import { withTransaction, query } from '../config/db.js'
import * as bookings from '../repositories/bookingRepo.js'
import * as deposits from '../repositories/depositRepo.js'
import * as rooms from '../repositories/roomRepo.js'
import * as users from '../repositories/userRepo.js'
import * as groups from '../repositories/groupRepo.js'
import * as payments from '../repositories/paymentRepo.js'
import * as notify from './notifyService.js'
import * as viewing from './viewingService.js'
import { getConfig } from './configService.js'
import { bookingCode } from '../utils/codes.js'
import { notFound, badRequest, forbidden, conflict } from '../utils/errors.js'

// UC-HT-03: khách hàng lập phiếu đăng ký thuê
export async function createBooking(dto, khachHangId) {
  if (!dto.tieuChi) throw badRequest('Thiếu tiêu chí thuê')
  // Lấy phòng để (1) kiểm tra ràng buộc giới tính, (2) suy chi nhánh cho đơn.
  // Mã phòng giờ trùng được giữa các chi nhánh nên ưu tiên id số (roomDbId); chỉ fallback mã khi thiếu.
  const room = dto.tieuChi?.roomDbId != null
    ? await rooms.findById(dto.tieuChi.roomDbId)
    : (dto.tieuChi?.roomId ? await rooms.roomByCode(dto.tieuChi.roomId) : null)

  // RÀNG BUỘC GIỚI TÍNH: phòng dành cho 'nam'/'nu' thì giới tính khách (lấy từ DB, không tin client)
  // phải khớp. Phòng 'khong_quy_dinh' (Hỗn hợp) thì ai cũng đăng ký được.
  if (room && room.gioi_tinh_ap_dung && room.gioi_tinh_ap_dung !== 'khong_quy_dinh') {
    const kh = await users.findCustomerById(khachHangId)
    const VN = { nam: 'nam', nu: 'nữ' }
    if (!kh?.gioi_tinh)
      throw badRequest(`Phòng này chỉ dành cho khách ${VN[room.gioi_tinh_ap_dung] || room.gioi_tinh_ap_dung}. Vui lòng cập nhật giới tính trong hồ sơ trước khi đăng ký.`)
    if (kh.gioi_tinh !== room.gioi_tinh_ap_dung)
      throw badRequest(`Phòng này chỉ dành cho khách ${VN[room.gioi_tinh_ap_dung] || room.gioi_tinh_ap_dung} — không phù hợp với giới tính của bạn.`)
  }

  let chiNhanhId = dto.chiNhanhId ?? null
  if (chiNhanhId == null && room) chiNhanhId = room.chi_nhanh_id

  const tc = dto.tieuChi
  const isGroup = !!tc?.hasGroup && Array.isArray(tc.groupMembers) && tc.groupMembers.length > 0
  const memberGender = (g) => g === 'Nam' ? 'nam' : g === 'Nữ' ? 'nu' : null

  // RÀNG BUỘC GIỚI TÍNH TỪNG THÀNH VIÊN NHÓM: phòng dành riêng nam/nữ thì MỌI thành viên
  // (không chỉ người đăng ký) phải đúng giới tính. Nhóm có cả nam và nữ -> phải chọn phòng
  // hỗn hợp (khong_quy_dinh). Chặn ngay tại đây để không tạo đơn với dữ liệu nhóm không hợp lệ.
  if (isGroup && room?.gioi_tinh_ap_dung && room.gioi_tinh_ap_dung !== 'khong_quy_dinh') {
    const VN = { nam: 'nam', nu: 'nữ' }
    const need = room.gioi_tinh_ap_dung
    const khongHopLe = tc.groupMembers.filter(m => m?.name && memberGender(m.gender) !== need)
    if (khongHopLe.length) {
      const ds = khongHopLe
        .map(m => `${m.name}${m.gender ? ` (${m.gender})` : ' (chưa khai giới tính)'}`)
        .join(', ')
      throw badRequest(
        `Phòng này chỉ dành cho khách ${VN[need] || need}, nên mọi thành viên trong nhóm phải là ${VN[need] || need}. ` +
        `Thành viên không phù hợp: ${ds}. Nếu nhóm có cả nam và nữ, vui lòng chọn phòng hỗn hợp.`)
    }
  }

  // RÀNG BUỘC PHÒNG & SỨC CHỨA (đề mục 3.1.1: đối chiếu sức chứa phòng theo số người dự kiến).
  // Chỉ áp dụng khi đơn gắn với một phòng cụ thể (đăng ký theo phòng).
  if (room) {
    if (room.trang_thai && room.trang_thai !== 'hoat_dong')
      throw badRequest('Phòng hiện không nhận đăng ký (đang bảo trì hoặc ngừng hoạt động).')
    const capacity = Number(room.suc_chua || 0)
    if (capacity > 0) {
      // Thuê nguyên phòng => số giường = sức chứa; ở ghép => số giường khách chọn.
      const soGiuong = tc.rentType === 'whole_room' ? capacity : Number(tc.numberOfBeds || 1)
      const soNguoi = Number(tc.numberOfPeople || (isGroup ? tc.groupMembers.length + 1 : soGiuong))
      if (soGiuong < 1) throw badRequest('Số giường thuê không hợp lệ.')
      if (tc.rentType !== 'whole_room' && soGiuong > capacity)
        throw badRequest(`Số giường đăng ký (${soGiuong}) vượt sức chứa phòng (${capacity} giường).`)
      if (soNguoi > capacity)
        throw badRequest(`Số người dự kiến (${soNguoi}) vượt sức chứa phòng (${capacity} người).`)
      if (tc.rentType !== 'whole_room' && soNguoi > soGiuong)
        throw badRequest(`Số người ở (${soNguoi}) không được vượt số giường thuê (${soGiuong}).`)
    }
  }

  return withTransaction(async (c) => {
    let nhomThueId = dto.nhomThueId || null

    // THUÊ THEO NHÓM: tạo nhom_thue + nhom_thue_thanh_vien thật (đại diện = chủ tài khoản đứng đơn).
    // Mỗi thành viên khai báo trở thành 1 hồ sơ "người ở" (khach_hang không tài khoản) gắn vào nhóm.
    // Điều kiện lưu trú từng người sẽ do Quản lý kiểm tra ở bước lập hợp đồng (dat_dieu_kien).
    if (isGroup) {
      const grp = await groups.insertGroup(c, {
        tenNhom: tc.groupName || null,
        daiDienId: khachHangId,
        soNguoiDuKien: Number(tc.numberOfBeds) || (tc.groupMembers.length + 1),
      })
      nhomThueId = grp.id
      // Đại diện cũng là một người ở trong nhóm
      await groups.addMember(c, grp.id, khachHangId, null)
      for (const m of tc.groupMembers) {
        if (!m?.name) continue
        const res = await users.createResident(c, {
          hoTen: m.name,
          gioiTinh: memberGender(m.gender),
          soGiayTo: m.idNumber || null,
          soDienThoai: m.phone || null,
        })
        await groups.addMember(c, grp.id, res.id, null)
      }
    }

    return bookings.insert(c, {
      maPhieu: bookingCode(), khachHangId, nhomThueId,
      saleId: dto.saleId, chiNhanhId,
      tieuChi: JSON.stringify(dto.tieuChi), ngayVaoO: dto.ngayVaoO,
      thoiHan: dto.thoiHan, ghiChu: dto.ghiChu, trangThai: 'cho_xem_phong',
    })
  })
}
export const listBookings = (status, chiNhanhId = null) => bookings.list(status, chiNhanhId)
export const myBookings = (khachHangId) => bookings.byCustomer(khachHangId)
export async function getBooking(code) {
  const b = await bookings.byCode(code); if (!b) throw notFound('Không tìm thấy phiếu đăng ký'); return b
}
// Sale: cập nhật trạng thái (đã lên lịch xem / đã xem phòng)
export async function setStatus(code, status, extra, saleId = null) {
  const ok = ['cho_xem_phong','dang_xu_ly','da_hen_xem','da_xem_phong','da_dat_coc','huy']
  if (!ok.includes(status)) throw badRequest('Trạng thái không hợp lệ')
  const b = await bookings.byCode(code)
  if (!b) throw notFound('Không tìm thấy phiếu đăng ký')

  // LỊCH XEM PHÒNG giờ là thực thể riêng (bảng lich_xem_phong) -> uỷ thác cho viewingService.
  // Vẫn nhận được lệnh setStatus cũ để tương thích ngược (frontend cũ / tích hợp khác).
  if (status === 'da_hen_xem' && extra?.scheduledViewing)
    return viewing.schedule(code, extra.scheduledViewing, saleId)
  if (status === 'da_xem_phong')
    return viewing.markViewed(code)

  // Từ chối/hủy đơn (sale/quản lý/kế toán): ngoài đổi trạng thái, phải TRẢ LẠI giường
  // đang giữ chỗ cho đơn này (nếu đã có phiếu cọc giữ giường) để phòng còn trống cho khách khác,
  // đồng thời huỷ lịch xem phòng còn hiệu lực (nếu có).
  if (status === 'huy') {
    const lyDo = extra?.rejectReason || extra?.lyDo || 'Nhân viên từ chối đơn'
    const dep = await deposits.activeByBooking(b.id)
    return withTransaction(async (c) => {
      await bookings.cancelTx(c, code, lyDo)
      await viewing.cancelForBooking(c, b.id)
      if (dep) {
        await deposits.updateStatus(c, dep.ma_phieu, 'da_huy', lyDo)
        const bedIds = await deposits.bedsOf(dep.id)
        if (bedIds.length) await rooms.setBedStatus(c, bedIds, 'trong')
      }
      return { ok: true, code, status }
    })
  }

  await bookings.updateStatusExtra(code, status, extra)
  return { ok: true, code, status }
}

