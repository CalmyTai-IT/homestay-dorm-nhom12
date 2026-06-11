import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'

// Lý do hủy đơn — khách chọn 1 trong các option
const CANCEL_REASONS = [
  { value: 'found_other', label: 'Tìm được nơi ở khác phù hợp hơn' },
  { value: 'plan_changed', label: 'Thay đổi kế hoạch (chuyển trường, công ty...)' },
  { value: 'price', label: 'Giá không phù hợp ngân sách' },
  { value: 'criteria', label: 'Tiêu chí phòng không như mong muốn' },
  { value: 'personal', label: 'Thay đổi quyết định cá nhân' },
  { value: 'other', label: 'Lý do khác' },
]

// Cấu hình cảnh báo theo từng trạng thái khi hủy
const WARNING_CONFIG = {
  pending_confirm: {
    level: 'info',
    title: 'Hủy đơn đăng ký',
    desc: 'Đơn của bạn chưa được nhân viên xử lý, nên việc hủy không phát sinh chi phí.',
    confirmText: 'Xác nhận hủy đơn',
  },
  viewing_scheduled: {
    level: 'info',
    title: 'Hủy lịch xem phòng',
    desc: 'Lịch hẹn xem phòng sẽ bị hủy bỏ. Vui lòng cân nhắc trước khi tiếp tục.',
    confirmText: 'Xác nhận hủy lịch xem',
  },
  awaiting_deposit: {
    level: 'warning',
    title: 'Hủy yêu cầu thanh toán cọc',
    desc: 'Yêu cầu cọc sẽ bị hủy và phòng được giải phóng cho khách khác. Bạn vẫn có thể đăng ký lại sau.',
    confirmText: 'Xác nhận hủy',
  },
  deposited: {
    level: 'danger',
    title: 'Hủy thuê và yêu cầu hoàn cọc',
    desc: 'Bạn đã đặt cọc cho phòng này. Theo chính sách, khi hủy ở giai đoạn chưa ký hợp đồng, bạn sẽ được hoàn lại 80% tiền cọc đã đóng. 20% còn lại là phí hủy không hoàn lại.',
    confirmText: 'Tôi đồng ý và hủy thuê',
  },
  // Đã ký hợp đồng và đang ở → khách yêu cầu trả phòng sớm (UC-HT-09).
  // Mức hoàn cọc do kế toán quyết định sau khi kiểm tra phòng & đối soát:
  //   ký <6 tháng: 50% · ký ≥6 tháng: 70% · hết hạn hợp đồng: 100% tiền cọc.
  contracted: {
    level: 'danger',
    title: 'Trả phòng & thanh lý hợp đồng',
    desc: 'Bạn đang có hợp đồng thuê hiệu lực. Gửi yêu cầu trả phòng để bộ phận quản lý hẹn kiểm tra phòng và bàn giao. Mức hoàn cọc sẽ do kế toán xác định sau khi đối soát, theo thời gian thuê thực tế.',
    confirmText: 'Gửi yêu cầu trả phòng',
  },
}

// Các mốc hoàn cọc khi trả phòng (theo file đồ án) — hiển thị tham khảo cho khách.
const CHECKOUT_REFUND_TIERS = [
  { label: 'Thuê dưới 6 tháng', rate: '50%' },
  { label: 'Thuê từ 6 tháng trở lên', rate: '70%' },
  { label: 'Hết hạn hợp đồng', rate: '100%' },
]

