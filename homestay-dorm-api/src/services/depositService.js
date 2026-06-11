import { withTransaction } from '../config/db.js'
import * as deposits from '../repositories/depositRepo.js'
import * as rooms from '../repositories/roomRepo.js'
import * as bookings from '../repositories/bookingRepo.js'
import * as payments from '../repositories/paymentRepo.js'
import { getConfig } from './configService.js'
import * as notify from './notifyService.js'
import { depositCode } from '../utils/codes.js'
import { notFound, badRequest, conflict, forbidden } from '../utils/errors.js'

const fmtVnd = (n) => Number(n || 0).toLocaleString('vi-VN')

// Công thức đề: Tiền cọc = giá 1 giường × số tháng cọc × số giường
export function calculateDeposit(giaThueGiuong, soGiuong, soThangCoc = 2) {
  return Number(giaThueGiuong) * soThangCoc * Number(soGiuong)
}

// UC-HT-04: NV Sale lập phiếu đặt cọc (giữ giường, hạn 24h)
export async function createDeposit(dto, saleId) {
  // dto.roomId ưu tiên là id số của phòng; fallback theo mã phòng cho đơn cũ (khi mã còn duy nhất toàn hệ thống)
  let room = await rooms.findById(dto.roomId)
  if (!room) room = await rooms.roomByCode(dto.roomId)
  if (!room) throw notFound('Không tìm thấy phòng')
  const cfg = await getConfig(room.chi_nhanh_id)
  const soGiuong = dto.rentType === 'whole_room' ? room.suc_chua : Number(dto.numberOfBeds || 1)
  // Kế thừa nhóm thuê từ phiếu đăng ký (nếu khách đăng ký theo nhóm) -> cọc mang nhom_thue_id,
  // nhờ đó hợp đồng lập từ cọc cũng gắn đúng nhóm.
  let nhomThueId = dto.nhomThueId || null
  if (!nhomThueId && dto.bookingCode) {
    const bk = await bookings.byCode(dto.bookingCode)
    if (bk) nhomThueId = bk.nhom_thue_id || null
  }
  return withTransaction(async (c) => {
    // Giữ giường NGUYÊN TỬ ngay trong transaction (khóa hàng) — chống 2 phiếu cọc song song
    // cùng giành một giường. Nếu không đủ giường trống thì rollback (giường tự nhả về 'trong').
    const bedIds = await rooms.reserveBeds(c, room.id, soGiuong, 'giu_cho')
    if (bedIds.length < soGiuong) throw conflict('Phòng/giường không còn đủ chỗ trống')
    const soTienCoc = calculateDeposit(room.gia_thue_giuong, soGiuong, cfg.so_thang_coc)
    const han = new Date(Date.now() + cfg.han_thanh_toan_coc_gio * 3600 * 1000)
    const slip = await deposits.insert(c, {
      maPhieu: depositCode(), phieuDangKyId: dto.phieuDangKyId, khachHangId: dto.khachHangId,
      nhomThueId, chiNhanhId: room.chi_nhanh_id, saleId,
      soTienCoc, hanThanhToan: han,
    })
    await deposits.addBeds(c, slip.id, bedIds)
    if (dto.bookingCode) await bookings.updateStatus(c, dto.bookingCode, 'da_dat_coc')
    return { ...slip, soGiuong }
  })
}
// Tự HUỶ các phiếu cọc QUÁ HẠN thanh toán: giải phóng giường + thông báo.
// Chỉ áp dụng phiếu còn 'cho_thanh_toan' (chưa nộp tiền); phiếu 'cho_duyet' đã nhận tiền nên bỏ qua.
export async function sweepExpired() {
  const list = await deposits.expired()
  for (const slip of list) {
    try {
      await withTransaction(async (c) => {
        await deposits.updateStatus(c, slip.ma_phieu, 'da_huy', 'Quá hạn thanh toán cọc')
        const bedIds = await deposits.bedsOf(slip.id)
        if (bedIds.length) await rooms.setBedStatus(c, bedIds, 'trong')
      })
      notify.toCustomer(slip.khach_hang_id, {
        tieuDe: 'Phiếu cọc đã hết hạn',
        noiDung: `Phiếu cọc ${slip.ma_phieu} đã quá hạn thanh toán và bị huỷ. Giường giữ chỗ đã được giải phóng.`,
        loai: 'coc_qua_han', doUuTien: 'high',
      })
      if (slip.nhan_vien_sale_id) notify.toStaff(slip.nhan_vien_sale_id, {
        tieuDe: 'Phiếu cọc quá hạn bị huỷ',
        noiDung: `Phiếu cọc ${slip.ma_phieu} quá hạn, hệ thống đã tự huỷ và giải phóng giường.`,
        loai: 'coc_qua_han',
      })
    } catch { /* lỗi 1 phiếu thì bỏ qua, tiếp tục các phiếu khác */ }
  }
}

