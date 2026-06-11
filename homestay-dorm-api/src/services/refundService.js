import { withTransaction } from '../config/db.js'
import * as checkouts from '../repositories/checkoutRepo.js'
import * as contracts from '../repositories/contractRepo.js'
import * as rooms from '../repositories/roomRepo.js'
import * as deposits from '../repositories/depositRepo.js'
import * as payments from '../repositories/paymentRepo.js'
import { getConfig } from './configService.js'
import * as notify from './notifyService.js'
import { checkoutCode } from '../utils/codes.js'
import { notFound, conflict, forbidden } from '../utils/errors.js'

// UC-HT-09 (khách tự khởi tạo): khách đang thuê yêu cầu TRẢ PHÒNG SỚM / hủy thuê.
// Tạo phiếu trả phòng (cho_kiem_tra) -> chảy vào trang Trả phòng của Quản lý + Hoàn cọc của Kế toán.
// Mức hoàn cọc (50%/70%/100%) do Kế toán quyết định theo thời gian lưu trú thực tế khi đối soát.
export async function registerCheckoutByCustomer(contractCode, khachHangId, lyDo) {
  const ct = await contracts.byCode(contractCode)
  if (!ct) throw notFound('Không tìm thấy hợp đồng')
  if (String(ct.khach_hang_id) !== String(khachHangId)) throw forbidden('Bạn không có quyền trả phòng cho hợp đồng này')
  if (ct.trang_thai !== 'dang_hieu_luc') throw conflict('Hợp đồng không ở trạng thái đang hiệu lực')
  // Tránh tạo trùng: nếu đã có phiếu trả phòng chưa hoàn tất cho HĐ này thì trả về phiếu đó
  const existing = (await checkouts.list()).find(t => t.ma_hop_dong === contractCode && t.trang_thai !== 'hoan_tat')
  if (existing) return existing
  const out = await withTransaction(c => checkouts.insert(c, {
    maPhieu: checkoutCode(), hopDongId: ct.id, saleId: null,
    ngayTraDuKien: null, lyDo: lyDo || 'Khách yêu cầu trả phòng sớm',
  }))
  notify.toCustomer(khachHangId, {
    tieuDe: 'Đã gửi yêu cầu trả phòng',
    noiDung: `Yêu cầu trả phòng cho hợp đồng ${contractCode} đã được ghi nhận. Quản lý sẽ kiểm tra hiện trạng phòng và kế toán sẽ đối soát hoàn cọc.`,
    loai: 'tra_phong', url: '/my-bookings',
  })
  notify.toRole('manager', {
    tieuDe: 'Yêu cầu trả phòng mới',
    noiDung: `Khách đã yêu cầu trả phòng hợp đồng ${contractCode}. Vui lòng kiểm tra hiện trạng phòng.`,
    loai: 'tra_phong', url: '/staff/manager/checkouts', doUuTien: 'high',
  })
  return out
}