// Khách hàng tự hủy phiếu đăng ký của chính mình (trước khi ký hợp đồng).
// - Kiểm tra quyền sở hữu (chỉ chủ đơn mới được hủy).
// - Nếu đã có hợp đồng đang hiệu lực/đã thanh lý → không cho tự hủy (phải đi quy trình trả phòng).
// - Nếu có phiếu cọc còn hiệu lực → hủy cọc + giải phóng giường. Cọc đã thanh toán thì
//   ghi nhận mức hoàn 80% (kế toán xử lý hoàn tiền sau — theo quy định hủy trước khi ký).
export async function cancelByCustomer(code, khachHangId, lyDo = 'Khách hủy đơn') {
  const b = await bookings.byCode(code)
  if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (String(b.khach_hang_id) !== String(khachHangId)) throw forbidden('Bạn không có quyền hủy đơn này')
  if (b.trang_thai === 'huy') return { ok: true, code, status: 'huy', refundRate: 0 }

  const dep = await deposits.activeByBooking(b.id)
  if (dep) {
    const hd = (await query(
      `select trang_thai from hop_dong_thue where phieu_dat_coc_id=$1 order by created_at desc limit 1`,
      [dep.id])).rows[0]
    if (hd && (hd.trang_thai === 'dang_hieu_luc' || hd.trang_thai === 'da_thanh_ly'))
      throw conflict('Đơn đã ký hợp đồng — không thể tự hủy. Vui lòng dùng quy trình trả phòng.')
  }

  // A5: đơn đã nhận tiền cọc (cho_duyet/da_thanh_toan) KHÔNG cho khách tự hủy trực tiếp.
  // Phải đi đúng quy trình: Sale lập yêu cầu hủy -> Quản lý duyệt -> Kế toán hoàn 80%.
  if (dep && (dep.trang_thai === 'cho_duyet' || dep.trang_thai === 'da_thanh_toan'))
    throw conflict('Đơn đã đặt cọc — không thể tự hủy trực tiếp. Vui lòng liên hệ nhân viên để được hoàn cọc 80% theo quy định.')

  return withTransaction(async (c) => {
    await bookings.cancelTx(c, code, lyDo)
    let refundRate = 0
    if (dep) {
      await deposits.updateStatus(c, dep.ma_phieu, 'da_huy', lyDo)
      const bedIds = await deposits.bedsOf(dep.id)
      if (bedIds.length) await rooms.setBedStatus(c, bedIds, 'trong')
      if (dep.trang_thai === 'da_thanh_toan') refundRate = 80 // hoàn 80% (kế toán xử lý)
    }
    return { ok: true, code, status: 'huy', refundRate }
  })
}

