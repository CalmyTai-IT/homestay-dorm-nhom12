// bookingUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockBookings.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export const CONTACT_TIME_SLOTS = [
  { value: 'morning',   label: 'Buổi sáng',  desc: '8:00 — 12:00', icon: '🌅' },
  { value: 'afternoon', label: 'Buổi chiều', desc: '13:00 — 17:00', icon: '☀️' },
  { value: 'evening',   label: 'Buổi tối',   desc: '18:00 — 20:00', icon: '🌙' },
  { value: 'anytime',   label: 'Bất kỳ lúc nào', desc: 'Trong giờ hành chính', icon: '⏰' },
]

// Phương thức liên lạc ưa thích

export const CONTACT_METHODS = [
  { value: 'phone', label: 'Gọi điện', icon: '📞' },
  { value: 'sms',   label: 'Tin nhắn SMS', icon: '💬' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'zalo',  label: 'Zalo', icon: '💚' },
]
// Thời hạn thuê

export const DURATION_OPTIONS = [
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng (1 năm)' },
  { value: 18, label: '18 tháng' },
  { value: 24, label: '24 tháng (2 năm)' },
]

// Tiêu chí ưu tiên (theo file PDF)

export function groupBookingsByTab(bookings) {
  return {
    processing: bookings.filter(b =>
      ['pending_confirm', 'viewing_scheduled', 'awaiting_deposit'].includes(b.status)
    ),
    deposited: bookings.filter(b => b.status === 'deposited'),
    contracted: bookings.filter(b => b.status === 'contracted'),
    returned: bookings.filter(b => b.status === 'returned'),
    cancelled: bookings.filter(b => b.status === 'cancelled'),
  }
}

// Tính progress % theo trạng thái (cho timeline)

export const STATUS_PROGRESS = {
  pending_confirm: 20,
  viewing_scheduled: 40,
  awaiting_deposit: 60,
  deposited: 80,
  contracted: 100,
  returned: 100,
  cancelled: 0,
}
