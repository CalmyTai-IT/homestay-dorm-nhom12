import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculateStayDuration, CHECKOUT_STATUS_CONFIG } from '@/lib/managerUi'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

import { Home, CheckCircle2, Clock, X, MapPin, Phone, Calendar, AlertCircle, Zap, Droplet, Plus, Trash2, Send, Eye, TrendingDown, FileCheck, Calculator, ArrowRight } from 'lucide-react'

// Trạng thái phiếu trả phòng (DB) -> trạng thái UI
const CHECKOUT_STATUS_MAP = {
  cho_kiem_tra: 'requested', cho_doi_soat: 'inspected', cho_thanh_ly: 'inspected', hoan_tat: 'completed',
}
const asObj = (v) => (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v)
function mapCheckout(t) {
  const insp = asObj(t.ket_qua_kiem_tra) || null
  return {
    code: t.ma_phieu,
    contractCode: t.ma_hop_dong,
    status: CHECKOUT_STATUS_MAP[t.trang_thai] || 'requested',
    createdAt: t.ngay_dang_ky,
    customer: { fullName: t.ho_ten || '—', phone: t.so_dien_thoai || '', email: t.email || '' },
    roomId: t.ma_phong || '—',
    branch: t.ten_chi_nhanh || '',
    requestedCheckoutDate: t.ngay_tra_du_kien || t.ngay_dang_ky,
    reason: t.ly_do || '',
    handoverInfo: { electricStart: insp?.electricStart ?? 0, waterStart: insp?.waterStart ?? 0 },
    contractInfo: {
      depositAmount: Number(t.so_tien_coc || 0),
      startDate: t.ngay_bat_dau,
      endDate: t.ngay_ket_thuc,
    },
    inspection: insp,
  }
}

const TABS = [
  { id: 'requested', label: 'Chờ kiểm tra', icon: Clock },
  { id: 'inspected', label: 'Đã kiểm tra', icon: FileCheck },
  { id: 'completed', label: 'Hoàn tất', icon: CheckCircle2 },
]

