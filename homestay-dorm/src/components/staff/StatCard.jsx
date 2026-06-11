import { Card } from '@/components/ui/card'

// KPI card tái sử dụng cho mọi dashboard
// props: icon (component), label, value, sub (text phụ), color, trend (optional)
export default function StatCard({ icon: Icon, label, value, sub, color = 'terracotta', trend }) {
  const colorMap = {
    terracotta: { bg: 'bg-terracotta-100', text: 'text-terracotta-600' },
    mint: { bg: 'bg-mint-light', text: 'text-mint-dark' },
    gold: { bg: 'bg-gold-light', text: 'text-gold' },
    ink: { bg: 'bg-cream-dark', text: 'text-ink' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
  }
  const c = colorMap[color] || colorMap.terracotta

  return (
    <Card className="p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend.up ? 'bg-mint-light text-mint-dark' : 'bg-red-100 text-red-600'
          }`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="font-display text-3xl font-bold mb-0.5">{value}</div>
      <div className="text-sm font-medium text-ink">{label}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </Card>
  )
}