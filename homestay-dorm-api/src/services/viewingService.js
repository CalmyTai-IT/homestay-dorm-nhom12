import { withTransaction } from '../config/db.js'
import * as viewings from '../repositories/viewingRepo.js'
import * as bookings from '../repositories/bookingRepo.js'
import { notFound, badRequest, conflict } from '../utils/errors.js'

// ============================================================================
//  viewingService — Nghiệp vụ LỊCH XEM PHÒNG (mục 3.1.1 của đề)
//  Tách khỏi bookingService để ánh xạ rõ 2 use-case của Sale:
//    - Sắp xếp / dời lịch xem phòng   (schedule)
//    - Đánh dấu đã dẫn khách xem phòng (markViewed)
//  Nguồn dữ liệu chuẩn = bảng lich_xem_phong; trạng thái phiếu đăng ký
//  (da_hen_xem / da_xem_phong) được đồng bộ theo lịch.
// ============================================================================

// Sale sắp xếp (hoặc dời) lịch xem phòng cho một phiếu đăng ký.
export async function schedule(code, dto, saleId = null) {
  if (!dto || !dto.date || !dto.time) throw badRequest('Thiếu ngày hoặc giờ hẹn xem phòng')
  const b = await bookings.byCode(code)
  if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (b.trang_thai === 'huy') throw conflict('Đơn đã huỷ, không thể lên lịch xem phòng')
  if (b.trang_thai === 'da_dat_coc') throw conflict('Đơn đã đặt cọc, không cần lịch xem phòng')

  const existing = await viewings.activeByBooking(b.id)
  return withTransaction(async (c) => {
    // Đã có lịch hiệu lực -> DỜI lịch; chưa có -> tạo mới
    const row = existing
      ? await viewings.reschedule(c, existing.id, { date: dto.date, time: dto.time, saleId, ghiChu: dto.ghiChu })
      : await viewings.insert(c, { phieuDangKyId: b.id, saleId, date: dto.date, time: dto.time, ghiChu: dto.ghiChu })
    await bookings.updateStatus(c, code, 'da_hen_xem')
    return row
  })
}

// Sale đánh dấu ĐÃ dẫn khách đi xem phòng.
export async function markViewed(code) {
  const b = await bookings.byCode(code)
  if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  if (!['da_hen_xem', 'dang_xu_ly', 'cho_xem_phong'].includes(b.trang_thai))
    throw conflict('Đơn không ở trạng thái có thể đánh dấu đã xem phòng')
  return withTransaction(async (c) => {
    await viewings.markViewedByBooking(c, b.id)
    await bookings.updateStatus(c, code, 'da_xem_phong')
    return { ok: true, code, status: 'da_xem_phong' }
  })
}

// Huỷ lịch xem phòng còn hiệu lực (dùng khi đơn bị huỷ/từ chối) — chạy trong transaction cha.
export const cancelForBooking = (client, bookingId) => viewings.cancelByBooking(client, bookingId)

// Lịch sử xem phòng của một phiếu đăng ký.
export async function listByBooking(code) {
  const b = await bookings.byCode(code)
  if (!b) throw notFound('Không tìm thấy phiếu đăng ký')
  return viewings.listByBooking(b.id)
}