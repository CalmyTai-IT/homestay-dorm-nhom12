import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { calculateRefund, REFUND_STATUS_CONFIG, REFUND_RATE_RULES } from '@/lib/accountantUi'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/statsHelpers'

// Trạng thái phiếu trả phòng (DB) -> trạng thái hoàn cọc UI
const REFUND_STATUS_MAP = { cho_doi_soat: 'pending', cho_thanh_ly: 'calculated', hoan_tat: 'completed' }
const asObj = (v) => (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v)
// Mỗi phiếu trả phòng (đã kiểm tra) là một yêu cầu hoàn cọc
function mapRefund(t) {
  const insp = asObj(t.ket_qua_kiem_tra) || {}
  const hoanThuc = Number(t.so_tien_hoan_thuc_te || 0)
  return {
    code: t.ma_phieu,
    status: REFUND_STATUS_MAP[t.trang_thai] || 'pending',
    customer: { fullName: t.ho_ten || '—', phone: t.so_dien_thoai || '', email: t.email || '' },
    roomId: t.ma_phong || '—',
    branch: t.ten_chi_nhanh || '',
    depositAmount: Number(t.so_tien_coc || 0),
    rentSituation: insp.rentSituation || 'under_6m',
    deductions: insp.deductions || [],
    createdAt: t.ngay_dang_ky,
    completedAt: t.ngay_dang_ky,
    leaveDate: t.ngay_tra_du_kien || null,        // ngày khách chọn rời đi (cơ sở tính tỷ lệ hoàn)
    contractStart: t.ngay_bat_dau || null,
    contractCode: t.ma_hop_dong,
    calculation: t.ty_le_hoan_coc != null ? {
      rate: Number(t.ty_le_hoan_coc),
      baseRefund: Number(t.hoan_coc_co_ban || 0),
      totalDeduction: Number(t.tong_khau_tru || 0),
      finalRefund: hoanThuc,
      actualRefund: Math.max(0, hoanThuc),
      customerOwes: hoanThuc < 0 ? Math.abs(hoanThuc) : 0,
    } : null,
  }
}
import { Calculator, CheckCircle2, Clock, X, MapPin, Phone, ChevronRight, AlertCircle, TrendingDown, Wallet, FileText, RotateCcw, Users } from 'lucide-react'

const TABS = [
  { id: 'pending', label: 'Chờ xử lý', icon: Clock },
  { id: 'calculated', label: 'Đã đối soát', icon: FileText },
  { id: 'cancel_refunds', label: 'Hủy đơn (80%)', icon: TrendingDown },
  { id: 'rejected', label: 'Cọc từ chối', icon: RotateCcw },
  { id: 'partial_refunds', label: 'Giảm giường (nhóm)', icon: Users },
  { id: 'completed', label: 'Đã hoàn tiền', icon: CheckCircle2 },
]

