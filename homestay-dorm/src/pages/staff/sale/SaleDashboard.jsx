import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/staff/StatCard'
import { timeAgo } from '@/lib/statsHelpers'
import { api } from '@/lib/api'
import {
  ClipboardList, Calendar, CreditCard, CheckCircle2,
  ArrowRight, Phone, Clock, MapPin, ChevronRight
} from 'lucide-react'

export default function SaleDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const load = () => api.statsSale().then(setData).catch(e => setErr(e.message || 'Lỗi tải dữ liệu'))
    load()
    // Tự làm mới khi quay lại tab/cửa sổ (đơn mới, vừa xử lý xong...)
    const onFocus = () => load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const priorityConfig = {
    high: { label: 'Ưu tiên cao', color: 'bg-red-100 text-red-600' },
    normal: { label: 'Bình thường', color: 'bg-gold-light text-gold' },
    low: { label: 'Thấp', color: 'bg-cream-dark text-ink-soft' },
  }

  if (err) return <div className="max-w-7xl mx-auto py-20 text-center text-sm text-ink-soft">⚠️ {err}</div>
  if (!data) return <div className="max-w-7xl mx-auto py-20 text-center text-sm text-ink-soft">Đang tải tổng quan…</div>
  const SALE_STATS = data.stats
  const SALE_PENDING_BOOKINGS = data.pendingBookings
  const SALE_VIEWINGS_TODAY = data.viewingsToday

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Xin chào, {user?.fullName?.split(' ').pop()} 👋</h1>
        <p className="text-ink-soft text-sm">Đây là tổng quan công việc của bạn hôm nay</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ClipboardList} label="Đơn mới chờ xử lý" value={SALE_STATS.newBookings} sub="Cần tiếp nhận" color="terracotta" />
        <StatCard icon={Calendar} label="Lịch xem hôm nay" value={SALE_STATS.viewingsToday} sub="Dẫn khách xem phòng" color="mint" />
        <StatCard icon={CreditCard} label="Đơn chờ đặt cọc" value={SALE_STATS.awaitingDeposit} sub="Đang chờ khách" color="gold" />
        <StatCard icon={CheckCircle2} label="Đã chốt tháng này" value={SALE_STATS.closedThisMonth} sub="Đặt cọc thành công" color="ink" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ĐƠN ĐĂNG KÝ MỚI */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-cream-dark">
              <div>
                <h2 className="font-display font-bold text-lg">Đơn đăng ký mới</h2>
                <p className="text-xs text-ink-muted">Cần tiếp nhận và sắp xếp lịch xem</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/staff/sale/bookings')}>
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="divide-y divide-cream-dark">
              {SALE_PENDING_BOOKINGS.map(booking => {
                const p = priorityConfig[booking.priority]
                return (
                  <button
                    key={booking.code}
                    onClick={() => navigate('/staff/sale/bookings')}
                    className="w-full flex items-center gap-4 p-4 hover:bg-warm-white transition text-left"
                  >
                    <div className="w-10 h-10 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-600 font-display font-bold flex-shrink-0">
                      {booking.customerName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{booking.customerName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.color}`}>
                          {p.label}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                        <span>{booking.code}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{booking.roomId} ({booking.branch})</span>
                        <span>·</span>
                        <span>{booking.rentType}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-ink-muted">{timeAgo(booking.createdAt)}</div>
                      <ChevronRight className="w-4 h-4 text-ink-muted ml-auto mt-1" />
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* LỊCH XEM HÔM NAY */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-cream-dark">
              <h2 className="font-display font-bold text-lg">Lịch xem hôm nay</h2>
              <p className="text-xs text-ink-muted">{SALE_VIEWINGS_TODAY.length} lịch hẹn</p>
            </div>
            <div className="divide-y divide-cream-dark">
              {SALE_VIEWINGS_TODAY.map(v => (
                <div key={v.code} className="p-4 hover:bg-warm-white transition">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-mint-light rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <Clock className="w-3 h-3 text-mint-dark" />
                      <span className="text-[10px] font-bold text-mint-dark">{v.time}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{v.customerName}</div>
                      <div className="text-xs text-ink-muted">Phòng {v.roomId}</div>
                    </div>
                  </div>
                  <a href={`tel:${v.phone}`} className="flex items-center gap-1.5 text-xs text-terracotta-500 font-medium hover:underline">
                    <Phone className="w-3 h-3" /> {v.phone}
                  </a>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}