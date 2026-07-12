import { withTransaction } from '../config/db.js'
import * as groups from '../repositories/groupRepo.js'
import * as deposits from '../repositories/depositRepo.js'
import * as rooms from '../repositories/roomRepo.js'
import * as bookings from '../repositories/bookingRepo.js'
import { cancelDeposit } from './depositService.js'
import { getConfig } from './configService.js'
import * as notify from './notifyService.js'
import { notFound, badRequest, conflict } from '../utils/errors.js'

const GENDER_VN = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }

function shapeMembers(rows) {
  return rows.map(m => ({
    khachHangId: m.khach_hang_id,
    hoTen: m.ho_ten,
    gioiTinh: GENDER_VN[m.gioi_tinh] || m.gioi_tinh || '',
    soGiayTo: m.so_giay_to || '',
    soDienThoai: m.so_dien_thoai || '',
    isDaiDien: m.is_dai_dien,
    datDieuKien: m.dat_dieu_kien,   // null = chưa kiểm tra | true = đạt | false = không đạt
  }))
}

// Danh sách người ở của 1 phiếu cọc — để Quản lý kiểm tra điều kiện lưu trú trước khi lập HĐ.
// Cọc thuê cá nhân (không nhóm) -> { hasGroup: false }.
export async function membersForDeposit(depositCode) {
  const slip = await deposits.byCode(depositCode)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  // Thuê CÁ NHÂN (không nhóm): trả thông tin người thuê + kết quả kiểm tra điều kiện đã lưu (nếu có).
  if (!slip.nhom_thue_id) return {
    hasGroup: false,
    individual: {
      khachHangId: slip.khach_hang_id,
      hoTen: slip.ho_ten,
      soGiayTo: slip.so_giay_to || '',
      soDienThoai: slip.so_dien_thoai || '',
    },
    residencyCheck: slip.dk_tieu_chi?.residencyCheck || null,
    members: [],
  }
  const rows = await groups.membersOf(slip.nhom_thue_id)
  return { hasGroup: true, nhomThueId: slip.nhom_thue_id, soGiuong: Number(slip.so_giuong || 0), members: shapeMembers(rows) }
}

// UC nghiệp vụ "Kiểm tra điều kiện lưu trú" (cho khách CÁ NHÂN — mục 3.1.3 của đề):
//  Quản lý ghi nhận khách ĐẠT / KHÔNG ĐẠT điều kiện lưu trú trước khi lập hợp đồng.
//  - datDieuKien = true  -> lưu kết quả đạt; cho phép lập hợp đồng.
//  - datDieuKien = false (hoặc decision='reject') -> Quản lý TỪ CHỐI ký:
//        huỷ cọc -> Kế toán hoàn 80% (dùng lại luồng hoàn cọc chưa ký có sẵn).
export async function checkIndividual(depositCode, dto, managerId) {
  const slip = await deposits.byCode(depositCode)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (slip.nhom_thue_id) throw conflict('Phiếu cọc này là thuê theo nhóm (dùng kiểm tra theo nhóm)')
  if (slip.trang_thai !== 'da_thanh_toan') throw conflict('Cọc chưa được chốt')
  if (slip.has_contract) throw conflict('Phiếu cọc đã có hợp đồng')

  const passed = dto.datDieuKien !== false && dto.decision !== 'reject'
  // Ghi kết quả kiểm tra vào tieu_chi của phiếu đăng ký (giữ nhất quán với cách lưu trạng thái nghiệp vụ khác)
  if (slip.dk_ma_phieu)
    await bookings.patchTieuChi(null, slip.dk_ma_phieu, {
      residencyCheck: { passed, note: dto.lyDo || null, checkedBy: managerId, checkedAt: new Date().toISOString() },
    })

  if (!passed) {
    // Không đủ điều kiện -> Quản lý từ chối ký -> huỷ cọc -> Kế toán hoàn 80%.
    await cancelDeposit(
      depositCode,
      dto.lyDo || 'Khách không đủ điều kiện lưu trú (Quản lý từ chối ký hợp đồng)',
      managerId)
    return { decision: 'rejected', passed: false, refundRate: 80 }
  }
  return { decision: 'passed', passed: true }
}

