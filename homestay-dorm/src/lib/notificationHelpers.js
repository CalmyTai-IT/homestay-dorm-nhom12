// notificationHelpers.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockNotifications.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  if (days === 1) return 'Hôm qua'
  if (days < 7) return `${days} ngày trước`
  return date.toLocaleDateString('vi-VN')
}
