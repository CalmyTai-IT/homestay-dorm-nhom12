import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/statsHelpers'
import {
  ClipboardList, Send, Plus, X, MapPin, Phone, Calendar,
  AlertCircle, ArrowRight, Search, Home, CheckCircle2
} from 'lucide-react'

// Map hợp đồng (API, snake_case) -> shape card "hợp đồng đang hiệu lực"
function mapContract(h) {
  return {
    code: h.ma_hop_dong,
    customer: { fullName: h.ho_ten || '—', phone: h.so_dien_thoai || '' },
    roomId: h.ma_phong || '—',
    branch: h.ten_chi_nhanh || '',
    startDate: h.ngay_bat_dau,
    endDate: h.ngay_ket_thuc,
    depositAmount: Number(h.so_tien_coc || 0),
  }
}

const REASON_OPTIONS = [
  'Hết hạn hợp đồng, không gia hạn',
  'Chuyển công tác / chuyển trường',
  'Tài chính khó khăn',
  'Tìm được nơi ở khác phù hợp hơn',
  'Không hài lòng với dịch vụ',
  'Lý do cá nhân',
  'Khác',
]

export default function SaleCheckoutsPage() {
  const [activeContracts, setActiveContracts] = useState([])
  const [submittedRequests, setSubmittedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creatingFor, setCreatingFor] = useState(null)
  const [search, setSearch] = useState('')

  const refresh = () => {
    setLoading(true)
    setLoadError('')
    // HĐ đang hiệu lực + các phiếu trả phòng đã tạo (để loại HĐ đã có yêu cầu)
    Promise.all([api.listContracts('dang_hieu_luc'), api.listCheckouts()])
      .then(([contracts, checkouts]) => {
        const byCode = Object.fromEntries((contracts || []).map(h => [h.ma_hop_dong, h]))
        const requests = (checkouts || [])
          .filter(t => t.trang_thai !== 'hoan_tat')   // chỉ hiện yêu cầu đang xử lý
          .map(t => ({
            code: t.ma_phieu,
            contractCode: t.ma_hop_dong,
            customer: { fullName: t.ho_ten || '—' },
            roomId: byCode[t.ma_hop_dong]?.ma_phong || '—',  // checkout không kèm phòng → tra từ HĐ
            requestedCheckoutDate: t.ngay_tra_du_kien,
            reason: t.ly_do || '—',
            createdAt: t.ngay_dang_ky,
          }))
        const taken = new Set(requests.map(r => r.contractCode))
        setSubmittedRequests(requests)
        setActiveContracts((contracts || []).filter(h => !taken.has(h.ma_hop_dong)).map(mapContract))
      })
      .catch(err => setLoadError(err.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const filteredContracts = useMemo(() => {
    if (!search) return activeContracts
    return activeContracts.filter(c =>
      c.customer.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.roomId.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    )
  }, [activeContracts, search])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-sm text-ink-soft">Đang tải dữ liệu…</p>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-sm text-ink-soft mb-4">{loadError}</p>
        <Button variant="outline" onClick={refresh}>Thử lại</Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Yêu cầu trả phòng</h1>
        <p className="text-ink-soft text-sm">Tiếp nhận yêu cầu trả phòng từ khách hàng và chuyển sang Quản lý kiểm tra</p>
      </div>

      {/* INFO BAR */}
      <Card className="p-4 mb-6 bg-terracotta-50 border-terracotta-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-ink mb-1">Hướng dẫn quy trình</div>
            <ol className="text-ink-soft space-y-0.5 text-xs">
              <li>1. Khi khách gọi điện báo muốn trả phòng → tìm hợp đồng dưới đây</li>
              <li>2. Click <strong className="text-terracotta-600">"Tạo yêu cầu"</strong> → ghi rõ ngày khách muốn trả + lý do</li>
              <li>3. Hệ thống tự chuyển yêu cầu sang Quản lý để hẹn lịch kiểm tra phòng</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* SEARCH */}
      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <Input
            placeholder="Tìm theo tên khách, mã HĐ hoặc mã phòng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* DANH SÁCH HỢP ĐỒNG ĐANG HIỆU LỰC */}
      <div className="mb-6">
        <h2 className="font-display font-bold mb-3 flex items-center gap-2">
          <Home className="w-4 h-4" />
          Hợp đồng đang hiệu lực ({filteredContracts.length})
        </h2>
        {filteredContracts.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-5xl mb-3">📋</div>
            <h3 className="font-display font-bold mb-1">Không có hợp đồng nào</h3>
            <p className="text-sm text-ink-soft">
              {search ? 'Không khớp tìm kiếm' : 'Tất cả hợp đồng đã có yêu cầu trả phòng hoặc chưa được kích hoạt'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map(c => (
              <ContractCard
                key={c.code}
                contract={c}
                onCreate={() => setCreatingFor(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* YÊU CẦU ĐÃ GỬI */}
      {submittedRequests.length > 0 && (
        <div>
          <h2 className="font-display font-bold mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint-dark" />
            Yêu cầu đã gửi ({submittedRequests.length})
          </h2>
          <div className="space-y-3">
            {submittedRequests.map(r => (
              <SubmittedRequestCard key={r.code} request={r} />
            ))}
          </div>
        </div>
      )}

      {creatingFor && (
        <CreateRequestModal
          contract={creatingFor}
          onClose={() => setCreatingFor(null)}
          onCreated={() => { refresh(); setCreatingFor(null) }}
        />
      )}
    </div>
  )
}

// ============== CARD HĐ ==============
function ContractCard({ contract, onCreate }) {
  const endDate = new Date(contract.endDate)
  const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {contract.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{contract.customer.fullName}</span>
            {daysLeft <= 30 && daysLeft > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">
                Còn {daysLeft} ngày
              </span>
            )}
            {daysLeft <= 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                Hết hạn HĐ
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>HĐ {contract.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{contract.roomId} ({contract.branch})</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{contract.customer.phone}</span>
          </div>
          <div className="text-xs text-mint-dark font-medium flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3" />
            HĐ: {new Date(contract.startDate).toLocaleDateString('vi-VN')} → {endDate.toLocaleDateString('vi-VN')}
          </div>
        </div>
        <Button size="sm" onClick={onCreate} variant="outline" className="flex-shrink-0">
          <Plus className="w-4 h-4" /> Tạo yêu cầu
        </Button>
      </div>
    </Card>
  )
}

// ============== CARD YÊU CẦU ĐÃ GỬI ==============
function SubmittedRequestCard({ request }) {
  return (
    <Card className="p-4 opacity-75">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-cream-dark rounded-full flex items-center justify-center text-ink font-display font-bold flex-shrink-0">
          {request.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{request.customer.fullName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-mint-light text-mint-dark">
              Đã chuyển QL
            </span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{request.code}</span>
            <span>·</span>
            <span>{request.roomId}</span>
            <span>·</span>
            <span>Trả ngày {new Date(request.requestedCheckoutDate).toLocaleDateString('vi-VN')}</span>
          </div>
          <div className="text-xs text-ink-muted mt-1">Lý do: {request.reason}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <ArrowRight className="w-4 h-4 text-mint-dark" />
          <div className="text-[10px] text-ink-muted mt-1">{timeAgo(request.createdAt)}</div>
        </div>
      </div>
    </Card>
  )
}

// ============== MODAL TẠO YÊU CẦU ==============
function CreateRequestModal({ contract, onClose, onCreated }) {
  const [checkoutDate, setCheckoutDate] = useState('')
  const [reasonOption, setReasonOption] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!checkoutDate) {
      alert('Vui lòng chọn ngày khách muốn trả phòng')
      return
    }
    if (!reasonOption || (reasonOption === 'Khác' && !customReason.trim())) {
      alert('Vui lòng chọn / nhập lý do trả phòng')
      return
    }
    setSubmitting(true)

    const reason = reasonOption === 'Khác' ? customReason.trim() : reasonOption

    try {
      // UC-HT-09: tạo phiếu trả phòng (chuyển sang Quản lý kiểm tra)
      await api.registerCheckout({
        contractCode: contract.code,
        ngayTraDuKien: checkoutDate,
        lyDo: reason,
      })
      setSubmitting(false)
      onCreated()
    } catch (err) {
      setSubmitting(false)
      alert(err.message || 'Không tạo được yêu cầu trả phòng')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-terracotta-100 rounded-2xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-terracotta-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Tạo yêu cầu trả phòng</h2>
              <p className="text-xs text-ink-muted">HĐ {contract.code} · {contract.customer.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          {/* Thông tin HĐ */}
          <div className="bg-warm-white rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-soft">Khách:</span><span className="font-semibold">{contract.customer.fullName}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{contract.roomId} — {contract.branch}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">HĐ:</span><span className="font-semibold">{new Date(contract.startDate).toLocaleDateString('vi-VN')} → {new Date(contract.endDate).toLocaleDateString('vi-VN')}</span></div>
          </div>

          {/* Ngày trả */}
          <div>
            <Label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">
              Ngày khách muốn trả phòng *
            </Label>
            <Input
              type="date"
              value={checkoutDate}
              onChange={e => setCheckoutDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-[10px] text-ink-muted mt-1">Khách thường báo trước 30 ngày theo điều khoản hợp đồng</p>
          </div>

          {/* Lý do */}
          <div>
            <Label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">
              Lý do trả phòng *
            </Label>
            <div className="space-y-2">
              {REASON_OPTIONS.map(r => (
                <label
                  key={r}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border-[1.5px] transition ${
                    reasonOption === r ? 'border-terracotta-500 bg-terracotta-50' : 'border-cream-dark hover:border-terracotta-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reasonOption === r}
                    onChange={() => setReasonOption(r)}
                    className="accent-terracotta-500"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
            {reasonOption === 'Khác' && (
              <textarea
                rows={3}
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Mô tả lý do cụ thể..."
                className="mt-3 w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-2.5 text-sm focus:outline-none focus:border-terracotta-500"
              />
            )}
          </div>

          <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
            <AlertCircle className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
            <span>Sau khi tạo, yêu cầu sẽ tự động chuyển sang Quản lý để hẹn lịch kiểm tra phòng.</span>
          </div>
        </div>

        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !checkoutDate || !reasonOption}
            className="flex-1"
          >
            {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4" /> Tạo & chuyển QL</>}
          </Button>
        </div>
      </div>
    </div>
  )
}