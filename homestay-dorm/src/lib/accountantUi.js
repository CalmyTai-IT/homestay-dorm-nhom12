// accountantUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockAccountantData.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Chờ đối soát', color: 'bg-gold-light text-gold' },
  confirmed: { label: 'Khớp đủ', color: 'bg-mint-light text-mint-dark' },
  underpaid: { label: 'Thiếu - chờ bù', color: 'bg-terracotta-100 text-terracotta-600' },
  overpaid: { label: 'Dư - chờ hoàn', color: 'bg-gold-light text-gold' },
  not_found: { label: 'Không tìm thấy', color: 'bg-red-100 text-red-600' },
}

export const PAYMENT_TYPES = {
  deposit: 'Đặt cọc',
  first_rent: 'Tiền thuê kỳ đầu',
  monthly_rent: 'Tiền thuê hàng tháng',
  extra_fee: 'Phụ phí',
}

// Giao dịch chờ kế toán đối soát

export function reconcilePayment(expectedAmount, receivedAmount) {
  const diff = receivedAmount - expectedAmount
  if (diff === 0) {
    return { status: 'confirmed', diff: 0, message: 'Số tiền khớp đủ' }
  }
  if (diff < 0) {
    return {
      status: 'underpaid',
      diff,
      shortfall: Math.abs(diff),       // Số tiền còn thiếu
      message: `Khách chuyển thiếu ${Math.abs(diff).toLocaleString('vi-VN')}đ`,
    }
  }
  return {
    status: 'overpaid',
    diff,
    excess: diff,                      // Số tiền dư
    message: `Khách chuyển dư ${diff.toLocaleString('vi-VN')}đ`,
  }
}

// ============== HOÀN CỌC ==============

export const REFUND_STATUS_CONFIG = {
  pending: { label: 'Chờ xử lý', color: 'bg-gold-light text-gold' },
  calculated: { label: 'Đã đối soát', color: 'bg-terracotta-100 text-terracotta-600' },
  completed: { label: 'Đã hoàn tiền', color: 'bg-mint-light text-mint-dark' },
}

// Tỷ lệ hoàn cọc cơ bản theo nghiệp vụ

export const REFUND_RATE_RULES = [
  { key: 'not_contracted', label: 'Chưa ký hợp đồng (chỉ mới đặt cọc)', rate: 80 },
  { key: 'under_6m', label: 'Đã ký HĐ, lưu trú dưới 6 tháng', rate: 50 },
  { key: 'over_6m', label: 'Đã ký HĐ, lưu trú trên 6 tháng', rate: 70 },
  { key: 'expired', label: 'Hết hạn thuê theo hợp đồng', rate: 100 },
]

// Yêu cầu hoàn cọc (khi khách trả phòng) — chuyển từ Quản lý sang

export function calculateRefund(depositAmount, rateKey, deductions = []) {
  const rule = REFUND_RATE_RULES.find(r => r.key === rateKey)
  const rate = rule?.rate || 0
  const baseRefund = Math.floor(depositAmount * rate / 100)
  const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0)
  const finalRefund = baseRefund - totalDeduction

  return {
    rate,
    baseRefund,           // Hoàn cơ bản
    totalDeduction,       // Tổng khấu trừ
    finalRefund,          // Hoàn thực tế (có thể âm = khách phải nộp thêm)
    customerOwes: finalRefund < 0 ? Math.abs(finalRefund) : 0,  // Khách nợ thêm
    actualRefund: finalRefund > 0 ? finalRefund : 0,             // Thực hoàn
  }
}

// Tạo yêu cầu hoàn cọc mới (gọi từ Manager khi kiểm tra xong checkout)
