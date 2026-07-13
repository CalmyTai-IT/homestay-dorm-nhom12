import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/staff/StatCard'
import { timeAgo } from '@/lib/statsHelpers'
import { api } from '@/lib/api'
import { Building2, Home, CreditCard, FileText, ArrowRight, Banknote } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// Bảng màu theo design system "Warm Hospitality"
const COLORS = {
  terracotta: '#E07856',
  mint: '#7FB39C',
  gold: '#D9A441',
  inkMuted: '#8A7C72',
  creamDark: '#E8DFD3',
}

// Tooltip cho donut cơ cấu phòng
function RoomTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = total ? Math.round((item.value / total) * 100) : 0
  return (
    <div className="bg-white rounded-lg border border-cream-dark shadow-lg px-3 py-2">
      <div className="text-[11px] text-ink-muted mb-0.5">{item.name}</div>
      <div className="font-display font-bold text-ink">{item.value} phòng/giường · {pct}%</div>
    </div>
  )
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const load = () => api.statsManager().then(setData).catch(e => setErr(e.message || 'Lỗi tải dữ liệu'))
    load()
    // Tự làm mới khi quay lại tab/cửa sổ (vd: sau khi Kế toán gửi cọc sang, hoặc sau khi vừa chốt cọc)
    const onFocus = () => load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (err) return <div className="max-w-7xl mx-auto py-20 text-center text-sm text-ink-soft">⚠️ {err}</div>
  if (!data) return <div className="max-w-7xl mx-auto py-20 text-center text-sm text-ink-soft">Đang tải tổng quan…</div>
  const MANAGER_STATS = data.stats
  const MANAGER_PENDING_DEPOSITS = data.pendingDeposits
  const MANAGER_BRANCH_OCCUPANCY = data.branchOccupancy

  // Cơ cấu phòng toàn hệ thống — gồm cả giường ĐÃ CỌC/GIỮ CHỖ và BẢO TRÌ để tổng = tổng phòng/giường,
  // và phản ánh đúng sau khi chốt cọc (giường chuyển sang trạng thái đặt cọc).
  const roomComposition = [
    { name: 'Đang thuê', value: MANAGER_STATS.occupied, color: COLORS.mint },
    { name: 'Đã cọc / giữ chỗ', value: MANAGER_STATS.reserved || 0, color: COLORS.terracotta },
    { name: 'Còn trống', value: MANAGER_STATS.available, color: COLORS.gold },
    { name: 'Bảo trì', value: MANAGER_STATS.maintenance || 0, color: COLORS.inkMuted },
  ].filter(s => s.value > 0)

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Xin chào, {user?.fullName?.split(' ').pop()} 👋</h1>
        <p className="text-ink-soft text-sm">Tổng quan vận hành toàn hệ thống</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Building2} label="Tổng phòng/giường" value={MANAGER_STATS.totalRooms} sub={`${MANAGER_STATS.available} còn trống`} color="ink" />
        <StatCard icon={Home} label="Đang được thuê" value={MANAGER_STATS.occupied} sub={`Tỷ lệ lấp đầy ${MANAGER_STATS.occupancyRate}%`} color="mint" />
        <StatCard icon={CreditCard} label="Cọc chờ xác nhận" value={MANAGER_STATS.pendingDeposits} sub="Cần đối chiếu" color="terracotta" />
        <StatCard icon={FileText} label="Hợp đồng cần ký" value={MANAGER_STATS.contractsToSign} sub="Chờ lập HĐ" color="gold" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* CỌC CHỜ XÁC NHẬN */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-cream-dark">
              <div>
                <h2 className="font-display font-bold text-lg">Cọc chờ đối chiếu</h2>
                <p className="text-xs text-ink-muted">Cần xác nhận giao dịch để chốt cọc</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/staff/manager/deposits')}>
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="divide-y divide-cream-dark">
              {MANAGER_PENDING_DEPOSITS.map(d => (
                <button
                  key={d.code}
                  onClick={() => navigate('/staff/manager/deposits')}
                  className="w-full flex items-center gap-4 p-4 hover:bg-warm-white transition text-left"
                >
                  <div className="w-10 h-10 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-600 font-display font-bold flex-shrink-0">
                    {d.customerName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{d.customerName}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                      <span>{d.code}</span>
                      <span>·</span>
                      <span>Phòng {d.roomId}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                        d.method === 'cash' ? 'bg-mint-light text-mint-dark' : 'bg-terracotta-100 text-terracotta-600'
                      }`}>
                        {d.method === 'cash' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                        {d.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-terracotta-600">{d.amount.toLocaleString('vi-VN')}đ</div>
                    <div className="text-xs text-ink-muted">{timeAgo(d.submittedAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* CỘT PHẢI: DONUT CƠ CẤU PHÒNG + TỶ LỆ LẤP ĐẦY THEO CHI NHÁNH */}
        <div className="lg:col-span-1 space-y-6">
          {/* Donut cơ cấu phòng (tổng quan) */}
          <Card className="p-5">
            <h2 className="font-display font-bold text-lg">Cơ cấu phòng</h2>
            <p className="text-xs text-ink-muted mb-1">Toàn hệ thống</p>

            <div className="relative" style={{ width: '100%', height: 170 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={roomComposition}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {roomComposition.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<RoomTooltip total={MANAGER_STATS.totalRooms} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Tỷ lệ lấp đầy ở giữa */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-display font-bold text-2xl text-ink">{MANAGER_STATS.occupancyRate}%</div>
                <div className="text-[10px] text-ink-muted">Lấp đầy</div>
              </div>
            </div>

            {/* Chú thích */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2 text-xs">
              {roomComposition.map(s => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name} <b className="text-ink">{s.value}</b>
                </span>
              ))}
            </div>
          </Card>

          {/* Tỷ lệ lấp đầy theo chi nhánh (giữ nguyên progress bar) */}
          <Card className="p-5">
            <h2 className="font-display font-bold text-lg mb-1">Tỷ lệ lấp đầy</h2>
            <p className="text-xs text-ink-muted mb-4">Theo từng chi nhánh</p>
            <div className="space-y-4">
              {MANAGER_BRANCH_OCCUPANCY.map(b => {
                const rate = Math.round((b.occupied / b.total) * 100)
                return (
                  <div key={b.branch}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{b.branch}</span>
                      <span className="text-ink-muted">{b.occupied}/{b.total} ({rate}%)</span>
                    </div>
                    <div className="h-2.5 bg-cream-dark rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rate >= 85 ? 'bg-red-400' : rate >= 70 ? 'bg-gold' : 'bg-mint'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-cream-dark">
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/staff/manager/rooms')}>
                <Building2 className="w-4 h-4" /> Quản lý phòng
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
