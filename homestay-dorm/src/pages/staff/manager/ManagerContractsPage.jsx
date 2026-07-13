import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONTRACT_STATUS_CONFIG } from '@/lib/managerUi'
import { api } from '@/lib/api'

import { FileText, Plus, X, MapPin, Calendar, ChevronRight, AlertCircle, FilePenLine, CheckCircle2, Clock, Send, Loader2, Ban, Users } from 'lucide-react'

// ===== Bộ chuyển dữ liệu API -> shape UI =====
const CONTRACT_STATUS_MAP = { cho_ky: 'draft', da_ky: 'signed', dang_hieu_luc: 'active', da_thanh_ly: 'ended' }
const GENDER = { nam: 'Nam', nu: 'Nữ' }
const monthsBetween = (a, b) => {
  const s = new Date(a), e = new Date(b)
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}
function mapContract(h) {
  const beds = Number(h.so_giuong || 0)
  return {
    code: h.ma_hop_dong,
    status: CONTRACT_STATUS_MAP[h.trang_thai] || 'draft',
    createdAt: h.created_at,
    customer: {
      fullName: h.ho_ten || '—', phone: h.so_dien_thoai || '', email: h.email || '',
      idNumber: h.so_giay_to || '', gender: GENDER[h.gioi_tinh] || h.gioi_tinh || '', dateOfBirth: h.ngay_sinh || '',
    },
    roomId: h.ma_phong || '—',
    branch: h.ten_chi_nhanh || '',
    rentType: beds && Number(h.suc_chua) === beds ? 'whole_room' : 'shared_bed',
    numberOfBeds: beds,
    pricePerBed: beds ? Math.round(Number(h.gia_thue_thang) / beds) : Number(h.gia_thue_thang || 0),
    depositAmount: Number(h.so_tien_coc || 0),
    duration: monthsBetween(h.ngay_bat_dau, h.ngay_ket_thuc),
    startDate: h.ngay_bat_dau,
    endDate: h.ngay_ket_thuc,
    monthlyRent: Number(h.gia_thue_thang || 0),
    signingDate: h.ngay_ky || null,          // mốc ký (B3) — null nếu chưa ký
    isSigned: !!h.ngay_ky,                    // ĐÃ KÝ (lịch sử): còn hiệu lực HOẶC đã thanh lý
    handoverDate: null,
  }
}
function mapDeposit(d) {
  const beds = Number(d.so_giuong || 0)
  return {
    code: d.ma_phieu,
    bookingCode: null,
    customer: { fullName: d.ho_ten || '—', idNumber: d.so_giay_to || '', phone: d.so_dien_thoai || '', email: d.email || '' },
    roomId: d.ma_phong || '—',
    branch: d.ten_chi_nhanh || '',
    rentType: beds && Number(d.suc_chua) === beds ? 'whole_room' : 'shared_bed',
    numberOfBeds: beds,
    depositAmount: Number(d.so_tien_coc || 0),
    pricePerBed: Number(d.gia_thue_giuong || 0),   // giá 1 giường/tháng (= cọc / số tháng cọc / số giường)
    duration: d.thoi_han_thue ?? null,        // thời hạn khách đã chọn lúc đăng ký
    moveInDate: d.ngay_du_kien_vao_o || '',    // ngày vào ở khách đã chọn
  }
}

const TABS = [
  { id: 'create', label: 'Lập hợp đồng', icon: Plus },
  { id: 'draft', label: 'Chờ ký', icon: Clock },
  { id: 'active', label: 'Đang hiệu lực', icon: CheckCircle2 },
  { id: 'signed', label: 'Đã ký', icon: FilePenLine },
  { id: 'ended', label: 'Đã thanh lý', icon: Ban },
]

