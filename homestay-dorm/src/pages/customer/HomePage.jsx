import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { RENT_TYPES, CAPACITIES, PRICE_RANGES, branchLabel } from '@/lib/roomUi'
import {
  Search, Sparkles, Shield, Heart, ArrowRight, Star,
  MapPin, Users, CheckCircle2
} from 'lucide-react'

// (Phòng nổi bật được lấy từ API thật bên trong component — xem useEffect bên dưới)

const TESTIMONIALS = [
  { name: 'Minh Anh', role: 'Sinh viên ĐH Y Dược', avatar: 'M', rating: 5, text: 'Phòng sạch sẽ, nhân viên thân thiện. Quy trình đặt cọc online rất nhanh, tôi không cần đến tận nơi nhiều lần.' },
  { name: 'Quang Huy', role: 'Sinh viên ĐH Bách Khoa', avatar: 'Q', rating: 5, text: 'Đã ở 2 năm tại HomeStay Dorm. Giá hợp lý, bạn cùng phòng vui vẻ. Sẽ giới thiệu cho bạn bè.' },
  { name: 'Thu Hà', role: 'Đi làm', avatar: 'T', rating: 5, text: 'Hợp đồng rõ ràng, không có phí ẩn. Khi trả phòng được hoàn cọc đúng quy định, rất chuyên nghiệp.' },
]

