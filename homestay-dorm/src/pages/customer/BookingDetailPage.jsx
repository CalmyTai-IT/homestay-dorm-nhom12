import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import BookingStatusBadge from '@/components/customer/BookingStatusBadge'
import ContactDialog from '@/components/customer/ContactDialog'
import CancelBookingDialog from '@/components/customer/CancelBookingDialog'
import { ArrowLeft, MapPin, Calendar, Phone, Mail, CreditCard, Clock, CheckCircle2, X, MessageCircle, FileText, AlertCircle } from 'lucide-react'

// Timeline các bước theo trạng thái
const TIMELINE_STEPS = [
  { id: 'pending_confirm', label: 'Đã gửi đăng ký', icon: CheckCircle2 },
  { id: 'viewing_scheduled', label: 'Sắp xếp lịch xem', icon: Calendar },
  { id: 'awaiting_deposit', label: 'Đặt cọc', icon: CreditCard },
  { id: 'deposited', label: 'Hoàn tất cọc', icon: CheckCircle2 },
  { id: 'contracted', label: 'Ký hợp đồng', icon: FileText },
]

const STATUS_ORDER = ['pending_confirm', 'viewing_scheduled', 'awaiting_deposit', 'deposited', 'contracted']

export default function BookingDetailPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showContact, setShowContact] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [isCheckoutDone, setIsCheckoutDone] = useState(false)

  const [booking, setBooking] = useState(null)
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.bookingDetail(code)
      .then(({ booking, room }) => {
        if (!alive) return
        // Hồ sơ cá nhân lấy từ tài khoản đang đăng nhập (đây là đơn của chính khách)
        if (booking) booking.personalInfo = {
          fullName: user?.fullName, gender: user?.gender, email: user?.email,
          phone: user?.phone, idNumber: user?.idNumber,
        }
        setBooking(booking); setRoom(room)
      })
      .catch(() => { if (alive) { setBooking(null); setRoom(null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [code, user?.id])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-sm text-ink-soft">Đang tải chi tiết đơn…</p>
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

  const currentStepIdx = booking.status === 'returned'
    ? STATUS_ORDER.length - 1
    : STATUS_ORDER.indexOf(booking.status)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-up">
      <button onClick={() => navigate('/my-bookings')}
        className="inline-flex items-center gap-2 text-sm text-ink-soft mb-4 hover:text-terracotta-500">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* === LEFT: CHI TIẾT === */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header card */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <BookingStatusBadge status={booking.status} size="lg" />
                  {booking.isDemo && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-cream-dark text-ink-muted rounded font-semibold">
                      ĐƠN DEMO
                    </span>
                  )}
                </div>
                <h1 className="font-display text-2xl font-bold mb-1">Đơn {booking.code}</h1>
                <p className="text-sm text-ink-muted">
                  Đăng ký ngày {new Date(booking.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {/* Timeline */}
            {booking.status !== 'cancelled' && (
              <div className="pt-4 border-t border-cream-dark">
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-4">Tiến trình xử lý</h3>
                <div className="relative">
                  {/* Đường nối */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-cream-dark"/>
                  <div
                    className="absolute top-4 left-4 h-0.5 bg-mint transition-all"
                    style={{ width: `calc(${(currentStepIdx / (STATUS_ORDER.length - 1)) * 100}% - ${(currentStepIdx / (STATUS_ORDER.length - 1)) * 32}px)` }}
                  />

                  {/* Các bước */}
                  <div className="relative flex justify-between">
                    {TIMELINE_STEPS.map((step, idx) => {
                      const Icon = step.icon
                      const isPassed = idx < currentStepIdx
                      const isCurrent = idx === currentStepIdx
                      return (
                        <div key={step.id} className="flex flex-col items-center" style={{ width: '20%' }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isPassed
                              ? 'bg-mint border-mint text-white'
                              : isCurrent
                              ? 'bg-terracotta-500 border-terracotta-500 text-white ring-4 ring-terracotta-100'
                              : 'bg-white border-cream-dark text-ink-muted'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className={`text-[10px] text-center mt-1.5 font-semibold ${
                            isPassed || isCurrent ? 'text-ink' : 'text-ink-muted'
                          }`}>
                            {step.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Nếu hủy */}
            {booking.status === 'cancelled' && (
              <div className="pt-4 border-t border-cream-dark">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-red-600 mb-1">Đơn đã bị hủy</div>
                    <div className="text-xs text-ink-soft">
                      Lý do: {booking.cancelReason || 'Không có'}<br/>
                      Hủy lúc: {fmtDateTime(booking.cancelledAt)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Nếu đã trả phòng / thanh lý */}
            {booking.status === 'returned' && (
              <div className="pt-4 border-t border-cream-dark">
                <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-gold mb-1">Đã trả phòng & thanh lý hợp đồng</div>
                    <div className="text-xs text-ink-soft">
                      Hợp đồng đã kết thúc và phòng đã được bàn giao lại. Cảm ơn bạn đã sử dụng dịch vụ.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Hoạt động tiếp theo theo trạng thái */}
          {booking.status === 'viewing_scheduled' && booking.scheduledViewing && (
            <Card className="p-5 border-mint/40 bg-mint-light/20">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-mint rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold mb-1">Lịch xem phòng của bạn</h3>
                  <p className="text-sm text-ink-soft mb-3">
                    NV Sale <strong>{booking.scheduledViewing.staffName}</strong> sẽ dẫn bạn xem phòng vào:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg">
                      <div className="text-xs text-ink-muted">Ngày</div>
                      <div className="font-semibold">{new Date(booking.scheduledViewing.date).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg">
                      <div className="text-xs text-ink-muted">Giờ</div>
                      <div className="font-semibold">{booking.scheduledViewing.time}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {booking.status === 'awaiting_deposit' && booking.depositInfo && (
            <Card className="p-5 border-terracotta-300 bg-terracotta-50">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-terracotta-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold mb-1">Cần thanh toán cọc</h3>
                  <p className="text-sm text-ink-soft mb-3">
                    Để hoàn tất giữ phòng, vui lòng thanh toán cọc trước thời hạn:
                  </p>
                  <div className="bg-white p-4 rounded-lg mb-3">
                    <div className="text-xs text-ink-muted">Số tiền cần thanh toán</div>
                    <div className="font-display text-3xl font-bold text-terracotta-600">
                      {booking.depositInfo.amount.toLocaleString('vi-VN')}đ
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      Hạn: {new Date(booking.depositInfo.deadline).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/payment/${booking.code}`)} size="lg" className="w-full">
                    <CreditCard className="w-4 h-4" /> Thanh toán ngay
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Thông tin đăng ký */}
          <Card className="p-6">
            <h3 className="font-display font-bold mb-4">Thông tin đăng ký</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Họ tên" value={booking.personalInfo.fullName} />
              <Field label="Giới tính" value={booking.personalInfo.gender} />
              <Field label="Email" value={booking.personalInfo.email} icon={Mail} />
              <Field label="SĐT" value={booking.personalInfo.phone} icon={Phone} />
              <Field label="CCCD" value={booking.personalInfo.idNumber} />
            </div>

            <div className="border-t border-cream-dark my-5"></div>

            <h3 className="font-display font-bold mb-4">Tiêu chí thuê</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Hình thức"
                value={booking.rentalCriteria.rentType === 'whole_room' ? 'Thuê nguyên phòng' : 'Thuê giường (ghép)'} />
              <Field label="Số giường" value={`${booking.rentalCriteria.numberOfBeds} giường`} />
              <Field label="Thời hạn thuê" value={`${booking.rentalCriteria.duration} tháng`} />
              <Field label="Ngày vào ở"
                value={new Date(booking.rentalCriteria.moveInDate).toLocaleDateString('vi-VN')} icon={Calendar} />
            </div>
          </Card>
        </div>

        {/* === RIGHT: SIDEBAR PHÒNG === */}
        <aside className="lg:col-span-1">
          <Card className="p-5 sticky top-24">
            {room && (
              <>
                <Link to={`/room/${room.id}`}>
                  <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 rounded-xl flex items-center justify-center text-6xl mb-4 hover:scale-[1.02] transition">
                    {room.emoji}
                  </div>
                </Link>
                <h3 className="font-display font-bold text-lg mb-1">Phòng {room.code}</h3>
                <div className="flex items-center gap-1 text-xs text-ink-muted mb-3">
                  <MapPin className="w-3.5 h-3.5" /> {room.address}
                </div>
                <div className="space-y-1.5 text-sm border-t border-cream-dark pt-3">
                  <Row label="Chi nhánh" value={room.branch} />
                  <Row label="Loại phòng" value={room.type} />
                  <Row label="Sức chứa" value={`${room.capacity} người`} />
                </div>
              </>
            )}

            <div className="border-t border-cream-dark mt-4 pt-4 space-y-2">
              {booking.status !== 'cancelled' && booking.status !== 'contracted' && booking.status !== 'returned' && (
                <Button variant="outline" className="w-full" onClick={() => setShowContact(true)}>
                  <MessageCircle className="w-4 h-4" /> Liên hệ nhân viên
                </Button>
              )}
              {/* Hợp đồng đang hiệu lực và ĐÃ gửi yêu cầu trả phòng → khóa nút, báo đang chờ */}
              {booking.status === 'contracted' && booking.checkoutPending && (
                <Button variant="outline" className="w-full text-ink-muted" disabled>
                  <Clock className="w-4 h-4" /> Đang chờ xử lý trả phòng
                </Button>
              )}
              {/* Nút TỰ HỦY chỉ cho đơn CHƯA đặt cọc (chưa phát sinh tiền).
                  Đơn đã cọc / đã ký HĐ: khách KHÔNG tự hủy — phải liên hệ Sale (xem ghi chú bên dưới). */}
              {['pending_confirm', 'viewing_scheduled', 'awaiting_deposit'].includes(booking.status) && (
                <Button
                    variant="outline"
                    className="w-full text-red-500 hover:bg-red-50 hover:border-red-200"
                    onClick={() => setShowCancel(true)}
                >
                    <X className="w-4 h-4" /> Hủy đơn này
                </Button>
                )}
              {/* Đang xử lý yêu cầu hủy (do Sale lập) */}
              {booking.cancelPending && (
                <div className="text-xs text-gold bg-gold-light/40 border border-gold/30 rounded-xl p-3 leading-relaxed flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  {booking.cancelStage === 'pending_accountant'
                    ? 'Yêu cầu hủy đã được duyệt, kế toán đang xử lý hoàn cọc cho bạn.'
                    : 'Yêu cầu hủy của bạn đang chờ quản lý duyệt.'}
                </div>
              )}
              {/* Đã cọc / đã ký HĐ: hướng dẫn liên hệ Sale (không cho tự hủy/trả phòng) */}
              {!booking.cancelPending && (booking.status === 'deposited' || (booking.status === 'contracted' && !booking.checkoutPending)) && (
                <div className="text-xs text-ink-soft bg-cream-light/60 border border-cream-dark rounded-xl p-3 leading-relaxed">
                  {booking.status === 'deposited'
                    ? 'Bạn đã đặt cọc phòng này. Nếu cần hủy thuê & hoàn cọc, vui lòng liên hệ nhân viên Sale để được lập yêu cầu xử lý.'
                    : 'Hợp đồng của bạn đang hiệu lực. Nếu cần trả phòng, vui lòng liên hệ nhân viên Sale để được lập yêu cầu trả phòng & hoàn cọc.'}
                </div>
                )}
            </div>
          </Card>
        </aside>
      </div>

      {showContact && room && (
        <ContactDialog
            room={room}
            booking={booking}
            onClose={() => setShowContact(false)}
        />
      )}

      {showCancel && room && (
        <CancelBookingDialog
          booking={booking}
          room={room}
          onClose={() => setShowCancel(false)}
          onCancelled={(_reason, isCheckout) => {
            setIsCheckoutDone(!!isCheckout)
            setCancelled(true)
            // Sau 2s tự về trang danh sách
            setTimeout(() => navigate('/my-bookings'), 2000)
          }}
        />
      )}

      {/* Thông báo hủy / trả phòng thành công */}
      {cancelled && (
        <div className="fixed bottom-6 right-6 z-50 bg-mint text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-up">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">✓</div>
          <div>
            <div className="font-display font-bold text-sm">
              {isCheckoutDone ? 'Đã gửi yêu cầu trả phòng' : 'Đơn đã được hủy'}
            </div>
            <div className="text-xs opacity-90">
              {isCheckoutDone ? 'Quản lý sẽ hẹn kiểm tra phòng. Đang quay về danh sách...' : 'Đang quay về danh sách...'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Sub components ===
function Field({ label, value, icon: Icon }) {
  return (
    <div>
      <div className="text-xs text-ink-muted mb-0.5">{label}</div>
      <div className="font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-muted" />} {value || '—'}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-soft">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}