// ===================== LUỒNG HỦY ĐƠN ĐÃ CỌC (CHƯA KÝ HĐ) =====================
// Sale lập yêu cầu -> Quản lý duyệt -> Kế toán hoàn 80% (theo cấu hình ty_le_hoan_chua_ky).
// Tiến trình lưu trong tieu_chi.cancelStage: pending_manager -> pending_accountant -> done.

// Lấy phiếu cọc ĐÃ THANH TOÁN và xác nhận đơn CHƯA ký hợp đồng
async function paidDepositNoContract(b) {
  const dep = await deposits.activeByBooking(b.id)
  if (!dep || dep.trang_thai !== 'da_thanh_toan')
    throw conflict('Chỉ áp dụng cho đơn đã đặt cọc thành công (chưa hoàn tất hủy)')
  const hd = (await query(
    `select trang_thai from hop_dong_thue where phieu_dat_coc_id=$1 order by created_at desc limit 1`, [dep.id])).rows[0]
  if (hd) throw conflict('Đơn đã có hợp đồng — vui lòng dùng quy trình trả phòng')
  return dep
}

// Sale lập yêu cầu hủy cho đơn đã cọc
export async function requestCancelDeposit(code, saleId, lyDo) {
  const b = await bookings.byCode(code); if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (b.tieu_chi?.cancelStage) throw conflict('Đơn này đã có yêu cầu hủy đang xử lý')
  await paidDepositNoContract(b)
  await bookings.patchTieuChi(null, code, {
    cancelStage: 'pending_manager',
    cancelReason: lyDo || 'Khách yêu cầu hủy (qua Sale)',
    cancelRequestedBy: saleId, cancelRequestedAt: new Date().toISOString(),
  })
  notify.toRole('manager', {
    tieuDe: 'Yêu cầu hủy đơn đã cọc',
    noiDung: `Sale đã lập yêu cầu hủy đơn ${code} (đã đặt cọc). Vui lòng duyệt.`,
    loai: 'huy_coc', url: '/staff/manager/deposits', doUuTien: 'high',
  })
  return { ok: true, code, cancelStage: 'pending_manager' }
}

