import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { reconcilePayment, PAYMENT_STATUS_CONFIG, PAYMENT_TYPES } from '@/lib/accountantUi'
import { api } from '@/lib/api'


// Trạng thái phiếu cọc (DB) -> trạng thái giao dịch UI
const PAY_STATUS = { cho_thanh_toan: 'pending', cho_duyet: 'reviewed', da_thanh_toan: 'confirmed', da_huy: 'not_found' }
function mapTxn(d) {
  const status = PAY_STATUS[d.trang_thai] || 'pending'
  const amount = Number(d.so_tien_coc || 0)
  const received = d.so_tien_thuc_nhan != null ? Number(d.so_tien_thuc_nhan) : null
  // Lần đối soát trước nhận THIẾU -> phiếu vẫn ở "Chờ đối soát"; ghi nhớ phần còn thiếu để Kế toán đối soát lại
  const shortfall = (status === 'pending' && received != null && received < amount) ? amount - received : 0
  return {
    code: d.ma_phieu,
    status,
    method: d.hinh_thuc === 'tien_mat' ? 'cash' : 'bank',
    type: 'deposit',
    customer: { fullName: d.ho_ten || '—', phone: d.so_dien_thoai || '', email: d.email || '' },
    roomId: d.ma_phong || '—',
    branch: d.ten_chi_nhanh || '',
    amount,
    receivedAmount: status === 'confirmed' ? amount : received,
    shortfall,
    createdAt: d.thoi_diem_tao,
    submittedAt: d.thoi_diem_tao,
    reconciledAt: d.thoi_diem_doi_soat || null,   // mốc Kế toán đối soát
    confirmedAt: d.thoi_diem_chot || null,        // mốc Quản lý chốt
    accountantName: d.ten_doi_soat || '',
    slipCode: d.ma_phieu,
    proofImage: d.minh_chung_ck || null,
    refundAccount: (d.tk_hoan_so || d.tk_hoan_ngan_hang || d.tk_hoan_chu_tk)
      ? { so: d.tk_hoan_so, nganHang: d.tk_hoan_ngan_hang, chuTk: d.tk_hoan_chu_tk } : null,
    notFoundReason: d.ly_do_huy || '',   // lý do Kế toán ghi khi "Không tìm thấy giao dịch"
  }
}
import { CreditCard, CheckCircle2, Clock, X, MapPin, Phone, Banknote, FileImage, AlertCircle, ChevronRight, CheckCheck, TrendingDown, TrendingUp, SearchX } from 'lucide-react'

const TABS = [
  { id: 'pending', label: 'Chờ đối soát', icon: Clock },
  { id: 'confirmed', label: 'Khớp đủ', icon: CheckCircle2 },
  { id: 'not_found', label: 'Không tìm thấy', icon: SearchX },
]

export default function AccountantPaymentsPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [selected, setSelected] = useState(null)

  const refresh = () => {
    setLoading(true)
    api.listDeposits()
      .then(rows => setTransactions(rows.map(mapTxn)))
      .catch(err => setLoadError(err.message || 'Không tải được danh sách giao dịch'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const grouped = useMemo(() => ({
    pending: transactions.filter(t => t.status === 'pending'),
    confirmed: transactions.filter(t => t.status === 'confirmed'),
    not_found: transactions.filter(t => t.status === 'not_found'),
  }), [transactions])

  if (loading) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <div className="text-4xl mb-3 animate-pulse">💳</div>
      <p className="text-sm text-ink-soft">Đang tải danh sách giao dịch…</p>
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
        <h1 className="font-display text-2xl font-bold">Đối soát thanh toán</h1>
        <p className="text-ink-soft text-sm">Xác nhận tính hợp lệ của các giao dịch khách đã thanh toán</p>
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
          <div className="text-5xl mb-3">💳</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có giao dịch nào</h3>
          <p className="text-sm text-ink-soft">Giao dịch ở trạng thái này sẽ hiển thị tại đây</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map(txn => (
            <TransactionCard key={txn.code} txn={txn} onOpen={() => setSelected(txn)} />
          ))}
        </div>
      )}

      {/* MODAL ĐỐI SOÁT */}
      {selected && (
        <ReconcileModal
          txn={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { refresh(); setSelected(null) }}
        />
      )}

    </div>
  )
}