export async function listDeposits(status, chiNhanhId = null) {
  await sweepExpired()   // dọn phiếu quá hạn mỗi lần xem danh sách
  return deposits.list(status, chiNhanhId)
}

// Khách chọn nộp TIỀN MẶT -> đánh dấu hình thức (chờ khách đến nộp, Kế toán đối soát sau)
export async function chooseCash(code, khachHangId) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (String(slip.khach_hang_id) !== String(khachHangId)) throw forbidden('Bạn không có quyền với phiếu cọc này')
  await deposits.setMethod(code, 'tien_mat')
  return { ok: true, code }
}

// UC-HT-06 (bước 1): Kế toán đối soát số tiền cọc thực nhận
export async function reconcileDeposit(code, dto, keToanId) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (slip.trang_thai !== 'cho_thanh_toan') throw conflict('Phiếu không ở trạng thái chờ đối soát')
  if (new Date(slip.han_thanh_toan) < new Date()) throw conflict('Phiếu đã quá hạn 24h')
  const received = Number(dto.soTienThucNhan)
  if (!(received >= 0)) throw badRequest('Số tiền thực nhận không hợp lệ')
  const required = Number(slip.so_tien_coc)
  const diff = received - required

  if (diff < 0) {
    // THIẾU: giữ nguyên 'cho_thanh_toan', lưu số đã nhận (để Kế toán nhớ đối soát lại) + báo khách bổ sung
    await deposits.setReceived(code, received, keToanId)
    notify.toCustomer(slip.khach_hang_id, {
      tieuDe: 'Tiền cọc còn thiếu',
      noiDung: `Phiếu cọc ${code}: đã nhận ${fmtVnd(received)}đ, còn thiếu ${fmtVnd(-diff)}đ. Vui lòng chuyển bổ sung trước khi hết hạn.`,
      loai: 'coc_thieu', doUuTien: 'high',
    })
    return { result: 'insufficient', shortfall: -diff, received, required, code }
  }

  // ĐỦ hoặc DƯ: chuyển 'cho_duyet', lưu số thực nhận, báo Quản lý
  await deposits.markReviewed(code, received, keToanId)
  notify.toRole('manager', {
    tieuDe: 'Phiếu cọc chờ duyệt',
    noiDung: `Phiếu cọc ${code} đã được kế toán đối soát hợp lệ${diff > 0 ? ` (dư ${fmtVnd(diff)}đ)` : ''}. Vui lòng duyệt để chốt cọc.`,
    loai: 'coc_cho_duyet', url: '/staff/manager/deposits', doUuTien: 'high',
  })
  if (diff > 0) {
    notify.toCustomer(slip.khach_hang_id, {
      tieuDe: 'Cọc chuyển dư',
      noiDung: `Phiếu cọc ${code}: bạn chuyển dư ${fmtVnd(diff)}đ. Khoản dư sẽ được đối trừ vào tiền thuê kỳ đầu.`,
      loai: 'coc_du',
    })
  }
  return { result: diff > 0 ? 'excess' : 'sufficient', excess: diff, received, required, code }
}

