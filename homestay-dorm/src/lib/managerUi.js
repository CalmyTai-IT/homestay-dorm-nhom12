// managerUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockManagerData.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export const MANAGER_DEPOSIT_STATUS_CONFIG = {
  pending_manager: { label: 'Chờ QL xác nhận', color: 'bg-gold-light text-gold' },
  confirmed: { label: 'Đã chốt cọc', color: 'bg-mint-light text-mint-dark' },
  returned_to_accountant: { label: 'Trả về kế toán', color: 'bg-terracotta-100 text-terracotta-600' },
  rejected: { label: 'Từ chối - chờ hoàn cọc', color: 'bg-red-100 text-red-600' },
}

export const CONTRACT_STATUS_CONFIG = {
  draft: { label: 'Chờ ký', color: 'bg-gold-light text-gold' },
  signed: { label: 'Đã ký - chờ bàn giao', color: 'bg-terracotta-100 text-terracotta-600' },
  active: { label: 'Đang hiệu lực', color: 'bg-mint-light text-mint-dark' },
  ended: { label: 'Đã kết thúc', color: 'bg-cream-dark text-ink-soft' },
}

export const STANDARD_HANDOVER_ITEMS = [
  { key: 'bed', label: 'Giường + đệm', defaultQty: 1 },
  { key: 'wardrobe', label: 'Tủ quần áo', defaultQty: 1 },
  { key: 'desk', label: 'Bàn học/làm việc', defaultQty: 1 },
  { key: 'chair', label: 'Ghế', defaultQty: 1 },
  { key: 'ac', label: 'Điều hòa', defaultQty: 1 },
  { key: 'fan', label: 'Quạt', defaultQty: 1 },
  { key: 'light', label: 'Đèn chiếu sáng', defaultQty: 2 },
  { key: 'key', label: 'Chìa khóa phòng', defaultQty: 1 },
  { key: 'wifi_router', label: 'Bộ phát Wi-Fi (nếu có)', defaultQty: 0 },
]

export const ITEM_CONDITIONS = [
  { value: 'good', label: 'Tốt', color: 'bg-mint-light text-mint-dark' },
  { value: 'normal', label: 'Bình thường', color: 'bg-gold-light text-gold' },
  { value: 'damaged', label: 'Hư hỏng', color: 'bg-red-100 text-red-600' },
  { value: 'missing', label: 'Thiếu/mất', color: 'bg-red-100 text-red-600' },
]

// Lấy hợp đồng "đã ký" — chờ bàn giao

export const CHECKOUT_STATUS_CONFIG = {
  requested: { label: 'Chờ kiểm tra', color: 'bg-gold-light text-gold' },
  inspected: { label: 'Đã kiểm tra - chờ hoàn cọc', color: 'bg-terracotta-100 text-terracotta-600' },
  completed: { label: 'Hoàn tất', color: 'bg-mint-light text-mint-dark' },
}

// Đơn giá điện/nước (theo nghiệp vụ thực tế)

export function calculateStayDuration(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return months
}
