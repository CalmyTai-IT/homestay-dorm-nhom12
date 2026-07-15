import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { ROOM_STATUS_CONFIG, getRoomStatus, AMENITIES, GENDERS, CAPACITIES } from '@/lib/roomUi'
import { Building2, Plus, X, Edit2, Trash2, Search, Users, MapPin, Wrench, CheckCircle2, AlertCircle, Save } from 'lucide-react'

// Thống kê tổng quan tính từ danh sách phòng đã tải (thay cho hàm đọc localStorage)
function computeStats(rooms) {
  return {
    total: rooms.length,
    available: rooms.filter(r => getRoomStatus(r) === 'available').length,
    partially: rooms.filter(r => getRoomStatus(r) === 'partially').length,
    full: rooms.filter(r => getRoomStatus(r) === 'full').length,
    maintenance: rooms.filter(r => getRoomStatus(r) === 'maintenance').length,
    totalBeds: rooms.reduce((s, r) => s + r.capacity, 0),
    occupiedBeds: rooms.reduce((s, r) => s + (r.capacity - r.bedsAvailable), 0),
  }
}

export default function ManagerRoomsPage() {
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])   // chi nhánh thật từ API (cho dropdown)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingRoom, setEditingRoom] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // all=1: lấy phòng còn hiệu lực (gồm 'bảo trì'), KHÔNG gồm phòng đã xoá ('ngung')
  const refresh = () => {
    setLoading(true); setLoadError('')
    api.getRooms({ all: 1 })
      .then(setRooms)
      .catch(e => setLoadError(e.message || 'Không tải được danh sách phòng'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])
  // Tải danh sách chi nhánh thật cho dropdown (thay cho mock cũ)
  useEffect(() => {
    api.staffBranches().then(setBranches).catch(() => setBranches([]))
  }, [])

  const activeRooms = useMemo(() => rooms.filter(r => r.status !== 'ngung'), [rooms])
  // Tên chi nhánh thật (từ API) cho các dropdown — thay cho hằng BRANCHES mock cũ
  const branchNames = useMemo(() => branches.map(b => b.name).filter(Boolean), [branches])

  // Phân quyền chi nhánh: QL chi nhánh chỉ quản lý phòng chi nhánh mình; QL toàn hệ thống (chiNhanhId=null) quản lý tất cả.
  const { user } = useAuth()
  const isSystemWide = user?.chiNhanhId == null
  const myBranchName = useMemo(
    () => branches.find(b => String(b.id) === String(user?.chiNhanhId))?.name || '',
    [branches, user]
  )

  const stats = useMemo(() => computeStats(activeRooms), [activeRooms])

  // Lọc phòng theo mã / địa chỉ / chi nhánh / trạng thái
  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeRooms.filter(r => {
      const codeStr = String(r.code || r.id || '').toLowerCase()
      if (q && !codeStr.includes(q)
          && !(r.address || '').toLowerCase().includes(q)
          && !(r.branch || '').toLowerCase().includes(q)) return false
      if (filterBranch && r.branch !== filterBranch) return false
      if (filterStatus && getRoomStatus(r) !== filterStatus) return false
      return true
    })
  }, [activeRooms, search, filterBranch, filterStatus])

  const hasActiveFilters = search || filterBranch || filterStatus

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-sm text-ink-soft">Đang tải danh sách phòng…</p>
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
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Quản lý phòng/giường</h1>
          <p className="text-ink-soft text-sm">Thêm, sửa, theo dõi trạng thái phòng cho toàn hệ thống</p>
        </div>
        <Button onClick={() => setCreating(true)} variant="mint">
          <Plus className="w-4 h-4" /> Thêm phòng mới
        </Button>
      </div>

      {/* KPI STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatBox label="Tổng phòng" value={stats.total} color="ink" icon={Building2} />
        <StatBox label="Sẵn sàng" value={stats.available} color="mint" icon={CheckCircle2} />
        <StatBox label="Còn 1 phần" value={stats.partially} color="gold" icon={Users} />
        <StatBox label="Đã đầy" value={stats.full} color="terracotta" icon={AlertCircle} />
        <StatBox label="Bảo trì" value={stats.maintenance} color="red" icon={Wrench} />
      </div>

      {/* FILTERS */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <Input
              placeholder="Tìm theo mã phòng hoặc địa chỉ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Branch — chỉ hiện cho QL toàn hệ thống; QL chi nhánh chỉ có 1 chi nhánh nên ẩn */}
          {isSystemWide && (
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint min-w-[150px]"
            >
              <option value="">Tất cả chi nhánh</option>
              {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint min-w-[160px]"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(ROOM_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setFilterBranch(''); setFilterStatus('') }}
            >
              <X className="w-4 h-4" /> Xóa lọc
            </Button>
          )}

          <div className="text-xs text-ink-muted ml-auto">
            <strong>{filteredRooms.length}</strong> / {rooms.length} phòng
          </div>
        </div>
      </Card>

      {/* TABLE */}
      {filteredRooms.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có phòng phù hợp</h3>
          <p className="text-sm text-ink-soft">Thử điều chỉnh bộ lọc hoặc thêm phòng mới</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-white border-b border-cream-dark">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Phòng</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Chi nhánh</th>
                  <th className="text-left p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Loại</th>
                  <th className="text-center p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Sức chứa</th>
                  <th className="text-center p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Còn trống</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Giá/giường</th>
                  <th className="text-center p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Trạng thái</th>
                  <th className="text-right p-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map(room => {
                  const status = getRoomStatus(room)
                  const cfg = ROOM_STATUS_CONFIG[status]
                  return (
                    <tr key={room.id} className="border-b border-cream-dark hover:bg-warm-white transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{room.emoji}</span>
                          <div>
                            <div className="font-semibold">{room.code || room.id}</div>
                            <div className="text-xs text-ink-muted">{room.gender}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3 text-ink-muted" /> {room.branch}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{room.type}</td>
                      <td className="p-3 text-center">{room.capacity}</td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${room.bedsAvailable === 0 ? 'text-red-500' : 'text-mint-dark'}`}>
                          {room.bedsAvailable}/{room.capacity}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-terracotta-600">
                        {(room.pricePerBed / 1000000).toFixed(1)}tr
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingRoom(room)}
                            className="w-8 h-8 rounded-lg hover:bg-mint-light/40 flex items-center justify-center text-mint-dark transition"
                            title="Sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(room)}
                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODALS */}
      {(creating || editingRoom) && (
        <RoomFormModal
          room={editingRoom}
          branches={branchNames}
          lockedBranch={isSystemWide ? null : myBranchName}
          onClose={() => { setCreating(false); setEditingRoom(null) }}
          onSaved={() => { refresh(); setCreating(false); setEditingRoom(null) }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          room={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirmed={async () => {
            try {
              await api.deleteRoom(confirmDelete.id)
              refresh()
              setConfirmDelete(null)
            } catch (e) {
              alert(e.message || 'Không xoá được phòng')
            }
          }}
        />
      )}
    </div>
  )
}

// ============== STAT BOX ==============
function StatBox({ label, value, color, icon: Icon }) {
  const colors = {
    ink: 'bg-cream-dark text-ink',
    mint: 'bg-mint-light text-mint-dark',
    gold: 'bg-gold-light text-gold',
    terracotta: 'bg-terracotta-100 text-terracotta-600',
    red: 'bg-red-100 text-red-600',
  }[color]

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-ink-muted">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </Card>
  )
}

// Emoji mặc định theo loại phòng (Quản lý vẫn có thể tự đổi)
const emojiForType = (type) => type === 'Phòng nguyên căn' ? '🏠' : '🛏️'

// ============== MODAL: FORM THÊM/SỬA PHÒNG ==============
function RoomFormModal({ room, branches = [], lockedBranch = null, onClose, onSaved }) {
  const isEdit = !!room
  const [form, setForm] = useState({
    id: room?.code || '',     // ô "Mã phòng" = mã hiển thị (ma_phong); với phòng đã có thì không cho sửa
    branch: room?.branch || lockedBranch || branches[0] || '',
    type: room?.type || 'Phòng ghép',
    capacity: room?.capacity || 4,
    gender: room?.gender || 'Nam',
    pricePerBed: room?.pricePerBed || 1500000,
    priceWholeRoom: room?.priceWholeRoom || 5000000,
    emoji: room?.emoji || emojiForType(room?.type || 'Phòng ghép'),
    amenities: room?.amenities || [],
    description: room?.description || '',
    maintenance: room?.maintenance || false,
    bedsAvailable: room?.bedsAvailable !== undefined ? room.bedsAvailable : 4,
  })
  const [submitting, setSubmitting] = useState(false)

  const toggleAmenity = (a) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a]
    }))
  }

  const handleSubmit = async () => {
    if (!form.id || !form.branch) {
      alert('Vui lòng nhập đủ mã phòng và chi nhánh')
      return
    }
    if (form.bedsAvailable > form.capacity) {
      alert('Số giường trống không thể lớn hơn sức chứa')
      return
    }
    setSubmitting(true)
    const data = {
      ...form,
      isFullyAvailable: form.bedsAvailable === form.capacity,
    }
    try {
      if (isEdit) await api.updateRoom(room.id, data)
      else await api.createRoom(data)
      setSubmitting(false)
      onSaved()
    } catch (e) {
      setSubmitting(false)
      alert(e.message || 'Không lưu được phòng')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-mint-light rounded-2xl flex items-center justify-center">
              {isEdit ? <Edit2 className="w-6 h-6 text-mint-dark" /> : <Plus className="w-6 h-6 text-mint-dark" />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{isEdit ? `Sửa phòng ${room.code}` : 'Thêm phòng mới'}</h2>
              <p className="text-xs text-ink-muted">{isEdit ? 'Cập nhật thông tin phòng' : 'Điền đầy đủ thông tin để tạo phòng mới'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {/* Thông tin cơ bản */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Mã phòng *</Label>
                <Input
                  placeholder="VD: P101"
                  value={form.id}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  disabled={isEdit}
                />
                {isEdit && <p className="text-[10px] text-ink-muted mt-1">Không thể sửa mã phòng</p>}
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Emoji</Label>
                <Input
                  placeholder="🛏️ 🏠"
                  value={form.emoji}
                  onChange={e => setForm({ ...form, emoji: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Chi nhánh *</Label>
                {lockedBranch ? (
                  // QL chi nhánh: khóa cố định theo chi nhánh mình phụ trách (không cho chọn chi nhánh khác)
                  <div className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-cream-light/50 text-sm flex items-center justify-between text-ink-soft">
                    <span>{lockedBranch}</span>
                    <span className="text-[11px] text-ink-muted">Chi nhánh của bạn</span>
                  </div>
                ) : (
                  <select
                    value={form.branch}
                    onChange={e => setForm({ ...form, branch: e.target.value })}
                    className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint"
                  >
                    {branches.length === 0 && form.branch && <option value={form.branch}>{form.branch}</option>}
                    {branches.length === 0 && !form.branch && <option value="">— Chưa có chi nhánh —</option>}
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Loại phòng *</Label>
                <select
                  value={form.type}
                  onChange={e => {
                    const newType = e.target.value
                    setForm(f => ({
                      ...f,
                      type: newType,
                      // Tự đổi icon theo loại phòng (trừ khi người dùng đã đặt icon khác loại trước đó)
                      emoji: (!f.emoji || f.emoji === emojiForType(f.type)) ? emojiForType(newType) : f.emoji,
                    }))
                  }}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint"
                >
                  <option value="Phòng ghép">Phòng ghép (ở ghép theo giường)</option>
                  <option value="Phòng nguyên căn">Phòng nguyên căn (thuê nguyên phòng)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cấu hình giường */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Cấu hình giường</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Sức chứa</Label>
                <select
                  value={form.capacity}
                  onChange={e => {
                    const newCap = Number(e.target.value)
                    setForm({ ...form, capacity: newCap, bedsAvailable: Math.min(form.bedsAvailable, newCap) })
                  }}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint"
                >
                  {CAPACITIES.map(c => <option key={c} value={c}>{c} người</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Còn trống</Label>
                <Input
                  type="number"
                  min={0}
                  max={form.capacity}
                  value={form.bedsAvailable}
                  onChange={e => setForm({ ...form, bedsAvailable: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Giới tính</Label>
                <select
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                  className="w-full h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-mint"
                >
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Giá */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Giá thuê</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Giá/giường/tháng</Label>
                <Input
                  type="number"
                  value={form.pricePerBed}
                  onChange={e => setForm({ ...form, pricePerBed: Number(e.target.value) })}
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  {form.pricePerBed > 0 && `${(form.pricePerBed / 1000000).toFixed(1)} triệu/tháng`}
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Giá nguyên phòng/tháng</Label>
                <Input
                  type="number"
                  value={form.priceWholeRoom}
                  onChange={e => setForm({ ...form, priceWholeRoom: Number(e.target.value) })}
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  {form.priceWholeRoom > 0 && `${(form.priceWholeRoom / 1000000).toFixed(1)} triệu/tháng`}
                </p>
              </div>
            </div>
          </div>

          {/* Tiện nghi */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">Tiện nghi ({form.amenities.length})</h3>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => {
                const selected = form.amenities.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      selected
                        ? 'bg-mint border-mint text-white'
                        : 'bg-warm-white border-cream-dark text-ink-soft hover:border-mint'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <Label className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2 block">Mô tả</Label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Mô tả ngắn về phòng..."
              className="w-full rounded-lg border-[1.5px] border-cream-dark px-4 py-2.5 text-sm focus:outline-none focus:border-mint"
            />
          </div>

          {/* Trạng thái bảo trì */}
          <label className="flex items-center gap-3 p-3 bg-warm-white rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenance}
              onChange={e => setForm({ ...form, maintenance: e.target.checked })}
              className="accent-red-500 w-4 h-4"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold">Đang bảo trì</div>
              <div className="text-xs text-ink-muted">Phòng tạm thời không cho thuê</div>
            </div>
            <Wrench className="w-4 h-4 text-red-500" />
          </label>
        </div>

        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="mint" className="flex-1">
            {submitting ? 'Đang lưu...' : <><Save className="w-4 h-4" /> {isEdit ? 'Lưu thay đổi' : 'Tạo phòng'}</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============== MODAL: XÁC NHẬN XÓA ==============
function DeleteConfirmModal({ room, onClose, onConfirmed }) {
  const [confirmText, setConfirmText] = useState('')
  // Phòng còn giường đang dùng (giữ chỗ/đặt cọc/đang thuê/bảo trì) thì backend sẽ từ chối xoá.
  const occupied = Math.max(0, (room.capacity || 0) - (room.bedsAvailable || 0))
  const hasOccupied = occupied > 0
  const canDelete = confirmText === room.code && !hasOccupied

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Xóa phòng {room.code}?</h2>
          <p className="text-sm text-ink-soft mb-4">
            Phòng <strong>{room.code} ({room.branch})</strong> sẽ bị xóa khỏi hệ thống. Hành động này <strong className="text-red-500">không thể hoàn tác</strong>.
          </p>

          {hasOccupied ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-ink-soft mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>
                Phòng đang có <strong className="text-red-600">{occupied}/{room.capacity} giường được sử dụng</strong> (giữ chỗ / đặt cọc / đang thuê / bảo trì).
                {' '}<strong className="text-ink">Không thể xóa</strong> cho đến khi tất cả giường về trạng thái trống.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-ink-soft mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Phòng hiện đã trống. Sau khi xóa, phòng sẽ được gỡ khỏi danh sách quản lý; <strong className="text-ink">mã phòng vẫn không thể dùng lại trong chi nhánh này</strong>.</span>
            </div>
          )}

          {!hasOccupied && (
            <div>
              <Label className="text-xs mb-1.5 block">
                Gõ <strong className="text-red-500">{room.code}</strong> để xác nhận:
              </Label>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={room.code}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-cream-dark bg-warm-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">{hasOccupied ? 'Đóng' : 'Hủy'}</Button>
          <Button
            onClick={onConfirmed}
            disabled={!canDelete}
            className="flex-1 !bg-red-500 hover:!bg-red-600 disabled:!bg-cream-dark"
          >
            <Trash2 className="w-4 h-4" /> Xóa phòng
          </Button>
        </div>
      </div>
    </div>
  )
}