// Quản lý duyệt / từ chối yêu cầu hủy
export async function approveCancelDeposit(code, managerId, approve = true) {
  const b = await bookings.byCode(code); if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (b.tieu_chi?.cancelStage !== 'pending_manager') throw conflict('Yêu cầu hủy không ở trạng thái chờ duyệt')
  if (!approve) {
    // Từ chối: gỡ tiến trình hủy, đơn trở lại bình thường
    await bookings.patchTieuChi(null, code, { cancelStage: null, cancelRejectedBy: managerId, cancelRejectedAt: new Date().toISOString() })
    notify.toRole('sale', { tieuDe: 'Yêu cầu hủy bị từ chối', noiDung: `Quản lý đã từ chối yêu cầu hủy đơn ${code}.`, loai: 'huy_coc', url: '/staff/sale/deposits' })
    return { ok: true, code, cancelStage: null }
  }
  await bookings.patchTieuChi(null, code, { cancelStage: 'pending_accountant', cancelApprovedBy: managerId, cancelApprovedAt: new Date().toISOString() })
  notify.toRole('accountant', {
    tieuDe: 'Hủy cọc chờ hoàn tiền',
    noiDung: `Quản lý đã duyệt hủy đơn ${code}. Vui lòng hoàn cọc cho khách.`,
    loai: 'huy_coc', url: '/staff/accountant/refunds', doUuTien: 'high',
  })
  return { ok: true, code, cancelStage: 'pending_accountant' }
}