export default function CancelBookingDialog({ booking, room, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const config = WARNING_CONFIG[booking.status] || WARNING_CONFIG.pending_confirm
  const isDanger = config.level === 'danger'
  // Trả phòng khi hợp đồng đang hiệu lực (khác với hủy lúc mới đặt cọc)
  const isCheckout = booking.status === 'contracted'
  // Chi tiết hoàn 80% chỉ áp dụng cho giai đoạn đã cọc nhưng CHƯA ký hợp đồng
  const showDepositRefund = isDanger && !isCheckout && booking.depositInfo
  const refundAmount = booking.depositInfo?.amount ? Math.floor(booking.depositInfo.amount * 0.8) : 0

  const canSubmit = reason && (reason !== 'other' || customReason.trim().length > 0) && (!isDanger || confirmed)

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)

    const finalReason = reason === 'other'
      ? customReason.trim()
      : CANCEL_REASONS.find(r => r.value === reason)?.label

    try {
      if (isCheckout) {
        // Hợp đồng đang hiệu lực → tạo phiếu trả phòng (UC-HT-09).
        // Đơn sẽ xuất hiện ở "Trả phòng" của Quản lý và "Hoàn cọc" của Kế toán.
        const contractCode = booking.contractInfo?.code
        if (!contractCode) throw new Error('Không tìm thấy mã hợp đồng để trả phòng.')
        await api.requestCheckout(contractCode, finalReason)
      } else {
        // Hủy đơn: backend đặt đơn về 'huy', giải phóng giường, đánh dấu hoàn 80% nếu đã cọc
        await api.cancelBooking(booking.code, finalReason)
      }
      setSubmitting(false)
      onCancelled?.(finalReason, isCheckout)
      onClose()
    } catch (err) {
      setSubmitting(false)
      alert(err.message || (isCheckout ? 'Không thể gửi yêu cầu trả phòng. Vui lòng thử lại.' : 'Không thể hủy đơn. Vui lòng thử lại.'))
    }
  }

  // Màu sắc theo level
  const levelColors = {
    info: { bg: 'bg-mint-light/40', border: 'border-mint/30', icon: 'text-mint-dark', Icon: Info },
    warning: { bg: 'bg-gold-light/40', border: 'border-gold/30', icon: 'text-gold', Icon: AlertCircle },
    danger: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', Icon: AlertTriangle },
  }
  const color = levelColors[config.level]
  const Icon = color.Icon

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-up p-4"
      onClick={onClose}
    >
      {/* Dialog */}
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 p-6 pb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color.bg}`}>
              <Icon className={`w-6 h-6 ${color.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl font-bold">{config.title}</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Đơn {booking.code} · Phòng {room.code}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="px-6 pb-6 overflow-y-auto custom-scrollbar">
          {/* Cảnh báo */}
          <div className={`p-4 rounded-xl border ${color.bg} ${color.border} mb-5`}>
            <p className="text-sm text-ink-soft leading-relaxed">
              {config.desc}
            </p>

            {/* Nếu là trường hợp đã cọc (chưa ký HĐ) → hiện chi tiết tiền hoàn 80% */}
            {showDepositRefund && (
              <div className="mt-4 pt-4 border-t border-red-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Tiền cọc đã đóng:</span>
                  <span className="font-semibold">{booking.depositInfo.amount.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Phí hủy (20%):</span>
                  <span className="font-semibold text-red-600">
                    −{Math.floor(booking.depositInfo.amount * 0.2).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-red-200">
                  <span className="font-display font-bold">Số tiền được hoàn:</span>
                  <span className="font-display font-bold text-mint-dark">
                    {refundAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <p className="text-[10px] text-ink-muted pt-1">
                  Kế toán sẽ liên hệ trong 3 ngày làm việc để xác nhận hình thức hoàn tiền.
                </p>
              </div>
            )}

            {/* Trả phòng khi đang thuê → hiện bảng mức hoàn cọc theo thời gian thuê */}
            {isCheckout && (
              <div className="mt-4 pt-4 border-t border-red-200 space-y-2 text-sm">
                <p className="text-xs font-semibold text-ink-soft">Mức hoàn cọc dự kiến (theo thời gian thuê):</p>
                {CHECKOUT_REFUND_TIERS.map(t => (
                  <div key={t.label} className="flex justify-between">
                    <span className="text-ink-soft">{t.label}</span>
                    <span className="font-semibold text-mint-dark">{t.rate} tiền cọc</span>
                  </div>
                ))}
                <p className="text-[10px] text-ink-muted pt-1">
                  Mức hoàn cuối cùng do kế toán xác định sau khi quản lý kiểm tra phòng và trừ các khoản phát sinh (nếu có).
                </p>
              </div>
            )}
          </div>

          {/* Chọn lý do */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3 block">
              Lý do hủy <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {CANCEL_REASONS.map(r => (
                <label
                  key={r.value}
                  className={`flex items-center gap-2.5 p-3 rounded-lg cursor-pointer border-[1.5px] transition ${
                    reason === r.value
                      ? 'border-terracotta-500 bg-terracotta-50'
                      : 'border-cream-dark hover:border-terracotta-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-terracotta-500"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>

            {/* Text area nếu chọn "Lý do khác" */}
            {reason === 'other' && (
              <textarea
                rows={3}
                placeholder="Vui lòng mô tả lý do hủy đơn..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="mt-3 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-terracotta-500 transition"
              />
            )}
          </div>

          {/* Checkbox xác nhận (chỉ khi đã đặt cọc) */}
          {isDanger && (
            <label className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="accent-red-500 w-4 h-4 mt-0.5"
              />
              <span className="text-xs text-ink-soft">
                {isCheckout ? (
                  <>Tôi xác nhận muốn <strong className="text-red-600">trả phòng và thanh lý hợp đồng</strong> trước hạn, và đồng ý mức hoàn cọc theo thời gian thuê thực tế sau khi kế toán đối soát.</>
                ) : (
                  <>Tôi xác nhận đã hiểu rằng việc hủy ở giai đoạn này sẽ làm tôi <strong className="text-red-600">mất 20% tiền cọc</strong> (
                  {Math.floor(booking.depositInfo?.amount * 0.2 || 0).toLocaleString('vi-VN')}đ
                  ) làm phí hủy, không thể hoàn lại.</>
                )}
              </span>
            </label>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-cream-dark flex gap-2 bg-warm-white">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={submitting}
          >
            Quay lại
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`flex-1 ${isDanger ? '!bg-red-500 hover:!bg-red-600' : ''}`}
          >
            {submitting ? 'Đang xử lý...' : config.confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}