export default function AccountantRefundsPage() {
  const [refunds, setRefunds] = useState([])
  const [rejectedRefunds, setRejectedRefunds] = useState([])
  const [cancelRefunds, setCancelRefunds] = useState([])
  const [partialRefunds, setPartialRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [selected, setSelected] = useState(null)

  const refresh = () => {
    setLoading(true)
    api.listCheckouts()
      .then(rows => setRefunds(
        rows.filter(t => ['cho_doi_soat', 'cho_thanh_ly', 'hoan_tat'].includes(t.trang_thai)).map(mapRefund)
      ))
      .catch(err => setLoadError(err.message || 'Không tải được danh sách hoàn cọc'))
      .finally(() => setLoading(false))
    // Cọc bị Quản lý TỪ CHỐI (đã nhận tiền) -> hoàn 100%
    api.listRejectedRefunds().then(setRejectedRefunds).catch(() => {})
    // Hủy đơn đã cọc (chưa ký HĐ) đã được Quản lý duyệt -> chờ Kế toán hoàn 80%
    api.listCancelRequests('pending_accountant').then(setCancelRefunds).catch(() => {})
    // Thuê nhóm — giảm giường: hoàn phần cọc dư của giường bị loại
    api.listPartialRefunds().then(setPartialRefunds).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const grouped = useMemo(() => ({
    pending: refunds.filter(r => r.status === 'pending'),
    calculated: refunds.filter(r => r.status === 'calculated'),
    cancel_refunds: cancelRefunds,
    rejected: rejectedRefunds,
    partial_refunds: partialRefunds,
    completed: refunds.filter(r => r.status === 'completed'),
  }), [refunds, rejectedRefunds, cancelRefunds, partialRefunds])

  if (loading) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <div className="text-4xl mb-3 animate-pulse">💰</div>
      <p className="text-sm text-ink-soft">Đang tải danh sách hoàn cọc…</p>
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
        <h1 className="font-display text-2xl font-bold">Hoàn cọc</h1>
        <p className="text-ink-soft text-sm">Tính tỷ lệ hoàn, khấu trừ chi phí và thực hiện hoàn cọc cho khách</p>
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
      {(grouped[activeTab] || []).length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">{activeTab === 'rejected' ? '🔁' : activeTab === 'cancel_refunds' ? '↩️' : activeTab === 'partial_refunds' ? '🛏️' : '💰'}</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có yêu cầu nào</h3>
          <p className="text-sm text-ink-soft">
            {activeTab === 'rejected'
              ? 'Cọc bị Quản lý từ chối (đã nhận tiền) sẽ hiển thị tại đây để hoàn cho khách'
              : activeTab === 'cancel_refunds'
              ? 'Đơn đã cọc được Quản lý duyệt hủy sẽ hiển thị tại đây để hoàn 80% cho khách'
              : activeTab === 'partial_refunds'
              ? 'Nhóm thuê bị giảm giường (thành viên không đủ điều kiện) sẽ hiển thị tại đây để hoàn phần cọc dư'
              : 'Yêu cầu hoàn cọc ở trạng thái này sẽ hiển thị tại đây'}
          </p>
        </Card>
      ) : activeTab === 'rejected' ? (
        <div className="space-y-3">
          {grouped.rejected.map(r => (
            <RejectedRefundCard key={r.ma_phieu} dep={r} onDone={refresh} />
          ))}
        </div>
      ) : activeTab === 'cancel_refunds' ? (
        <div className="space-y-3">
          {grouped.cancel_refunds.map(r => (
            <CancelRefundCard key={r.ma_phieu} req={r} onDone={refresh} />
          ))}
        </div>
      ) : activeTab === 'partial_refunds' ? (
        <div className="space-y-3">
          {grouped.partial_refunds.map(r => (
            <PartialRefundCard key={r.ma_phieu} dep={r} onDone={refresh} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map(refund => (
            <RefundCard key={refund.code} refund={refund} onOpen={() => setSelected(refund)} />
          ))}
        </div>
      )}

      {/* MODAL */}
      {selected && (
        <RefundModal
          refund={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { refresh(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ============== CARD ==============
// Thẻ cọc BỊ TỪ CHỐI chờ hoàn — Kế toán hoàn TOÀN BỘ số khách đã nộp (100%)
function RejectedRefundCard({ dep, onDone }) {
  const [submitting, setSubmitting] = useState(false)
  const coc = Number(dep.so_tien_coc || 0)
  const hoan = Math.round(coc * 0.8)            // hoàn 80% theo quy định đề (đã cọc, chưa ký HĐ)
  const isCK = (dep.hinh_thuc || (dep.minh_chung_ck ? 'chuyen_khoan' : 'tien_mat')) === 'chuyen_khoan'
  const doRefund = async () => {
    if (submitting) return
    if (!window.confirm(`Hoàn 80% tiền cọc (${hoan.toLocaleString('vi-VN')}đ) cho khách — phiếu ${dep.ma_phieu}?`)) return
    try {
      setSubmitting(true)
      await api.refundRejectedDeposit(dep.ma_phieu)
      onDone?.()
    } catch (e) {
      alert(e.message || 'Không hoàn cọc được')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
          <RotateCcw className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{dep.ho_ten || '—'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">Bị từ chối · chờ hoàn</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>Cọc {dep.ma_phieu}</span>
            {dep.ma_phong && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{dep.ma_phong} ({dep.ten_chi_nhanh})</span></>}
            {dep.so_dien_thoai && <><span>·</span><span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{dep.so_dien_thoai}</span></>}
          </div>
          {dep.ly_do_huy && <div className="text-xs text-red-600 mt-1">Lý do từ chối: {dep.ly_do_huy}</div>}
          {/* TK nhận hoàn tiền (nếu khách chuyển khoản) */}
          {(dep.tk_hoan_so || isCK) && (
            <div className="text-xs mt-1 p-2 rounded-lg bg-cream-light/70 border border-cream-dark">
              <span className="font-semibold text-ink-soft">Hoàn về TK: </span>
              {dep.tk_hoan_so
                ? <span>{dep.tk_hoan_so}{dep.tk_hoan_ngan_hang ? ` · ${dep.tk_hoan_ngan_hang}` : ''}{dep.tk_hoan_chu_tk ? ` · ${dep.tk_hoan_chu_tk}` : ''}</span>
                : <span className="text-ink-muted">khách CK nhưng chưa cung cấp TK — hoàn về tài khoản nguồn hoặc liên hệ khách</span>}
            </div>
          )}
          {!isCK && <div className="text-xs text-ink-muted mt-1">Hình thức: tiền mặt — hoàn tại chi nhánh</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Hoàn cho khách (80%)</div>
          <div className="font-display font-bold text-mint-dark">{hoan.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">trên cọc {coc.toLocaleString('vi-VN')}đ</div>
          <Button size="sm" disabled={submitting} onClick={doRefund} className="mt-2 !bg-mint hover:!bg-mint-dark">
            {submitting ? 'Đang hoàn...' : 'Hoàn 80%'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function RefundCard({ refund, onOpen }) {
  const cfg = REFUND_STATUS_CONFIG[refund.status]
  const rule = REFUND_RATE_RULES.find(r => r.key === refund.rentSituation)

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {refund.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{refund.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-cream-dark text-ink-soft">
              Hoàn {rule?.rate}%
            </span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{refund.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{refund.roomId} ({refund.branch})</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{refund.customer.phone}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền cọc</div>
          <div className="font-display font-bold text-terracotta-600">{refund.depositAmount.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">{timeAgo(refund.createdAt)}</div>
        </div>
        {refund.status === 'completed' ? (
          <Button size="sm" variant="outline" onClick={onOpen} className="flex-shrink-0">Xem</Button>
        ) : (
          <Button size="sm" onClick={onOpen} className="flex-shrink-0">
            Xử lý <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}

// ============== MODAL ==============
function RefundModal({ refund, onClose, onUpdated }) {
  // Tỷ lệ hoàn: nếu phiếu đã được đối soát thì lấy lại đúng tỷ lệ đã lưu;
  // ngược lại dùng gợi ý theo tình trạng lưu trú từ biên bản kiểm tra.
  const initialRateKey = (() => {
    const saved = refund.calculation?.rate
    if (saved != null) return REFUND_RATE_RULES.find(r => r.rate === saved)?.key || refund.rentSituation
    return refund.rentSituation
  })()
  const [rateKey, setRateKey] = useState(initialRateKey)
  // Các khoản khấu trừ
  const [deductions] = useState(refund.deductions || [])
  const [submitting, setSubmitting] = useState(false)
  const isCompleted = refund.status === 'completed'

  // Tính toán hoàn cọc realtime
  const calc = useMemo(
    () => calculateRefund(refund.depositAmount, rateKey, deductions),
    [refund.depositAmount, rateKey, deductions]
  )

  // Lưu đối soát (chưa hoàn tiền)
  const reconcilePayload = () => ({
    tyLe: REFUND_RATE_RULES.find(r => r.key === rateKey)?.rate ?? 0,
    khoanKhauTru: deductions.map(d => ({ loai: 'khac', moTa: d.label, soTien: d.amount })),
    hetHan: rateKey === 'expired',
  })

  const handleSaveCalculation = async () => {
    try {
      setSubmitting(true)
      await api.reconcileCheckout(refund.code, reconcilePayload())
      onUpdated()
    } catch (e) {
      alert(e.message || 'Không lưu được đối soát')
    } finally {
      setSubmitting(false)
    }
  }

  // Xác nhận đã hoàn tiền
  const handleCompleteRefund = async () => {
    try {
      setSubmitting(true)
      await api.reconcileCheckout(refund.code, reconcilePayload())  // chốt tỷ lệ + khấu trừ
      await api.settleCheckout(refund.code)                         // thanh lý HĐ + hoàn tiền
      onUpdated()
    } catch (e) {
      alert(e.message || 'Không hoàn tiền được')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Bảng đối soát hoàn cọc</h2>
              <p className="text-xs text-ink-muted">{refund.code} · {refund.customer.fullName} · Phòng {refund.roomId}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* Tiền cọc gốc */}
          <div className="bg-warm-white rounded-xl p-4 text-center border border-cream-dark">
            <div className="text-xs text-ink-muted mb-1">Tiền cọc đã đóng</div>
            <div className="font-display text-3xl font-bold text-terracotta-500">{refund.depositAmount.toLocaleString('vi-VN')}đ</div>
          </div>

          {/* Ngày khách rời đi — cơ sở để xác định tỷ lệ hoàn (lưu trú &lt;6 / ≥6 tháng) */}
          {(refund.leaveDate || refund.contractStart) && (
            <div className="bg-mint-light/30 border border-mint/30 rounded-xl p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
              {refund.contractStart && (
                <span><span className="text-ink-muted">Bắt đầu thuê: </span><strong>{new Date(refund.contractStart).toLocaleDateString('vi-VN')}</strong></span>
              )}
              <span><span className="text-ink-muted">Ngày khách rời đi: </span>
                <strong className="text-mint-dark">{refund.leaveDate ? new Date(refund.leaveDate).toLocaleDateString('vi-VN') : 'chưa ghi nhận'}</strong>
              </span>
            </div>
          )}

          {/* 1. Tỷ lệ hoàn */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">1. Tỷ lệ hoàn cơ bản</h3>
            <div className="space-y-2">
              {REFUND_RATE_RULES.map(rule => (
                <label
                  key={rule.key}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border-[1.5px] transition ${
                    isCompleted ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    rateKey === rule.key ? 'border-terracotta-500 bg-terracotta-50' : 'border-cream-dark hover:border-terracotta-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="rate"
                      checked={rateKey === rule.key}
                      onChange={() => !isCompleted && setRateKey(rule.key)}
                      disabled={isCompleted}
                      className="accent-terracotta-500"
                    />
                    <span className="text-sm">{rule.label}</span>
                  </div>
                  <span className="font-display font-bold text-terracotta-600">{rule.rate}%</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Khấu trừ — do Quản lý nhập khi kiểm tra phòng, Kế toán chỉ xem & xác nhận */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">2. Các khoản khấu trừ</h3>
            <p className="text-[11px] text-ink-muted mb-2">Do Quản lý ghi nhận khi kiểm tra phòng. Kế toán xác nhận, không chỉnh sửa.</p>
            {deductions.length > 0 ? (
              <div className="space-y-2">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-warm-white rounded-lg">
                    <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-sm">{d.label}</span>
                    <span className="font-semibold text-red-600 text-sm">−{d.amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Không có khoản khấu trừ</p>
            )}
          </div>

          {/* 3. Kết quả tính toán */}
          <div className="bg-cream rounded-xl p-4 border border-cream-dark">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">3. Kết quả đối soát</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Tiền cọc × {calc.rate}%</span>
                <span className="font-semibold">{calc.baseRefund.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Tổng khấu trừ</span>
                <span className="font-semibold text-red-600">−{calc.totalDeduction.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="border-t border-cream-dark pt-2 mt-2">
                {calc.finalRefund >= 0 ? (
                  <div className="flex justify-between items-baseline">
                    <span className="font-display font-bold flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-mint-dark" /> Thực hoàn cho khách
                    </span>
                    <span className="font-display text-2xl font-bold text-mint-dark">
                      {calc.actualRefund.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-display font-bold flex items-center gap-1.5 text-red-600">
                        <AlertCircle className="w-4 h-4" /> Khách phải nộp thêm
                      </span>
                      <span className="font-display text-2xl font-bold text-red-600">
                        {calc.customerOwes.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">
                      Khấu trừ vượt quá số cọc hoàn. Khách cần thanh toán thêm phần chênh lệch này.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trạng thái đã hoàn */}
          {isCompleted && (
            <div className="p-3 bg-mint-light/40 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark font-medium">
              <CheckCircle2 className="w-4 h-4" /> Đã hoàn tiền lúc {new Date(refund.completedAt).toLocaleString('vi-VN')}
            </div>
          )}
        </div>

        {/* FOOTER */}
        {!isCompleted && (
          <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
            <Button variant="outline" onClick={handleSaveCalculation} className="flex-1">
              <FileText className="w-4 h-4" /> Lưu đối soát
            </Button>
            <Button onClick={handleCompleteRefund} disabled={submitting} variant="mint" className="flex-1">
              {submitting ? 'Đang xử lý...' : <>
                <CheckCircle2 className="w-4 h-4" />
                {calc.finalRefund >= 0 ? 'Xác nhận đã hoàn tiền' : 'Xác nhận đã thu thêm'}
              </>}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Thẻ HỦY ĐƠN ĐÃ CỌC (chưa ký HĐ) đã được Quản lý duyệt — Kế toán hoàn 80% tiền cọc
function CancelRefundCard({ req, onDone }) {
  const [busy, setBusy] = useState(false)
  const coc = Number(req.so_tien_coc || 0)
  const hoan = Math.round(coc * 0.8)
  const isCK = (req.coc_hinh_thuc || (req.tk_hoan_so ? 'chuyen_khoan' : 'tien_mat')) === 'chuyen_khoan'
  const reason = (req.tieu_chi || {}).cancelReason || ''
  const doRefund = async () => {
    if (busy) return
    if (!window.confirm(`Hoàn 80% tiền cọc (${hoan.toLocaleString('vi-VN')}đ) cho khách — đơn ${req.ma_phieu}?`)) return
    try { setBusy(true); await api.refundCancelDeposit(req.ma_phieu); onDone?.() }
    catch (e) { alert(e.message || 'Không hoàn cọc được') }
    finally { setBusy(false) }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-gold-light rounded-full flex items-center justify-center text-gold flex-shrink-0">
          <TrendingDown className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{req.ho_ten || '—'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">Hủy đơn · chờ hoàn 80%</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>Đơn {req.ma_phieu}</span>
            {req.coc_ma && <><span>·</span><span>Cọc {req.coc_ma}</span></>}
            {req.so_dien_thoai && <><span>·</span><span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{req.so_dien_thoai}</span></>}
          </div>
          {reason && <div className="text-xs text-ink-soft mt-1">Lý do hủy: {reason}</div>}
          {(req.tk_hoan_so || isCK) && (
            <div className="text-xs mt-1 p-2 rounded-lg bg-cream-light/70 border border-cream-dark">
              <span className="font-semibold text-ink-soft">Hoàn về TK: </span>
              {req.tk_hoan_so
                ? <span>{req.tk_hoan_so}{req.tk_hoan_ngan_hang ? ` · ${req.tk_hoan_ngan_hang}` : ''}{req.tk_hoan_chu_tk ? ` · ${req.tk_hoan_chu_tk}` : ''}</span>
                : <span className="text-ink-muted">khách CK nhưng chưa cung cấp TK — liên hệ khách</span>}
            </div>
          )}
          {!isCK && <div className="text-xs text-ink-muted mt-1">Hình thức: tiền mặt — hoàn tại chi nhánh</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Hoàn cho khách (80%)</div>
          <div className="font-display font-bold text-mint-dark">{hoan.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">trên cọc {coc.toLocaleString('vi-VN')}đ</div>
          <Button size="sm" disabled={busy} onClick={doRefund} className="mt-2 !bg-mint hover:!bg-mint-dark">
            {busy ? 'Đang hoàn...' : 'Hoàn 80%'}
          </Button>
        </div>
      </div>
    </Card>
  )
}


// Thẻ GIẢM GIƯỜNG (thuê nhóm): thành viên không đủ điều kiện -> trả giường, hoàn phần cọc dư
function PartialRefundCard({ dep, onDone }) {
  const [busy, setBusy] = useState(false)
  const pr = (dep.dk_tieu_chi || {}).partialRefund || {}
  const hoan = Number(pr.amount || 0)
  const isCK = (dep.hinh_thuc || (dep.minh_chung_ck ? 'chuyen_khoan' : 'tien_mat')) === 'chuyen_khoan'
  const doRefund = async () => {
    if (busy) return
    if (!window.confirm(`Hoàn ${hoan.toLocaleString('vi-VN')}đ (${pr.rate}% phần cọc của ${pr.beds} giường giảm bớt) — phiếu ${dep.ma_phieu}?`)) return
    try { setBusy(true); await api.refundPartialDeposit(dep.ma_phieu); onDone?.() }
    catch (e) { alert(e.message || 'Không hoàn cọc được') }
    finally { setBusy(false) }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark flex-shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{dep.ho_ten || '—'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-mint-light text-mint-dark">Nhóm · giảm {pr.beds} giường</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>Cọc {dep.ma_phieu}</span>
            {dep.ma_phong && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{dep.ma_phong} ({dep.ten_chi_nhanh})</span></>}
            {dep.so_dien_thoai && <><span>·</span><span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{dep.so_dien_thoai}</span></>}
          </div>
          <div className="text-xs text-ink-soft mt-1">Hợp đồng lập với số giường đã giảm; hoàn phần cọc dư của {pr.beds} giường không sử dụng.</div>
          {(dep.tk_hoan_so || isCK) && (
            <div className="text-xs mt-1 p-2 rounded-lg bg-cream-light/70 border border-cream-dark">
              <span className="font-semibold text-ink-soft">Hoàn về TK: </span>
              {dep.tk_hoan_so
                ? <span>{dep.tk_hoan_so}{dep.tk_hoan_ngan_hang ? ` · ${dep.tk_hoan_ngan_hang}` : ''}{dep.tk_hoan_chu_tk ? ` · ${dep.tk_hoan_chu_tk}` : ''}</span>
                : <span className="text-ink-muted">khách CK nhưng chưa cung cấp TK — liên hệ khách</span>}
            </div>
          )}
          {!isCK && <div className="text-xs text-ink-muted mt-1">Hình thức: tiền mặt — hoàn tại chi nhánh</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Hoàn cho khách ({pr.rate}%)</div>
          <div className="font-display font-bold text-mint-dark">{hoan.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">cọc giảm {Number(pr.reduction || 0).toLocaleString('vi-VN')}đ</div>
          <Button size="sm" disabled={busy} onClick={doRefund} className="mt-2 !bg-mint hover:!bg-mint-dark">
            {busy ? 'Đang hoàn...' : `Hoàn ${pr.rate}%`}
          </Button>
        </div>
      </div>
    </Card>
  )
}