// Kế toán hoàn cọc (80%) -> hoàn tất hủy
export async function refundCancelDeposit(code, keToanId) {
  const b = await bookings.byCode(code); if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (b.tieu_chi?.cancelStage !== 'pending_accountant') throw conflict('Yêu cầu hủy chưa được Quản lý duyệt')
  const dep = await paidDepositNoContract(b)
  const cfg = await getConfig(dep.chi_nhanh_id)
  const tyLe = Number(cfg.ty_le_hoan_chua_ky)        // 80%
  const tienCoc = Number(dep.so_tien_coc)
  const hoan = Math.round(tienCoc * tyLe / 100)
  const out = await withTransaction(async (c) => {
    // hoàn cọc (giao dịch), hủy cọc, giải phóng giường
    const gd = await payments.insert(c, {
      loai: 'hoan_coc', soTien: hoan, hinhThuc: 'chuyen_khoan', keToanId,
      phieuDatCocId: dep.id, ghiChu: `Hoàn ${tyLe}% cọc do hủy đơn ${code}`,
    })
    await deposits.updateStatus(c, dep.ma_phieu, 'da_huy', b.tieu_chi?.cancelReason || 'Hủy đơn (hoàn cọc)')
    const bedIds = await deposits.bedsOf(dep.id)
    if (bedIds.length) await rooms.setBedStatus(c, bedIds, 'trong')
    await bookings.completeCancel(c, code, {
      cancelStage: 'done', cancelRefundedBy: keToanId, cancelRefundedAt: new Date().toISOString(),
      cancelRefundRate: tyLe, cancelRefundAmount: hoan,
    })
    return { soTienHoan: hoan, tyLe, giaoDich: gd }
  })
  notify.toCustomer(b.khach_hang_id, {
    tieuDe: 'Đã hoàn cọc & hủy đơn',
    noiDung: `Đơn ${code} đã được hủy. Bạn được hoàn ${tyLe}% tiền cọc (${hoan.toLocaleString('vi-VN')}đ).`,
    loai: 'huy_coc', url: '/my-bookings',
  })
  return { ok: true, code, ...out }
}

export const listCancelRequests = (stage, chiNhanhId = null) => bookings.listByCancelStage(stage, chiNhanhId)

// Suy ra trạng thái tổng hợp (UI) từ phiếu ĐK + cọc + hợp đồng
function deriveUiStatus(r) {
  if (r.dk_trang_thai === 'huy') return 'cancelled'
  if (r.ma_hop_dong && r.hd_trang_thai === 'da_thanh_ly') return 'returned'   // đã trả phòng / thanh lý xong
  if (r.ma_hop_dong && r.hd_trang_thai === 'dang_hieu_luc') return 'contracted'
  if (r.coc_trang_thai === 'da_thanh_toan') return 'deposited'
  if (r.coc_trang_thai === 'cho_thanh_toan') return 'awaiting_deposit'
  if (r.dk_trang_thai === 'da_xem_phong' || r.dk_trang_thai === 'da_hen_xem') return 'viewing_scheduled'
  return 'pending_confirm'
}

// Yêu cầu trả phòng đang xử lý (chưa hoàn tất) → dùng để hiện badge "Đang chờ trả phòng"
function isCheckoutPending(r) {
  return !!r.tra_ma && ['cho_kiem_tra', 'cho_doi_soat', 'cho_thanh_ly'].includes(r.tra_trang_thai)
}

export async function myBookingsFull(khachHangId) {
  const rows = await bookings.fullByCustomer(khachHangId)
  return rows.map(r => ({
    ma_phieu: r.ma_phieu,
    tieu_chi: r.tieu_chi,
    viewing: r.viewing || null,   // lịch xem phòng lấy từ bảng lich_xem_phong
    created_at: r.created_at,
    ngay_du_kien_vao_o: r.ngay_du_kien_vao_o,
    thoi_han_thue: r.thoi_han_thue,
    ui_status: deriveUiStatus(r),
    checkout_pending: isCheckoutPending(r),
    checkout: r.tra_ma ? {
      ma_phieu: r.tra_ma, trang_thai: r.tra_trang_thai, ngay_dang_ky: r.tra_ngay,
    } : null,
    deposit: r.coc_ma ? {
      ma_phieu: r.coc_ma, trang_thai: r.coc_trang_thai,
      so_tien_coc: r.so_tien_coc, han_thanh_toan: r.han_thanh_toan,
    } : null,
    contract: r.ma_hop_dong ? {
      ma_hop_dong: r.ma_hop_dong, trang_thai: r.hd_trang_thai,
      ngay_bat_dau: r.ngay_bat_dau, ngay_ket_thuc: r.ngay_ket_thuc,
    } : null,
  }))
}