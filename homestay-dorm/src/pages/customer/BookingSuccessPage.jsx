import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Calendar, Phone, Home, FileText } from 'lucide-react'

export default function BookingSuccessPage() {
  const { code } = useParams()
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-fade-up">
      <Card className="p-10 text-center shadow-xl">
        {/* Icon thành công */}
        <div className="w-20 h-20 bg-mint-light rounded-full flex items-center justify-center mx-auto mb-6 animate-fade-up">
          <CheckCircle2 className="w-10 h-10 text-mint-dark" />
        </div>

        <h1 className="font-display text-3xl font-bold mb-3">
          Đăng ký thành công! 🎉
        </h1>
        <p className="text-ink-soft mb-2">
          Cảm ơn bạn đã đăng ký với HomeStay Dorm.
        </p>
        <p className="text-ink-soft mb-8">
          Nhân viên Sale sẽ liên hệ với bạn trong vòng <span className="font-semibold text-ink">24 giờ</span> để xác nhận lịch xem phòng.
        </p>

        {/* Mã đăng ký */}
        <div className="bg-warm-white rounded-2xl p-5 mb-8 border border-cream-dark">
          <div className="text-xs text-ink-muted mb-1">Mã đăng ký của bạn</div>
          <div className="font-display text-3xl font-bold text-terracotta-500 tracking-wider">
            {code}
          </div>
          <div className="text-xs text-ink-muted mt-2">
            Vui lòng giữ mã này để theo dõi đơn đăng ký
          </div>
        </div>

        {/* Các bước tiếp theo */}
        <div className="text-left mb-8">
          <h3 className="font-display font-bold mb-3">Các bước tiếp theo:</h3>
          <div className="space-y-3">
            {[
              { icon: Phone, title: 'Nhân viên gọi xác nhận', desc: 'Trong vòng 24 giờ tới' },
              { icon: Calendar, title: 'Đến xem phòng đúng lịch', desc: 'Nhân viên dẫn bạn tham quan' },
              { icon: FileText, title: 'Đặt cọc & ký hợp đồng', desc: 'Sau khi quyết định thuê' },
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
            <FileText className="w-4 h-4" /> Xem đơn của tôi
          </Button>
          <Button onClick={() => navigate('/')}>
            <Home className="w-4 h-4" /> Về trang chủ
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