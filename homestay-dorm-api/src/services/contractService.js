import { withTransaction } from '../config/db.js'
import * as contracts from '../repositories/contractRepo.js'
import * as deposits from '../repositories/depositRepo.js'
import * as rooms from '../repositories/roomRepo.js'
import * as groups from '../repositories/groupRepo.js'
import * as bookings from '../repositories/bookingRepo.js'
import * as payments from '../repositories/paymentRepo.js'
import * as notify from './notifyService.js'
import { getConfig } from './configService.js'
import { contractCode } from '../utils/codes.js'
import { notFound, badRequest, conflict } from '../utils/errors.js'

// Cọc đã thanh toán nhưng chưa có hợp đồng
export async function depositsReadyForContract() {
  const paid = await deposits.list('da_thanh_toan')
  const existing = await contracts.list()
  const usedDepositIds = new Set(existing.map(c => c.phieu_dat_coc_id))
  // Loại cọc đang trong luồng hủy (tieu_chi.cancelStage) — tránh lập/ký HĐ cho đơn sắp hủy (B1)
  return paid.filter(d => !usedDepositIds.has(d.id) && !(d.dk_tieu_chi && d.dk_tieu_chi.cancelStage))
}
// UC-HT-07: Quản lý lập hợp đồng từ cọc
export async function createContract(dto, _managerId) {
  const slip = await deposits.byCode(dto.depositCode)
  if (!slip) throw notFound('Không tìm thấy phiếu cọc')
  if (slip.trang_thai !== 'da_thanh_toan') throw conflict('Cọc chưa được thanh toán')
  if (await contracts.existsByDeposit(slip.id)) throw conflict('Phiếu cọc này đã có hợp đồng')
  // Nhóm thuê: nếu đã kiểm tra điều kiện mà NGƯỜI ĐẠI DIỆN không đạt -> không cho lập HĐ
  // (phải hủy thuê & hoàn 80%, hoặc đổi đại diện).
  if (slip.nhom_thue_id) {
    const members = await groups.membersOf(slip.nhom_thue_id)
    const rep = members.find(m => m.is_dai_dien)
    if (rep && rep.dat_dieu_kien === false)
      throw conflict('Người đại diện không đủ điều kiện lưu trú — không thể lập hợp đồng cho nhóm này.')
  } else if (slip.dk_tieu_chi?.residencyCheck?.passed === false) {
    // Thuê cá nhân: Quản lý đã đánh dấu KHÔNG đủ điều kiện lưu trú -> từ chối lập HĐ (đề mục 3.1.3).
    throw conflict('Khách không đủ điều kiện lưu trú — không thể lập hợp đồng. Hãy từ chối ký và hoàn cọc 80%.')
  }
  if (!dto.ngayBatDau || !dto.thoiHan) throw badRequest('Thiếu ngày bắt đầu hoặc thời hạn')
  const start = new Date(dto.ngayBatDau)
  const end = new Date(start); end.setMonth(end.getMonth() + Number(dto.thoiHan))
  // tiền thuê/tháng = tiền cọc / SỐ THÁNG CỌC (cấu hình so_thang_coc, mặc định 2) — KHÔNG hardcode /2
  const cfg = await getConfig(slip.chi_nhanh_id)
  const soThangCoc = Number(cfg.so_thang_coc) || 2
  const giaThueThang = Math.round(Number(slip.so_tien_coc) / soThangCoc)
  return withTransaction(async (c) => {
    const ct = await contracts.insert(c, {
      maHopDong: contractCode(), phieuDatCocId: slip.id, khachHangId: slip.khach_hang_id,
      nhomThueId: slip.nhom_thue_id, chiNhanhId: slip.chi_nhanh_id,
      ngayBatDau: start.toISOString().slice(0,10), ngayKetThuc: end.toISOString().slice(0,10),
      giaThueThang,
    })
    const bedIds = await deposits.bedsOf(slip.id)
    await contracts.addBeds(c, ct.id, bedIds.map(id => ({ id, gia: Math.round(giaThueThang/bedIds.length) })))
    return ct
  })
}
export const listContracts = (status, chiNhanhId = null) => contracts.list(status, chiNhanhId)

// UC-HT-08 (rút gọn): ký hợp đồng + bàn giao → giường 'dang_thue', thu tiền thuê kỳ đầu
export async function signContract(code, keToanId) {
  const ct = await contracts.byCode(code)
  if (!ct) throw notFound('Không tìm thấy hợp đồng')
  if (ct.trang_thai !== 'cho_ky') throw conflict('Hợp đồng không ở trạng thái chờ ký (có thể đã ký hoặc đã thanh lý)')
  return withTransaction(async (c) => {
    const bedIds = await contracts.bedsOf(ct.id)
    await rooms.setBedStatus(c, bedIds, 'dang_thue')
    await contracts.sign(c, code)   // -> dang_hieu_luc + ghi ngay_ky (lịch sử ký)
    await contracts.addHandover(c, ct.id, keToanId)
    // Đối trừ khoản cọc DƯ (nếu có) vào tiền thuê kỳ đầu
    let firstRent = Number(ct.gia_thue_thang)
    let excessNote = ''
    if (ct.phieu_dat_coc_id) {
      const slip = await deposits.byId(ct.phieu_dat_coc_id)
      const excess = slip?.so_tien_thuc_nhan
        ? Math.max(0, Number(slip.so_tien_thuc_nhan) - Number(slip.so_tien_coc)) : 0
      if (excess > 0) {
        firstRent = Math.max(0, firstRent - excess)
        excessNote = ` (đã đối trừ ${excess.toLocaleString('vi-VN')}đ cọc dư)`
      }
    }
    const gd = await payments.insert(c, {
      loai: 'thu_tien_thue', soTien: firstRent, hinhThuc: 'chuyen_khoan',
      keToanId, hopDongId: ct.id, ghiChu: `Thu tiền thuê kỳ đầu ${code}${excessNote}`,
    })
    // Thông báo khách: hợp đồng đã ký, phòng đã thuê
    notify.toCustomer(ct.khach_hang_id, {
      tieuDe: 'Hợp đồng đã ký — phòng đã thuê',
      noiDung: `Hợp đồng ${code} đã ký kết và có hiệu lực. Phòng của bạn đã chính thức được thuê.`,
      loai: 'hop_dong_ky', url: '/my-bookings',
    })
    return { contract: ct, giaoDich: gd }
  })
}