// ============== CARD ==============
function TransactionCard({ txn, onOpen }) {
  const cfg = PAYMENT_STATUS_CONFIG[txn.status]
  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
          txn.method === 'cash' ? 'bg-mint-light text-mint-dark' : 'bg-gold-light text-gold'
        }`}>
          {txn.method === 'cash' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{txn.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-cream-dark text-ink-soft">
              {PAYMENT_TYPES[txn.type]}
            </span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{txn.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{txn.roomId} ({txn.branch})</span>
            <span>·</span>
            <span>{txn.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
          </div>
          {/* Phiếu từng nhận thiếu -> nhắc Kế toán đối soát lại */}
          {txn.shortfall > 0 && (
            <div className="text-xs text-terracotta-600 font-medium flex items-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3" /> Đã nhận {txn.receivedAmount?.toLocaleString('vi-VN')}đ · còn thiếu {txn.shortfall.toLocaleString('vi-VN')}đ — cần đối soát lại
            </div>
          )}
          {txn.status === 'overpaid' && txn.excess && (
            <div className="text-xs text-gold font-medium flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Dư {txn.excess.toLocaleString('vi-VN')}đ — cần hoàn lại khách
            </div>
          )}
          {txn.status === 'not_found' && txn.notFoundReason && (
            <div className="text-xs text-red-500 font-medium flex items-start gap-1 mt-1">
              <SearchX className="w-3 h-3 mt-0.5 flex-shrink-0" /> Lý do từ chối: {txn.notFoundReason}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Cần thu</div>
          <div className="font-display font-bold text-mint-dark">{txn.amount.toLocaleString('vi-VN')}đ</div>
          {txn.receivedAmount != null && txn.receivedAmount !== txn.amount && (
            <div className="text-[10px] text-ink-muted">Nhận: {txn.receivedAmount.toLocaleString('vi-VN')}đ</div>
          )}
        </div>
        {txn.status === 'pending' ? (
          <Button size="sm" onClick={onOpen} className="flex-shrink-0">
            Đối soát <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onOpen} className="flex-shrink-0">Xem</Button>
        )}
      </div>
    </Card>
  )
}

// ============== MODAL ĐỐI SOÁT ==============
function ReconcileModal({ txn, onClose, onUpdated }) {
  // mode: 'view' | 'check' (nhập số tiền thực nhận) | 'notfound'
  const [mode, setMode] = useState('view')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [notFoundReason, setNotFoundReason] = useState('')
  const [zoomProof, setZoomProof] = useState(false)   // phóng to ảnh chứng từ trong trang

  // Kết quả đối soát tạm tính (khi đang nhập số tiền)
  const reconcileResult = receivedAmount !== ''
    ? reconcilePayment(txn.amount, Number(receivedAmount))
    : null

  // Xác nhận kết quả đối soát (bước 1: Kế toán). Đủ/Dư -> chuyển Quản lý duyệt; Thiếu -> báo khách bổ sung.
  const handleConfirmReconcile = async () => {
    if (receivedAmount === '' || Number(receivedAmount) < 0) {
      alert('Vui lòng nhập số tiền thực nhận hợp lệ')
      return
    }
    try {
      const out = await api.reconcileDeposit(txn.code, { soTienThucNhan: Number(receivedAmount) })
      if (out.result === 'insufficient') {
        alert(`Đã thông báo khách bổ sung ${Number(out.shortfall).toLocaleString('vi-VN')}đ. Phiếu vẫn chờ cho đến khi nhận đủ.`)
      } else if (out.result === 'excess') {
        alert(`Đối soát xong (khách dư ${Number(out.excess).toLocaleString('vi-VN')}đ — sẽ đối trừ tiền thuê kỳ đầu). Đã chuyển Quản lý duyệt.`)
      } else {
        alert('Đối soát hợp lệ. Đã chuyển Quản lý duyệt.')
      }
      onUpdated()
    } catch (e) {
      alert(e.message || 'Không đối soát được giao dịch')
    }
  }

  // Đánh dấu không tìm thấy giao dịch
  const handleNotFound = async () => {
    if (!notFoundReason.trim()) {
      alert('Vui lòng nhập ghi chú')
      return
    }
    try {
      await api.cancelDeposit(txn.code, notFoundReason.trim())
      onUpdated()
    } catch (e) {
      alert(e.message || 'Không cập nhật được')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      {zoomProof && txn.proofImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={(e) => { e.stopPropagation(); setZoomProof(false) }}
        >
          <img src={txn.proofImage} alt="Biên lai chuyển khoản" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              txn.method === 'cash' ? 'bg-mint-light' : 'bg-gold-light'
            }`}>
              {txn.method === 'cash' ? <Banknote className="w-6 h-6 text-mint-dark" /> : <CreditCard className="w-6 h-6 text-gold" />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Đối soát giao dịch</h2>
              <p className="text-xs text-ink-muted">{txn.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* MODE VIEW */}
          {mode === 'view' && (
            <div className="space-y-5">
              {/* Số tiền cần thu */}
              <div className="bg-warm-white rounded-xl p-4 text-center border border-cream-dark">
                <div className="text-xs text-ink-muted mb-1">Số tiền cần thu</div>
                <div className="font-display text-3xl font-bold text-terracotta-500">{txn.amount.toLocaleString('vi-VN')}đ</div>
                <div className="text-xs text-ink-muted mt-1">{PAYMENT_TYPES[txn.type]} · {txn.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
              </div>

              {/* Thông tin khách */}
              <div>
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Khách hàng</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{txn.customer.fullName}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold flex items-center gap-1"><Phone className="w-3 h-3" />{txn.customer.phone}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{txn.roomId} — {txn.branch}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Phiếu liên quan:</span><span className="font-semibold">{txn.slipCode}</span></div>
                </div>
              </div>

              {/* Chứng từ chuyển khoản khách tải lên — chỉ áp dụng cho đơn CHUYỂN KHOẢN.
                  Đơn tiền mặt không cần chứng từ nên ẩn hẳn mục này. */}
              {txn.method !== 'cash' && (
              <div>
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Chứng từ khách tải lên</h3>
                {txn.proofImage ? (
                  <>
                    <button type="button" onClick={() => setZoomProof(true)} className="block w-full cursor-zoom-in">
                      <img
                        src={txn.proofImage}
                        alt="Biên lai chuyển khoản"
                        className="w-full max-h-80 object-contain rounded-xl border border-cream-dark bg-warm-white"
                      />
                    </button>
                    <p className="text-xs text-ink-muted mt-2">Bấm vào ảnh để xem lớn. Đối chiếu với sao kê ngân hàng trước khi xác nhận.</p>
                  </>
                ) : (
                  <div className="p-3 bg-warm-white rounded-lg text-xs text-ink-muted flex items-center gap-2">
                    <FileImage className="w-4 h-4" /> Khách chưa tải lên chứng từ. Đối soát theo sao kê ngân hàng.
                  </div>
                )}
              </div>
              )}

              {/* TK nhận hoàn tiền khách cung cấp — để hoàn cọc nếu phiếu bị hủy/từ chối */}
              {txn.method !== 'cash' && txn.refundAccount && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tài khoản nhận hoàn tiền</h3>
                  <div className="p-3 bg-warm-white rounded-lg text-sm space-y-0.5">
                    <div className="flex justify-between"><span className="text-ink-soft">Số TK:</span><span className="font-semibold">{txn.refundAccount.so || '—'}</span></div>
                    {txn.refundAccount.nganHang && <div className="flex justify-between"><span className="text-ink-soft">Ngân hàng:</span><span className="font-semibold">{txn.refundAccount.nganHang}</span></div>}
                    {txn.refundAccount.chuTk && <div className="flex justify-between"><span className="text-ink-soft">Chủ TK:</span><span className="font-semibold">{txn.refundAccount.chuTk}</span></div>}
                  </div>
                  <p className="text-xs text-ink-muted mt-2">Dùng khi cần hoàn cọc cho khách (nếu phiếu bị từ chối/hủy).</p>
                </div>
              )}
            </div>
          )}

          {/* MODE CHECK — nhập số tiền thực nhận */}
          {mode === 'check' && (
            <div className="space-y-5">
              <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
                <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <span>Tra cứu sao kê ngân hàng và nhập <strong className="text-ink">số tiền thực tế đã nhận được</strong>. Hệ thống sẽ tự động đối chiếu với số cần thu.</span>
              </div>

              <div className="bg-warm-white rounded-xl p-4 border border-cream-dark">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-ink-soft">Số tiền cần thu:</span>
                  <span className="font-display font-bold text-lg">{txn.amount.toLocaleString('vi-VN')}đ</span>
                </div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Số tiền thực nhận (theo sao kê)</label>
                <Input
                  type="number"
                  placeholder="Nhập số tiền..."
                  value={receivedAmount}
                  onChange={e => setReceivedAmount(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                />
                {/* Nút điền nhanh = đúng số tiền */}
                <button
                  onClick={() => setReceivedAmount(txn.amount.toString())}
                  className="text-xs text-terracotta-500 font-semibold hover:underline mt-2"
                >
                  Điền đúng số cần thu ({txn.amount.toLocaleString('vi-VN')}đ)
                </button>
              </div>

              {/* Kết quả tạm tính */}
              {reconcileResult && (
                <div className={`rounded-xl p-4 border ${
                  reconcileResult.status === 'confirmed' ? 'bg-mint-light/40 border-mint/30' :
                  reconcileResult.status === 'underpaid' ? 'bg-terracotta-50 border-terracotta-200' :
                  'bg-gold-light/40 border-gold/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {reconcileResult.status === 'confirmed' && <CheckCircle2 className="w-5 h-5 text-mint-dark" />}
                    {reconcileResult.status === 'underpaid' && <TrendingDown className="w-5 h-5 text-terracotta-600" />}
                    {reconcileResult.status === 'overpaid' && <TrendingUp className="w-5 h-5 text-gold" />}
                    <span className="font-display font-bold">{reconcileResult.message}</span>
                  </div>

                  {reconcileResult.status === 'underpaid' && (
                    <div className="text-sm text-ink-soft space-y-1">
                      <div className="flex justify-between"><span>Đã nhận:</span><span className="font-semibold">{Number(receivedAmount).toLocaleString('vi-VN')}đ</span></div>
                      <div className="flex justify-between text-terracotta-600"><span>Còn thiếu:</span><span className="font-bold">{reconcileResult.shortfall.toLocaleString('vi-VN')}đ</span></div>
                      <p className="text-xs pt-2 border-t border-terracotta-200 mt-2">
                        ✓ Số tiền đã nhận vẫn được giữ. Hệ thống sẽ yêu cầu khách chuyển bù phần còn thiếu.
                      </p>
                    </div>
                  )}

                  {reconcileResult.status === 'overpaid' && (
                    <div className="text-sm text-ink-soft space-y-1">
                      <div className="flex justify-between"><span>Đã nhận:</span><span className="font-semibold">{Number(receivedAmount).toLocaleString('vi-VN')}đ</span></div>
                      <div className="flex justify-between text-gold"><span>Dư:</span><span className="font-bold">{reconcileResult.excess.toLocaleString('vi-VN')}đ</span></div>
                      <p className="text-xs pt-2 border-t border-gold/30 mt-2">
                        ✓ Cọc được ghi nhận đủ. Phần dư sẽ được hoàn lại cho khách.
                      </p>
                    </div>
                  )}

                  {reconcileResult.status === 'confirmed' && (
                    <p className="text-sm text-ink-soft">Số tiền khớp chính xác. Giao dịch sẽ được xác nhận hợp lệ.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODE NOT FOUND */}
          {mode === 'notfound' && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-ink-soft">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>Chỉ chọn mục này khi <strong className="text-ink">không tìm thấy bất kỳ khoản tiền nào vào tài khoản</strong>. Khách sẽ được yêu cầu kiểm tra lại giao dịch.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Ghi chú</label>
                <textarea
                  rows={4}
                  value={notFoundReason}
                  onChange={e => setNotFoundReason(e.target.value)}
                  placeholder="Ví dụ: Không tìm thấy giao dịch nào với nội dung này trong sao kê 24h qua / Khách có thể chuyển nhầm tài khoản..."
                  className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-3 text-sm focus:outline-none focus:border-terracotta-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {txn.status === 'pending' && (
          <div className="p-4 border-t border-cream-dark bg-warm-white">
            {mode === 'view' && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => setMode('notfound')}>
                  <SearchX className="w-4 h-4" /> Không tìm thấy
                </Button>
                <Button className="flex-1" onClick={() => setMode('check')}>
                  <CheckCheck className="w-4 h-4" /> Bắt đầu đối soát
                </Button>
              </div>
            )}
            {mode === 'check' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
                <Button onClick={handleConfirmReconcile} disabled={!reconcileResult} className="flex-1">
                  <CheckCircle2 className="w-4 h-4" /> Xác nhận kết quả
                </Button>
              </div>
            )}
            {mode === 'notfound' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1">Quay lại</Button>
                <Button onClick={handleNotFound} className="flex-1 !bg-red-500 hover:!bg-red-600">
                  <SearchX className="w-4 h-4" /> Xác nhận không tìm thấy
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
