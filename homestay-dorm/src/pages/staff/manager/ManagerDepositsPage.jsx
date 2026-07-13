import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MANAGER_DEPOSIT_STATUS_CONFIG } from '@/lib/managerUi'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/utils'
import { timeAgo } from '@/lib/statsHelpers'
import { CreditCard, CheckCircle2, Clock, X, MapPin, Phone, Banknote, ChevronRight, CheckCheck, UserCheck, RotateCcw, XCircle, AlertTriangle } from 'lucide-react'

const TABS = [
  { id: 'pending_manager', label: 'Chờ xác nhận', icon: Clock },
  { id: 'cancel_requests', label: 'Yêu cầu hủy', icon: RotateCcw },
  { id: 'confirmed', label: 'Đã chốt cọc', icon: CheckCircle2 },
  { id: 'rejected', label: 'Đã từ chối', icon: XCircle },
]

// Map phiếu cọc (API) -> shape trang. Quản lý chỉ thấy phiếu ĐÃ được Kế toán đối soát (cho_duyet).
const DSTATUS = { cho_duyet: 'pending_manager', da_thanh_toan: 'confirmed', da_huy: 'rejected' }
function mapDeposit(d) {
  const status = DSTATUS[d.trang_thai]
  if (!status) return null   // cho_thanh_toan (chưa được kế toán đối soát, kể cả phiếu thiếu tiền) -> KHÔNG hiển thị cho Quản lý
  return {
    code: d.ma_phieu,
    status,
    customer: { fullName: d.ho_ten || '—', phone: d.so_dien_thoai || '', email: d.email || '', idNumber: d.so_giay_to || '' },
    roomId: d.ma_phong || '—',
    branch: d.ten_chi_nhanh || '',
    depositAmount: Number(d.so_tien_coc || 0),
    receivedAmount: d.so_tien_thuc_nhan != null ? Number(d.so_tien_thuc_nhan) : null,
    numberOfBeds: Number(d.so_giuong || 0),
    createdAt: d.thoi_diem_tao,
    deadline: d.han_thanh_toan,
    proofImage: d.minh_chung_ck || null,
    rejectReason: d.ly_do_huy || '',
    // Mốc thời gian + người thực hiện từng bước (để hiện trong "Lịch sử xử lý")
    accountantName: d.ten_doi_soat || 'Kế toán',
    accountantConfirmedAt: d.thoi_diem_doi_soat || null,
    managerName: d.ten_chot || 'Quản lý',
    managerConfirmedAt: d.thoi_diem_chot || null,
    rejectedBy: d.ten_chot || 'Quản lý',
    rejectedAt: d.thoi_diem_chot || null,
  }
}