export default function ManagerCheckoutsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('requested')
  const [inspectingFor, setInspectingFor] = useState(null)
  const [viewing, setViewing] = useState(null)

  const refresh = () => {
    setLoading(true)
    api.listCheckouts()
      .then(rows => setRequests(rows.map(mapCheckout)))
      .catch(err => setLoadError(err.message || 'Không tải được danh sách trả phòng'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const grouped = useMemo(() => ({
    requested: requests.filter(r => r.status === 'requested'),
    inspected: requests.filter(r => r.status === 'inspected'),
    completed: requests.filter(r => r.status === 'completed'),
  }), [requests])

  if (loading) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <div className="text-4xl mb-3 animate-pulse">🏠</div>
      <p className="text-sm text-ink-soft">Đang tải danh sách trả phòng…</p>
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Trả phòng</h1>
        <p className="text-ink-soft text-sm">Kiểm tra hiện trạng phòng và lập yêu cầu hoàn cọc cho khách</p>
      </div>

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
                isActive ? 'border-mint text-mint-dark' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  isActive ? 'bg-mint-light text-mint-dark' : 'bg-cream-dark text-ink-soft'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {(grouped[activeTab] || []).length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có yêu cầu nào</h3>
          <p className="text-sm text-ink-soft">Yêu cầu trả phòng ở trạng thái này sẽ hiển thị tại đây</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map(req => (
            <CheckoutCard
              key={req.code}
              request={req}
              onAction={() => req.status === 'requested' ? setInspectingFor(req) : setViewing(req)}
            />
          ))}
        </div>
      )}

      {inspectingFor && (
        <InspectionModal
          request={inspectingFor}
          onClose={() => setInspectingFor(null)}
          onCompleted={() => { refresh(); setInspectingFor(null); setActiveTab('inspected') }}
        />
      )}

      {viewing && (
        <InspectionDetailModal request={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

// ============== CARD ==============
function CheckoutCard({ request, onAction }) {
  const cfg = CHECKOUT_STATUS_CONFIG[request.status]
  const reqDate = new Date(request.requestedCheckoutDate)
  const today = new Date()
  const daysUntil = Math.ceil((reqDate - today) / (1000 * 60 * 60 * 24))

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-600 font-display font-bold flex-shrink-0">
          {request.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{request.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
            {request.status === 'requested' && (
              daysUntil < 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                  Quá hạn {Math.abs(daysUntil)} ngày
                </span>
              ) : daysUntil === 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">
                  Hôm nay
                </span>
              ) : daysUntil <= 3 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">
                  Còn {daysUntil} ngày
                </span>
              ) : null
            )}
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{request.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{request.roomId} ({request.branch})</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{request.customer.phone}</span>
          </div>
          <div className="text-xs text-mint-dark font-medium flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3" />
            Ngày trả: {reqDate.toLocaleDateString('vi-VN')} · Lý do: {request.reason}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Cọc</div>
          <div className="font-display font-bold text-terracotta-600">{request.contractInfo.depositAmount.toLocaleString('vi-VN')}đ</div>
        </div>
        {request.status === 'requested' ? (
          <Button size="sm" onClick={onAction} variant="mint" className="flex-shrink-0">
            <FileCheck className="w-4 h-4" /> Kiểm tra
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onAction} className="flex-shrink-0">
            <Eye className="w-4 h-4" /> Xem
          </Button>
        )}
      </div>
    </Card>
  )
}

// ============== MODAL: KIỂM TRA TRẢ PHÒNG ==============
function InspectionModal({ request, onClose, onCompleted }) {
  const { user } = useAuth()

  // Quản lý nhập trực tiếp tiền điện/nước CÒN THIẾU (cách tính do QL tự kiểm soát, ngoài phạm vi app)
  const [dienOwed, setDienOwed] = useState('')
  const [nuocOwed, setNuocOwed] = useState('')
  const [damages, setDamages] = useState([])
  const [newDamage, setNewDamage] = useState({ label: '', amount: '' })
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Tổng khấu trừ dự kiến = điện thiếu + nước thiếu + hư hỏng
  const totalDeductions = useMemo(() => {
    return (Number(dienOwed) || 0) + (Number(nuocOwed) || 0) + damages.reduce((sum, d) => sum + d.amount, 0)
  }, [dienOwed, nuocOwed, damages])

  // Xác định tỷ lệ hoàn dựa trên thời gian lưu trú — tính tới NGÀY KHÁCH CHỌN RỜI ĐI
  // (request.requestedCheckoutDate = ngay_tra_du_kien), KHÔNG phải ngày hiện tại.
  const leaveDate = useMemo(() => new Date(request.requestedCheckoutDate), [request])
  const stayMonths = useMemo(() => {
    return calculateStayDuration(request.contractInfo.startDate, leaveDate)
  }, [request, leaveDate])

  const suggestedRefundRate = useMemo(() => {
    const endDate = new Date(request.contractInfo.endDate)
    if (leaveDate >= endDate) return 'expired'    // Rời đi sau khi HĐ hết hạn
    if (stayMonths >= 6) return 'over_6m'          // Lưu trú ≥ 6 tháng
    return 'under_6m'                              // Lưu trú < 6 tháng
  }, [stayMonths, request, leaveDate])

  const refundRateLabels = {
    expired: { label: 'Hết hạn HĐ', rate: 100 },
    over_6m: { label: 'Lưu trú ≥ 6 tháng', rate: 70 },
    under_6m: { label: 'Lưu trú < 6 tháng', rate: 50 },
  }

  const rateInfo = refundRateLabels[suggestedRefundRate]

  const addDamage = () => {
    if (!newDamage.label.trim() || !newDamage.amount || Number(newDamage.amount) <= 0) {
      alert('Vui lòng nhập đủ tên khoản và số tiền')
      return
    }
    setDamages([...damages, { label: newDamage.label.trim(), amount: Number(newDamage.amount) }])
    setNewDamage({ label: '', amount: '' })
  }

  const removeDamage = (idx) => {
    setDamages(damages.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!confirmed) { alert('Vui lòng tick xác nhận đã kiểm tra'); return }

    const dien = Number(dienOwed) || 0
    const nuoc = Number(nuocOwed) || 0
    const inspection = {
      inspectorName: user?.fullName || 'Quản lý',
      dienOwed: dien,
      nuocOwed: nuoc,
      damages,
      notes: notes.trim(),
      rentSituation: suggestedRefundRate,
      deductions: [
        ...(dien > 0 ? [{ label: 'Tiền điện còn thiếu', amount: dien }] : []),
        ...(nuoc > 0 ? [{ label: 'Tiền nước còn thiếu', amount: nuoc }] : []),
        ...damages,
      ],
      inspectedAt: new Date().toISOString(),
    }

    try {
      setSubmitting(true)
      // Lưu biên bản kiểm tra; phiếu chuyển sang chờ Kế toán đối soát (hoàn cọc)
      await api.inspectCheckout(request.code, { ketQua: inspection, veSinh: notes.trim() })
      onCompleted()
    } catch (e) {
      alert(e.message || 'Không lưu được biên bản kiểm tra')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Kiểm tra trả phòng</h2>
              <p className="text-xs text-ink-muted">{request.code} · {request.customer.fullName} · {request.roomId}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* Tóm tắt hợp đồng */}
          <div className="bg-warm-white rounded-xl p-4 border border-cream-dark">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tóm tắt hợp đồng</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-ink-muted">Bắt đầu:</span> <strong>{new Date(request.contractInfo.startDate).toLocaleDateString('vi-VN')}</strong></div>
              <div><span className="text-ink-muted">Kết thúc:</span> <strong>{new Date(request.contractInfo.endDate).toLocaleDateString('vi-VN')}</strong></div>
              <div className="text-mint-dark"><span className="text-ink-muted">Ngày khách rời đi:</span> <strong>{leaveDate.toLocaleDateString('vi-VN')}</strong></div>
              <div><span className="text-ink-muted">Lưu trú tới ngày rời:</span> <strong>{stayMonths} tháng</strong></div>
              <div className="col-span-2"><span className="text-ink-muted">Cọc:</span> <strong>{request.contractInfo.depositAmount.toLocaleString('vi-VN')}đ</strong></div>
            </div>
          </div>

          {/* 1. Tiền điện/nước còn thiếu (Quản lý nhập trực tiếp) */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">1. Tiền điện / nước còn thiếu</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-gold" /> Tiền điện còn thiếu (đ)
                </label>
                <Input type="number" placeholder="0" value={dienOwed} onChange={e => setDienOwed(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-mint-dark" /> Tiền nước còn thiếu (đ)
                </label>
                <Input type="number" placeholder="0" value={nuocOwed} onChange={e => setNuocOwed(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-ink-muted mt-2">Số tiền do Quản lý ghi nhận &amp; kiểm soát. Để trống nếu không có khoản thiếu.</p>
          </div>

          {/* 2. Hư hỏng */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">2. Hư hỏng / mất mát (nếu có)</h3>
            {damages.length > 0 && (
              <div className="space-y-2 mb-3">
                {damages.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-warm-white rounded-lg">
                    <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-sm">{d.label}</span>
                    <span className="font-semibold text-red-600 text-sm">{d.amount.toLocaleString('vi-VN')}đ</span>
                    <button onClick={() => removeDamage(i)} className="text-red-500 hover:bg-red-50 rounded p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Tên khoản (vd: Vỡ kính cửa)"
                value={newDamage.label}
                onChange={e => setNewDamage({ ...newDamage, label: e.target.value })}
                className="flex-1 text-sm"
              />
              <Input
                type="number"
                placeholder="Số tiền"
                value={newDamage.amount}
                onChange={e => setNewDamage({ ...newDamage, amount: e.target.value })}
                className="w-32 text-sm"
              />
              <Button variant="outline" size="icon" onClick={addDamage}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 3. Ghi chú */}
          <div>
            <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">3. Ghi chú tổng quan</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Tình trạng phòng tổng thể, các điểm cần lưu ý cho Kế toán..."
              className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-2.5 text-sm focus:outline-none focus:border-mint"
            />
          </div>

          {/* Tóm tắt sẽ chuyển sang Kế toán */}
          {rateInfo && (
            <div className="bg-cream rounded-xl p-4 border border-cream-dark">
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" /> Tóm tắt chuyển Kế toán
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-ink-soft">Cọc đã đóng:</span><span className="font-semibold">{request.contractInfo.depositAmount.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Tỷ lệ hoàn đề xuất:</span><span className="font-semibold text-mint-dark">{rateInfo.rate}% ({rateInfo.label})</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Tổng khấu trừ:</span><span className="font-semibold text-red-600">−{totalDeductions.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between pt-2 border-t border-cream-dark mt-2">
                  <span className="font-display font-bold">Hoàn dự kiến:</span>
                  <span className="font-display font-bold text-mint-dark">
                    {Math.max(0, Math.floor(request.contractInfo.depositAmount * rateInfo.rate / 100) - totalDeductions).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-ink-muted mt-2">Kế toán sẽ chốt số liệu cuối cùng và thực hiện hoàn tiền</p>
            </div>
          )}

          {/* Cảnh báo */}
          <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
            <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
            <span>Sau khi xác nhận, hệ thống sẽ tự động tạo yêu cầu hoàn cọc và chuyển sang Kế toán xử lý.</span>
          </div>

          <label className="flex items-start gap-2 p-3 bg-warm-white rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="accent-mint w-4 h-4 mt-0.5"
            />
            <span className="text-xs text-ink-soft">
              Tôi xác nhận đã <strong className="text-ink">kiểm tra đầy đủ</strong> hiện trạng phòng cùng khách thuê và các thông tin trên là chính xác.
            </span>
          </label>
        </div>

        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !confirmed}
            variant="mint"
            className="flex-1"
          >
            {submitting ? 'Đang xử lý...' : <><Send className="w-4 h-4" /> Hoàn tất & chuyển Kế toán</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============== MODAL: XEM CHI TIẾT ==============
function InspectionDetailModal({ request, onClose }) {
  const i = request.inspection
  if (!i) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <Home className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Biên bản kiểm tra trả phòng</h2>
              <p className="text-xs text-ink-muted">{request.code} · {request.customer.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark">
            <CheckCircle2 className="w-4 h-4" />
            Đã kiểm tra bởi <strong>{i.inspectorName}</strong> lúc {new Date(i.inspectedAt || request.inspectedAt).toLocaleString('vi-VN')}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Các khoản khấu trừ</h3>
            {(i.deductions?.length > 0) ? (
              <div className="space-y-2">
                {i.deductions.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-warm-white rounded-lg">
                    <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-sm">{d.label}</span>
                    <span className="font-semibold text-red-600 text-sm">{Number(d.amount).toLocaleString('vi-VN')}đ</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Không có khoản khấu trừ</p>
            )}
          </div>

          {i.notes && (
            <div>
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">Ghi chú</h3>
              <p className="text-sm text-ink-soft p-3 bg-warm-white rounded-lg">{i.notes}</p>
            </div>
          )}

          <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark">
            <ArrowRight className="w-4 h-4" />
            Yêu cầu hoàn cọc đã được chuyển sang Kế toán xử lý
          </div>
        </div>
      </div>
    </div>
  )
}