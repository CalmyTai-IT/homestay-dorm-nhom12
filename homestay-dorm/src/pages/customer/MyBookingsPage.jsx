import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/utils'
import { groupBookingsByTab, STATUS_PROGRESS } from '@/lib/bookingUi'
import BookingStatusBadge from '@/components/customer/BookingStatusBadge'
import { Clock, MapPin, Eye, X, CreditCard, FileText, Inbox, Loader2, LogOut, CheckCircle2 } from 'lucide-react'

const TABS = [
  { id: 'processing', label: 'Đang xử lý', icon: Clock },
  { id: 'deposited', label: 'Đã đặt cọc', icon: CreditCard },
  { id: 'contracted', label: 'Đã thuê', icon: FileText },
  { id: 'returned', label: 'Đã trả phòng', icon: LogOut },
  { id: 'cancelled', label: 'Đã hủy', icon: X },
]

// Chuyển 1 phiếu (đã được backend tổng hợp: kèm ui_status + cọc + hợp đồng) về shape UI
function mapBooking(reg) {
  const tc = reg.tieu_chi || {}
  const b = {
    code: reg.ma_phieu,
    status: reg.ui_status,             // backend đã suy ra trạng thái 6 bước
    roomId: tc.roomId,
    createdAt: reg.created_at,
    rentalCriteria: {
      rentType: tc.rentType,
      numberOfBeds: tc.numberOfBeds,
      duration: reg.thoi_han_thue ?? tc.duration,
      moveInDate: reg.ngay_du_kien_vao_o || tc.moveInDate,
    },
  }
  // Chờ thanh toán cọc → kèm số tiền + hạn để hiện nút "Thanh toán ngay"
  if (reg.deposit && reg.ui_status === 'awaiting_deposit') {
    b.depositInfo = {
      amount: Number(reg.deposit.so_tien_coc),
      deadline: reg.deposit.han_thanh_toan,
      depositCode: reg.deposit.ma_phieu,
    }
  }
  // Đã ký hợp đồng → thông tin hợp đồng
  if (reg.contract) {
    b.contractInfo = { code: reg.contract.ma_hop_dong, endDate: reg.contract.ngay_ket_thuc }
  }
  // Có yêu cầu trả phòng đang xử lý (chưa thanh lý xong)
  b.checkoutPending = !!reg.checkout_pending
  return b
}

