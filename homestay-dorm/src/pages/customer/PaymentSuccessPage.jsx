import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { CheckCircle2, FileText, Calendar, Phone, ArrowRight } from 'lucide-react'

export default function PaymentSuccessPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [room, setRoom] = useState(null)

  useEffect(() => {
    let alive = true
    api.bookingDetail(code)
      .then(({ booking, room }) => { if (alive) { setBooking(booking); setRoom(room) } })
      .catch(() => { if (alive) { setBooking(null); setRoom(null) } })
    return () => { alive = false }
  }, [code])

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-fade-up">
      <Card className="p-10 text-center shadow-xl">
        {/* Icon thành công */}
        <div className="w-20 h-20 bg-mint-light rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-mint-dark" />
        </div>

        <h1 className="font-display text-3xl font-bold mb-3">
          Thanh toán đã được ghi nhận! 🎉
        </h1>
        <p className="text-ink-soft mb-2">
          Cảm ơn bạn đã thực hiện đặt cọc cho phòng {booking?.roomId}.
        </p>
        <p className="text-ink-soft mb-8">
          Bộ phận kế toán sẽ đối chiếu giao dịch và thông báo lại cho bạn trong vòng <span className="font-semibold text-ink">24 giờ</span>.
        </p>

        {/* Thông tin giao dịch */}
        <div className="bg-warm-white rounded-2xl p-5 mb-8 border border-cream-dark text-left">
          <div className="text-xs text-ink-muted mb-2 text-center">Chi tiết giao dịch</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Mã đơn</span>
              <span className="font-display font-bold">{code}</span>
            </div>
            {booking && (
              <>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Phòng</span>
                  <span className="font-semibold">{booking.roomId} — {room?.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Số tiền cọc</span>
                  <span className="font-display font-bold text-terracotta-500">
                    {booking.depositInfo?.amount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Thời gian</span>
                  <span className="font-semibold">{new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Các bước tiếp theo */}
        <div className="text-left mb-8">
          <h3 className="font-display font-bold mb-3">Các bước tiếp theo:</h3>
          <div className="space-y-3">
            {[
              { icon: Phone, title: 'Quản lý xác nhận giao dịch', desc: 'Đối chiếu chứng từ trong vòng 24h' },
              { icon: Calendar, title: 'Sắp xếp lịch nhận phòng', desc: 'NV sẽ liên hệ thống nhất ngày cụ thể' },
              { icon: FileText, title: 'Đến chi nhánh ký hợp đồng', desc: 'Mang CCCD và hoàn tất thủ tục' },
            ].map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-cream rounded-xl">
                  <div className="w-10 h-10 bg-terracotta-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-terracotta-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{step.title}</div>
                    <div className="text-xs text-ink-muted">{step.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => navigate('/my-bookings')}>
            <FileText className="w-4 h-4" /> Đặt phòng của tôi
          </Button>
          <Button onClick={() => navigate(`/my-bookings/${code}`)}>
            Xem chi tiết đơn <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Help */}
        <div className="mt-8 pt-6 border-t border-cream-dark">
          <p className="text-xs text-ink-muted">
            Cần hỗ trợ? Liên hệ hotline{' '}
            <a href="tel:19001234" className="text-terracotta-500 font-semibold">1900 1234</a>
          </p>
        </div>
      </Card>
    </div>
  )
}