// UC nghiệp vụ "Kiểm tra điều kiện lưu trú" (cho nhóm thuê):
//  - Lưu kết quả đạt/không đạt từng người (nhom_thue_thanh_vien.dat_dieu_kien).
//  - decision = 'continue' (a): ký tiếp với các thành viên ĐỦ điều kiện
//       (đại diện BẮT BUỘC đủ điều kiện; phải còn ≥1 người đủ điều kiện).
//  - decision = 'cancel'   (b): nhóm không ký -> hủy cọc -> Kế toán hoàn 80% (luồng có sẵn).
export async function checkAndDecide(depositCode, dto, managerId) {
  const slip = await deposits.byCode(depositCode)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (!slip.nhom_thue_id) throw conflict('Phiếu cọc này không phải thuê theo nhóm')
  if (slip.trang_thai !== 'da_thanh_toan') throw conflict('Cọc chưa được chốt')
  if (slip.has_contract) throw conflict('Phiếu cọc đã có hợp đồng')

  const eligibility = Array.isArray(dto.eligibility) ? dto.eligibility : []
  if (!eligibility.length) throw badRequest('Thiếu kết quả kiểm tra điều kiện thành viên')

  // Ghi nhận kết quả kiểm tra từng người
  await withTransaction(async (c) => {
    for (const e of eligibility)
      await groups.setEligibility(c, slip.nhom_thue_id, e.khachHangId, !!e.datDieuKien)
  })

  if (dto.decision === 'cancel') {
    // (b) Không ký -> hủy cọc. Cọc đã nhận tiền nên rơi vào hàng đợi "Hoàn cọc 80%" của Kế toán.
    await cancelDeposit(
      depositCode,
      dto.lyDo || 'Nhóm không ký hợp đồng (thành viên không đủ điều kiện lưu trú / khách dừng thuê)',
      managerId)
    return { decision: 'cancelled', refundRate: 80 }
  }

  // (a) Tiếp tục ký
  const members = await groups.membersOf(slip.nhom_thue_id)
  const rep = members.find(m => m.is_dai_dien)
  if (rep && rep.dat_dieu_kien === false)
    throw conflict('Người đại diện không đủ điều kiện lưu trú — không thể tiếp tục ký. Hãy hủy thuê (hoàn 80%).')
  const eligible = members.filter(m => m.dat_dieu_kien !== false)
  if (eligible.length < 1)
    throw conflict('Không còn thành viên nào đủ điều kiện — vui lòng hủy thuê (hoàn 80%).')

  // GIẢM GIƯỜNG/CỌC: nếu có người không đủ điều kiện -> trả giường thừa về trống,
  // giảm tiền cọc về đúng số người ở, và đẩy phần cọc dư vào hàng đợi để Kế toán hoàn (80%).
  const excludedCount = members.length - eligible.length
  let partialRefund = null
  if (excludedCount > 0) partialRefund = await reduceBedsToEligible(slip, eligible.length, managerId)

  return {
    decision: 'continue',
    eligibleCount: eligible.length,
    excludedCount,
    total: members.length,
    partialRefund,   // { beds, amount, rate, newCoc } | null
  }
}

// Giảm phiếu cọc xuống còn `keep` giường (số người đủ điều kiện): giải phóng giường thừa,
// cập nhật lại tiền cọc, và GHI NHẬN khoản hoàn cọc dư cho Kế toán xử lý (tách vai trò).
async function reduceBedsToEligible(slip, keep, managerId) {
  const allBeds = await deposits.bedsOf(slip.id)            // N giường đang giữ
  keep = Math.max(1, Math.min(keep, allBeds.length))        // đại diện luôn giữ ≥1 giường
  const release = allBeds.slice(keep)                       // (N-keep) giường thừa
  if (release.length === 0) return null

  const oldCoc = Number(slip.so_tien_coc)
  const newCoc = Math.round(oldCoc * keep / allBeds.length) // = giá×số_tháng×keep
  const reduction = oldCoc - newCoc                         // cọc của các giường bị loại
  const oldThucNhan = Number(slip.so_tien_thuc_nhan ?? oldCoc)
  const genuineOverpay = Math.max(0, oldThucNhan - oldCoc)  // giữ lại phần khách lỡ nộp dư (đối trừ tiền thuê)
  const newThucNhan = newCoc + genuineOverpay

  const cfg = await getConfig(slip.chi_nhanh_id)
  const rate = Number(cfg.ty_le_hoan_chua_ky)              // 80% (cọc chưa ký HĐ)
  const refund = Math.round(reduction * rate / 100)

  await withTransaction(async (c) => {
    await rooms.setBedStatus(c, release, 'trong')           // trả giường về pool
    await deposits.removeBeds(c, slip.id, release)          // gỡ khỏi phiếu cọc
    await deposits.setAmounts(c, slip.ma_phieu, newCoc, newThucNhan)
    // Ghi nhận khoản hoàn cọc dư vào đơn (tieu_chi.partialRefund) -> hàng đợi của Kế toán
    if (slip.dk_ma_phieu)
      await bookings.patchTieuChi(c, slip.dk_ma_phieu, {
        partialRefund: {
          status: 'pending', amount: refund, rate, reduction,
          beds: release.length, newCoc,
          requestedBy: managerId, requestedAt: new Date().toISOString(),
        },
      })
  })

  notify.toRole('accountant', {
    tieuDe: 'Hoàn cọc giảm giường (nhóm)',
    noiDung: `Cọc ${slip.ma_phieu} giảm ${release.length} giường do thành viên không đủ điều kiện. Vui lòng hoàn ${refund.toLocaleString('vi-VN')}đ (${rate}%) cho khách.`,
    loai: 'hoan_coc', url: '/staff/accountant/refunds', doUuTien: 'high',
  })
  notify.toCustomer(slip.khach_hang_id, {
    tieuDe: 'Điều chỉnh hợp đồng nhóm',
    noiDung: `Hợp đồng nhóm được lập với ${keep} giường (giảm ${release.length} giường do thành viên không đủ điều kiện). Phần cọc dư ${refund.toLocaleString('vi-VN')}đ sẽ được hoàn.`,
    loai: 'hoan_coc',
  })
  return { beds: release.length, amount: refund, rate, newCoc }
}