import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { Banknote, Clock, AlertCircle, FileText, Home, CheckCircle2, Phone, Building2, Calendar } from 'lucide-react'

export default function CashPaymentNoticePage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  // Đồng hồ đếm ngược tới deadline đóng tiền mặt
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.bookingDetail(code)
      .then(({ booking, room }) => { if (alive) { setBooking(booking); setRoom(room) } })
      .catch(() => { if (alive) { setBooking(null); setRoom(null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [code])

  useEffect(() => {
    if (!booking?.depositInfo?.deadline) return
    const updateTimer = () => {
      const deadline = new Date(booking.depositInfo.deadline).getTime()
      const diff = deadline - Date.now()
      if (diff <= 0) {
        setTimeLeft({ expired: true })
        return
      }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft({ hours, minutes, expired: false })
    }
    updateTimer()
    const interval = setInterval(updateTimer, 60000) // cập nhật mỗi phút
    return () => clearInterval(interval)
  }, [booking])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-sm text-ink-soft">Đang tải thông tin…</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl font-bold mb-2">Không tìm thấy đơn</h1>
        <Button onClick={() => navigate('/my-bookings')}>Quay lại danh sách</Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-fade-up">
      <Card className="p-10 text-center shadow-xl">
        {/* Icon — Banknote thay vì CheckCircle vì chưa hoàn tất giao dịch */}
        <div className="w-20 h-20 bg-gold-light rounded-full flex items-center justify-center mx-auto mb-6">
          <Banknote className="w-10 h-10 text-gold" />
        </div>

        <h1 className="font-display text-3xl font-bold mb-3">
          Đã ghi nhận yêu cầu của bạn
        </h1>
        <p className="text-ink-soft mb-2">
          Cảm ơn bạn đã chọn hình thức thanh toán <span className="font-semibold text-ink">tiền mặt</span>.
        </p>
        <p className="text-ink-soft mb-8">
          Vui lòng đến chi nhánh để hoàn tất việc đóng cọc trong thời hạn quy định.
        </p>

        {/* Cảnh báo deadline */}
        {timeLeft && !timeLeft.expired && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 justify-center mb-2">
              <Clock className="w-6 h-6 text-red-500" />
              <span className="font-display font-bold text-red-600">QUAN TRỌNG: Thời hạn thanh toán</span>
            </div>
            <div className="font-display text-3xl font-bold text-red-600 mb-1">
              {timeLeft.hours} giờ {timeLeft.minutes} phút
            </div>
            <p className="text-xs text-ink-soft">
              Hết hạn vào {new Date(booking.depositInfo.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}.
              Quá hạn, đơn sẽ tự động bị hủy.
            </p>
          </div>
        )}

        {/* Thông tin giao dịch */}
        <div className="bg-warm-white rounded-2xl p-5 mb-6 border border-cream-dark text-left">
          <div className="text-xs text-ink-muted mb-3 text-center font-semibold uppercase tracking-wider">
            Thông tin cần ghi nhớ
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-ink-soft">Mã đơn:</span>
              <span className="font-display font-bold text-base">{code}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-cream-dark">
              <span className="text-ink-soft">Số tiền cần đóng:</span>
              <span className="font-display font-bold text-2xl text-terracotta-600">
                {booking.depositInfo?.amount.toLocaleString('vi-VN')}đ
              </span>
            </div>

            {room && (
              <>
                <div className="flex items-start gap-2 pt-2">
                  <Building2 className="w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-ink-muted">Đến chi nhánh</div>
                    <div className="font-semibold">{room.branch}</div>
                    <div className="text-xs text-ink-soft">{room.address}</div>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-ink-muted">Giờ làm việc</div>
                <div className="font-semibold text-sm">Thứ 2 - Thứ 7: 8:00 — 18:00</div>
                <div className="font-semibold text-sm">Chủ nhật: 9:00 — 17:00</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cần mang theo */}
        <div className="bg-mint-light/40 border border-mint/30 rounded-2xl p-5 mb-6 text-left">
          <h3 className="font-display font-bold mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-mint-dark" />
            Khi đến chi nhánh, vui lòng mang theo:
          </h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <span className="font-bold text-mint-dark">1.</span>
              <span>CCCD/Passport bản gốc để đối chiếu</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-mint-dark">2.</span>
              <span>Mã đơn <strong className="text-ink">{code}</strong> (đã hiển thị ở trên)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-mint-dark">3.</span>
              <span>Số tiền cọc đầy đủ: <strong className="text-ink">{booking.depositInfo?.amount.toLocaleString('vi-VN')}đ</strong></span>
            </li>
          </ul>
        </div>

        {/* Lưu ý */}
        <div className="bg-gold-light/30 border border-gold/30 rounded-xl p-4 mb-6 text-left flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
          <div className="text-xs text-ink-soft">
            <strong className="text-ink block mb-1">Lưu ý:</strong>
            <ul className="space-y-1">
              <li>• Đơn của bạn vẫn ở trạng thái <strong>"Chờ đặt cọc"</strong> cho đến khi nhân viên xác nhận đã nhận tiền.</li>
              <li>• Nhân viên Sale phụ trách đã được thông báo về việc bạn sẽ đến đóng tiền mặt.</li>
              <li>• Nhân viên sẽ xuất biên lai có chữ ký xác nhận khi nhận tiền.</li>
            </ul>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => navigate(`/my-bookings/${code}`)}>
            <FileText className="w-4 h-4" /> Chi tiết đơn
          </Button>
          <Button onClick={() => navigate('/my-bookings')}>
            <Home className="w-4 h-4" /> Đặt phòng của tôi
          </Button>
        </div>

        {/* Help */}
        <div className="mt-8 pt-6 border-t border-cream-dark">
          <p className="text-xs text-ink-muted">
            Có thay đổi? Liên hệ hotline{' '}
            <a href="tel:19001234" className="text-terracotta-500 font-semibold inline-flex items-center gap-1">
              <Phone className="w-3 h-3" /> 1900 1234
            </a>
            {' '}để được hỗ trợ.
          </p>
        </div>
      </Card>
    </div>
  )
}