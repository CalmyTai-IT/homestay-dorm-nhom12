import { Clock, Calendar, CreditCard, CheckCircle2, FileCheck, XCircle, LogOut } from 'lucide-react'

// Map trạng thái → cấu hình hiển thị (label, màu, icon)
const STATUS_CONFIG = {
  pending_confirm: {
    label: 'Chờ NV xác nhận',
    bg: 'bg-gold-light/40',
    text: 'text-gold',
    border: 'border-gold/30',
    icon: Clock,
  },
  viewing_scheduled: {
    label: 'Đã có lịch xem',
    bg: 'bg-mint-light',
    text: 'text-mint-dark',
    border: 'border-mint/30',
    icon: Calendar,
  },
  awaiting_deposit: {
    label: 'Chờ đặt cọc',
    bg: 'bg-terracotta-100',
    text: 'text-terracotta-600',
    border: 'border-terracotta-200',
    icon: CreditCard,
  },
  deposited: {
    label: 'Đã đặt cọc',
    bg: 'bg-mint-light',
    text: 'text-mint-dark',
    border: 'border-mint/30',
    icon: CheckCircle2,
  },
  contracted: {
    label: 'Đã ký hợp đồng',
    bg: 'bg-mint-light',
    text: 'text-mint-dark',
    border: 'border-mint/30',
    icon: FileCheck,
  },
  returned: {
    label: 'Đã trả phòng',
    bg: 'bg-gold-light/40',
    text: 'text-gold',
    border: 'border-gold/30',
    icon: LogOut,
  },
  cancelled: {
    label: 'Đã hủy',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    icon: XCircle,
  },
}

export default function BookingStatusBadge({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending_confirm
  const Icon = config.icon

  const sizeClass = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size]

  const iconSize = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }[size]

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClass}`}>
      <Icon className={iconSize} />
      {config.label}
    </span>
  )
}