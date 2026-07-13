import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { DEPOSIT_SLIP_CONFIG } from '@/lib/saleUi'
import { timeAgo } from '@/lib/statsHelpers'
import { Plus, X, Clock, CheckCircle2, MapPin, Phone, AlertCircle, FileText, Send, Calculator, Loader2 } from 'lucide-react'

const TABS = [
  { id: 'create', label: 'Lập phiếu mới', icon: Plus },
  { id: 'awaiting_payment', label: 'Chờ thanh toán', icon: Clock },
  { id: 'paid', label: 'Đã thanh toán', icon: CheckCircle2 },
  { id: 'confirmed', label: 'Đã xác nhận', icon: FileText },
]

// Công thức cọc (xem trước phía client; số tiền thật do API tính)
const previewDeposit = (pricePerBed, beds) => Number(pricePerBed || 0) * 2 * Number(beds || 0)

// Tra cứu phòng cho đơn: ưu tiên id số (roomDbId), fallback theo mã phòng
// (tương thích các đơn cũ chưa lưu roomDbId). roomsById được lập chỉ mục theo id số.
const resolveRoom = (roomsById, booking) =>
  roomsById[booking.roomDbId] || Object.values(roomsById).find(r => r.code === booking.roomId) || null

// Trạng thái phiếu cọc (API) -> trạng thái UI
// cho_duyet = khách đã nộp tiền + Kế toán đã đối soát, đang chờ Quản lý chốt -> hiển thị ở tab "Đã thanh toán"
const SLIP_STATUS = { cho_thanh_toan: 'awaiting_payment', cho_duyet: 'paid', da_thanh_toan: 'confirmed', da_huy: 'cancelled' }
function mapSlip(d) {
  const beds = Number(d.so_giuong || 0)
  return {
    code: d.ma_phieu,
    status: SLIP_STATUS[d.trang_thai] || 'awaiting_payment',
    createdAt: d.thoi_diem_tao,
    deadline: d.han_thanh_toan,
    customer: { fullName: d.ho_ten || '—', phone: d.so_dien_thoai || '', email: d.email || '' },
    roomId: d.ma_phong || '—',
    branch: d.ten_chi_nhanh || '',
    rentType: beds && Number(d.suc_chua) === beds ? 'whole_room' : 'shared_bed',
    numberOfBeds: beds,
    pricePerBed: Number(d.gia_thue_giuong || 0),
    depositAmount: Number(d.so_tien_coc || 0),
    bookingCode: d.dk_ma_phieu || null,                         // mã đơn ĐK (để lập yêu cầu hủy)
    cancelStage: (d.dk_tieu_chi || {}).cancelStage || null,     // tiến trình hủy (nếu có)
    hasContract: !!d.has_contract,                              // đã có HĐ thì không hủy ở đây
  }
}
// Đơn "đã xem phòng" (API) -> shape dùng trong trang
function mapViewed(b) {
  const tc = b.tieu_chi || {}
  return {
    id: b.id,                       // dùng làm phieuDangKyId khi lập cọc
    code: b.ma_phieu,
    khachHangId: b.khach_hang_id,
    customer: { fullName: b.ho_ten || '—', phone: b.so_dien_thoai || '', email: b.email || '', idNumber: b.so_giay_to || '' },
    roomId: tc.roomId,
    roomDbId: tc.roomDbId ?? null,   // id số của phòng (để lập cọc tra cứu đúng khi mã trùng giữa chi nhánh)
    rentType: tc.rentType,
    numberOfBeds: tc.numberOfBeds ?? 1,
  }
}