export default function ManagerContractsPage() {
  const [contracts, setContracts] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('create')
  const [creatingFor, setCreatingFor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [searchParams] = useSearchParams()
  const focusCode = searchParams.get('focus')
  const focusedRef = useRef(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([api.listContracts(), api.readyDeposits()])
      .then(([cs, ds]) => { setContracts(cs.map(mapContract)); setDeposits(ds.map(mapDeposit)) })
      .catch(err => setLoadError(err.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const grouped = useMemo(() => ({
    draft: contracts.filter(c => c.status === 'draft'),
    active: contracts.filter(c => c.status === 'active'),
    // "Đã ký" = LỊCH SỬ ký: mọi HĐ từng được ký (đang hiệu lực + đã thanh lý), không mất khi hủy
    signed: contracts.filter(c => c.isSigned),
    ended: contracts.filter(c => c.status === 'ended'),
  }), [contracts])

  useEffect(() => {
    if (!focusCode || focusedRef.current === focusCode) return
    const tabId = TABS.find(t => (grouped[t.id] || []).some(c => c.code === focusCode))?.id
    if (tabId) { setActiveTab(tabId); focusedRef.current = focusCode }
  }, [focusCode, grouped])

  useEffect(() => {
    if (!focusCode) return
    const t = setTimeout(() => {
      document.getElementById(`item-${focusCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [focusCode, activeTab])

  if (loading) return (
    <div className="max-w-7xl mx-auto py-20 text-center">
      <Loader2 className="w-8 h-8 text-mint-dark mx-auto mb-3 animate-spin" />
      <p className="text-sm text-ink-soft">Đang tải dữ liệu hợp đồng…</p>
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
        <h1 className="font-display text-2xl font-bold">Hợp đồng</h1>
        <p className="text-ink-soft text-sm">Lập hợp đồng cho khách đã đặt cọc, theo dõi việc ký kết</p>
      </div>

      <div className="flex gap-1 border-b border-cream-dark mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          let count
          if (tab.id === 'create') count = deposits.length
          else count = grouped[tab.id]?.length || 0
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

      {/* TAB: LẬP MỚI */}
      {activeTab === 'create' && (
        <div>
          {deposits.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-5xl mb-3">📄</div>
              <h3 className="font-display font-bold text-lg mb-1">Chưa có cọc nào sẵn sàng lập hợp đồng</h3>
              <p className="text-sm text-ink-soft">Các cọc đã chốt nhưng chưa có hợp đồng sẽ hiển thị tại đây</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-sm text-ink-soft mb-4">
                <AlertCircle className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
                <span>Các cọc dưới đây đã được chốt. Lập hợp đồng để hẹn khách đến ký kết.</span>
              </div>
              {deposits.map(d => (
                <DepositReadyCard key={d.code} deposit={d} onCreate={() => setCreatingFor(d)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: STATUS */}
      {activeTab !== 'create' && (
        <div>
          {(grouped[activeTab] || []).length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-5xl mb-3">📋</div>
              <h3 className="font-display font-bold text-lg mb-1">Không có hợp đồng nào</h3>
              <p className="text-sm text-ink-soft">Hợp đồng ở trạng thái này sẽ hiển thị tại đây</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeTab === 'signed' && (
                <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-start gap-2 text-sm text-ink-soft mb-1">
                  <FilePenLine className="w-4 h-4 text-mint-dark mt-0.5 flex-shrink-0" />
                  <span>Lịch sử các hợp đồng <strong className="text-ink">đã ký</strong> — giữ lại kể cả khi hợp đồng đã thanh lý hoặc khách đã hủy.</span>
                </div>
              )}
              {grouped[activeTab].map(c => (
                <div
                  key={c.code}
                  id={`item-${c.code}`}
                  className={c.code === focusCode ? 'rounded-2xl ring-2 ring-mint ring-offset-2 transition' : ''}
                >
                  <ContractCard contract={c} onOpen={() => setViewing(c)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creatingFor && (
        <CreateContractModal
          deposit={creatingFor}
          onClose={() => setCreatingFor(null)}
          onCreated={() => { refresh(); setCreatingFor(null); setActiveTab('draft') }}
        />
      )}

      {viewing && (
        <ContractDetailModal
          contract={viewing}
          onClose={() => setViewing(null)}
          onUpdated={() => { refresh(); setViewing(null) }}
        />
      )}
    </div>
  )
}

// ============== CARDS ==============
function DepositReadyCard({ deposit, onCreate }) {
  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {deposit.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{deposit.customer.fullName}</div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>Cọc {deposit.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{deposit.roomId} ({deposit.branch})</span>
            <span>·</span>
            <span>{deposit.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'} · {deposit.numberOfBeds} giường</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Cọc đã chốt</div>
          <div className="font-display font-bold text-terracotta-600">{deposit.depositAmount.toLocaleString('vi-VN')}đ</div>
        </div>
        <Button size="sm" onClick={onCreate} className="flex-shrink-0">
          <Plus className="w-4 h-4" /> Lập HĐ
        </Button>
      </div>
    </Card>
  )
}

function ContractCard({ contract, onOpen }) {
  const cfg = CONTRACT_STATUS_CONFIG[contract.status]
  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {contract.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{contract.customer.fullName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{contract.code}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{contract.roomId} ({contract.branch})</span>
            <span>·</span>
            <span>{contract.duration} tháng</span>
          </div>
          <div className="text-xs text-mint-dark font-medium flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3" />
            {new Date(contract.startDate).toLocaleDateString('vi-VN')} → {new Date(contract.endDate).toLocaleDateString('vi-VN')}
          </div>
          {contract.signingDate && (
            <div className="text-[11px] text-ink-muted flex items-center gap-1 mt-0.5">
              <FilePenLine className="w-3 h-3" /> Đã ký: {new Date(contract.signingDate).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">Tiền thuê/tháng</div>
          <div className="font-display font-bold text-terracotta-600">{contract.monthlyRent.toLocaleString('vi-VN')}đ</div>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen} className="flex-shrink-0">
          Xem <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}

// ============== MODAL: LẬP HỢP ĐỒNG ==============
function CreateContractModal({ deposit, onClose, onCreated }) {
  const [duration, setDuration] = useState(deposit.duration || 12)
  const [startDate, setStartDate] = useState(deposit.moveInDate ? String(deposit.moveInDate).split('T')[0] : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Nhóm thuê: kiểm tra điều kiện lưu trú từng người TRƯỚC khi lập hợp đồng
  const [group, setGroup] = useState(null)        // { hasGroup, members, nhomThueId } | null
  const [elig, setElig] = useState({})            // khachHangId -> true|false (mặc định "đạt")
  const [indivEligible, setIndivEligible] = useState(true)  // thuê cá nhân: đạt/không đạt điều kiện lưu trú
  const [loadingMembers, setLoadingMembers] = useState(true)

  useEffect(() => {
    let alive = true
    setLoadingMembers(true)
    api.getDepositMembers(deposit.code)
      .then(g => {
        if (!alive) return
        setGroup(g)
        if (g.hasGroup) {
          const init = {}
          g.members.forEach(m => { init[m.khachHangId] = m.datDieuKien !== false })
          setElig(init)
        } else {
          setIndivEligible(g.residencyCheck?.passed !== false)
        }
      })
      .catch(() => { if (alive) setGroup({ hasGroup: false, members: [] }) })
      .finally(() => { if (alive) setLoadingMembers(false) })
    return () => { alive = false }
  }, [deposit.code])

  // tiền thuê/tháng = giá 1 giường × số giường (= tiền cọc / số tháng cọc) — KHÔNG hardcode /2
  const monthlyRent = deposit.pricePerBed
    ? deposit.pricePerBed * deposit.numberOfBeds
    : Number(deposit.depositAmount || 0)
  const isGroup = !!group?.hasGroup
  const rep = isGroup ? group.members.find(m => m.isDaiDien) : null
  const repEligible = !rep || elig[rep.khachHangId] !== false
  const eligibleCount = isGroup ? group.members.filter(m => elig[m.khachHangId] !== false).length : 0

  const calcEndDate = () => {
    if (!startDate) return ''
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + Number(duration))
    return d.toISOString().split('T')[0]
  }
  const eligibilityPayload = () =>
    (group?.members || []).map(m => ({ khachHangId: m.khachHangId, datDieuKien: elig[m.khachHangId] !== false }))

  // (a) Ký tiếp với các thành viên đủ điều kiện -> lập hợp đồng
  const handleSubmit = async () => {
    if (!startDate) { setError('Vui lòng chọn ngày bắt đầu hợp đồng'); return }
    setError('')
    try {
      setSubmitting(true)
      if (isGroup) {
        if (!repEligible) { setError('Người đại diện không đủ điều kiện — hãy hủy thuê (hoàn 80%) hoặc đổi đại diện.'); setSubmitting(false); return }
        await api.checkDepositMembers(deposit.code, { eligibility: eligibilityPayload(), decision: 'continue' })
      } else {
        // Thuê cá nhân: ghi nhận khách ĐẠT điều kiện lưu trú trước khi lập HĐ
        if (!indivEligible) { setError('Khách không đủ điều kiện — hãy dùng "Từ chối (hoàn 80%)".'); setSubmitting(false); return }
        await api.checkDepositIndividual(deposit.code, { datDieuKien: true })
      }
      await api.createContract({ depositCode: deposit.code, ngayBatDau: startDate, thoiHan: Number(duration) })
      onCreated()
    } catch (e) {
      setError(e.message || 'Không lập được hợp đồng')
    } finally {
      setSubmitting(false)
    }
  }

  // (b) Nhóm không ký (thành viên không đủ điều kiện / khách dừng thuê) -> hủy thuê, hoàn 80%
  const handleCancelGroup = async () => {
    if (!window.confirm('Hủy thuê cho nhóm này? Khách sẽ được hoàn 80% tiền cọc theo quy định (Kế toán xử lý hoàn).')) return
    setError('')
    try {
      setSubmitting(true)
      await api.checkDepositMembers(deposit.code, { eligibility: eligibilityPayload(), decision: 'cancel' })
      onCreated()
    } catch (e) {
      setError(e.message || 'Không hủy được')
    } finally {
      setSubmitting(false)
    }
  }

  // Thuê cá nhân: khách KHÔNG đủ điều kiện -> Quản lý từ chối ký -> hủy cọc -> Kế toán hoàn 80%
  const handleRejectIndividual = async () => {
    if (!window.confirm('Từ chối ký cho khách này (không đủ điều kiện lưu trú)? Khách sẽ được hoàn 80% tiền cọc theo quy định (Kế toán xử lý hoàn).')) return
    setError('')
    try {
      setSubmitting(true)
      await api.checkDepositIndividual(deposit.code, { datDieuKien: false, decision: 'reject' })
      onCreated()
    } catch (e) {
      setError(e.message || 'Không từ chối được')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Lập hợp đồng thuê</h2>
              <p className="text-xs text-ink-muted">Từ cọc {deposit.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Bên thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{deposit.customer.fullName}{isGroup && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-mint-light text-mint-dark font-bold">Đại diện nhóm</span>}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">CCCD:</span><span className="font-semibold">{deposit.customer.idNumber}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold">{deposit.customer.phone}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Phòng thuê:</span><span className="font-semibold">{deposit.roomId} — {deposit.branch}</span></div>
            </div>
          </div>

          {/* KIỂM TRA ĐIỀU KIỆN LƯU TRÚ — chỉ hiện khi thuê theo nhóm */}
          {loadingMembers ? (
            <div className="text-sm text-ink-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách thành viên…</div>
          ) : isGroup && (
            <div>
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Kiểm tra điều kiện lưu trú ({group.members.length} người)</h3>
              <p className="text-[11px] text-ink-muted mb-2.5">Đánh dấu từng người <strong>đủ</strong>/<strong>không đủ</strong> điều kiện (giấy tờ, giới tính, độ tuổi…). Người không đủ sẽ không được ký và không vào ở. Người đại diện bắt buộc đủ điều kiện.</p>
              <div className="space-y-2">
                {group.members.map(m => {
                  const okk = elig[m.khachHangId] !== false
                  return (
                    <div key={m.khachHangId} className="flex items-center gap-3 p-2.5 bg-warm-white rounded-lg border border-cream-dark">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold flex items-center gap-2 truncate">
                          {m.hoTen}
                          {m.isDaiDien && <span className="text-[10px] px-1.5 py-0.5 rounded bg-mint-light text-mint-dark font-bold flex-shrink-0">Đại diện</span>}
                        </div>
                        <div className="text-xs text-ink-muted truncate">{[m.gioiTinh, m.soGiayTo && `CCCD ${m.soGiayTo}`, m.soDienThoai].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                      <div className="flex rounded-lg overflow-hidden border border-cream-dark text-xs flex-shrink-0">
                        <button type="button" onClick={() => setElig({ ...elig, [m.khachHangId]: true })} className={`px-2.5 py-1.5 font-medium ${okk ? 'bg-mint text-white' : 'bg-white text-ink-soft hover:bg-cream-light'}`}>Đạt</button>
                        <button type="button" onClick={() => setElig({ ...elig, [m.khachHangId]: false })} className={`px-2.5 py-1.5 font-medium ${!okk ? 'bg-red-500 text-white' : 'bg-white text-ink-soft hover:bg-cream-light'}`}>Không đạt</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!repEligible && (
                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Người đại diện không đủ điều kiện nên không thể ký hợp đồng. Hãy hủy thuê (hoàn 80%) hoặc đổi người đại diện.
                </div>
              )}
              {repEligible && eligibleCount < group.members.length && (
                <div className="mt-2 p-2.5 bg-gold-light/40 border border-gold/40 rounded-lg text-xs text-ink-soft flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" /> Sẽ ký hợp đồng với {eligibleCount}/{group.members.length} người đủ điều kiện; {group.members.length - eligibleCount} người không vào ở.
                </div>
              )}
            </div>
          )}

          {/* KIỂM TRA ĐIỀU KIỆN LƯU TRÚ — thuê CÁ NHÂN */}
          {!loadingMembers && !isGroup && (
            <div>
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Kiểm tra điều kiện lưu trú</h3>
              <p className="text-[11px] text-ink-muted mb-2.5">Đánh dấu khách <strong>đủ</strong>/<strong>không đủ</strong> điều kiện lưu trú (giấy tờ, giới tính, độ tuổi…). Nếu không đủ, Quản lý từ chối ký và khách được hoàn 80% tiền cọc.</p>
              <div className="flex items-center gap-3 p-2.5 bg-warm-white rounded-lg border border-cream-dark">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{deposit.customer.fullName}</div>
                  <div className="text-xs text-ink-muted truncate">{[deposit.customer.idNumber && `CCCD ${deposit.customer.idNumber}`, deposit.customer.phone].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-cream-dark text-xs flex-shrink-0">
                  <button type="button" onClick={() => setIndivEligible(true)} className={`px-2.5 py-1.5 font-medium ${indivEligible ? 'bg-mint text-white' : 'bg-white text-ink-soft hover:bg-cream-light'}`}>Đạt</button>
                  <button type="button" onClick={() => setIndivEligible(false)} className={`px-2.5 py-1.5 font-medium ${!indivEligible ? 'bg-red-500 text-white' : 'bg-white text-ink-soft hover:bg-cream-light'}`}>Không đạt</button>
                </div>
              </div>
              {!indivEligible && (
                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Khách không đủ điều kiện — không thể lập hợp đồng. Hãy dùng "Từ chối (hoàn 80%)".
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Điều khoản thuê</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 block">Thời hạn thuê *</label>
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint"
                >
                  <option value={6}>6 tháng</option>
                  <option value={12}>12 tháng (1 năm)</option>
                  <option value={18}>18 tháng</option>
                  <option value={24}>24 tháng (2 năm)</option>
                </select>
                {deposit.duration && (
                  <p className="text-[11px] text-mint-dark mt-1">Theo đăng ký của khách: {deposit.duration} tháng (có thể điều chỉnh nếu khách đổi ý)</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 block">Ngày bắt đầu *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              {startDate && (
                <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg text-sm">
                  <div className="text-xs text-ink-soft">Ngày kết thúc dự kiến:</div>
                  <div className="font-semibold text-mint-dark">{new Date(calcEndDate()).toLocaleDateString('vi-VN')}</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-warm-white rounded-xl p-4 border border-cream-dark">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tài chính</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Cọc đã đóng:</span><span className="font-semibold">{deposit.depositAmount.toLocaleString('vi-VN')}đ</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Tiền thuê/tháng:</span><span className="font-display font-bold text-terracotta-600">{monthlyRent.toLocaleString('vi-VN')}đ</span></div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
            <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
            <span>Sau khi lập, hợp đồng ở trạng thái "Chờ ký". Hẹn khách đến chi nhánh để ký kết và bàn giao phòng.</span>
          </div>
        </div>

        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          {isGroup ? (
            <>
              <Button variant="outline" onClick={handleCancelGroup} disabled={submitting} className="flex-1 text-red-600 border-red-200 hover:bg-red-50">
                <Ban className="w-4 h-4" /> Hủy thuê (hoàn 80%)
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !startDate || !repEligible} variant="mint" className="flex-1">
                {submitting ? 'Đang xử lý...' : <><Send className="w-4 h-4" /> Tiếp tục & lập HĐ</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleRejectIndividual} disabled={submitting} className="flex-1 text-red-600 border-red-200 hover:bg-red-50">
                <Ban className="w-4 h-4" /> Từ chối (hoàn 80%)
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !startDate || !indivEligible} variant="mint" className="flex-1">
                {submitting ? 'Đang lập...' : <><Send className="w-4 h-4" /> Đạt & lập HĐ</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============== MODAL: XEM CHI TIẾT HỢP ĐỒNG ==============
function ContractDetailModal({ contract, onClose, onUpdated }) {
  const cfg = CONTRACT_STATUS_CONFIG[contract.status]
  const [submitting, setSubmitting] = useState(false)

  const handleMarkSigned = async () => {
    try {
      setSubmitting(true)
      await api.signContract(contract.code)
      onUpdated()
    } catch (e) {
      alert(e.message || 'Không ký được hợp đồng')
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
              <FileText className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Hợp đồng {contract.code}</h2>
              <p className="text-xs text-ink-muted">
                <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Bên thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Họ tên:</span><span className="font-semibold">{contract.customer.fullName}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Giới tính:</span><span className="font-semibold">{contract.customer.gender}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">CCCD:</span><span className="font-semibold">{contract.customer.idNumber}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">SĐT:</span><span className="font-semibold">{contract.customer.phone}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Email:</span><span className="font-semibold text-xs">{contract.customer.email}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Đối tượng thuê</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Phòng:</span><span className="font-semibold">{contract.roomId} — {contract.branch}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Hình thức:</span><span className="font-semibold">{contract.rentType === 'whole_room' ? 'Nguyên phòng' : 'Thuê ghép'}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Số giường:</span><span className="font-semibold">{contract.numberOfBeds} giường</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Thời hạn</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-warm-white p-3 rounded-lg text-center">
                <div className="text-xs text-ink-muted">Bắt đầu</div>
                <div className="font-display font-bold">{new Date(contract.startDate).toLocaleDateString('vi-VN')}</div>
              </div>
              <div className="bg-warm-white p-3 rounded-lg text-center">
                <div className="text-xs text-ink-muted">Kết thúc</div>
                <div className="font-display font-bold">{new Date(contract.endDate).toLocaleDateString('vi-VN')}</div>
              </div>
              <div className="bg-mint-light/30 p-3 rounded-lg text-center">
                <div className="text-xs text-ink-muted">Thời hạn</div>
                <div className="font-display font-bold text-mint-dark">{contract.duration} tháng</div>
              </div>
            </div>
          </div>

          <div className="bg-warm-white rounded-xl p-4 border border-cream-dark">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tài chính</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Cọc đã đóng:</span><span className="font-semibold">{contract.depositAmount.toLocaleString('vi-VN')}đ</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Tiền thuê/tháng:</span><span className="font-display font-bold text-terracotta-600">{contract.monthlyRent.toLocaleString('vi-VN')}đ</span></div>
              <div className="flex justify-between pt-2 border-t border-cream-dark mt-2"><span className="text-ink-soft">Tổng giá trị HĐ:</span><span className="font-display font-bold">{(contract.monthlyRent * contract.duration).toLocaleString('vi-VN')}đ</span></div>
            </div>
          </div>

          {contract.signingDate && (
            <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark">
              <CheckCircle2 className="w-4 h-4" /> Đã ký lúc {new Date(contract.signingDate).toLocaleString('vi-VN')}
            </div>
          )}

          {contract.handoverDate && (
            <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark">
              <CheckCircle2 className="w-4 h-4" /> Đã bàn giao phòng lúc {new Date(contract.handoverDate).toLocaleString('vi-VN')}
            </div>
          )}
        </div>

        {contract.status === 'draft' && (
          <div className="p-4 border-t border-cream-dark bg-warm-white">
            <Button onClick={handleMarkSigned} disabled={submitting} variant="mint" className="w-full">
              {submitting ? 'Đang xử lý...' : <><FilePenLine className="w-4 h-4" /> Đánh dấu đã ký</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}