export default function HomePage() {
  const navigate = useNavigate()

  // Phòng nổi bật: lấy từ API thật (3 phòng đang hoạt động & còn chỗ trống)
  const [featuredRooms, setFeaturedRooms] = useState([])
  const [allRooms, setAllRooms] = useState([])
  useEffect(() => {
    api.getRooms()
      .then(rs => {
        setAllRooms(rs)
        setFeaturedRooms(rs.filter(r => r.status === 'hoat_dong' && r.bedsAvailable > 0).slice(0, 3))
      })
      .catch(() => { setAllRooms([]); setFeaturedRooms([]) })
  }, [])

  // Danh sách KHU VỰC cho ô chọn nhanh — suy ra từ phòng thật (tự cập nhật khi có chi nhánh mới).
  // value = tên chi nhánh đầy đủ (khớp filter ở trang /search); nhãn hiển thị rút gọn.
  const branchOptions = [...new Set(allRooms.map(r => r.branch).filter(Boolean))].sort()

  // === QUICK SEARCH STATE ===
  // Khi user chọn các filter ở quick search → lưu vào state này
  const [quickFilters, setQuickFilters] = useState({
    branch: '',
    rentType: '',
    capacity: '',
    priceRange: '',
  })

  // === HANDLE SEARCH SUBMIT ===
  // Khi user bấm "Tìm kiếm" → chuyển sang trang /search với query params
  const handleQuickSearch = () => {
    const params = new URLSearchParams()
    if (quickFilters.branch)     params.set('branch', quickFilters.branch)
    if (quickFilters.rentType)   params.set('rentType', quickFilters.rentType)
    if (quickFilters.capacity)   params.set('capacity', quickFilters.capacity)
    if (quickFilters.priceRange) params.set('price', quickFilters.priceRange)

    // Chuyển sang trang search với các filter đã chọn
    const queryString = params.toString()
    navigate(queryString ? `/search?${queryString}` : '/search')
  }

  return (
    <div className="animate-fade-up">
      {/* =================== HERO =================== */}
      <section className="grain-bg relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-mint-light rounded-full text-xs text-mint-dark font-semibold mb-6">
              <span className="w-2 h-2 bg-mint rounded-full animate-pulse"></span>
              Đang mở đặt phòng kỳ 2026
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              Tìm <span className="text-terracotta-500">ngôi nhà</span><br />thứ hai của bạn
            </h1>
            <p className="text-lg text-ink-soft mb-8 leading-relaxed max-w-lg">
              HomeStay Dorm — Hệ thống ký túc xá tư nhân với hơn 200 phòng tại TP.HCM.
              Đặt phòng online, xem phòng tận nơi, thanh toán an toàn.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="xl" onClick={() => navigate('/search')}>
                Tìm phòng ngay <ArrowRight className="w-5 h-5" />
              </Button>
              <Button size="xl" variant="outline" onClick={() => navigate('/about')}>
                Tìm hiểu thêm
              </Button>
            </div>

            <div className="flex items-center gap-8 mt-10 pt-8 border-t border-cream-dark">
              <div>
                <div className="font-display text-2xl font-bold">200+</div>
                <div className="text-xs text-ink-muted">Phòng cho thuê</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold">3</div>
                <div className="text-xs text-ink-muted">Chi nhánh</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold">1500+</div>
                <div className="text-xs text-ink-muted">Khách tin tưởng</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square bg-gradient-to-br from-terracotta-200 to-terracotta-300 rounded-[3rem] flex items-center justify-center text-9xl shadow-xl">
              🏠
            </div>
            <Card className="absolute -top-4 -right-4 p-4 shadow-xl">
              <div className="text-xs text-ink-muted mb-1">Giá từ</div>
              <div className="font-display text-2xl font-bold text-terracotta-500">
                1.5tr<span className="text-sm text-ink-muted font-normal">/giường</span>
              </div>
            </Card>
            <Card className="absolute -bottom-4 -left-4 p-4 shadow-xl">
              <div className="flex items-center gap-2.5">
                <div className="text-2xl">⭐</div>
                <div>
                  <div className="font-display font-bold text-lg leading-none">4.8/5</div>
                  <div className="text-xs text-ink-muted mt-0.5">Đánh giá khách</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* =================== QUICK SEARCH (đã có chức năng) =================== */}
      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-10">
        <Card className="p-6 shadow-xl">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-terracotta-500" />
            Tìm phòng nhanh
          </h3>
          <div className="grid md:grid-cols-5 gap-3">
            {/* Chi nhánh */}
            <select
              value={quickFilters.branch}
              onChange={e => setQuickFilters({...quickFilters, branch: e.target.value})}
              className="h-11 rounded-lg border-[1.5px] border-cream-dark px-4 text-sm bg-white focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Chi nhánh</option>
              {branchOptions.map(b => <option key={b} value={b}>{branchLabel(b)}</option>)}
            </select>

            {/* Hình thức thuê */}
            <select
              value={quickFilters.rentType}
              onChange={e => setQuickFilters({...quickFilters, rentType: e.target.value})}
              className="h-11 rounded-lg border-[1.5px] border-cream-dark px-4 text-sm bg-white focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Hình thức thuê</option>
              {RENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Sức chứa */}
            <select
              value={quickFilters.capacity}
              onChange={e => setQuickFilters({...quickFilters, capacity: e.target.value})}
              className="h-11 rounded-lg border-[1.5px] border-cream-dark px-4 text-sm bg-white focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Sức chứa</option>
              {CAPACITIES.map(c => <option key={c} value={c}>Phòng {c} người</option>)}
            </select>

            {/* Khoảng giá */}
            <select
              value={quickFilters.priceRange}
              onChange={e => setQuickFilters({...quickFilters, priceRange: e.target.value})}
              className="h-11 rounded-lg border-[1.5px] border-cream-dark px-4 text-sm bg-white focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Khoảng giá</option>
              {PRICE_RANGES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>

            {/* Nút tìm kiếm */}
            <Button onClick={handleQuickSearch} className="h-11">
              <Search className="w-4 h-4" /> Tìm kiếm
            </Button>
          </div>
        </Card>
      </section>

      {/* =================== WHY US =================== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Vì sao chọn HomeStay Dorm?
          </h2>
          <p className="text-ink-soft">Trải nghiệm thuê phòng minh bạch và an toàn</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, color: 'mint', title: 'Hợp đồng minh bạch', desc: 'Mọi điều khoản rõ ràng, không phí ẩn. Hoàn cọc theo quy định công khai.' },
            { icon: Sparkles, color: 'terracotta', title: 'Tiện nghi đầy đủ', desc: 'Điều hòa, wifi, gửi xe, máy giặt — sẵn sàng cho cuộc sống thoải mái.' },
            { icon: Heart, color: 'gold', title: 'Hỗ trợ tận tâm', desc: 'Đội ngũ tư vấn 24/7. Bạn không đơn độc trong hành trình tìm chỗ ở.' },
          ].map((feat, i) => {
            const Icon = feat.icon
            const colorMap = {
              mint: 'bg-mint-light text-mint-dark',
              terracotta: 'bg-terracotta-100 text-terracotta-600',
              gold: 'bg-gold-light text-gold',
            }
            return (
              <Card key={i} className="p-6 hover:-translate-y-1 hover:shadow-lg">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${colorMap[feat.color]}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">{feat.title}</h3>
                <p className="text-ink-soft leading-relaxed">{feat.desc}</p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* =================== FEATURED ROOMS =================== */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl font-bold mb-2">Phòng nổi bật</h2>
            <p className="text-ink-soft">Những phòng được khách hàng quan tâm nhất tuần qua</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/search')}>
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {featuredRooms.length === 0 && (
            <div className="col-span-full text-center text-sm text-ink-muted py-8">Đang tải phòng nổi bật…</div>
          )}
          {featuredRooms.map(room => {
            const wholeRoom = room.roomType === 'nguyen_can'
            const price = wholeRoom ? room.priceWholeRoom : room.pricePerBed
            return (
            <Card
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className="overflow-hidden hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
            >
              <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 flex items-center justify-center text-7xl group-hover:scale-105 transition-transform">
                {room.emoji}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-1 bg-mint-light text-mint-dark rounded-full font-semibold">
                    {room.type}
                  </span>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-mint" />
                    {room.bedsAvailable} chỗ trống
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg mb-1">Phòng {room.code} — {room.branch}</h3>
                <div className="flex items-center gap-3 text-xs text-ink-muted mb-3">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {room.capacity} người</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {room.gender}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-cream-dark">
                  <div>
                    <div className="font-display text-xl font-bold text-terracotta-500">
                      {(price/1000000).toFixed(1)}tr
                    </div>
                    <div className="text-xs text-ink-muted">
                      {wholeRoom ? '/phòng/tháng' : '/giường/tháng'}
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    Chi tiết
                  </Button>
                </div>
              </div>
            </Card>
            )
          })}
        </div>
      </section>

      {/* =================== HOW IT WORKS =================== */}
      <section className="bg-warm-white py-16 mt-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Thuê phòng trong 4 bước</h2>
            <p className="text-ink-soft">Đơn giản, nhanh chóng và an toàn</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { num: '01', emoji: '📝', title: 'Đăng ký online', desc: 'Chọn phòng và điền thông tin đăng ký xem' },
              { num: '02', emoji: '👀', title: 'Xem phòng', desc: 'Đến xem phòng theo lịch hẹn với nhân viên' },
              { num: '03', emoji: '💳', title: 'Đặt cọc', desc: 'Đặt cọc giữ chỗ trong vòng 24 giờ' },
              { num: '04', emoji: '🔑', title: 'Nhận phòng', desc: 'Ký hợp đồng và chính thức nhận phòng' },
            ].map(step => (
              <Card key={step.num} className="p-6 hover:-translate-y-1 hover:shadow-md">
                <div className="w-14 h-14 bg-terracotta-100 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  {step.emoji}
                </div>
                <div className="text-xs text-terracotta-500 font-bold mb-1">BƯỚC {step.num}</div>
                <h3 className="font-display font-bold text-lg mb-1">{step.title}</h3>
                <p className="text-sm text-ink-soft">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =================== TESTIMONIALS =================== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Khách hàng nói gì về chúng tôi</h2>
          <p className="text-ink-soft">Hơn 1500 khách hàng đã tin tưởng HomeStay Dorm</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-terracotta-500 rounded-full flex items-center justify-center text-white font-display font-bold">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-display font-bold">{t.name}</div>
                  <div className="text-xs text-ink-muted">{t.role}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                ))}
              </div>
              <p className="text-sm text-ink-soft leading-relaxed">"{t.text}"</p>
            </Card>
          ))}
        </div>
      </section>

      {/* =================== CTA =================== */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-br from-terracotta-500 to-terracotta-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-[20rem] opacity-10 leading-none">🏠</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 relative">
            Sẵn sàng tìm tổ ấm mới?
          </h2>
          <p className="opacity-90 mb-6 relative">
            Hơn 200 phòng đang chờ bạn khám phá
          </p>
          <Button size="xl" variant="secondary" onClick={() => navigate('/search')} className="relative">
            Bắt đầu tìm phòng <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  )
}