export default function SaleDepositsPage() {
  const [slips, setSlips] = useState([])
  const [viewedBookings, setViewedBookings] = useState([])
  const [roomsById, setRoomsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('create')
  const [creatingFor, setCreatingFor] = useState(null)
  const [searchParams] = useSearchParams()
  const focusCode = searchParams.get('focus')
  const focusedRef = useRef(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([api.listDeposits(), api.listBookings('da_xem_phong'), api.getRooms()])
      .then(([deps, viewed, rooms]) => {
        setSlips(deps.map(mapSlip))
        setViewedBookings(viewed.map(mapViewed))
        setRoomsById(Object.fromEntries(rooms.map(r => [r.id, r])))
      })
      .catch(err => setLoadError(err.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const groupedSlips = useMemo(() => ({
    awaiting_payment: slips.filter(s => s.status === 'awaiting_payment'),
    paid: slips.filter(s => s.status === 'paid'),
    confirmed: slips.filter(s => s.status === 'confirmed'),
  }), [slips])

  useEffect(() => {
    if (!focusCode || focusedRef.current === focusCode) return
    const tabId = TABS.find(t => (groupedSlips[t.id] || []).some(s => s.code === focusCode))?.id
    if (tabId) { setActiveTab(tabId); focusedRef.current = focusCode }
  }, [focusCode, groupedSlips])

  useEffect(() => {
    if (!focusCode) return
    const t = setTimeout(() => {
      document.getElementById(`item-${focusCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [focusCode, activeTab])

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Phiếu đặt cọc</h1>
        <p className="text-ink-soft text-sm">Lập phiếu cọc và gửi yêu cầu thanh toán cho khách</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-cream-dark mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          let count
          if (tab.id === 'create') count = viewedBookings.length
          else count = groupedSlips[tab.id]?.length || 0
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

      {/* Trạng thái tải / lỗi */}
      {loading ? (
        <Card className="p-16 text-center">
          <Loader2 className="w-8 h-8 text-terracotta-500 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-ink-soft">Đang tải dữ liệu…</p>
        </Card>
      ) : loadError ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h3 className="font-display font-bold text-lg mb-1">Không tải được dữ liệu</h3>
          <p className="text-sm text-ink-soft mb-4">{loadError}</p>
          <Button variant="outline" onClick={refresh}>Thử lại</Button>
        </Card>
      ) : (
        <>
          {/* TAB: LẬP PHIẾU MỚI */}
          {activeTab === 'create' && (
            <div>
              {viewedBookings.length === 0 ? (
                <Card className="p-16 text-center">
                  <div className="text-5xl mb-3">📋</div>
                  <h3 className="font-display font-bold text-lg mb-1">Chưa có đơn nào sẵn sàng lập cọc</h3>
                  <p className="text-sm text-ink-soft">Các đơn đã "đã xem phòng" trong mục Đơn đăng ký sẽ xuất hiện ở đây</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-sm text-ink-soft mb-4">
                    <AlertCircle className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
                    <span>Các đơn dưới đây đã xem phòng xong. Lập phiếu cọc để gửi yêu cầu thanh toán cho khách.</span>
                  </div>
                  {viewedBookings.map(booking => (
                    <ViewedBookingCard
                      key={booking.code}
                      booking={booking}
                      roomsById={roomsById}
                      onCreateDeposit={() => setCreatingFor(booking)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CÁC TRẠNG THÁI PHIẾU */}
          {activeTab !== 'create' && (
            <div>
              {(groupedSlips[activeTab] || []).length === 0 ? (
                <Card className="p-16 text-center">
                  <div className="text-5xl mb-3">💳</div>
                  <h3 className="font-display font-bold text-lg mb-1">Chưa có phiếu nào</h3>
                  <p className="text-sm text-ink-soft">Phiếu cọc ở trạng thái này sẽ hiển thị tại đây</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {groupedSlips[activeTab].map(slip => (
                    <div
                      key={slip.code}
                      id={`item-${slip.code}`}
                      className={slip.code === focusCode ? 'rounded-2xl ring-2 ring-gold ring-offset-2 transition' : ''}
                    >
                      <DepositSlipCard slip={slip} onChanged={refresh} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL LẬP PHIẾU CỌC */}
      {creatingFor && (
        <CreateDepositModal
          booking={creatingFor}
          roomsById={roomsById}
          onClose={() => setCreatingFor(null)}
          onCreated={() => {
            refresh()
            setCreatingFor(null)
            setActiveTab('awaiting_payment')
          }}
        />
      )}
    </div>
  )
}

// ============== CARD: ĐƠN ĐÃ XEM PHÒNG ==============
function ViewedBookingCard({ booking, roomsById, onCreateDeposit }) {
  const room = resolveRoom(roomsById, booking)
  const pricePerBed = room?.pricePerBed || 0
  const depositAmount = previewDeposit(pricePerBed, booking.numberOfBeds)

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {booking.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{booking.customer.fullName}</div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{booking.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{booking.roomId}</span>
            <span>·</span>
            <span>{booking.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'} · {booking.numberOfBeds} giường</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền cọc dự kiến</div>
          <div className="font-display font-bold text-terracotta-600">{depositAmount.toLocaleString('vi-VN')}đ</div>
        </div>
        <Button size="sm" onClick={onCreateDeposit} className="flex-shrink-0">
          <Plus className="w-4 h-4" /> Lập phiếu
        </Button>
      </div>
    </Card>
  )
}

// ============== CARD: PHIẾU CỌC ==============
function DepositSlipCard({ slip, onChanged }) {
  const cfg = DEPOSIT_SLIP_CONFIG[slip.status]
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Đơn đã cọc (đã chốt) nhưng CHƯA có hợp đồng -> Sale có thể lập yêu cầu hủy (hoàn 80%)
  const canRequestCancel = slip.status === 'confirmed' && !slip.hasContract && !slip.cancelStage
  const cancelBadge = slip.cancelStage === 'pending_manager' ? 'Chờ Quản lý duyệt hủy'
    : slip.cancelStage === 'pending_accountant' ? 'Chờ Kế toán hoàn cọc' : null

  const submitCancel = async () => {
    if (!reason.trim()) return
    try {
      setSubmitting(true)
      await api.requestCancelDeposit(slip.bookingCode, reason.trim())
      setAsking(false); setReason('')
      onChanged?.()
    } catch (e) {
      alert(e.message || 'Không gửi được yêu cầu hủy')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-600 font-display font-bold flex-shrink-0">
          {slip.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{slip.customer.fullName}</span>
            {cfg && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>}
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{slip.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{slip.roomId} ({slip.branch})</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{slip.customer.phone}</span>
          </div>
          {slip.status === 'awaiting_payment' && (
            <div className="text-xs text-gold font-medium flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              Hạn thanh toán: {new Date(slip.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền cọc</div>
          <div className="font-display font-bold text-terracotta-600">{slip.depositAmount.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted mt-0.5">{timeAgo(slip.createdAt)}</div>
        </div>
      </div>

      {/* Yêu cầu hủy đơn đã cọc (chưa ký HĐ) -> hoàn 80% */}
      {(canRequestCancel || cancelBadge) && (
        <div className="mt-3 pt-3 border-t border-cream-dark">
          {cancelBadge ? (
            <div className="text-xs font-medium text-gold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {cancelBadge}
            </div>
          ) : !asking ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-muted">Khách muốn hủy thuê (chưa ký hợp đồng)?</span>
              <Button size="sm" variant="outline" onClick={() => setAsking(true)}
                className="text-red-500 hover:bg-red-50 hover:border-red-200">
                <X className="w-4 h-4" /> Yêu cầu hủy
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-2.5 bg-gold-light/30 border border-gold/30 rounded-lg text-xs text-ink-soft flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <span>Yêu cầu sẽ chuyển Quản lý duyệt, sau đó Kế toán hoàn <strong className="text-ink">80%</strong> tiền cọc cho khách (theo quy định hủy trước khi ký HĐ).</span>
              </div>
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Lý do hủy (VD: khách đổi ý, không còn nhu cầu thuê...)"
                className="w-full rounded-lg border-[1.5px] border-cream-dark px-3 py-2 text-sm focus:outline-none focus:border-terracotta-500" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setAsking(false); setReason('') }} disabled={submitting}>Hủy bỏ</Button>
                <Button size="sm" onClick={submitCancel} disabled={submitting || !reason.trim()} className="!bg-red-500 hover:!bg-red-600">
                  {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4" /> Gửi yêu cầu</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ============== MODAL: LẬP PHIẾU CỌC ==============
function CreateDepositModal({ booking, roomsById, onClose, onCreated }) {
  const room = resolveRoom(roomsById, booking)
  const pricePerBed = room?.pricePerBed || 0
  const branch = room?.branch || ''
  const depositAmount = previewDeposit(pricePerBed, booking.numberOfBeds)
  const [submitting, setSubmitting] = useState(false)
  const [confirmedInfo, setConfirmedInfo] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!confirmedInfo) { setError('Vui lòng xác nhận đã rà soát thông tin khách thuê'); return }
    setError('')
    try {
      setSubmitting(true)
      await api.createDeposit({
        roomId: booking.roomDbId ?? booking.roomId,
        rentType: booking.rentType,
        numberOfBeds: booking.numberOfBeds,
        khachHangId: booking.khachHangId,
        phieuDangKyId: booking.id,     // liên kết phiếu đăng ký để chuỗi trạng thái chạy đúng
        bookingCode: booking.code,
      })
      onCreated()
    } catch (e) {
      setError(e.message || 'Không lập được phiếu cọc')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-terracotta-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-6 h-6 text-terracotta-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Lập phiếu đặt cọc</h2>
              <p className="text-xs text-ink-muted">Đơn {booking.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* Thông tin khách */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Khách thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{booking.customer.fullName}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold">{booking.customer.phone}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">CCCD:</span><span className="font-semibold">{booking.customer.idNumber || '—'}</span></div>
            </div>
          </div>

          {/* Thông tin thuê */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Thông tin thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{booking.roomId}{branch && ` — ${branch}`}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Hình thức:</span><span className="font-semibold">{booking.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Số giường:</span><span className="font-semibold">{booking.numberOfBeds} giường</span></div>
            </div>
          </div>

          {/* Tính tiền cọc */}
          <div className="bg-warm-white rounded-xl p-4 border border-cream-dark">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tính tiền cọc</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Tiền thuê/giường/tháng:</span>
                <span className="font-semibold">{pricePerBed.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Công thức:</span>
                <span className="font-medium text-xs">{(pricePerBed/1000000).toFixed(1)}tr × 2 tháng × {booking.numberOfBeds}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-cream-dark">
                <span className="font-display font-bold">Tổng tiền cọc:</span>
                <span className="font-display text-2xl font-bold text-terracotta-500">{depositAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>

          {/* Thời hạn */}
          <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
            <Clock className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
            <span>Khách có <strong className="text-ink">24 giờ</strong> để thanh toán kể từ khi nhận yêu cầu. Quá hạn, phiếu sẽ tự động hủy và phòng được giải phóng.</span>
          </div>

          {/* Checkbox rà soát */}
          <label className="flex items-start gap-2 p-3 bg-warm-white rounded-xl cursor-pointer">
            <input type="checkbox" checked={confirmedInfo} onChange={e => setConfirmedInfo(e.target.checked)} className="accent-terracotta-500 w-4 h-4 mt-0.5" />
            <span className="text-xs text-ink-soft">
              Tôi đã rà soát thông tin khách thuê và xác nhận khách <strong className="text-ink">đủ điều kiện lưu trú</strong> (giới tính, quốc tịch, giấy tờ) theo quy định của ký túc xá.
            </span>
          </label>

          {error && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</div>}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Hủy</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={submitting || !confirmedInfo}>
            {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4" /> Gửi yêu cầu thanh toán</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
