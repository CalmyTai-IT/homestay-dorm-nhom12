import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { ROOM_STATUS_CONFIG, getRoomStatus, BRANCHES, GENDERS, CAPACITIES } from '@/lib/roomUi'
import { Building2, Search, MapPin, Users, CheckCircle2, Wrench, X, Eye } from 'lucide-react'

export default function SaleRoomsPage() {
  const { user } = useAuth()
  // Sale thuộc 1 chi nhánh -> backend chỉ trả phòng chi nhánh đó, nên ẩn bộ lọc chi nhánh.
  // Sale toàn hệ thống (chiNhanhId=null) -> thấy mọi chi nhánh, giữ bộ lọc.
  const isSystemWide = user?.chiNhanhId == null
  const [rooms, setRooms] = useState([])
  useEffect(() => {
    let alive = true
    api.getRooms()
      .then(rs => { if (alive) setRooms(rs) })
      .catch(() => { if (alive) setRooms([]) })
    return () => { alive = false }
  }, [])
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('available') // mặc định: phòng còn trống
  const [filterCapacity, setFilterCapacity] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [viewing, setViewing] = useState(null)

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (search && !String(r.code||'').toLowerCase().includes(search.toLowerCase()) &&
          !r.address?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterBranch && r.branch !== filterBranch) return false
      if (filterStatus) {
        const status = getRoomStatus(r)
        if (filterStatus === 'available' && status === 'full') return false
        if (filterStatus === 'available' && status === 'maintenance') return false
        if (filterStatus !== 'available' && status !== filterStatus) return false
      }
      if (filterCapacity && r.capacity !== Number(filterCapacity)) return false
      if (filterGender && r.gender !== filterGender) return false
      return true
    })
  }, [rooms, search, filterBranch, filterStatus, filterCapacity, filterGender])

  const stats = useMemo(() => ({
    total: rooms.length,
    available: rooms.filter(r => r.bedsAvailable > 0 && !r.maintenance).length,
    totalBedsAvailable: rooms.reduce((sum, r) => sum + (r.maintenance ? 0 : r.bedsAvailable), 0),
  }), [rooms])

  const hasFilters = search || filterBranch || filterStatus || filterCapacity || filterGender

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Tra cứu phòng</h1>
        <p className="text-ink-soft text-sm">Tìm kiếm phòng còn trống để tư vấn khách hàng</p>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-cream-dark rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-ink" />
            </div>
            <span className="text-xs text-ink-muted">Tổng phòng</span>
          </div>
          <div className="font-display text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-mint-light rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-mint-dark" />
            </div>
            <span className="text-xs text-ink-muted">Phòng còn trống</span>
          </div>
          <div className="font-display text-2xl font-bold text-mint-dark">{stats.available}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-terracotta-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-terracotta-600" />
            </div>
            <span className="text-xs text-ink-muted">Giường còn trống</span>
          </div>
          <div className="font-display text-2xl font-bold text-terracotta-600">{stats.totalBedsAvailable}</div>
        </Card>
      </div>

      {/* FILTERS */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <Input
              placeholder="Tìm theo mã phòng, địa chỉ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isSystemWide && (
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
            >
              <option value="">Tất cả chi nhánh</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
          >
            <option value="">Tất cả</option>
            <option value="available">Còn trống</option>
            <option value="partially">Còn 1 phần</option>
            <option value="full">Đã đầy</option>
            <option value="maintenance">Bảo trì</option>
          </select>

          <select
            value={filterCapacity}
            onChange={e => setFilterCapacity(e.target.value)}
            className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
          >
            <option value="">Sức chứa</option>
            {CAPACITIES.map(c => <option key={c} value={c}>{c} người</option>)}
          </select>

          <select
            value={filterGender}
            onChange={e => setFilterGender(e.target.value)}
            className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
          >
            <option value="">Giới tính</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => {
              setSearch(''); setFilterBranch(''); setFilterStatus(''); setFilterCapacity(''); setFilterGender('')
            }}>
              <X className="w-4 h-4" /> Xóa lọc
            </Button>
          )}

          <div className="text-xs text-ink-muted ml-auto">
            <strong>{filteredRooms.length}</strong> / {rooms.length}
          </div>
        </div>
      </Card>

      {/* GRID ROOMS */}
      {filteredRooms.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h3 className="font-display font-bold text-lg mb-1">Không có phòng phù hợp</h3>
          <p className="text-sm text-ink-soft">Thử điều chỉnh bộ lọc</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRooms.map(room => (
            <RoomCard key={room.id} room={room} onView={() => setViewing(room)} />
          ))}
        </div>
      )}

      {viewing && <RoomDetailModal room={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

// ============== CARD ==============
function RoomCard({ room, onView }) {
  const status = getRoomStatus(room)
  const cfg = ROOM_STATUS_CONFIG[status]

  return (
    <Card
      className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-4xl">{room.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-lg">{room.code}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {room.branch} · {room.type}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 pt-3 border-t border-cream-dark">
        <div>
          <div className="text-[10px] text-ink-muted uppercase">Sức chứa</div>
          <div className="font-semibold text-sm">{room.capacity} người</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-muted uppercase">Giới tính</div>
          <div className="font-semibold text-sm">{room.gender}</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-muted uppercase">Trống</div>
          <div className={`font-semibold text-sm ${room.bedsAvailable === 0 ? 'text-red-500' : 'text-mint-dark'}`}>
            {room.bedsAvailable}/{room.capacity}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-cream-dark">
        <div>
          <div className="text-[10px] text-ink-muted">Giá/giường</div>
          <div className="font-display font-bold text-terracotta-600">{(room.pricePerBed/1000000).toFixed(1)}tr</div>
        </div>
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye className="w-4 h-4" /> Chi tiết
        </Button>
      </div>
    </Card>
  )
}

// ============== MODAL CHI TIẾT ==============
function RoomDetailModal({ room, onClose }) {
  const status = getRoomStatus(room)
  const cfg = ROOM_STATUS_CONFIG[status]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-cream-dark">
          <div className="flex items-start gap-3">
            <div className="text-5xl">{room.emoji}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-xl font-bold">Phòng {room.code}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-xs text-ink-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {room.address}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          {/* Thông tin chính */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBox label="Loại phòng" value={room.type} />
            <InfoBox label="Chi nhánh" value={room.branch} />
            <InfoBox label="Sức chứa" value={`${room.capacity} người`} />
            <InfoBox label="Giới tính" value={room.gender} />
            <InfoBox label="Còn trống" value={`${room.bedsAvailable}/${room.capacity} giường`} highlight={room.bedsAvailable > 0} />
            <InfoBox label="Đánh giá" value={`${room.rating}/5 (${room.reviewCount})`} />
          </div>

          {/* Giá */}
          <div className="bg-warm-white rounded-xl p-4">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">Giá thuê</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-ink-muted">Theo giường</div>
                <div className="font-display font-bold text-terracotta-600 text-lg">{(room.pricePerBed/1000000).toFixed(1)}tr/tháng</div>
              </div>
              <div>
                <div className="text-xs text-ink-muted">Nguyên phòng</div>
                <div className="font-display font-bold text-terracotta-600 text-lg">{(room.priceWholeRoom/1000000).toFixed(1)}tr/tháng</div>
              </div>
            </div>
          </div>

          {/* Tiện nghi */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">Tiện nghi</h3>
            <div className="flex flex-wrap gap-1.5">
              {room.amenities.map(a => (
                <span key={a} className="text-xs px-2 py-1 bg-warm-white border border-cream-dark rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* Mô tả */}
          {room.description && (
            <div>
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">Mô tả</h3>
              <p className="text-sm text-ink-soft p-3 bg-warm-white rounded-lg">{room.description}</p>
            </div>
          )}

          {room.maintenance && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
              <Wrench className="w-4 h-4" />
              <strong>Phòng đang bảo trì</strong> — không khả dụng cho khách thuê
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoBox({ label, value, highlight }) {
  return (
    <div className="p-3 bg-warm-white rounded-lg">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`font-semibold text-sm ${highlight ? 'text-mint-dark' : ''}`}>{value}</div>
    </div>
  )
}