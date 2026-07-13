import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/staff/StatCard'
import { formatMoney, timeAgo } from '@/lib/statsHelpers'
import { api } from '@/lib/api'
import { Wallet, TrendingUp, Calculator, ArrowRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// Bảng màu theo design system "Warm Hospitality"
const COLORS = {
  terracotta: '#E07856',
  mint: '#7FB39C',
  gold: '#D9A441',
  inkMuted: '#8A7C72',
  creamDark: '#E8DFD3',
}
const PIE_COLORS = [COLORS.terracotta, COLORS.mint, COLORS.gold, COLORS.inkMuted]

// Tooltip cho biểu đồ doanh thu
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg border border-cream-dark shadow-lg px-3 py-2">
      <div className="text-[11px] text-ink-muted mb-0.5">Tháng {String(label).replace('T', '')}</div>
      <div className="font-display font-bold text-terracotta-600">{payload[0].value} triệu đ</div>
    </div>
  )
}

// Tooltip cho biểu đồ tròn
function PieTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = total ? Math.round((item.value / total) * 100) : 0
  return (
    <div className="bg-white rounded-lg border border-cream-dark shadow-lg px-3 py-2">
      <div className="text-[11px] text-ink-muted mb-0.5">{item.name}</div>
      <div className="font-display font-bold text-ink">{item.value} triệu đ · {pct}%</div>
    </div>
  )
}

export default function AccountantDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const load = () => api.statsAccountant().then(setData).catch(e => setErr(e.message || 'Lỗi tải dữ liệu'))
    load()
    // Tự làm mới khi quay lại tab/cửa sổ (giao dịch mới cần đối soát, vừa hoàn cọc...)
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
  const ACCOUNTANT_STATS = data.stats
  const ACCOUNTANT_PENDING_PAYMENTS = data.pendingPayments
  const ACCOUNTANT_REVENUE_CHART = data.revenueChart
  const ACCOUNTANT_REVENUE_BREAKDOWN = data.revenueBreakdown
  const ACCOUNTANT_PENDING_REFUNDS = data.pendingRefunds

  // Tô đậm cột/điểm của tháng hiện tại (điểm cuối) bằng màu terracotta
  const lastIndex = ACCOUNTANT_REVENUE_CHART.length - 1
  const renderDot = (props) => {
    const { cx, cy, index } = props
    const isLast = index === lastIndex
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={isLast ? 5 : 3}
        fill={isLast ? COLORS.terracotta : COLORS.mint}
        stroke="#fff"
        strokeWidth={2}
      />
    )
  }

  const pieTotal = ACCOUNTANT_REVENUE_BREAKDOWN.reduce((s, x) => s + x.value, 0)

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Xin chào, {user?.fullName?.split(' ').pop()} 👋</h1>
        <p className="text-ink-soft text-sm">Tổng quan tài chính hệ thống</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Wallet} label="Cọc chờ đối soát" value={ACCOUNTANT_STATS.depositsToReconcile} sub="Cần xác nhận" color="terracotta" />
        <StatCard icon={TrendingUp} label="Doanh thu tháng" value={`${formatMoney(ACCOUNTANT_STATS.revenueThisMonth)}`} sub={`Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`} color="mint" />
        <StatCard icon={Calculator} label="Hoàn cọc chờ xử lý" value={ACCOUNTANT_STATS.refundsPending} sub="Cần thực hiện" color="gold" />
      </div>

      {/* CHARTS ROW */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* BIỂU ĐỒ DOANH THU (Area) */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-display font-bold text-lg">Doanh thu</h2>
              <p className="text-xs text-ink-muted">6 tháng gần nhất (triệu đ)</p>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-xl text-terracotta-600">
                {ACCOUNTANT_REVENUE_CHART[lastIndex].revenue} tr
              </div>
              <div className="text-[11px] text-mint-dark font-semibold">Tháng hiện tại</div>
            </div>
          </div>

          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={ACCOUNTANT_REVENUE_CHART} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.terracotta} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.terracotta} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.creamDark} vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: COLORS.inkMuted }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.inkMuted }}
                  width={40}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: COLORS.creamDark, strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLORS.terracotta}
                  strokeWidth={2.5}
                  fill="url(#revFill)"
                  dot={renderDot}
                  activeDot={{ r: 6, fill: COLORS.terracotta, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CƠ CẤU GIAO DỊCH (Donut) */}
        <Card className="lg:col-span-1 p-5">
          <h2 className="font-display font-bold text-lg">Cơ cấu giao dịch</h2>
          <p className="text-xs text-ink-muted mb-2">Theo loại · tháng này</p>

          <div className="relative" style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={ACCOUNTANT_REVENUE_BREAKDOWN}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {ACCOUNTANT_REVENUE_BREAKDOWN.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip total={pieTotal} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Tổng ở giữa donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-display font-bold text-xl text-ink">{pieTotal}tr</div>
              <div className="text-[10px] text-ink-muted">Tổng thu</div>
            </div>
          </div>

          {/* Chú thích */}
          <div className="mt-3 space-y-2">
            {ACCOUNTANT_REVENUE_BREAKDOWN.map((entry, i) => {
              const pct = Math.round((entry.value / pieTotal) * 100)
              return (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="flex-1 text-ink-soft truncate">{entry.name}</span>
                  <span className="text-ink-muted">{entry.value}tr</span>
                  <span className="font-semibold text-ink w-9 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* GIAO DỊCH CHỜ ĐỐI SOÁT */}
      <Card className="overflow-hidden mb-6">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="font-display font-bold text-lg">Giao dịch chờ đối soát</h2>
            <p className="text-xs text-ink-muted">Cần xác nhận tính hợp lệ</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/staff/accountant/payments')}>
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="divide-y divide-cream-dark">
          {ACCOUNTANT_PENDING_PAYMENTS.map(p => (
            <button
              key={p.code}
              onClick={() => navigate('/staff/accountant/payments')}
              className="w-full flex items-center gap-4 p-4 hover:bg-warm-white transition text-left"
            >
              <div className="w-10 h-10 bg-gold-light rounded-full flex items-center justify-center text-gold font-display font-bold flex-shrink-0">
                {p.customerName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{p.customerName}</div>
                <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                  <span>{p.code}</span>
                  <span>·</span>
                  <span>{p.type}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-mint-dark">{p.amount.toLocaleString('vi-VN')}đ</div>
                <div className="text-xs text-ink-muted">{timeAgo(p.submittedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* HOÀN CỌC CHỜ XỬ LÝ */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="font-display font-bold text-lg">Hoàn cọc chờ xử lý</h2>
            <p className="text-xs text-ink-muted">Khách đã trả phòng, chờ hoàn tiền</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/staff/accountant/refunds')}>
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="divide-y divide-cream-dark">
          {ACCOUNTANT_PENDING_REFUNDS.map(r => (
            <button
              key={r.code}
              onClick={() => navigate('/staff/accountant/refunds')}
              className="w-full flex items-center gap-4 p-4 hover:bg-warm-white transition text-left"
            >
              <div className="w-10 h-10 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
                {r.customerName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{r.customerName}</div>
                <div className="text-xs text-ink-muted">{r.code} · Phòng {r.roomId}</div>
              </div>
              <div className="text-center flex-shrink-0 px-4">
                <div className="text-xs text-ink-muted">Tỷ lệ hoàn</div>
                <div className="font-display font-bold text-mint-dark">{r.refundRate}%</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-ink-muted">Số tiền hoàn</div>
                <div className="font-display font-bold text-terracotta-600">{r.refundAmount.toLocaleString('vi-VN')}đ</div>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
