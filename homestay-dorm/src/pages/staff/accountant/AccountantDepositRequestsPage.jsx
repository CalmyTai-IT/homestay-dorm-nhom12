import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { DEPOSIT_SLIP_CONFIG } from '@/lib/saleUi'
import { timeAgo } from '@/lib/statsHelpers'
import { Wallet, Search, MapPin, Phone, Clock, X, ChevronRight, CreditCard, AlertCircle, FileText, Loader2 } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'awaiting_payment', label: 'Chờ khách thanh toán' },
  { id: 'paid', label: 'Khách đã thanh toán' },
]

// Trạng thái phiếu cọc (API) -> trạng thái mà UI/cấu hình dùng.
// cho_duyet = khách ĐÃ nộp, Kế toán đã đối soát, chờ Quản lý chốt -> coi là "đã thanh toán" (paid).
const SLIP_STATUS = { cho_thanh_toan: 'awaiting_payment', cho_duyet: 'paid', da_thanh_toan: 'confirmed', da_huy: 'cancelled' }
function mapSlip(d) {
  const beds = Number(d.so_giuong || 0)
  return {
    code: d.ma_phieu,
    status: SLIP_STATUS[d.trang_thai] || 'awaiting_payment',
    createdAt: d.thoi_diem_tao,
    deadline: d.han_thanh_toan,
    paidAt: d.thoi_diem_doi_soat || d.thoi_diem_chot || null,
    customer: { fullName: d.ho_ten || '—', phone: d.so_dien_thoai || '', email: d.email || '' },
    roomId: d.ma_phong || '—',
    branch: d.ten_chi_nhanh || '',
    rentType: beds && Number(d.suc_chua) === beds ? 'whole_room' : 'shared_bed',
    numberOfBeds: beds,
    pricePerBed: Number(d.gia_thue_giuong || 0),
    depositAmount: Number(d.so_tien_coc || 0),
    receivedAmount: Number(d.so_tien_thuc_nhan || 0),   // đã nhận (ca khách trả thiếu) — để tính "còn phải thu"
  }
}