// UC-HT-06 (bước 2): Quản lý chốt cọc (sau khi kế toán đối soát hợp lệ)
export async function confirmPayment(code, txn, nguoiChotId) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (slip.trang_thai !== 'cho_duyet') throw conflict('Phiếu chưa được kế toán đối soát hợp lệ (chưa ở trạng thái chờ duyệt)')
  return withTransaction(async (c) => {
    await deposits.updateStatus(c, code, 'da_thanh_toan', null, nguoiChotId)
    const bedIds = await deposits.bedsOf(slip.id)
    await rooms.setBedStatus(c, bedIds, 'dat_coc')
    // Hình thức: ưu tiên hình thức khách đã chọn, rồi suy theo chứng từ
    const hinhThuc = txn?.hinhThuc || slip.hinh_thuc || (slip.minh_chung_ck ? 'chuyen_khoan' : 'tien_mat')
    const gd = await payments.insert(c, {
      loai: 'thu_coc', soTien: slip.so_tien_coc, hinhThuc,
      keToanId: nguoiChotId, phieuDatCocId: slip.id, maGiaoDich: txn?.maGiaoDich, ghiChu: `Thu cọc ${code}`,
    })
    // Đặt cọc thành công -> báo khách + báo Sale phụ trách
    notify.toCustomer(slip.khach_hang_id, {
      tieuDe: 'Đặt cọc thành công',
      noiDung: `Phiếu cọc ${code} đã được xác nhận. Nhân viên sẽ liên hệ để thống nhất thời gian nhận phòng.`,
      loai: 'coc_thanh_cong',
    })
    if (slip.nhan_vien_sale_id) notify.toStaff(slip.nhan_vien_sale_id, {
      tieuDe: 'Cọc đã được chốt',
      noiDung: `Phiếu cọc ${code} đã chốt. Hãy thông báo khách và hẹn lịch nhận phòng.`,
      loai: 'coc_chot', url: '/staff/sale/deposits',
    })
    return { deposit: { ...slip, trang_thai: 'da_thanh_toan' }, giaoDich: gd }
  })
}

// Khách tải ảnh chứng từ chuyển khoản lên phiếu cọc của chính mình (để Kế toán đối soát)
// + (tùy chọn) lưu TK nhận hoàn tiền phòng khi đơn bị hủy/từ chối.
export async function attachProof(code, khachHangId, anh, taiKhoan = null) {
  if (!anh) throw badRequest('Thiếu ảnh chứng từ')
  if (anh.length > 4_000_000) throw badRequest('Ảnh quá lớn (tối đa ~3MB)')
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (String(slip.khach_hang_id) !== String(khachHangId)) throw forbidden('Bạn không có quyền với phiếu cọc này')
  await deposits.saveProof(code, anh)
  await deposits.setMethod(code, 'chuyen_khoan')
  if (taiKhoan && (taiKhoan.so || taiKhoan.nganHang || taiKhoan.chuTk))
    await deposits.saveRefundAccount(code, taiKhoan)
  return { ok: true, code }
}

// UC-HT-05: hủy cọc quá hạn / Quản lý từ chối (giải phóng giường)
// Nếu khách ĐÃ nộp tiền: KHÔNG hoàn ngay tại đây — phiếu chuyển thành "đã từ chối, chờ hoàn cọc"
// để KẾ TOÁN thực hiện hoàn (tách vai trò: Quản lý quyết định từ chối, Kế toán hoàn tiền).
export async function cancelDeposit(code, lyDo = 'Quá hạn 24h', nguoiId = null) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  return withTransaction(async (c) => {
    await deposits.updateStatus(c, code, 'da_huy', lyDo, nguoiId)
    const bedIds = await deposits.bedsOf(slip.id)
    if (bedIds.length) await rooms.setBedStatus(c, bedIds, 'trong')
    const daNhan = Number(slip.so_tien_thuc_nhan || 0)
    notify.toCustomer(slip.khach_hang_id, {
      tieuDe: 'Phiếu cọc bị hủy',
      noiDung: daNhan > 0
        ? `Phiếu cọc ${code} đã bị hủy${lyDo ? ` (${lyDo})` : ''}. Kế toán sẽ hoàn ${fmtVnd(daNhan)}đ cho bạn.`
        : `Phiếu cọc ${code} đã bị hủy${lyDo ? ` (${lyDo})` : ''}.`,
      loai: 'coc', doUuTien: 'high',
    })
    return { ...slip, trang_thai: 'da_huy', choHoanCoc: daNhan > 0 }
  })
}

// Danh sách cọc BỊ TỪ CHỐI đã nhận tiền & chưa hoàn — để Kế toán xử lý hoàn (UC-HT-05)
export async function listRejectedRefunds(chiNhanhId = null) {
  return deposits.listRejectedAwaitingRefund(chiNhanhId)
}

