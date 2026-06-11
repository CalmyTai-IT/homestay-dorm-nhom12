// saleUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockSaleData.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export function groupSaleBookings(bookings) {
  return {
    pending: bookings.filter(b => ['pending_confirm', 'checking'].includes(b.status)),
    scheduled: bookings.filter(b => b.status === 'viewing_scheduled'),
    viewed: bookings.filter(b => b.status === 'viewed'),
    processed: bookings.filter(b => ['deposit_created', 'rejected'].includes(b.status)),
  }
}

// Label + màu cho từng trạng thái

export const SALE_STATUS_CONFIG = {
  pending_confirm: { label: 'Chờ tiếp nhận', color: 'bg-gold-light text-gold' },
  checking: { label: 'Đang kiểm tra', color: 'bg-terracotta-100 text-terracotta-600' },
  viewing_scheduled: { label: 'Đã hẹn xem', color: 'bg-mint-light text-mint-dark' },
  viewed: { label: 'Đã xem phòng', color: 'bg-mint-light text-mint-dark' },
  deposit_created: { label: 'Đã lập phiếu cọc', color: 'bg-mint-light text-mint-dark' },
  rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-600' },
}

// Khung giờ xem phòng để NV chọn khi sắp xếp lịch

export const VIEWING_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

// ============== PHIẾU ĐẶT CỌC ==============

// Trạng thái phiếu đặt cọc

export const DEPOSIT_SLIP_CONFIG = {
  awaiting_payment: { label: 'Chờ thanh toán', color: 'bg-gold-light text-gold' },
  paid: { label: 'Đã thanh toán', color: 'bg-terracotta-100 text-terracotta-600' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-mint-light text-mint-dark' },
  expired: { label: 'Quá hạn', color: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Đã hủy', color: 'bg-cream-dark text-ink-soft' },
}

// Phiếu cọc mẫu (đã lập từ trước)

export function calculatePriority(booking) {
  const now = Date.now()

  // 1. Thời gian chờ (kể từ lúc gửi đơn)
  const hoursWaiting = (now - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60)
  let waitScore, waitLabel
  if (hoursWaiting > 4) { waitScore = 3; waitLabel = `Chờ ${Math.floor(hoursWaiting)}h` }
  else if (hoursWaiting >= 1) { waitScore = 2; waitLabel = `Chờ ${Math.floor(hoursWaiting)}h` }
  else { waitScore = 1; waitLabel = 'Mới gửi' }

  // 2. Ngày vào ở gần kề
  const daysUntilMoveIn = (new Date(booking.moveInDate).getTime() - now) / (1000 * 60 * 60 * 24)
  let moveInScore, moveInLabel
  if (daysUntilMoveIn <= 7) { moveInScore = 3; moveInLabel = 'Vào ở ≤7 ngày' }
  else if (daysUntilMoveIn <= 30) { moveInScore = 2; moveInLabel = 'Vào ở ≤30 ngày' }
  else { moveInScore = 1; moveInLabel = 'Vào ở >30 ngày' }

  // 3. Giá trị đơn (theo hình thức + số giường)
  let valueScore, valueLabel
  if (booking.rentType === 'whole_room' || booking.numberOfBeds >= 4) { valueScore = 3; valueLabel = 'Giá trị cao' }
  else if (booking.numberOfBeds >= 2) { valueScore = 2; valueLabel = 'Giá trị TB' }
  else { valueScore = 1; valueLabel = 'Giá trị thấp' }

  // 4. Quy mô nhóm
  let groupScore, groupLabel
  if (booking.hasGroup) { groupScore = 2; groupLabel = 'Thuê nhóm' }
  else { groupScore = 1; groupLabel = 'Cá nhân' }

  // Tính tổng điểm có trọng số
  const total = (waitScore * 3) + (moveInScore * 2) + (valueScore * 2) + (groupScore * 1)

  // Quy ra mức
  let level
  if (total >= 18) level = 'high'
  else if (total >= 12) level = 'normal'
  else level = 'low'

  return {
    level,
    total,
    breakdown: [
      { label: waitLabel, points: waitScore, weight: 3, subtotal: waitScore * 3 },
      { label: moveInLabel, points: moveInScore, weight: 2, subtotal: moveInScore * 2 },
      { label: valueLabel, points: valueScore, weight: 2, subtotal: valueScore * 2 },
      { label: groupLabel, points: groupScore, weight: 1, subtotal: groupScore * 1 },
    ],
  }
}

// Config hiển thị cho từng mức ưu tiên

export const PRIORITY_CONFIG = {
  high: { label: 'Ưu tiên cao', dot: 'bg-red-500', badge: 'bg-red-100 text-red-600' },
  normal: { label: 'Bình thường', dot: 'bg-gold', badge: 'bg-gold-light text-gold' },
  low: { label: 'Thấp', dot: 'bg-cream-dark', badge: 'bg-cream-dark text-ink-soft' },
}

// ============== TIẾP NHẬN YÊU CẦU TRẢ PHÒNG (NV SALE) ==============
// Khi khách gọi báo muốn trả phòng, Sale ghi nhận và chuyển sang Quản lý

// Tạo yêu cầu trả phòng → lưu vào mockManagerData (checkouts)
