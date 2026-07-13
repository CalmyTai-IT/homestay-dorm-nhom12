import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { groupSaleBookings, SALE_STATUS_CONFIG, VIEWING_SLOTS, calculatePriority, PRIORITY_CONFIG } from '@/lib/saleUi'
import { timeAgo } from '@/lib/statsHelpers'

// Trạng thái đơn (DB) -> trạng thái mock mà trang đang dùng
const SALE_STATUS_MAP = {
  cho_xem_phong: 'pending_confirm', dang_xu_ly: 'checking', da_hen_xem: 'viewing_scheduled',
  da_xem_phong: 'viewed', da_dat_coc: 'deposit_created', huy: 'rejected',
}
function mapSaleBooking(b) {
  const tc = b.tieu_chi || {}
  const GENDER = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }
  return {
    id: b.id,
    code: b.ma_phieu,
    status: SALE_STATUS_MAP[b.trang_thai] || 'pending_confirm',
    createdAt: b.created_at,
    moveInDate: b.ngay_du_kien_vao_o || tc.moveInDate,
    roomId: tc.roomId,
    branch: tc.branch || '',
    rentType: tc.rentType,
    numberOfBeds: tc.numberOfBeds ?? 1,
    hasGroup: tc.hasGroup ?? false,
    groupMembers: tc.groupMembers || [],
    duration: b.thoi_han_thue ?? tc.duration,
    notes: tc.notes || '',
    // Lịch xem phòng: ưu tiên bảng lich_xem_phong (b.scheduled_viewing), fallback tieu_chi (dữ liệu cũ)
    scheduledViewing: b.scheduled_viewing || tc.scheduledViewing || null,
    rejectReason: tc.rejectReason || '',
    // Liên lạc ưa thích: lấy từ tieu_chi nếu có; mặc định "gọi điện" để modal không lỗi undefined
    contactPreference: tc.contactPreference || {
      preferredMethod: tc.preferredMethod || 'phone',
      notes: tc.contactNotes || '',
    },
    customer: {
      fullName: b.ho_ten || '—',
      phone: b.so_dien_thoai || '',
      email: b.email || '',
      idNumber: b.so_giay_to || '',
      gender: b.gioi_tinh ? (GENDER[b.gioi_tinh] || b.gioi_tinh) : '',
      dateOfBirth: b.ngay_sinh || null,
    },
  }
}
import { ClipboardList, Calendar, Eye, CheckCircle2, X, Phone, Mail, MapPin, Users, ChevronRight, AlertCircle, CreditCard, CheckCheck, XCircle, User, Sparkles } from 'lucide-react'

const TABS = [
  { id: 'pending', label: 'Chờ xử lý', icon: ClipboardList },
  { id: 'scheduled', label: 'Đã hẹn xem', icon: Calendar },
  { id: 'viewed', label: 'Đã xem phòng', icon: Eye },
  { id: 'processed', label: 'Đã xử lý', icon: CheckCircle2 },
]

