import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { RENTAL_RULES, REFUND_RATES } from '@/lib/roomUi'
import ContactDialog from '@/components/customer/ContactDialog'
import {
  ArrowLeft, MapPin, Users, Bed, CheckCircle2, Star, Phone,
  MessageCircle, Calendar, Lock, ShieldCheck, AlertCircle, Loader2
} from 'lucide-react'

export default function RoomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showContact, setShowContact] = useState(false)

  // Lấy toàn bộ danh sách phòng từ API: vừa tìm được phòng hiện tại (kèm số giường trống
  // chính xác), vừa có sẵn dữ liệu để gợi ý "phòng tương tự".
  const [rooms, setRooms] = useState(null)   // null = đang tải
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    api.getRooms()
      .then(data => { if (alive) setRooms(data) })
      .catch(err => { if (alive) { setRooms([]); setLoadError(err.message || 'Không tải được dữ liệu') } })
    return () => { alive = false }
  }, [])

  // Đang tải
  if (rooms === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Loader2 className="w-8 h-8 text-terracotta-500 mx-auto mb-3 animate-spin" />
        <p className="text-ink-soft">Đang tải thông tin phòng…</p>
      </div>
    )
  }

  const room = rooms.find(r => String(r.id) === id)

  // Không tìm thấy phòng (hoặc lỗi tải)
  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl font-bold mb-2">Không tìm thấy phòng</h1>
        <p className="text-ink-soft mb-6">{loadError || `Phòng "${id}" không tồn tại hoặc đã bị xóa.`}</p>
        <Button onClick={() => navigate('/search')}>Quay lại danh sách phòng</Button>
      </div>
    )
  }

  const isWholeRoom = room.roomType === 'nguyen_can'
  // Ước tính tiền cọc hiển thị (cọc thật do hệ thống tính khi lập phiếu): 2 tháng tiền thuê
  const depositAmount = (isWholeRoom ? room.priceWholeRoom : room.pricePerBed) * 2

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-up">
      {/* Breadcrumb */}
      <button onClick={() => navigate('/search')}
        className="inline-flex items-center gap-2 text-sm text-ink-soft mb-4 hover:text-terracotta-500">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* === LEFT: ROOM INFO === */}
        <div className="lg:col-span-2">
          {/* Gallery */}
          <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 rounded-3xl flex items-center justify-center text-9xl mb-6 shadow-sm">
            {room.emoji}
          </div>

          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs px-3 py-1 bg-mint-light text-mint-dark rounded-full font-semibold">
              {room.type}
            </span>
            <span className="text-xs px-3 py-1 bg-warm-white border border-cream-dark rounded-full text-ink-soft">
              Giới tính: {room.gender}
            </span>
            <span className="text-xs px-3 py-1 bg-warm-white border border-cream-dark rounded-full text-ink-soft flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {room.branch}
            </span>
            <span className="text-xs flex items-center gap-1 ml-auto">
              <Star className="w-3.5 h-3.5 fill-gold text-gold" />
              <span className="font-semibold">{room.rating}</span>
              <span className="text-ink-muted">({room.reviewCount} đánh giá)</span>
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold mb-2">Phòng {room.code}</h1>
          <p className="text-ink-soft mb-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> {room.address}
          </p>
          <p className="text-lg text-ink-soft mt-4 mb-6 leading-relaxed">{room.description}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Card className="p-4">
              <Users className="w-5 h-5 text-terracotta-500 mb-2" />
              <div className="text-xs text-ink-muted">Sức chứa</div>
              <div className="font-display font-bold text-lg">{room.capacity} người</div>
            </Card>
            <Card className="p-4">
              <Bed className="w-5 h-5 text-mint-dark mb-2" />
              <div className="text-xs text-ink-muted">Còn trống</div>
              <div className="font-display font-bold text-lg">
                {isWholeRoom
                  ? (room.isFullyAvailable ? 'Còn phòng' : 'Đã thuê')
                  : `${room.bedsAvailable} giường`}
              </div>
            </Card>
            <Card className="p-4">
              <ShieldCheck className="w-5 h-5 text-gold mb-2" />
              <div className="text-xs text-ink-muted">Tiền cọc</div>
              <div className="font-display font-bold text-lg">{(depositAmount/1000000).toFixed(1)}tr</div>
            </Card>
          </div>

          {/* Tiện nghi */}
          <div className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4">Tiện nghi</h2>
            <div className="grid grid-cols-2 gap-3">
              {room.amenities.map(a => (
                <div key={a} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-cream-dark">
                  <div className="w-8 h-8 bg-mint-light rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-mint-dark" />
                  </div>
                  <span className="text-sm font-medium">{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quy định cho thuê */}
          <div className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4">Quy định cho thuê</h2>
            <Card className="p-5">
              <ul className="space-y-2.5">
                {RENTAL_RULES.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <span className="text-terracotta-500 mt-0.5">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Chính sách hoàn cọc */}
          <div className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4">Chính sách hoàn cọc</h2>
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-warm-white border-b border-cream-dark">
                  <tr>
                    <th className="text-left p-4 font-display font-semibold">Trường hợp</th>
                    <th className="text-right p-4 font-display font-semibold w-32">Tỷ lệ hoàn</th>
                  </tr>
                </thead>
                <tbody>
                  {REFUND_RATES.map((r, i) => (
                    <tr key={i} className="border-b border-cream-dark last:border-0">
                      <td className="p-4 text-ink-soft">{r.condition}</td>
                      <td className="p-4 text-right">
                        <span className="font-display font-bold text-mint-dark">{r.rate}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-warm-white border-t border-cream-dark flex items-start gap-2.5 text-xs text-ink-soft">
                <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <span>Số tiền hoàn thực tế = (Tiền cọc × Tỷ lệ) − Các khoản phát sinh (tiền thuê còn nợ, điện nước, hư hỏng, phạt vi phạm)</span>
              </div>
            </Card>
          </div>
        </div>

        {/* === RIGHT: BOOKING SIDEBAR === */}
        <aside className="lg:col-span-1">
          <Card className="p-6 sticky top-24 shadow-md">
            {/* Pricing — theo loại phòng */}
            <div className="pb-5 border-b border-cream-dark mb-5">
              {isWholeRoom ? (
                <>
                  <div className="text-xs text-ink-muted mb-1">Thuê nguyên phòng</div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-terracotta-500">
                      {(room.priceWholeRoom/1000000).toFixed(1)}tr
                    </span>
                    <span className="text-sm text-ink-muted">/tháng</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-ink-muted mb-1">Thuê ghép (mỗi giường)</div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-terracotta-500">
                      {(room.pricePerBed/1000000).toFixed(1)}tr
                    </span>
                    <span className="text-sm text-ink-muted">/tháng</span>
                  </div>
                </>
              )}
            </div>

            {/* Availability status */}
            <div className="mb-5 p-3 bg-warm-white rounded-xl">
              {isWholeRoom ? (
                room.isFullyAvailable ? (
                  <div className="flex items-center gap-1.5 text-mint-dark font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Còn phòng — có thể thuê nguyên căn
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-500 font-semibold text-sm">
                    <Lock className="w-4 h-4" /> Đã có người thuê
                  </div>
                )
              ) : room.bedsAvailable > 0 ? (
                <div className="flex items-center gap-1.5 text-mint-dark font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Còn {room.bedsAvailable}/{room.capacity} giường trống
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-500 font-semibold text-sm">
                  <Lock className="w-4 h-4" /> Đã hết chỗ
                </div>
              )}
            </div>

            {/* CTA buttons */}
            <div className="space-y-2.5">
              <Button
                size="lg"
                className="w-full"
                disabled={room.bedsAvailable === 0}
                onClick={() => navigate(`/register-rental/${room.id}`)}
              >
                <Calendar className="w-4 h-4" /> Đặt lịch xem phòng
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => setShowContact(true)}
              >
                <MessageCircle className="w-4 h-4" /> Liên hệ nhân viên
              </Button>
            </div>

            {/* Hotline */}
            <div className="mt-5 pt-5 border-t border-cream-dark">
              <div className="text-xs text-ink-muted mb-2">Cần tư vấn ngay?</div>
              <a href="tel:19001234" className="flex items-center gap-2 text-sm font-display font-bold hover:text-terracotta-500">
                <Phone className="w-4 h-4" /> Hotline: 1900 1234
              </a>
            </div>
          </Card>
        </aside>
      </div>

      {/* Related rooms */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold mb-6">Phòng tương tự</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {rooms
            .filter(r => r.id !== room.id && r.branch === room.branch)
            .slice(0, 3)
            .map(r => (
              <Link key={r.id} to={`/room/${r.id}`}>
                <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-md cursor-pointer">
                  <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 flex items-center justify-center text-5xl">
                    {r.emoji}
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-mint-dark font-semibold mb-1">{r.type}</div>
                    <div className="font-display font-bold">{r.code} — {r.branch}</div>
                    <div className="font-display text-terracotta-500 font-bold mt-2">
                      {(r.pricePerBed/1000000).toFixed(1)}tr<span className="text-xs text-ink-muted font-normal">/giường</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      </section>

      {/* Contact dialog */}
      {showContact && (
        <ContactDialog room={room} onClose={() => setShowContact(false)} />
      )}
    </div>
  )
}
