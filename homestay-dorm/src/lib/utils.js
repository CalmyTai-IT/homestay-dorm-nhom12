import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Định dạng ngày-giờ an toàn: trả '—' nếu giá trị rỗng/không hợp lệ (tránh hiện "Invalid Date").
export function fmtDateTime(value, opts) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return opts ? d.toLocaleString('vi-VN', opts) : d.toLocaleString('vi-VN')
}

// Định dạng chỉ ngày an toàn.
export function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}