export default function AccountantDepositRequestsPage() {
  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let alive = true
    api.listDeposits()
      .then(rows => { if (alive) setSlips(rows.map(mapSlip)) })
      .catch(err => { if (alive) setLoadError(err.message || 'Không tải được danh sách phiếu cọc') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filteredSlips = useMemo(() => {
    let list = slips
    if (activeTab !== 'all') list = list.filter(s => s.status === activeTab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.customer.fullName.toLowerCase().includes(q) ||
        s.roomId.toLowerCase().includes(q)
      )
    }
    return list
  }, [slips, activeTab, search])

  const stats = useMemo(() => ({
    awaiting: slips.filter(s => s.status === 'awaiting_payment').length,
    paid: slips.filter(s => s.status === 'paid').length,
    confirmed: slips.filter(s => s.status === 'confirmed').length,
    totalAmount: slips.filter(s => s.status === 'awaiting_payment')
      .reduce((sum, s) => sum + Math.max(0, s.depositAmount - s.receivedAmount), 0),
  }), [slips])

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Yêu cầu thanh toán cọc</h1>
        <p className="text-ink-soft text-sm">Theo dõi các phiếu cọc NV Sale đã gửi cho khách</p>
      </div>

      {/* INFO BAR */}
      <Card className="p-4 mb-6 bg-gold-light/30 border-gold/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-ink mb-1">Vai trò của bạn</div>
            <p className="text-ink-soft text-xs">
              Theo dõi các phiếu yêu cầu thanh toán cọc do NV Sale lập. Khi khách thanh toán, giao dịch sẽ xuất hiện ở mục
              <strong className="text-ink"> "Đối soát thanh toán"</strong> để bạn xác nhận tính hợp lệ.
            </p>
          </div>
        </div>
      </Card>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gold" />
            <span className="text-xs text-ink-muted">Chờ thanh toán</span>
          </div>
          <div className="font-display text-2xl font-bold text-gold">{stats.awaiting}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-terracotta-600" />
            <span className="text-xs text-ink-muted">Đã thanh toán</span>
          </div>
          <div className="font-display text-2xl font-bold text-terracotta-600">{stats.paid}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-mint-dark" />
            <span className="text-xs text-ink-muted">Đã xác nhận</span>
          </div>
          <div className="font-display text-2xl font-bold text-mint-dark">{stats.confirmed}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-ink" />
            <span className="text-xs text-ink-muted">Tổng đang chờ</span>
          </div>
          <div className="font-display text-2xl font-bold">{(stats.totalAmount/1000000).toFixed(1)}tr</div>
        </Card>
      </div>

      {/* FILTERS */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <Input
              placeholder="Tìm theo mã phiếu, tên khách, mã phòng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 border border-cream-dark rounded-lg p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === tab.id ? 'bg-gold text-white' : 'text-ink-soft hover:bg-warm-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-ink-muted ml-auto">
            <strong>{filteredSlips.length}</strong> phiếu
          </div>
        </div>
      </Card>

      {/* LIST */}
      {loading ? (
        <Card className="p-16 text-center">
          <Loader2 className="w-8 h-8 text-gold mx-auto mb-3 animate-spin" />
          <p className="text-sm text-ink-soft">Đang tải danh sách phiếu cọc…</p>
        </Card>
      ) : loadError ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h3 className="font-display font-bold text-lg mb-1">Không tải được dữ liệu</h3>
          <p className="text-sm text-ink-soft mb-4">{loadError}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Thử lại</Button>
        </Card>
      ) : filteredSlips.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">💳</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có phiếu nào</h3>
          <p className="text-sm text-ink-soft">Các phiếu cọc Sale lập sẽ hiển thị tại đây</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSlips.map(slip => (
            <SlipCard key={slip.code} slip={slip} onView={() => setViewing(slip)} />
          ))}
        </div>
      )}

      {viewing && <SlipDetailModal slip={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function SlipCard({ slip, onView }) {
  const cfg = DEPOSIT_SLIP_CONFIG[slip.status]
  const isExpired = new Date(slip.deadline) < new Date() && slip.status === 'awaiting_payment'

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-gold-light rounded-full flex items-center justify-center text-gold font-display font-bold flex-shrink-0">
          {slip.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{slip.customer.fullName}</span>
            {cfg && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>}
            {isExpired && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                Quá hạn
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{slip.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{slip.roomId} ({slip.branch})</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{slip.customer.phone}</span>
          </div>
          {slip.status === 'awaiting_payment' && (
            <div className={`text-xs font-medium flex items-center gap-1 mt-1 ${isExpired ? 'text-red-600' : 'text-gold'}`}>
              <Clock className="w-3 h-3" />
              Hạn: {new Date(slip.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền cọc</div>
          <div className="font-display font-bold text-terracotta-600">{slip.depositAmount.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">{timeAgo(slip.createdAt)}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onView} className="flex-shrink-0">
          Xem <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}

function SlipDetailModal({ slip, onClose }) {
  const cfg = DEPOSIT_SLIP_CONFIG[slip.status]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gold-light rounded-2xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Phiếu cọc {slip.code}</h2>
              <p className="text-xs text-ink-muted">
                {cfg && <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          <div className="bg-warm-white rounded-xl p-4 text-center border border-cream-dark">
            <div className="text-xs text-ink-muted mb-1">Số tiền cọc cần thu</div>
            <div className="font-display text-3xl font-bold text-terracotta-500">{slip.depositAmount.toLocaleString('vi-VN')}đ</div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Khách hàng</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{slip.customer.fullName}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold">{slip.customer.phone}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Email:</span><span className="font-semibold text-xs">{slip.customer.email}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Thông tin thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{slip.roomId} — {slip.branch}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Hình thức:</span><span className="font-semibold">{slip.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Số giường:</span><span className="font-semibold">{slip.numberOfBeds} giường</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Giá/giường:</span><span className="font-semibold">{slip.pricePerBed.toLocaleString('vi-VN')}đ</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Thời gian</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Lập phiếu:</span><span className="font-semibold">{new Date(slip.createdAt).toLocaleString('vi-VN')}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Hạn thanh toán:</span><span className="font-semibold">{new Date(slip.deadline).toLocaleString('vi-VN')}</span></div>
            </div>
          </div>

          {slip.status === 'paid' && (
            <div className="p-3 bg-terracotta-50 border border-terracotta-200 rounded-lg flex items-start gap-2 text-sm text-ink-soft">
              <AlertCircle className="w-4 h-4 text-terracotta-600 mt-0.5 flex-shrink-0" />
              <span>Khách đã thanh toán. Vui lòng vào mục <strong className="text-ink">"Đối soát thanh toán"</strong> để xác nhận tính hợp lệ.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
