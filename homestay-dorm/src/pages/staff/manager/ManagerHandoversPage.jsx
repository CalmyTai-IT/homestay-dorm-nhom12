import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STANDARD_HANDOVER_ITEMS, ITEM_CONDITIONS } from '@/lib/managerUi'
import { api } from '@/lib/api'

import { Home, CheckCircle2, Clock, X, MapPin, Phone, Calendar, AlertCircle, Zap, Droplet, Key, Send, Eye, Package } from 'lucide-react'

const TABS = [
  { id: 'pending', label: 'Chờ bàn giao', icon: Clock },
  { id: 'completed', label: 'Đã bàn giao', icon: CheckCircle2 },
]

export default function ManagerHandoversPage() {
  const [handovers, setHandovers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [handoverFor, setHandoverFor] = useState(null)
  const [viewing, setViewing] = useState(null)

  const refresh = () => { api.listHandovers().then(setHandovers).catch(() => {}) }
  useEffect(() => { refresh() }, [])

  // Biên bản tạo tự động khi ký HĐ; "chờ bàn giao" = chưa ghi chi tiết tài sản, "đã bàn giao" = đã ghi
  const pendingContracts = handovers.filter(h => !h.hasDetails)
  const completedContracts = handovers.filter(h => h.hasDetails)
  const currentList = activeTab === 'pending' ? pendingContracts : completedContracts

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Bàn giao phòng</h1>
        <p className="text-ink-soft text-sm">Kiểm tra hiện trạng phòng và bàn giao chìa khóa cho khách đã ký hợp đồng</p>
      </div>

      <div className="flex gap-1 border-b border-cream-dark mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = tab.id === 'pending' ? pendingContracts.length : completedContracts.length
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

      {currentList.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có hồ sơ nào</h3>
          <p className="text-sm text-ink-soft">
            {activeTab === 'pending'
              ? 'Hợp đồng đã ký xong sẽ xuất hiện ở đây để chờ bàn giao'
              : 'Các phòng đã bàn giao sẽ hiển thị tại đây'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentList.map(contract => (
            <ContractCard
              key={contract.code}
              contract={contract}
              isPending={activeTab === 'pending'}
              onAction={() => activeTab === 'pending' ? setHandoverFor(contract) : api.getHandover(contract.id).then(setViewing).catch(() => {})}
            />
          ))}
        </div>
      )}

      {handoverFor && (
        <HandoverModal
          contract={handoverFor}
          onClose={() => setHandoverFor(null)}
          onCompleted={() => { refresh(); setHandoverFor(null); setActiveTab('completed') }}
        />
      )}

      {viewing && (
        <HandoverDetailModal contract={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

// ============== CARD ==============
function ContractCard({ contract, isPending, onAction }) {
  const startDate = new Date(contract.startDate)
  const today = new Date()
  const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24))
  const isOverdue = isPending && daysUntilStart < 0

  return (
    <Card className="p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-mint-light rounded-full flex items-center justify-center text-mint-dark font-display font-bold flex-shrink-0">
          {contract.customer.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{contract.customer.fullName}</span>
            {isPending ? (
              isOverdue ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                  Quá hạn {Math.abs(daysUntilStart)} ngày
                </span>
              ) : daysUntilStart === 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">
                  Hôm nay
                </span>
              ) : daysUntilStart <= 7 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gold-light text-gold">
                  Còn {daysUntilStart} ngày
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-cream-dark text-ink-soft">
                  Còn {daysUntilStart} ngày
                </span>
              )
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-mint-light text-mint-dark">
                Đã bàn giao
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
            {isPending ? `Ngày nhận phòng: ${startDate.toLocaleDateString('vi-VN')}` :
              `Đã bàn giao: ${new Date(contract.handoverDate).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-ink-muted">{contract.duration} tháng</div>
          <div className="text-[10px] text-ink-muted">{contract.numberOfBeds} giường</div>
        </div>
        {isPending ? (
          <Button size="sm" onClick={onAction} variant="mint" className="flex-shrink-0">
            <Key className="w-4 h-4" /> Bàn giao
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

// ============== MODAL: BÀN GIAO PHÒNG ==============
function HandoverModal({ contract, onClose, onCompleted }) {

  // Khởi tạo danh sách tài sản từ chuẩn
  const [items, setItems] = useState(
    STANDARD_HANDOVER_ITEMS.map(s => ({
      key: s.key,
      label: s.label,
      quantity: s.defaultQty,
      condition: 'good',
    }))
  )
  const [electricStart, setElectricStart] = useState('')
  const [waterStart, setWaterStart] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const updateItem = (key, field, value) => {
    setItems(items.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  const handleSubmit = () => {
    if (!electricStart || !waterStart) {
      alert('Vui lòng nhập chỉ số điện và nước ban đầu')
      return
    }
    if (!confirmed) {
      alert('Vui lòng tick xác nhận đã kiểm tra')
      return
    }
    setSubmitting(true)
    // Hoàn tất bàn giao: ghi tài sản + chỉ số công tơ đầu kỳ + ghi chú hiện trạng
    api.completeHandover(contract.id, {
      items: items.filter(i => i.quantity > 0),
      electricStart: Number(electricStart),
      waterStart: Number(waterStart),
      notes: notes.trim(),
    }).then(() => {
      setSubmitting(false)
      onCompleted()
    }).catch(e => {
      setSubmitting(false)
      alert(e.message || 'Không hoàn tất được bàn giao')
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <Key className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Biên bản bàn giao phòng</h2>
              <p className="text-xs text-ink-muted">HĐ {contract.code} · {contract.customer.fullName} · {contract.roomId}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* Thông tin nhanh */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-warm-white p-3 rounded-lg">
              <div className="text-xs text-ink-muted">Bên nhận</div>
              <div className="font-semibold text-sm">{contract.customer.fullName}</div>
            </div>
            <div className="bg-warm-white p-3 rounded-lg">
              <div className="text-xs text-ink-muted">Phòng</div>
              <div className="font-semibold text-sm">{contract.roomId} — {contract.branch}</div>
            </div>
            <div className="bg-warm-white p-3 rounded-lg">
              <div className="text-xs text-ink-muted">Ngày nhận</div>
              <div className="font-semibold text-sm">{new Date(contract.startDate).toLocaleDateString('vi-VN')}</div>
            </div>
          </div>

          {/* Chỉ số điện/nước */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Chỉ số điện/nước ban đầu</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-gold" /> Công tơ điện (kWh) *
                </label>
                <Input
                  type="number"
                  placeholder="VD: 12345"
                  value={electricStart}
                  onChange={e => setElectricStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft mb-1.5 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-mint-dark" /> Công tơ nước (m³) *
                </label>
                <Input
                  type="number"
                  placeholder="VD: 1234"
                  value={waterStart}
                  onChange={e => setWaterStart(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[10px] text-ink-muted mt-1.5">Chỉ số này sẽ làm mốc tính tiền điện nước hàng tháng</p>
          </div>

          {/* Danh sách tài sản */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Tài sản bàn giao
            </h3>
            <div className="border border-cream-dark rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-warm-white">
                  <tr>
                    <th className="text-left p-2.5 text-xs font-semibold text-ink-soft">Hạng mục</th>
                    <th className="text-center p-2.5 text-xs font-semibold text-ink-soft w-20">SL</th>
                    <th className="text-center p-2.5 text-xs font-semibold text-ink-soft w-32">Tình trạng</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.key} className="border-t border-cream-dark">
                      <td className="p-2.5">{item.label}</td>
                      <td className="p-2.5">
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={e => updateItem(item.key, 'quantity', Number(e.target.value))}
                          className="text-center h-8 text-sm"
                        />
                      </td>
                      <td className="p-2.5">
                        <select
                          value={item.condition}
                          onChange={e => updateItem(item.key, 'condition', e.target.value)}
                          disabled={item.quantity === 0}
                          className="w-full h-8 px-2 rounded border-[1.5px] border-cream-dark text-xs disabled:opacity-50"
                        >
                          {ITEM_CONDITIONS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Ghi chú thêm</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Vết xước trên tường, vị trí ổ cắm bị lỏng, hoặc các lưu ý khác..."
              className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-2.5 text-sm focus:outline-none focus:border-mint"
            />
          </div>

          {/* Cảnh báo */}
          <div className="p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2 text-xs text-ink-soft">
            <AlertCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
            <span>Sau khi bàn giao, hợp đồng sẽ chuyển sang trạng thái <strong>"Đang hiệu lực"</strong> và khách chính thức nhận phòng. Biên bản này sẽ làm căn cứ đối chiếu khi trả phòng.</span>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-2 p-3 bg-warm-white rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="accent-mint w-4 h-4 mt-0.5"
            />
            <span className="text-xs text-ink-soft">
              Tôi xác nhận đã <strong className="text-ink">kiểm tra đầy đủ</strong> hiện trạng phòng cùng với khách thuê và các thông tin trên là chính xác.
            </span>
          </label>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !confirmed || !electricStart || !waterStart}
            variant="mint"
            className="flex-1"
          >
            {submitting ? 'Đang xử lý...' : <><Send className="w-4 h-4" /> Hoàn tất bàn giao</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============== MODAL: XEM CHI TIẾT BÀN GIAO ==============
function HandoverDetailModal({ contract, onClose }) {
  const h = contract.handoverInfo

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              <Home className="w-6 h-6 text-mint-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Biên bản bàn giao</h2>
              <p className="text-xs text-ink-muted">HĐ {contract.code} · {contract.customer.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          <div className="p-3 bg-mint-light/30 border border-mint/30 rounded-lg flex items-center gap-2 text-sm text-mint-dark">
            <CheckCircle2 className="w-4 h-4" />
            Đã bàn giao bởi <strong>{h.handoverBy}</strong> lúc {new Date(h.handoverAt).toLocaleString('vi-VN')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-warm-white p-3 rounded-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-gold" />
              <div>
                <div className="text-xs text-ink-muted">Điện ban đầu</div>
                <div className="font-semibold">{h.electricStart} kWh</div>
              </div>
            </div>
            <div className="bg-warm-white p-3 rounded-lg flex items-center gap-2">
              <Droplet className="w-5 h-5 text-mint-dark" />
              <div>
                <div className="text-xs text-ink-muted">Nước ban đầu</div>
                <div className="font-semibold">{h.waterStart} m³</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Tài sản đã bàn giao ({h.items.length} mục)
            </h3>
            <div className="border border-cream-dark rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-warm-white">
                  <tr>
                    <th className="text-left p-2.5 text-xs font-semibold text-ink-soft">Hạng mục</th>
                    <th className="text-center p-2.5 text-xs font-semibold text-ink-soft w-16">SL</th>
                    <th className="text-center p-2.5 text-xs font-semibold text-ink-soft w-32">Tình trạng</th>
                  </tr>
                </thead>
                <tbody>
                  {h.items.map(item => {
                    const condCfg = ITEM_CONDITIONS.find(c => c.value === item.condition)
                    return (
                      <tr key={item.key} className="border-t border-cream-dark">
                        <td className="p-2.5">{item.label}</td>
                        <td className="p-2.5 text-center">{item.quantity}</td>
                        <td className="p-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${condCfg?.color}`}>
                            {condCfg?.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {h.notes && (
            <div>
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">Ghi chú</h3>
              <p className="text-sm text-ink-soft p-3 bg-warm-white rounded-lg">{h.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}