// UC-HT-09: Sale đăng ký trả phòng
export async function registerCheckout(dto, saleId) {
  const ct = await contracts.byCode(dto.contractCode)
  if (!ct) throw notFound('Không tìm thấy hợp đồng')
  // C1: chỉ trả phòng cho HĐ đang hiệu lực
  if (ct.trang_thai !== 'dang_hieu_luc') throw conflict('Hợp đồng không ở trạng thái đang hiệu lực')
  // C1: tránh tạo trùng — nếu đã có phiếu trả phòng chưa hoàn tất cho HĐ này thì trả về phiếu đó
  const existing = (await checkouts.list()).find(t => t.ma_hop_dong === dto.contractCode && t.trang_thai !== 'hoan_tat')
  if (existing) return existing
  return withTransaction(c => checkouts.insert(c, {
    maPhieu: checkoutCode(), hopDongId: ct.id, saleId, ngayTraDuKien: dto.ngayTraDuKien, lyDo: dto.lyDo,
  }))
}
// UC-HT-10: Quản lý kiểm tra hiện trạng
export async function inspect(code, dto, nvId) {
  const t = await checkouts.byCode(code); if (!t) throw notFound('Không tìm thấy phiếu trả phòng')
  if (t.trang_thai !== 'cho_kiem_tra') throw conflict('Phiếu không ở bước chờ kiểm tra (có thể đã kiểm tra hoặc đã xử lý)')
  return withTransaction(async (c) => {
    await checkouts.addInspection(c, t.id, nvId, dto.ketQua ? JSON.stringify(dto.ketQua) : null, dto.veSinh)
    await checkouts.setStatus(c, code, 'cho_doi_soat')
    return { ...t, trang_thai: 'cho_doi_soat' }
  })
}
// UC-HT-11: Kế toán đối soát & tính hoàn cọc
function refundRate(cfg, daKyHopDong, soThangLuuTru, hetHan) {
  if (!daKyHopDong) return Number(cfg.ty_le_hoan_chua_ky)        // 80%
  if (hetHan) return Number(cfg.ty_le_hoan_het_han)              // 100%
  return soThangLuuTru >= 6 ? Number(cfg.ty_le_hoan_ky_tren_6m)  // 70%
                            : Number(cfg.ty_le_hoan_ky_duoi_6m)  // 50%
}
export async function reconcile(code, dto, keToanId) {
  const t = await checkouts.byCode(code); if (!t) throw notFound('Không tìm thấy phiếu trả phòng')
  if (t.trang_thai !== 'cho_doi_soat') throw conflict('Phiếu chưa ở bước đối soát (cần Quản lý kiểm tra phòng trước) hoặc đã thanh lý')
  const ct = await contracts.byCode(t.ma_hop_dong)
  const slip = ct.phieu_dat_coc_id
    ? (await deposits.list()).find(d => d.id === ct.phieu_dat_coc_id) : null
  const tienCoc = Number(slip?.so_tien_coc || dto.tienCoc || 0)
  const cfg = await getConfig(ct.chi_nhanh_id)
  // Số tháng lưu trú tính theo NGÀY KHÁCH RỜI ĐI (ngày trả thực tế nếu có, không thì ngày trả dự kiến
  // do Sale/khách chọn), KHÔNG dùng ngày hiện tại. Chỉ fallback now() khi phiếu không có ngày nào.
  const ngayRoiDi = t.ngay_tra_thuc_te || t.ngay_tra_du_kien || new Date()
  const months = dto.soThangLuuTru ??
    Math.max(0, Math.round((new Date(ngayRoiDi) - new Date(ct.ngay_bat_dau)) / (30*24*3600*1000)))
  // Ưu tiên tỷ lệ kế toán chọn tay (UI); nếu không có thì tự suy theo thời gian lưu trú
  const tyLe = dto.tyLe != null ? Number(dto.tyLe) : refundRate(cfg, true, months, !!dto.hetHan)
  const hoanCoBan = Math.round(tienCoc * tyLe / 100)
  const deductions = dto.khoanKhauTru || []
  const tongKhauTru = deductions.reduce((s, d) => s + Number(d.soTien || 0), 0)
  const hoanThuc = hoanCoBan - tongKhauTru
  return withTransaction(async (c) => {
    const bds = await checkouts.addReconcile(c, {
      ptpId: t.id, keToanId, tyLe, tienCoc, hoanCoBan, tongKhauTru, hoanThuc,
    })
    for (const d of deductions) await checkouts.addDeduction(c, bds.id, d)
    await checkouts.setStatus(c, code, 'cho_thanh_ly')
    return bds
  })
}
// UC-HT-12: Thanh lý hợp đồng + hoàn cọc
export async function settle(code, keToanId) {
  const t = await checkouts.byCode(code); if (!t) throw notFound('Không tìm thấy phiếu trả phòng')
  if (t.trang_thai !== 'cho_thanh_ly') throw conflict('Phiếu chưa ở bước thanh lý (cần đối soát trước) hoặc đã hoàn tất')
  const bds = (await import('../config/db.js')).query
  const row = (await (await import('../config/db.js')).query(
    'select * from bang_doi_soat where phieu_tra_phong_id=$1 order by id desc limit 1', [t.id])).rows[0]
  if (!row) throw conflict('Chưa có bảng đối soát, hãy đối soát trước')
  const ct = await contracts.byCode(t.ma_hop_dong)
  return withTransaction(async (c) => {
    const bedIds = await contracts.bedsOf(ct.id)
    await rooms.setBedStatus(c, bedIds, 'trong')
    await contracts.setStatus(c, ct.ma_hop_dong, 'da_thanh_ly')
    await checkouts.setStatus(c, code, 'hoan_tat')
    const hoan = Number(row.so_tien_hoan_thuc_te)
    const gd = await payments.insert(c, {
      loai: hoan >= 0 ? 'hoan_coc' : 'thu_chenh_lech', soTien: Math.abs(hoan),
      hinhThuc: 'chuyen_khoan', keToanId, bangDoiSoatId: row.id,
      ghiChu: hoan >= 0 ? `Hoàn cọc ${code}` : `Thu chênh lệch ${code}`,
    })
    return { soTienHoan: hoan, giaoDich: gd }
  })
}
export const listCheckouts = (status, chiNhanhId = null) => checkouts.list(status, chiNhanhId)