export default function SaleBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [roomsById, setRoomsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [searchParams] = useSearchParams()
  const focusCode = searchParams.get('focus')
  const focusedRef = useRef(null)

  const grouped = useMemo(() => groupSaleBookings(bookings), [bookings])

  // Sắp xếp đơn trong tab hiện tại theo điểm ưu tiên giảm dần
  const currentList = useMemo(() => {
    const list = grouped[activeTab] || []
    return [...list].sort((a, b) => calculatePriority(b).total - calculatePriority(a).total)
  }, [grouped, activeTab])

  // Mở đúng tab chứa đơn được tìm (chỉ chạy 1 lần cho mỗi mã)
  useEffect(() => {
    if (!focusCode || focusedRef.current === focusCode) return
    const tabId = TABS.find(t => (grouped[t.id] || []).some(b => b.code === focusCode))?.id
    if (tabId) { setActiveTab(tabId); focusedRef.current = focusCode }
  }, [focusCode, grouped])

  // Cuộn tới đơn được focus
  useEffect(() => {
    if (!focusCode) return
    const t = setTimeout(() => {
      document.getElementById(`item-${focusCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [focusCode, activeTab])

  const refresh = () => {
    setLoading(true)
    Promise.all([api.listBookings(), api.getRooms()])
      .then(([bs, rooms]) => {
        const roomsById = Object.fromEntries(rooms.map(r => [r.id, r]))
        setBookings(bs.map(b => {
          const sb = mapSaleBooking(b)
          if (!sb.branch && roomsById[sb.roomId]) sb.branch = roomsById[sb.roomId].branch
          return sb
        }))
        setRoomsById(roomsById)
      })
      .catch(err => setLoadError(err.message || 'Không tải được danh sách đơn'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  if (loading) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <div className="text-4xl mb-3 animate-pulse">📋</div>
      <p className="text-sm text-ink-soft">Đang tải danh sách đơn…</p>
    </div>
  )
  if (loadError) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <div className="text-5xl mb-3">⚠️</div>
      <h3 className="font-display font-bold text-lg mb-1">Không tải được dữ liệu</h3>
      <p className="text-sm text-ink-soft mb-4">{loadError}</p>
      <Button variant="outline" onClick={refresh}>Thử lại</Button>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Đơn đăng ký thuê</h1>
        <p className="text-ink-soft text-sm">Tiếp nhận và xử lý đơn đăng ký từ khách hàng</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-cream-dark mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = grouped[tab.id]?.length || 0
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                isActive ? 'border-terracotta-500 text-terracotta-500' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  isActive ? 'bg-terracotta-100 text-terracotta-600' : 'bg-cream-dark text-ink-soft'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* LIST */}
      {currentList.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">📭</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có đơn nào</h3>
          <p className="text-sm text-ink-soft">Các đơn ở trạng thái này sẽ hiển thị tại đây</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentList.map(booking => (
            <div
              key={booking.code}
              id={`item-${booking.code}`}
              className={booking.code === focusCode ? 'rounded-2xl ring-2 ring-terracotta-400 ring-offset-2 transition' : ''}
            >
              <SaleBookingCard
                booking={booking}
                roomsById={roomsById}
                onOpenDetail={() => setSelectedBooking(booking)}
              />
            </div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          roomsById={roomsById}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => { refresh(); setSelectedBooking(null) }}
        />
      )}
    </div>
  )
}

// ============== CARD ==============
function SaleBookingCard({ booking, onOpenDetail, roomsById = {} }) {
  const room = roomsById[booking.roomId]
  const statusCfg = SALE_STATUS_CONFIG[booking.status]

  // Tính điểm ưu tiên động từ dữ liệu đơn
  const priority = calculatePriority(booking)
  const priorityCfg = PRIORITY_CONFIG[priority.level]
  const [showTooltip, setShowTooltip] = useState(false)
  // Đơn đã xử lý xong (đã lập phiếu cọc hoặc từ chối) thì không cần thể hiện mức độ ưu tiên nữa
  const isProcessed = ['deposit_created', 'rejected'].includes(booking.status)

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        {/* Priority + Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-600 font-display font-bold">
            {booking.customer.fullName[0]}
          </div>
          {!isProcessed && (
            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 ${priorityCfg.dot} rounded-full border-2 border-white`} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{booking.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>

            {/* Badge ưu tiên — ẩn khi đơn đã xử lý xong (đã lập phiếu cọc/từ chối) */}
            {!isProcessed && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 cursor-help ${priorityCfg.badge}`}
              >
                {priorityCfg.label} · {priority.total}đ
              </button>

              {/* Tooltip giải thích điểm */}
              {showTooltip && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-56 bg-white rounded-xl border border-cream-dark shadow-xl p-3 text-left">
                  <div className="text-xs font-bold text-ink mb-2">Cách tính điểm ưu tiên:</div>
                  <div className="space-y-1.5">
                    {priority.breakdown.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-soft">{b.label}</span>
                        <span className="font-mono text-ink-muted">
                          {b.points}×{b.weight} = <strong className="text-ink">{b.subtotal}</strong>
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-cream-dark">
                      <span className="font-bold text-ink">Tổng điểm</span>
                      <span className="font-display font-bold text-terracotta-500">{priority.total}đ</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {booking.hasGroup && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-cream-dark text-ink-soft flex items-center gap-1">
                <Users className="w-3 h-3" /> Nhóm {booking.numberOfBeds}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-1 flex-wrap">
            <span>{booking.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{booking.roomId} ({booking.branch})</span>
            <span>·</span>
            <span>{booking.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'}</span>
            {room && (
              <>
                <span>·</span>
                <span>{(booking.rentType === 'whole_room' ? room.priceWholeRoom : room.pricePerBed)?.toLocaleString('vi-VN')}đ{booking.rentType === 'whole_room' ? '/phòng' : '/giường'}</span>
                <span>·</span>
                <span>còn {room.bedsAvailable}/{room.capacity} giường</span>
              </>
            )}
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{booking.customer.phone}</span>
          </div>
          {/* Lịch xem nếu có */}
          {booking.scheduledViewing && (
            <div className="text-xs text-mint-dark font-medium flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              Hẹn xem: {new Date(booking.scheduledViewing.date).toLocaleDateString('vi-VN')} lúc {booking.scheduledViewing.time}
            </div>
          )}
        </div>

        {/* Time + Action */}
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted mb-2">{timeAgo(booking.createdAt)}</div>
          <Button size="sm" onClick={onOpenDetail}>
            Xử lý <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ============== DETAIL MODAL ==============
function BookingDetailModal({ booking, onClose, onUpdated, roomsById = {} }) {
  const room = roomsById[booking.roomId]
  const navigate = useNavigate()
  const [mode, setMode] = useState('view') // 'view' | 'schedule' | 'reject'
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' })
  const [rejectReason, setRejectReason] = useState('')

  // === GỢI Ý LỊCH HẸN theo khung giờ khách đã cho biết rảnh (lúc đăng ký) ===
  const TIME_SLOT_INFO = {
    morning:   { label: 'Buổi sáng',  desc: '8:00–12:00', icon: '🌅', range: [8, 12] },
    afternoon: { label: 'Buổi chiều', desc: '13:00–17:00', icon: '☀️', range: [13, 17] },
    evening:   { label: 'Buổi tối',   desc: '18:00–20:00', icon: '🌙', range: [18, 20] },
    anytime:   { label: 'Bất kỳ lúc nào', desc: 'trong giờ hành chính', icon: '⏰', range: [0, 24] },
  }
  const prefTimes = booking.contactPreference?.preferredTimes || []
  const prefAnytime = prefTimes.includes('anytime')
  // Một khung giờ cụ thể (vd '09:00') được "khách rảnh" nếu nằm trong buổi khách đã chọn.
  const isSlotRecommended = (slot) => {
    if (!prefTimes.length) return false
    if (prefAnytime) return true
    const h = parseInt(slot, 10)
    return prefTimes.some(p => TIME_SLOT_INFO[p] && h >= TIME_SLOT_INFO[p].range[0] && h <= TIME_SLOT_INFO[p].range[1])
  }
  // Tự gợi ý khung giờ đầu tiên khách rảnh khi mở form lên lịch (sale vẫn đổi được)
  const firstRecommendedSlot = VIEWING_SLOTS.find(isSlotRecommended) || ''

  // Tiếp nhận đơn → chuyển sang "đang kiểm tra"
  const handleAccept = async () => {
    try { await api.setBookingStatus(booking.code, 'dang_xu_ly'); onUpdated() }
    catch (e) { alert(e.message || 'Không cập nhật được') }
  }

  // Sắp xếp lịch xem
  const handleSchedule = () => {
    if (!scheduleData.date || !scheduleData.time) {
      alert('Vui lòng chọn ngày và giờ xem phòng')
      return
    }
    api.scheduleViewing(booking.code, { date: scheduleData.date, time: scheduleData.time })
      .then(onUpdated)
      .catch(e => alert(e.message || 'Không lên lịch được'))
  }

  // Đánh dấu đã xem phòng
  const handleMarkViewed = async () => {
    try { await api.markViewed(booking.code); onUpdated() }
    catch (e) { alert(e.message || 'Không cập nhật được') }
  }

  // Từ chối đơn
  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Vui lòng nhập lý do từ chối')
      return
    }
    api.setBookingStatus(booking.code, 'huy', { rejectReason: rejectReason.trim() })
      .then(onUpdated)
      .catch(e => alert(e.message || 'Không từ chối được'))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-xl font-bold">{booking.customer.fullName}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SALE_STATUS_CONFIG[booking.status].color}`}>
                {SALE_STATUS_CONFIG[booking.status].label}
              </span>
            </div>
            <p className="text-xs text-ink-muted">{booking.code} · Đăng ký {timeAgo(booking.createdAt)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {mode === 'view' && (
            <div className="space-y-5">
              {/* Thông tin khách */}
              <Section title="Thông tin khách hàng">
                <InfoGrid items={[
                  { label: 'Họ tên', value: booking.customer.fullName },
                  { label: 'Giới tính', value: booking.customer.gender },
                  { label: 'Ngày sinh', value: new Date(booking.customer.dateOfBirth).toLocaleDateString('vi-VN') },
                  { label: 'CCCD', value: booking.customer.idNumber },
                  { label: 'SĐT', value: booking.customer.phone, icon: Phone },
                  { label: 'Email', value: booking.customer.email, icon: Mail },
                ]} />
              </Section>

              {/* Thông tin thuê */}
              <Section title="Yêu cầu thuê">
                <InfoGrid items={[
                  { label: 'Phòng', value: `${booking.roomId} — ${booking.branch}` },
                  { label: 'Hình thức', value: booking.rentType === 'whole_room' ? 'Thuê nguyên phòng' : 'Thuê giường (ghép)' },
                  ...(room ? [
                    { label: 'Loại phòng', value: room.type },
                    { label: 'Giá', value: `${(booking.rentType === 'whole_room' ? room.priceWholeRoom : room.pricePerBed)?.toLocaleString('vi-VN')}đ${booking.rentType === 'whole_room' ? '/phòng' : '/giường/tháng'}` },
                    { label: 'Sức chứa', value: `${room.capacity} người · còn ${room.bedsAvailable} giường` },
                    ...(room.amenities?.length ? [{ label: 'Tiện ích', value: room.amenities.join(', ') }] : []),
                  ] : []),
                  { label: 'Số giường', value: `${booking.numberOfBeds} giường` },
                  { label: 'Thời hạn', value: `${booking.duration} tháng` },
                  { label: 'Ngày vào ở', value: new Date(booking.moveInDate).toLocaleDateString('vi-VN') },
                ]} />
                {booking.notes && (
                  <div className="mt-3 p-3 bg-warm-white rounded-lg text-sm">
                    <span className="text-ink-muted text-xs">Ghi chú: </span>{booking.notes}
                  </div>
                )}
              </Section>

              {/* Nhóm thuê */}
              {booking.hasGroup && booking.groupMembers?.length > 0 && (
                <Section title={`Thành viên nhóm (${booking.groupMembers.length})`}>
                  <div className="space-y-2">
                    {booking.groupMembers.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 bg-warm-white rounded-lg text-sm">
                        <User className="w-4 h-4 text-ink-muted" />
                        <span className="font-medium">{m.name}</span>
                        <span className="text-ink-muted text-xs">{m.phone} · {m.gender}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Liên hệ ưa thích */}
              <Section title="Liên lạc ưa thích">
                <div className="text-sm text-ink-soft">
                  Qua <strong className="text-ink">{
                    { phone: 'Gọi điện', sms: 'SMS', email: 'Email', zalo: 'Zalo' }[booking.contactPreference.preferredMethod]
                  }</strong>
                  {booking.contactPreference.notes && ` · ${booking.contactPreference.notes}`}
                </div>
              </Section>

              {/* Lịch xem nếu đã có */}
              {booking.scheduledViewing && (
                <div className="p-4 bg-mint-light/40 border border-mint/30 rounded-xl flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-mint-dark" />
                  <div className="text-sm">
                    <span className="font-semibold">Lịch xem phòng: </span>
                    {new Date(booking.scheduledViewing.date).toLocaleDateString('vi-VN')} lúc {booking.scheduledViewing.time}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE: SẮP XẾP LỊCH XEM */}
          {mode === 'schedule' && (
            <div className="space-y-4">
              {/* GỢI Ý: khung giờ khách đã cho biết rảnh lúc đăng ký */}
              {prefTimes.length > 0 ? (
                <div className="p-3 bg-gold-light/40 border border-gold/40 rounded-lg text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-ink mb-2">
                    <Sparkles className="w-4 h-4 text-gold" /> Khách đã cho biết khung giờ rảnh
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {prefTimes.filter(p => TIME_SLOT_INFO[p]).map(p => (
                      <span key={p} className="px-2 py-1 rounded-full bg-white border border-gold/40 text-xs">
                        {TIME_SLOT_INFO[p].icon} {TIME_SLOT_INFO[p].label}
                        <span className="text-ink-muted"> ({TIME_SLOT_INFO[p].desc})</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted mt-2">
                    Liên hệ ưa thích: <strong className="text-ink-soft">{
                      { phone: 'Gọi điện', sms: 'Tin nhắn SMS', email: 'Email', zalo: 'Zalo' }[booking.contactPreference.preferredMethod] || '—'
                    }</strong>
                    {booking.contactPreference.notes && <> · “{booking.contactPreference.notes}”</>}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-warm-white border border-cream-dark rounded-lg text-xs text-ink-muted">
                  Khách chưa cho biết khung giờ rảnh cụ thể — bạn chủ động liên hệ để chốt giờ phù hợp.
                </div>
              )}

              <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-sm text-ink-soft">
                <AlertCircle className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
                <span>Sau khi sắp xếp, hệ thống sẽ thông báo lịch hẹn cho khách qua {booking.contactPreference.preferredMethod === 'phone' ? 'điện thoại' : booking.contactPreference.preferredMethod}.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Ngày xem phòng</label>
                <input
                  type="date"
                  value={scheduleData.date}
                  onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark focus:outline-none focus:border-terracotta-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Khung giờ</label>
                <div className="grid grid-cols-4 gap-2">
                  {VIEWING_SLOTS.map(slot => {
                    const rec = isSlotRecommended(slot)
                    const selected = scheduleData.time === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => setScheduleData({ ...scheduleData, time: slot })}
                        title={rec ? 'Khách rảnh khung giờ này' : undefined}
                        className={`relative px-3 py-2 rounded-lg text-sm font-semibold border-[1.5px] transition ${
                          selected
                            ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-600'
                            : rec
                              ? 'border-gold bg-gold-light/40 text-ink'
                              : 'border-cream-dark text-ink-soft hover:border-terracotta-300'
                        }`}
                      >
                        {slot}
                        {rec && !selected && (
                          <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-gold border border-white" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {prefTimes.length > 0 && (
                  <p className="text-[11px] text-ink-muted mt-2 flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-gold align-middle" />
                    Chấm vàng = khung giờ khách đã báo rảnh, nên ưu tiên chọn.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* MODE: TỪ CHỐI */}
          {mode === 'reject' && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-ink-soft">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>Đơn bị từ chối khi khách không đủ điều kiện lưu trú hoặc phòng không còn phù hợp.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Lý do từ chối</label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Ví dụ: Phòng đã hết chỗ / Khách không đủ điều kiện giới tính của khu vực..."
                  className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-3 text-sm focus:outline-none focus:border-terracotta-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER — actions thay đổi theo trạng thái + mode */}
        <div className="p-4 border-t border-cream-dark bg-warm-white">
          {mode === 'view' && (
            <div className="flex gap-2 flex-wrap">
              {booking.status === 'pending_confirm' && (
                <>
                  <Button variant="outline" className="text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => setMode('reject')}>
                    <XCircle className="w-4 h-4" /> Từ chối
                  </Button>
                  <Button onClick={handleAccept} className="flex-1">
                    <CheckCheck className="w-4 h-4" /> Tiếp nhận & kiểm tra
                  </Button>
                </>
              )}
              {booking.status === 'checking' && (
                <>
                  <Button variant="outline" className="text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => setMode('reject')}>
                    <XCircle className="w-4 h-4" /> Từ chối
                  </Button>
                  <Button onClick={() => { setScheduleData(d => ({ ...d, time: d.time || firstRecommendedSlot })); setMode('schedule') }} className="flex-1">
                    <Calendar className="w-4 h-4" /> Sắp xếp lịch xem
                  </Button>
                </>
              )}
              {booking.status === 'viewing_scheduled' && (
                <Button onClick={handleMarkViewed} className="flex-1">
                  <Eye className="w-4 h-4" /> Đánh dấu đã xem phòng
                </Button>
              )}
              {booking.status === 'viewed' && (
                <Button
                  className="flex-1"
                  onClick={() => { navigate(`/staff/sale/deposits?focus=${booking.code}`); onClose() }}
                >
                  <CreditCard className="w-4 h-4" /> Lập phiếu đặt cọc
                </Button>
              )}
              {(booking.status === 'rejected' || booking.status === 'deposit_created') && (
                <div className="w-full text-center text-sm text-ink-muted">
                  Đơn đã được xử lý xong.
                  {booking.rejectReason && <div className="mt-1 text-red-500">Lý do từ chối: {booking.rejectReason}</div>}
                </div>
              )}
            </div>
          )}

          {mode === 'schedule' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
              <Button onClick={handleSchedule} className="flex-1">
                <CheckCircle2 className="w-4 h-4" /> Xác nhận lịch xem
              </Button>
            </div>
          )}

          {mode === 'reject' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
              <Button onClick={handleReject} className="flex-1 !bg-red-500 hover:!bg-red-600">
                <XCircle className="w-4 h-4" /> Xác nhận từ chối
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// === Sub components ===
function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i}>
            <div className="text-xs text-ink-muted">{item.label}</div>
            <div className="font-semibold text-sm flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5 text-ink-muted" />}
              {item.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}