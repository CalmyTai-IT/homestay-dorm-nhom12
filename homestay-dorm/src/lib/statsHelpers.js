// statsHelpers.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockStats.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export function formatMoney(amount) {
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)} tỷ`
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(0)}tr`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`
  return amount.toString()
}

// Helper: format thời gian "x phút/giờ trước"

export function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  if (mins < 60) return `${mins} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}
