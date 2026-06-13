// roomUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockRooms.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export const BRANCHES = ['Quận 5', 'Quận 10', 'Thủ Đức']

// Nhãn khu vực rút gọn để hiển thị: bỏ tiền tố "HomeStay Dorm" khỏi tên chi nhánh
// (vd "HomeStay Dorm Quận 5" -> "Quận 5"). Giá trị lọc vẫn dùng tên đầy đủ để khớp dữ liệu.
export const branchLabel = (name) =>
  (name || '').replace(/^HomeStay\s*Dorm\s*/i, '').trim() || name

export const RENT_TYPES = ['Thuê giường (ghép)', 'Thuê nguyên phòng']

export const CAPACITIES = [2, 4, 6]

export const GENDERS = ['Nam', 'Nữ', 'Hỗn hợp']

export const PRICE_RANGES = [
  { label: 'Dưới 2 triệu', min: 0, max: 2000000 },
  { label: '2 - 3 triệu', min: 2000000, max: 3000000 },
  { label: 'Trên 3 triệu', min: 3000000, max: Infinity },
]

export const AMENITIES = ['Điều hòa', 'Gửi xe', 'Wifi', 'Tủ riêng', 'Bếp riêng', 'Máy giặt', 'Ban công']

// 12 phòng mẫu phủ đủ các trường hợp

export const RENTAL_RULES = [
  'Tiền cọc = Tiền thuê 2 tháng × Số giường thuê',
  'Thanh toán cọc trong 24h sau khi đặt, nếu không sẽ tự hủy',
  'Hợp đồng tối thiểu 6 tháng',
  'Cấm hút thuốc, nuôi thú cưng trong phòng',
  'Giờ giới nghiêm: 23:00 — 05:00',
  'Phải xuất trình CCCD/Passport khi nhận phòng',
]

// Tỷ lệ hoàn cọc (theo nghiệp vụ trong PDF)

export const REFUND_RATES = [
  { condition: 'Chưa ký hợp đồng (chỉ mới đặt cọc)', rate: '80%' },
  { condition: 'Đã ký HĐ, lưu trú dưới 6 tháng', rate: '50%' },
  { condition: 'Đã ký HĐ, lưu trú trên 6 tháng', rate: '70%' },
  { condition: 'Hết hạn thuê theo hợp đồng', rate: '100%' },
]

// Helper: tìm phòng theo id

export const ROOM_STATUS_CONFIG = {
  available: { label: 'Sẵn sàng', color: 'bg-mint-light text-mint-dark' },
  partially: { label: 'Còn 1 phần', color: 'bg-gold-light text-gold' },
  full: { label: 'Đã đầy', color: 'bg-terracotta-100 text-terracotta-600' },
  maintenance: { label: 'Bảo trì', color: 'bg-red-100 text-red-600' },
}

// Tính trạng thái phòng dựa trên số giường còn trống

export function getRoomStatus(room) {
  if (room.maintenance) return 'maintenance'
  if (room.bedsAvailable === 0) return 'full'
  if (room.bedsAvailable === room.capacity) return 'available'
  return 'partially'
}

// Lấy danh sách phòng (có thể đã chỉnh sửa qua quản lý)