export default function MyBookingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('processing')

  const [bookings, setBookings] = useState([])
  const [roomsById, setRoomsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Tải song song: đơn của tôi (đã tổng hợp cọc + hợp đồng) + danh sách phòng để tra theo mã
    Promise.all([api.myBookingsFull(), api.getRooms()])
      .then(([regs, rooms]) => {
        if (!alive) return
        setBookings(regs.map(mapBooking))
        setRoomsById(Object.fromEntries(rooms.map(r => [r.id, r])))
      })
      .catch(err => { if (alive) setLoadError(err.message || 'Không tải được danh sách đơn') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.id])

  const groupedBookings = useMemo(() => groupBookingsByTab(bookings), [bookings])
  const currentList = groupedBookings[activeTab] || []

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-up">
      {/* === HEADER === */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold mb-1">Đặt phòng của tôi</h1>
        <p className="text-ink-soft">
          Theo dõi tiến trình và quản lý các đơn đăng ký thuê phòng của bạn
        </p>
      </div>

      {/* === TABS === */}
      <div className="flex gap-1 border-b border-cream-dark mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = groupedBookings[tab.id]?.length || 0
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-terracotta-500 text-terracotta-500'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  isActive ? 'bg-terracotta-100 text-terracotta-600' : 'bg-cream-dark text-ink-soft'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* === CONTENT === */}
      {loading ? (
        <Card className="p-16 text-center">
          <Loader2 className="w-8 h-8 text-terracotta-500 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-ink-soft">Đang tải danh sách đơn…</p>
        </Card>
      ) : loadError ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="font-display font-bold text-lg mb-1">Không tải được dữ liệu</h3>
          <p className="text-sm text-ink-soft mb-6">{loadError}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Thử lại</Button>
        </Card>
      ) : currentList.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="space-y-4">
          {currentList.map(booking => (
            <BookingCard key={booking.code} booking={booking} room={roomsById[booking.roomId]} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============== COMPONENT CON: EMPTY STATE ==============
function EmptyState({ activeTab }) {
  const messages = {
    processing: { emoji: '📭', title: 'Chưa có đơn đang xử lý', desc: 'Hãy tìm phòng và đăng ký để bắt đầu' },
    deposited: { emoji: '💰', title: 'Chưa có đơn đã đặt cọc', desc: 'Các đơn đã thanh toán cọc sẽ hiển thị ở đây' },
    contracted: { emoji: '🏡', title: 'Chưa có hợp đồng nào', desc: 'Sau khi ký hợp đồng, đơn sẽ chuyển vào tab này' },
    returned: { emoji: '📦', title: 'Chưa có đơn đã trả phòng', desc: 'Các hợp đồng đã trả phòng & thanh lý sẽ hiển thị ở đây' },
    cancelled: { emoji: '🗑️', title: 'Không có đơn bị hủy', desc: 'Các đơn đã hủy sẽ được lưu tại đây' },
  }
  const msg = messages[activeTab] || messages.processing
  return (
    <Card className="p-16 text-center">
      <div className="text-6xl mb-4">{msg.emoji}</div>
      <h3 className="font-display font-bold text-lg mb-1">{msg.title}</h3>
      <p className="text-sm text-ink-soft mb-6">{msg.desc}</p>
      <Link to="/search">
        <Button>
          <Inbox className="w-4 h-4" /> Tìm phòng ngay
        </Button>
      </Link>
    </Card>
  )
}

// ============== COMPONENT CON: BOOKING CARD ==============
function BookingCard({ booking, room, navigate }) {
  const progress = STATUS_PROGRESS[booking.status] || 0
  const createdDate = booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('vi-VN') : '—'
  const rc = booking.rentalCriteria || {}
  const moveIn = rc.moveInDate ? new Date(rc.moveInDate).toLocaleDateString('vi-VN') : '—'

  const roomLabel = room ? `Phòng ${room.code} — ${room.branch}` : `Đơn ${booking.code}`
  const emoji = room?.emoji || '🏠'
  const address = room?.address

  return (
    <Card className="overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Hình phòng */}
        <div className="md:w-48 aspect-video md:aspect-auto bg-gradient-to-br from-terracotta-100 to-terracotta-200 flex items-center justify-center text-7xl flex-shrink-0">
          {emoji}
        </div>

        {/* Nội dung */}
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <BookingStatusBadge status={booking.status} />
                {booking.status === 'contracted' && booking.checkoutPending && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full border bg-gold-light/40 text-gold border-gold/30 px-2 py-0.5">
                    <Clock className="w-3 h-3" /> Đang chờ trả phòng
                  </span>
                )}
                <span className="text-xs text-ink-muted">Mã: {booking.code}</span>
              </div>
              <h3 className="font-display font-bold text-lg">{roomLabel}</h3>
              {address && (
                <div className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                  <MapPin className="w-3.5 h-3.5" /> {address}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-muted">Đăng ký ngày</div>
              <div className="font-semibold text-sm">{createdDate}</div>
            </div>
          </div>

          {/* Thông tin chi tiết */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-warm-white rounded-lg">
            <div>
              <div className="text-xs text-ink-muted">Hình thức</div>
              <div className="text-sm font-semibold">
                {rc.rentType === 'whole_room' ? 'Nguyên phòng' : rc.rentType === 'shared_bed' ? 'Ghép giường' : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Số giường</div>
              <div className="text-sm font-semibold">{rc.numberOfBeds ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Thời hạn</div>
              <div className="text-sm font-semibold">{rc.duration ? `${rc.duration} tháng` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Vào ở từ</div>
              <div className="text-sm font-semibold">{moveIn}</div>
            </div>
          </div>

          {/* Progress bar (không hiển thị với đơn đã hủy) */}
          {booking.status !== 'cancelled' && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-ink-soft">Tiến độ</span>
                <span className="font-semibold text-terracotta-500">{progress}%</span>
              </div>
              <div className="h-2 bg-cream-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Chờ thanh toán cọc → hiện số tiền + hạn + nút thanh toán */}
          {booking.status === 'awaiting_deposit' && booking.depositInfo && (
            <div className="mb-4 p-3 bg-terracotta-50 border border-terracotta-200 rounded-lg">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs text-ink-soft">Số tiền cọc cần thanh toán</div>
                  <div className="font-display font-bold text-xl text-terracotta-600">
                    {booking.depositInfo.amount.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-xs text-ink-muted">
                    Hạn: {new Date(booking.depositInfo.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
                <Button onClick={() => navigate(`/payment/${booking.code}`)}>
                  <CreditCard className="w-4 h-4" /> Thanh toán ngay
                </Button>
              </div>
            </div>
          )}

          {/* Đã ký hợp đồng → thông tin hợp đồng */}
          {booking.status === 'contracted' && booking.contractInfo && (
            <div className="mb-4 p-3 bg-mint-light/40 border border-mint/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 font-semibold text-mint-dark mb-1">
                <FileText className="w-4 h-4" /> Đã ký hợp đồng
              </div>
              <div className="text-xs text-ink-soft">
                Mã HĐ: <strong>{booking.contractInfo.code}</strong>
                {booking.contractInfo.endDate && <> — đến ngày {fmtDate(booking.contractInfo.endDate)}</>}
              </div>
            </div>
          )}

          {/* Đang xử lý yêu cầu hủy (Sale đã lập) */}
          {booking.cancelPending && (
            <div className="mb-4 p-3 bg-gold-light/40 border border-gold/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 font-semibold text-gold mb-1">
                <Clock className="w-4 h-4" /> Đang xử lý yêu cầu hủy
              </div>
              <div className="text-xs text-ink-soft">
                {booking.cancelStage === 'pending_accountant'
                  ? 'Yêu cầu hủy đã được quản lý duyệt, kế toán đang xử lý hoàn cọc cho bạn.'
                  : 'Yêu cầu hủy của bạn đang chờ quản lý duyệt.'}
              </div>
            </div>
          )}

          {/* Đã hủy + đã hoàn cọc */}
          {booking.status === 'cancelled' && booking.cancelRefund && (
            <div className="mb-4 p-3 bg-mint-light/40 border border-mint/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 font-semibold text-mint-dark mb-1">
                <CheckCircle2 className="w-4 h-4" /> Đã hủy & hoàn cọc
              </div>
              <div className="text-xs text-ink-soft">
                Bạn được hoàn <strong>{booking.cancelRefund.amount.toLocaleString('vi-VN')}đ</strong>
                {booking.cancelRefund.rate ? <> ({booking.cancelRefund.rate}% tiền cọc)</> : null}.
              </div>
            </div>
          )}

          {/* Đã trả phòng / thanh lý xong */}
          {booking.status === 'returned' && (
            <div className="mb-4 p-3 bg-gold-light/30 border border-gold/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 font-semibold text-gold mb-1">
                <CheckCircle2 className="w-4 h-4" /> Đã trả phòng & thanh lý hợp đồng
              </div>
              <div className="text-xs text-ink-soft">
                {booking.contractInfo?.code && <>Mã HĐ: <strong>{booking.contractInfo.code}</strong> · </>}
                Hợp đồng đã kết thúc. Cảm ơn bạn đã sử dụng dịch vụ.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-cream-dark">
            <Button size="sm" variant="outline" onClick={() => navigate(`/my-bookings/${booking.code}`)}>
              <Eye className="w-4 h-4" /> Xem chi tiết
            </Button>
            {/* Đang có yêu cầu trả phòng → chỉ báo trạng thái (khách KHÔNG tự trả phòng; do Sale lập) */}
            {booking.status === 'contracted' && booking.checkoutPending && (
              <Button size="sm" variant="outline" disabled className="text-ink-muted">
                <Clock className="w-4 h-4" /> Đang chờ trả phòng
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