// Kế toán hoàn cọc cho phiếu bị từ chối (đã cọc, CHƯA ký HĐ): hoàn 80% theo quy định đề
export async function refundRejected(code, keToanId) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (slip.trang_thai !== 'da_huy') throw conflict('Phiếu chưa bị từ chối/hủy')
  const daNhan = Number(slip.so_tien_thuc_nhan || 0)
  if (daNhan <= 0) throw conflict('Phiếu chưa nhận tiền, không cần hoàn')
  if (await deposits.hasRefund(slip.id)) throw conflict('Phiếu này đã được hoàn cọc')
  // Đã cọc nhưng CHƯA ký HĐ (gồm cả bị từ chối do không đạt điều kiện) -> hoàn 80% (ty_le_hoan_chua_ky)
  const cfg = await getConfig(slip.chi_nhanh_id)
  const tyLe = Number(cfg.ty_le_hoan_chua_ky)
  const hoan = Math.round(Number(slip.so_tien_coc) * tyLe / 100)
  const hinhThuc = slip.hinh_thuc || (slip.minh_chung_ck ? 'chuyen_khoan' : 'tien_mat')
  return withTransaction(async (c) => {
    const gd = await payments.insert(c, {
      loai: 'hoan_coc', soTien: hoan, hinhThuc, keToanId, phieuDatCocId: slip.id,
      ghiChu: `Hoàn ${tyLe}% cọc do từ chối phiếu ${code}${slip.ly_do_huy ? ` — ${slip.ly_do_huy}` : ''}`,
    })
    notify.toCustomer(slip.khach_hang_id, {
      tieuDe: 'Đã hoàn tiền cọc',
      noiDung: `KTX đã hoàn ${fmtVnd(hoan)}đ (${tyLe}% tiền cọc, phiếu ${code}) qua ${hinhThuc === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt tại chi nhánh'}.`,
      loai: 'hoan_coc', doUuTien: 'high',
    })
    return { soTienHoan: hoan, tyLe, giaoDich: gd }
  })
}

// ===== THUÊ NHÓM — HOÀN CỌC GIẢM GIƯỜNG =====
// Khi Quản lý "tiếp tục ký" mà loại bớt người không đủ điều kiện, hệ thống đã giảm giường + cọc
// và ghi khoản hoàn cọc dư vào đơn (tieu_chi.partialRefund). KẾ TOÁN xử lý hoàn ở đây (tách vai trò).

// Hàng đợi: các phiếu cọc còn hiệu lực có khoản hoàn giảm giường đang chờ.
export async function listPartialRefunds(chiNhanhId = null) {
  return deposits.listPendingPartialRefunds(chiNhanhId)
}

// Kế toán thực hiện hoàn phần cọc dư do giảm giường.
export async function refundPartial(code, keToanId) {
  const slip = await deposits.byCode(code)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  const pr = slip.dk_tieu_chi?.partialRefund
  if (!pr || pr.status !== 'pending') throw conflict('Phiếu này không có khoản hoàn cọc giảm giường đang chờ')
  const hoan = Number(pr.amount || 0)
  if (hoan <= 0) throw conflict('Khoản hoàn không hợp lệ')
  const hinhThuc = slip.hinh_thuc || (slip.minh_chung_ck ? 'chuyen_khoan' : 'tien_mat')
  const out = await withTransaction(async (c) => {
    const gd = await payments.insert(c, {
      loai: 'hoan_coc', soTien: hoan, hinhThuc, keToanId, phieuDatCocId: slip.id,
      ghiChu: `Hoàn ${pr.rate}% cọc do giảm ${pr.beds} giường (nhóm) — phiếu ${code}`,
    })
    // đánh dấu đã hoàn (chống hoàn 2 lần)
    if (slip.dk_ma_phieu)
      await bookings.patchTieuChi(c, slip.dk_ma_phieu, {
        partialRefund: { ...pr, status: 'done', refundedBy: keToanId, refundedAt: new Date().toISOString() },
      })
    return gd
  })
  notify.toCustomer(slip.khach_hang_id, {
    tieuDe: 'Đã hoàn cọc giảm giường',
    noiDung: `KTX đã hoàn ${fmtVnd(hoan)}đ (${pr.rate}% phần cọc của ${pr.beds} giường giảm bớt) — phiếu ${code}.`,
    loai: 'hoan_coc', doUuTien: 'high',
  })
  return { soTienHoan: hoan, rate: pr.rate, beds: pr.beds, giaoDich: out }
}