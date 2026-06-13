import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import {
  RENT_TYPES, CAPACITIES, GENDERS, PRICE_RANGES, AMENITIES, branchLabel
} from '@/lib/roomUi'
import ContactDialog from '@/components/customer/ContactDialog'
import {
  MapPin, CheckCircle2, X, SlidersHorizontal,
  MessageCircle, Calendar, Star, Lock, Loader2
} from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Mới nhất' },
  { value: 'priceLow',  label: 'Giá thấp → cao' },
  { value: 'priceHigh', label: 'Giá cao → thấp' },
  { value: 'rating',    label: 'Đánh giá cao nhất' },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // === DỮ LIỆU PHÒNG TỪ API ===
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.getRooms()
      .then(data => { if (alive) setRooms(data) })
      .catch(err => { if (alive) setLoadError(err.message || 'Không tải được danh sách phòng') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // === FILTERS STATE — đọc query params từ trang chủ ===
  const [filters, setFilters] = useState({
    branch:     searchParams.get('branch')   || '',
    rentType:   searchParams.get('rentType') || '',
    capacity:   searchParams.get('capacity') ? Number(searchParams.get('capacity')) : '',
    gender:     searchParams.get('gender')   || '',
    priceRange: searchParams.get('price')    || '',
    amenities:  [],
  })
  const [sortBy, setSortBy] = useState('newest')
  const [contactRoom, setContactRoom] = useState(null)

  // Danh sách KHU VỰC suy ra từ dữ liệu phòng thật (tự cập nhật khi có chi nhánh mới).
  // Giá trị = tên chi nhánh đầy đủ (để khớp filter r.branch); nhãn hiển thị rút gọn.
  const branchOptions = useMemo(
    () => [...new Set(rooms.map(r => r.branch).filter(Boolean))].sort(),
    [rooms]
  )


  // === LOGIC LỌC (chạy trên dữ liệu lấy từ API) ===
  const filteredRooms = useMemo(() => {
    let result = [...rooms]

    if (filters.branch) {
      result = result.filter(r => r.branch === filters.branch)
    }

    if (filters.rentType === 'Thuê nguyên phòng') {
      result = result.filter(r => r.roomType === 'nguyen_can')
    } else if (filters.rentType === 'Thuê giường (ghép)') {
      result = result.filter(r => r.roomType === 'o_ghep' && r.bedsAvailable > 0)
    }

    if (filters.capacity) {
      result = result.filter(r => r.capacity === filters.capacity)
    }

    if (filters.gender) {
      result = result.filter(r => r.gender === filters.gender)
    }

    if (filters.priceRange) {
      const range = PRICE_RANGES.find(p => p.label === filters.priceRange)
      if (range) {
        result = result.filter(r => {
          const price = r.roomType === 'nguyen_can' ? r.priceWholeRoom : r.pricePerBed
          return price >= range.min && price < range.max
        })
      }
    }

    if (filters.amenities.length > 0) {
      result = result.filter(r =>
        filters.amenities.every(a => r.amenities.includes(a))
      )
    }

    const effPrice = (r) => r.roomType === 'nguyen_can' ? r.priceWholeRoom : r.pricePerBed
    switch (sortBy) {
      case 'priceLow':
        result.sort((a, b) => effPrice(a) - effPrice(b))
        break
      case 'priceHigh':
        result.sort((a, b) => effPrice(b) - effPrice(a))
        break
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      default:
        break
    }

    return result
  }, [filters, sortBy, rooms])

  const toggleAmenity = (a) => {
    setFilters(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a]
    }))
  }

  const resetFilters = () => {
    setFilters({ branch: '', rentType: '', capacity: '', gender: '', priceRange: '', amenities: [] })
  }

  const hasActiveFilters = filters.branch || filters.rentType || filters.capacity ||
                           filters.gender || filters.priceRange || filters.amenities.length > 0

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold mb-1">Tìm phòng phù hợp</h1>
        <p className="text-ink-soft">
          Lọc theo nhu cầu của bạn — <span className="font-semibold text-ink">{filteredRooms.length} phòng</span> tìm thấy
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* === SIDEBAR FILTERS (có scroll riêng) === */}
        <aside className="lg:col-span-1">
          <Card className="sticky top-24 max-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">

            {/* Header cố định ở trên */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-cream-dark flex-shrink-0">
              <h3 className="font-display font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Bộ lọc
              </h3>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-xs text-terracotta-500 font-semibold hover:underline">
                  Xóa hết
                </button>
              )}
            </div>

            {/* Vùng scroll cho các filter */}
            <div className="overflow-y-auto p-5 pt-4 flex-1 custom-scrollbar">

              {/* Khu vực */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Khu vực
                </div>
                <div className="space-y-2">
                  {branchOptions.map(b => (
                    <label key={b} className="flex items-start gap-2 cursor-pointer hover:bg-warm-white p-1 rounded">
                      <input
                        type="radio"
                        name="branch"
                        checked={filters.branch === b}
                        onChange={() => setFilters({...filters, branch: b})}
                        className="accent-terracotta-500 mt-0.5 flex-shrink-0"
                      />
                      <span className="text-sm break-words min-w-0">{branchLabel(b)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Hình thức thuê */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Hình thức thuê
                </div>
                <div className="space-y-2">
                  {RENT_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setFilters({...filters, rentType: filters.rentType === t ? '' : t})}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border-[1.5px] transition ${
                        filters.rentType === t
                          ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-600'
                          : 'border-cream-dark text-ink-soft hover:border-terracotta-300'
                      }`}
                    >
                      {t === 'Thuê giường (ghép)' ? '🛏️ ' : '🏠 '}{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sức chứa */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Sức chứa phòng
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CAPACITIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setFilters({...filters, capacity: filters.capacity === c ? '' : c})}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border-[1.5px] transition ${
                        filters.capacity === c
                          ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-600'
                          : 'border-cream-dark text-ink-soft hover:border-terracotta-300'
                      }`}
                    >
                      {c} người
                    </button>
                  ))}
                </div>
              </div>

              {/* Giới tính — luôn hoạt động cho cả 2 hình thức thuê */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Giới tính
                </div>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map(g => (
                    <button
                      key={g}
                      onClick={() => setFilters({...filters, gender: filters.gender === g ? '' : g})}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        filters.gender === g
                          ? 'bg-terracotta-500 border-terracotta-500 text-white'
                          : 'bg-warm-white border-cream-dark text-ink-soft hover:border-terracotta-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mức giá */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Mức giá
                </div>
                <div className="space-y-2">
                  {PRICE_RANGES.map(p => (
                    <label key={p.label} className="flex items-center gap-2 cursor-pointer hover:bg-warm-white p-1 rounded">
                      <input
                        type="radio"
                        name="price"
                        checked={filters.priceRange === p.label}
                        onChange={() => setFilters({...filters, priceRange: p.label})}
                        className="accent-terracotta-500"
                      />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tiện nghi */}
              <div>
                <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2.5">
                  Tiện nghi
                </div>
                <div className="space-y-2">
                  {AMENITIES.map(a => (
                    <label key={a} className="flex items-center gap-2 cursor-pointer hover:bg-warm-white p-1 rounded">
                      <input
                        type="checkbox"
                        checked={filters.amenities.includes(a)}
                        onChange={() => toggleAmenity(a)}
                        className="accent-terracotta-500"
                      />
                      <span className="text-sm">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </aside>

        {/* === RESULTS === */}
        <div className="lg:col-span-3">
          {/* Toolbar: sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 bg-white rounded-xl border border-cream-dark">
            <div className="text-sm text-ink-soft">
              Hiển thị <span className="font-semibold text-ink">{filteredRooms.length}</span> phòng
              {filters.branch && <> tại <span className="font-semibold text-ink">{branchLabel(filters.branch)}</span></>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-9 rounded-lg border-[1.5px] border-cream-dark px-3 text-sm bg-white focus:outline-none focus:border-terracotta-500"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.branch && <FilterChip label={branchLabel(filters.branch)} onRemove={() => setFilters({...filters, branch: ''})} />}
              {filters.rentType && <FilterChip label={filters.rentType} onRemove={() => setFilters({...filters, rentType: ''})} />}
              {filters.capacity && <FilterChip label={`${filters.capacity} người`} onRemove={() => setFilters({...filters, capacity: ''})} />}
              {filters.gender && <FilterChip label={filters.gender} onRemove={() => setFilters({...filters, gender: ''})} />}
              {filters.priceRange && <FilterChip label={filters.priceRange} onRemove={() => setFilters({...filters, priceRange: ''})} />}
              {filters.amenities.map(a => (
                <FilterChip key={a} label={a} onRemove={() => toggleAmenity(a)} />
              ))}
            </div>
          )}

          {/* Trạng thái tải / lỗi / kết quả */}
          {loading ? (
            <Card className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-terracotta-500 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-ink-soft">Đang tải danh sách phòng…</p>
            </Card>
          ) : loadError ? (
            <Card className="p-12 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="font-display font-bold text-lg mb-1">Không tải được dữ liệu</h3>
              <p className="text-sm text-ink-soft mb-4">{loadError}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Thử lại</Button>
            </Card>
          ) : filteredRooms.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-5xl mb-3">🔍</div>
              <h3 className="font-display font-bold text-lg mb-1">Không có phòng phù hợp</h3>
              <p className="text-sm text-ink-soft mb-4">Hãy thử điều chỉnh bộ lọc của bạn</p>
              <Button variant="outline" onClick={resetFilters}>Xóa bộ lọc</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onViewDetail={() => navigate(`/room/${room.id}`)}
                  onContact={() => setContactRoom(room)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact dialog */}
      {contactRoom && (
        <ContactDialog room={contactRoom} onClose={() => setContactRoom(null)} />
      )}
    </div>
  )
}

// ============== SUB COMPONENTS ==============

function FilterChip({ label, onRemove }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-terracotta-100 text-terracotta-700 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:bg-terracotta-200 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

function RoomCard({ room, onViewDetail, onContact }) {
  const isWholeRoom = room.roomType === 'nguyen_can'
  const displayPrice = isWholeRoom ? room.priceWholeRoom : room.pricePerBed
  const priceUnit = isWholeRoom ? '/phòng/tháng' : '/giường/tháng'
  const noVacancy = isWholeRoom ? !room.isFullyAvailable : room.bedsAvailable === 0

  return (
    <Card className="p-5 flex flex-col md:flex-row gap-5 hover:-translate-y-0.5 hover:shadow-md transition-all">
      <div className="md:w-48 aspect-video md:aspect-square bg-gradient-to-br from-terracotta-100 to-terracotta-200 rounded-xl flex items-center justify-center text-7xl flex-shrink-0">
        {room.emoji}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs px-2 py-0.5 bg-mint-light text-mint-dark rounded-full font-semibold">
                {room.type}
              </span>
              <span className="text-xs px-2 py-0.5 bg-warm-white border border-cream-dark rounded-full text-ink-soft">
                {room.gender}
              </span>
              <span className="text-xs text-ink-muted flex items-center gap-1">
                <Star className="w-3 h-3 fill-gold text-gold" />
                {room.rating} ({room.reviewCount})
              </span>
            </div>
            <h3 className="font-display font-bold text-xl">Phòng {room.code}</h3>
            <div className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {room.address}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-2xl font-bold text-terracotta-500">
              {(displayPrice/1000000).toFixed(1)}tr
            </div>
            <div className="text-xs text-ink-muted">{priceUnit}</div>
          </div>
        </div>

        <p className="text-sm text-ink-soft mb-3 line-clamp-2">{room.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {room.amenities.slice(0, 4).map(a => (
            <span key={a} className="text-xs px-2 py-0.5 bg-warm-white border border-cream-dark rounded text-ink-soft">
              {a}
            </span>
          ))}
          {room.amenities.length > 4 && (
            <span className="text-xs px-2 py-0.5 text-ink-muted">+{room.amenities.length - 4}</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-cream-dark mt-auto">
          <div className="text-sm">
            {noVacancy ? (
              <span className="text-red-500 font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Đã hết chỗ
              </span>
            ) : (
              <span className="flex items-center gap-1 text-ink-soft">
                <CheckCircle2 className="w-3.5 h-3.5 text-mint" />
                {isWholeRoom ? 'Còn nguyên phòng' : `Còn ${room.bedsAvailable}/${room.capacity} giường`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onContact}>
              <MessageCircle className="w-4 h-4" /> Liên hệ
            </Button>
            <Button size="sm" onClick={onViewDetail} disabled={noVacancy}>
              <Calendar className="w-4 h-4" /> Đặt lịch xem
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