export default function ManagerDepositsPage() {
  const [deposits, setDeposits] = useState([])
  const [cancelReqs, setCancelReqs] = useState([])
  const [activeTab, setActiveTab] = useState('pending_manager')
  const [selected, setSelected] = useState(null)

  const refresh = () => {
    api.listDeposits().then(rs => setDeposits(rs.map(mapDeposit).filter(Boolean))).catch(() => {})
    // Yêu cầu hủy đơn đã cọc do Sale lập, chờ Quản lý duyệt
    api.listCancelRequests('pending_manager').then(setCancelReqs).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const grouped = useMemo(() => ({
    pending_manager: deposits.filter(d => d.status === 'pending_manager'),
    cancel_requests: cancelReqs,
    confirmed: deposits.filter(d => d.status === 'confirmed'),
    rejected: deposits.filter(d => d.status === 'rejected'),
  }), [deposits, cancelReqs])

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Xác nhận cọc</h1>
        <p className="text-ink-soft text-sm">Duyệt cọc đã được kế toán đối soát hợp lệ — đây là bước chốt cuối cùng</p>
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
          <div className="text-5xl mb-3">💳</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có phiếu nào</h3>
          <p className="text-sm text-ink-soft">Cọc ở trạng thái này sẽ hiển thị tại đây</p>
        </Card>
      ) : activeTab === 'cancel_requests' ? (
        <div className="space-y-3">
          {grouped.cancel_requests.map(r => (
            <CancelRequestCard key={r.ma_phieu} req={r} onDone={refresh} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map(d => (
            <DepositCard key={d.code} deposit={d} onOpen={() => setSelected(d)} />
          ))}
        </div>
      )}

      {selected && (
        <ConfirmModal
          deposit={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { refresh(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// Thẻ yêu cầu hủy đơn đã cọc — Quản lý Duyệt / Từ chối (UC hủy: bước duyệt)
function DepositCard({ deposit, onOpen }) {
  const cfg = MANAGER_DEPOSIT_STATUS_CONFIG[deposit.status]
  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
          deposit.paymentMethod === 'cash' ? 'bg-mint-light text-mint-dark' : 'bg-gold-light text-gold'
        }`}>
          {deposit.paymentMethod === 'cash' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{deposit.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{deposit.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{deposit.roomId} ({deposit.branch})</span>
            <span>·</span>
            <span>{deposit.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'}</span>
          </div>
          {deposit.status === 'pending_manager' && (
            <div className="text-xs text-mint-dark font-medium flex items-center gap-1 mt-1">
              <UserCheck className="w-3 h-3" />
              Kế toán {deposit.accountantName} đã đối soát · {deposit.accountantConfirmedAt ? timeAgo(deposit.accountantConfirmedAt) : '—'}
            </div>
          )}
          {deposit.status === 'returned_to_accountant' && deposit.returnReason && (
            <div className="text-xs text-terracotta-600 font-medium flex items-center gap-1 mt-1">
              <RotateCcw className="w-3 h-3" /> Lý do trả về: {deposit.returnReason}
            </div>
          )}
          {deposit.status === 'rejected' && deposit.rejectReason && (
            <div className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
              <XCircle className="w-3 h-3" /> Lý do từ chối: {deposit.rejectReason}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display font-bold text-terracotta-600">{deposit.depositAmount.toLocaleString('vi-VN')}đ</div>
        </div>
        {deposit.status === 'pending_manager' ? (
          <Button size="sm" onClick={onOpen} variant="mint" className="flex-shrink-0">
            Xử lý <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onOpen} className="flex-shrink-0">Xem</Button>
        )}
      </div>
    </Card>
  )
}

function ConfirmModal({ deposit, onClose, onUpdated }) {

  // mode: 'view' | 'confirm' | 'return' | 'reject'
  const [mode, setMode] = useState('view')
  const [submitting, setSubmitting] = useState(false)

  // Form fields cho từng action
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnIssue, setReturnIssue] = useState('')   // loại vấn đề
  const [rejectReason, setRejectReason] = useState('')

  const isProcessed = deposit.status !== 'pending_manager'

  // === HANDLERS ===
  const handleConfirm = async () => {
    if (!confirmChecked) {
      alert('Vui lòng tick xác nhận đã kiểm tra')
      return
    }
    setSubmitting(true)
    try {
      // UC: Quản lý xác nhận đã nhận khoản cọc hợp lệ -> khoá giường, ghi giao dịch thu cọc
      // (backend tự suy hình thức tiền mặt/chuyển khoản theo chứng từ)
      await api.confirmDeposit(deposit.code, {})
      setSubmitting(false)
      onUpdated()
    } catch (e) {
      setSubmitting(false)
      alert(e.message || 'Không xác nhận được cọc')
    }
  }

  const handleReturn = async () => {
    if (!returnIssue || !returnReason.trim()) {
      alert('Vui lòng chọn loại vấn đề và nhập mô tả chi tiết')
      return
    }
    setSubmitting(true)
    try {
      await api.cancelDeposit(deposit.code, `Trả về: ${returnIssue} — ${returnReason.trim()}`)
      setSubmitting(false)
      onUpdated()
    } catch (e) {
      setSubmitting(false)
      alert(e.message || 'Không xử lý được')
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Vui lòng nhập lý do từ chối')
      return
    }
    setSubmitting(true)
    try {
      await api.cancelDeposit(deposit.code, rejectReason.trim())
      setSubmitting(false)
      onUpdated()
    } catch (e) {
      setSubmitting(false)
      alert(e.message || 'Không từ chối được cọc')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <CheckCheck className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Xác nhận cọc</h2>
              <p className="text-xs text-ink-muted">{deposit.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* THÔNG TIN CƠ BẢN — luôn hiển thị */}
          {mode === 'view' && (
            <>
              <div className="bg-warm-white rounded-xl p-4 text-center border border-cream-dark">
                <div className="text-xs text-ink-muted mb-1">Số tiền cọc</div>
                <div className="font-display text-3xl font-bold text-terracotta-500">{deposit.depositAmount.toLocaleString('vi-VN')}đ</div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Khách hàng</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{deposit.customer.fullName}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold">{deposit.customer.phone}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">CCCD:</span><span className="font-semibold">{deposit.customer.idNumber}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{deposit.roomId} — {deposit.branch}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Hình thức:</span><span className="font-semibold">{deposit.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'} · {deposit.numberOfBeds} giường</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Lịch sử xử lý</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-mint-light/30 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-mint-dark mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Kế toán đã đối soát hợp lệ</div>
                      <div className="text-xs text-ink-muted">{deposit.accountantName} · {fmtDateTime(deposit.accountantConfirmedAt)}</div>
                    </div>
                  </div>
                  {deposit.status === 'confirmed' && (
                    <div className="flex items-start gap-3 p-3 bg-mint-light/30 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-mint-dark mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Quản lý đã chốt cọc</div>
                        <div className="text-xs text-ink-muted">{deposit.managerName} · {fmtDateTime(deposit.managerConfirmedAt)}</div>
                      </div>
                    </div>
                  )}
                  {deposit.status === 'returned_to_accountant' && (
                    <div className="flex items-start gap-3 p-3 bg-terracotta-50 rounded-lg">
                      <RotateCcw className="w-5 h-5 text-terracotta-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-terracotta-600">Quản lý trả về kế toán</div>
                        <div className="text-xs text-ink-muted">{deposit.returnedBy} · {fmtDateTime(deposit.returnedAt)}</div>
                        <div className="text-xs text-ink-soft mt-1"><strong>Vấn đề:</strong> {deposit.returnIssue}</div>
                        <div className="text-xs text-ink-soft"><strong>Chi tiết:</strong> {deposit.returnReason}</div>
                      </div>
                    </div>
                  )}
                  {deposit.status === 'rejected' && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-red-600">Quản lý đã từ chối</div>
                        <div className="text-xs text-ink-muted">{deposit.rejectedBy} · {fmtDateTime(deposit.rejectedAt)}</div>
                        <div className="text-xs text-ink-soft mt-1"><strong>Lý do:</strong> {deposit.rejectReason}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* MODE: CHỐT CỌC */}
          {mode === 'confirm' && (
            <>
              <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
                <CheckCircle2 className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
                <span>Sau khi chốt cọc, hệ thống sẽ chuyển sang bước lập hợp đồng. Vui lòng rà soát kỹ trước khi xác nhận.</span>
              </div>
              <label className="flex items-start gap-2 p-3 bg-warm-white rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={e => setConfirmChecked(e.target.checked)}
                  className="accent-mint w-4 h-4 mt-0.5"
                />
                <span className="text-xs text-ink-soft">
                  Tôi xác nhận đã <strong className="text-ink">kiểm tra lại</strong> thông tin khách thuê, số tiền cọc và trạng thái đối soát của kế toán.
                </span>
              </label>
            </>
          )}

          {/* MODE: TRẢ VỀ KẾ TOÁN */}
          {mode === 'return' && (
            <>
              <div className="p-3 bg-terracotta-50 border border-terracotta-200 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
                <RotateCcw className="w-4 h-4 text-terracotta-600 mt-0.5 flex-shrink-0" />
                <span>Phiếu sẽ được gửi lại Kế toán để đối soát lại. Tiền khách đã chuyển <strong className="text-ink">vẫn được giữ nguyên</strong>.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Loại vấn đề *</label>
                <select
                  value={returnIssue}
                  onChange={e => setReturnIssue(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
                >
                  <option value="">— Chọn loại vấn đề —</option>
                  <option value="Sai số tiền">Số tiền không khớp giữa sao kê và phiếu thu</option>
                  <option value="Chứng từ chưa rõ">Chứng từ thanh toán không rõ ràng / mờ</option>
                  <option value="Thiếu thông tin">Thiếu thông tin khách thuê hoặc phiếu cọc</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Mô tả chi tiết *</label>
                <textarea
                  rows={4}
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="Ghi rõ vấn đề để Kế toán dễ kiểm tra lại..."
                  className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-3 text-sm focus:outline-none focus:border-terracotta-500"
                />
              </div>
            </>
          )}

          {/* MODE: TỪ CHỐI */}
          {mode === 'reject' && (
            <>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-ink block mb-1">Cẩn thận!</strong>
                  Khi từ chối, phiếu cọc sẽ bị hủy và <strong className="text-ink">kích hoạt quy trình hoàn cọc</strong> cho khách hàng. Chỉ chọn khi cọc không thể chốt được (vd: phòng hết chỗ, khách rút yêu cầu, CCCD không hợp lệ).
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Lý do từ chối *</label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="VD: Phòng đã được khách khác đặt trước / Khách rút yêu cầu thuê / CCCD không hợp lệ..."
                  className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-3 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        {!isProcessed && (
          <div className="p-4 border-t border-cream-dark bg-warm-white">
            {mode === 'view' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMode('reject')}
                  className="flex-1 text-red-500 hover:bg-red-50 hover:border-red-200"
                >
                  <XCircle className="w-4 h-4" /> Từ chối
                </Button>
                <Button
                  onClick={() => setMode('confirm')}
                  variant="mint"
                  className="flex-1"
                >
                  <CheckCheck className="w-4 h-4" /> Chốt cọc
                </Button>
              </div>
            )}

            {mode === 'confirm' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
                <Button onClick={handleConfirm} disabled={submitting || !confirmChecked} variant="mint" className="flex-1">
                  {submitting ? 'Đang xử lý...' : <><CheckCheck className="w-4 h-4" /> Xác nhận chốt</>}
                </Button>
              </div>
            )}

            {mode === 'return' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
                <Button
                  onClick={handleReturn}
                  disabled={submitting || !returnIssue || !returnReason.trim()}
                  className="flex-1 !bg-terracotta-500 hover:!bg-terracotta-600"
                >
                  {submitting ? 'Đang gửi...' : <><RotateCcw className="w-4 h-4" /> Trả về kế toán</>}
                </Button>
              </div>
            )}

            {mode === 'reject' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
                <Button
                  onClick={handleReject}
                  disabled={submitting || !rejectReason.trim()}
                  className="flex-1 !bg-red-500 hover:!bg-red-600"
                >
                  {submitting ? 'Đang xử lý...' : <><XCircle className="w-4 h-4" /> Xác nhận từ chối</>}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Thẻ YÊU CẦU HỦY đơn đã cọc (chưa ký HĐ) — Quản lý Duyệt / Từ chối (Kế toán hoàn 80% sau)
function CancelRequestCard({ req, onDone }) {
  const [busy, setBusy] = useState(false)
  const coc = Number(req.so_tien_coc || 0)
  const reason = (req.tieu_chi || {}).cancelReason || '—'
  const act = async (approve) => {
    if (busy) return
    if (approve && !window.confirm(`Duyệt hủy đơn ${req.ma_phieu}? Kế toán sẽ hoàn 80% (${Math.round(coc*0.8).toLocaleString('vi-VN')}đ) cho khách.`)) return
    try { setBusy(true); await api.approveCancelDeposit(req.ma_phieu, approve); onDone?.() }
    catch (e) { alert(e.message || 'Không xử lý được yêu cầu hủy') }
    finally { setBusy(false) }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-gold-light rounded-full flex items-center justify-center text-gold flex-shrink-0">
          <RotateCcw className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{req.ho_ten || '—'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">Yêu cầu hủy · chờ duyệt</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>Đơn {req.ma_phieu}</span>
            {req.coc_ma && <><span>·</span><span>Cọc {req.coc_ma}</span></>}
            {req.so_dien_thoai && <><span>·</span><span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{req.so_dien_thoai}</span></>}
          </div>
          <div className="text-xs text-ink-soft mt-1">Lý do hủy: {reason}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền cọc</div>
          <div className="font-display font-bold text-terracotta-600">{coc.toLocaleString('vi-VN')}đ</div>
          <div className="text-[10px] text-ink-muted">hoàn 80% nếu duyệt</div>
          <div className="flex gap-2 mt-2 justify-end">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(false)}
              className="text-red-500 hover:bg-red-50 hover:border-red-200">Từ chối</Button>
            <Button size="sm" variant="mint" disabled={busy} onClick={() => act(true)}>
              {busy ? '...' : 'Duyệt hủy'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

