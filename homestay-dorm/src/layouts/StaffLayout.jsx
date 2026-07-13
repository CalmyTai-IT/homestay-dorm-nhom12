import { useState, useMemo, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/staffUi'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, FileText, CreditCard, Building2, ClipboardList, Wallet, Calculator, Home, LogOut, Menu, X, ChevronDown, Settings, Search, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import StaffNotificationDropdown from '@/components/staff/StaffNotificationDropdown'


// Định nghĩa menu cho từng vai trò
const ROLE_MENUS = {
  sale: [
    { to: '/staff/sale/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/staff/sale/bookings', label: 'Đơn đăng ký', icon: ClipboardList },
    { to: '/staff/sale/deposits', label: 'Phiếu đặt cọc', icon: CreditCard },
    { to: '/staff/sale/checkouts', label: 'Yêu cầu trả phòng', icon: FileText },
    { to: '/staff/sale/rooms', label: 'Phòng/giường', icon: Building2 },
  ],
  manager: [
    { to: '/staff/manager/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/staff/manager/deposits', label: 'Xác nhận cọc', icon: CreditCard },
    { to: '/staff/manager/contracts', label: 'Hợp đồng', icon: FileText },
    { to: '/staff/manager/handovers', label: 'Bàn giao phòng', icon: Home },
    { to: '/staff/manager/checkouts', label: 'Trả phòng', icon: ClipboardList },
    { to: '/staff/manager/rooms', label: 'Quản lý phòng', icon: Building2 },
  ],
  accountant: [
    { to: '/staff/accountant/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/staff/accountant/deposit-requests', label: 'Yêu cầu thanh toán', icon: Wallet },
    { to: '/staff/accountant/payments', label: 'Đối soát thanh toán', icon: CreditCard },
    { to: '/staff/accountant/refunds', label: 'Hoàn cọc', icon: Calculator },
  ],
  admin: [
    { to: '/staff/admin/dashboard', label: 'Quản lý hệ thống', icon: ShieldCheck },
    { to: '/staff/admin/settings', label: 'Cài đặt', icon: Settings },
  ],
}

export default function StaffLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  // Dữ liệu thật từ API để tìm kiếm (thay cho mock cũ). Tải theo quyền của vai trò.
  const [searchData, setSearchData] = useState({ bookings: [], deposits: [], contracts: [] })

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    const role = user.role
    const safe = (p) => p.then(r => Array.isArray(r) ? r : []).catch(() => [])
    // RBAC: /bookings chỉ cho sale & manager; /deposits & /contracts cho cả 3 vai trò
    const bookingsP = (role === 'sale' || role === 'manager') ? safe(api.listBookings()) : Promise.resolve([])
    Promise.all([bookingsP, safe(api.listDeposits()), safe(api.listContracts())])
      .then(([bookings, deposits, contracts]) => {
        if (alive) setSearchData({ bookings, deposits, contracts })
      })
    return () => { alive = false }
  }, [user?.id, user?.role])

  // Logic tìm kiếm toàn cục: đơn đăng ký, phiếu cọc, hợp đồng (dữ liệu thật từ API)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || q.length < 2) return null

    const results = []
    const match = (...vals) => vals.some(v => v && String(v).toLowerCase().includes(q))
    const role = user?.role

    // Trang đích theo vai trò (null = vai trò này không có trang tương ứng → bỏ qua)
    const bookingUrl = role === 'sale' ? '/staff/sale/bookings' : null
    const depositUrl = role === 'sale' ? '/staff/sale/deposits'
      : role === 'manager' ? '/staff/manager/deposits'
      : role === 'accountant' ? '/staff/accountant/payments' : null
    const contractUrl = role === 'manager' ? '/staff/manager/contracts' : null

    // Đơn đăng ký
    if (bookingUrl) searchData.bookings.forEach(b => {
      const roomId = b.tieu_chi?.roomId
      if (match(b.ma_phieu, b.ho_ten, b.so_dien_thoai)) {
        results.push({
          type: 'booking', typeLabel: 'Đơn đăng ký', id: b.ma_phieu,
          title: b.ho_ten || '—',
          subtitle: `${b.ma_phieu}${roomId ? ` · Phòng ${roomId}` : ''}`,
          url: bookingUrl,
          color: 'bg-terracotta-100 text-terracotta-600',
        })
      }
    })

    // Phiếu cọc
    if (depositUrl) searchData.deposits.forEach(s => {
      if (match(s.ma_phieu, s.ho_ten, s.so_dien_thoai)) {
        results.push({
          type: 'deposit', typeLabel: 'Phiếu cọc', id: s.ma_phieu,
          title: s.ho_ten || '—',
          subtitle: `${s.ma_phieu} · ${Number(s.so_tien_coc || 0).toLocaleString('vi-VN')}đ`,
          url: depositUrl,
          color: 'bg-gold-light text-gold',
        })
      }
    })

    // Hợp đồng
    if (contractUrl) searchData.contracts.forEach(c => {
      if (match(c.ma_hop_dong, c.ho_ten, c.so_dien_thoai)) {
        results.push({
          type: 'contract', typeLabel: 'Hợp đồng', id: c.ma_hop_dong,
          title: c.ho_ten || '—',
          subtitle: `${c.ma_hop_dong}${c.ma_phong ? ` · Phòng ${c.ma_phong}` : ''}`,
          url: contractUrl,
          color: 'bg-mint-light text-mint-dark',
        })
      }
    })

    return results.slice(0, 10) // Tối đa 10 kết quả
  }, [searchQuery, searchData, user?.role])

  const handleResultClick = (result) => {
    setSearchOpen(false)
    setSearchQuery('')
    navigate(`${result.url}?focus=${encodeURIComponent(result.id)}`)
  }

  const menuItems = ROLE_MENUS[user?.role] || []
  const roleLabel = ROLE_LABELS[user?.role] || 'Nhân viên'
  const roleColor = ROLE_COLORS[user?.role] || 'terracotta'

  const handleLogout = () => {
    logout()
    navigate('/staff/login')
  }

  const colorClasses = {
    terracotta: { bg: 'bg-terracotta-500', text: 'text-terracotta-500', bgLight: 'bg-terracotta-50' },
    mint: { bg: 'bg-mint', text: 'text-mint-dark', bgLight: 'bg-mint-light' },
    gold: { bg: 'bg-gold', text: 'text-gold', bgLight: 'bg-gold-light' },
    ink: { bg: 'bg-ink', text: 'text-ink', bgLight: 'bg-cream-dark' },
  }[roleColor]

  return (
    <div className="min-h-screen bg-cream flex">
      {/* === SIDEBAR === */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-cream-dark
        flex flex-col z-40 transition-transform
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-cream-dark">
          <Link to={`/staff/${user?.role}/dashboard`} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center text-white font-display font-bold text-lg">
              H
            </div>
            <div>
              <div className="font-display font-bold text-ink leading-tight">HomeStay Dorm</div>
              <div className={`text-[10px] font-semibold ${colorClasses.text}`}>
                {roleLabel.toUpperCase()}
              </div>
            </div>
          </Link>
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-3 mb-2">
            Chức năng
          </div>
          <div className="space-y-1">
            {menuItems.map(item => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                    ${isActive
                      ? `${colorClasses.bgLight} ${colorClasses.text} font-semibold`
                      : 'text-ink-soft hover:bg-warm-white hover:text-ink'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>

        {/* User info ở dưới */}
        <div className="p-3 border-t border-cream-dark">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-muted hover:bg-warm-white"
          >
            <Home className="w-3.5 h-3.5" />
            Về trang khách hàng
          </Link>
        </div>
      </aside>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* === MAIN === */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-cream-dark">
          <div className="px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Search bar (desktop) */}
            <div className="hidden md:flex flex-1 max-w-md relative">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Tìm đơn, mã phiếu, khách hàng..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-full h-9 pl-10 pr-9 rounded-lg border-[1.5px] border-cream-dark bg-warm-white text-sm focus:outline-none focus:border-terracotta-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded hover:bg-cream-dark flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-ink-muted" />
                  </button>
                )}
              </div>

              {/* Dropdown kết quả */}
              {searchOpen && searchQuery.length >= 2 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-cream-dark shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                    {searchResults && searchResults.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold text-ink-muted uppercase tracking-wider border-b border-cream-dark">
                          {searchResults.length} kết quả
                        </div>
                        {searchResults.map((r, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleResultClick(r)}
                            className="w-full px-3 py-2.5 hover:bg-warm-white transition flex items-center gap-3 text-left border-b border-cream-dark last:border-0"
                          >
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${r.color}`}>
                              {r.typeLabel}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{r.title}</div>
                              <div className="text-xs text-ink-muted truncate">{r.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="p-6 text-center">
                        <div className="text-3xl mb-2">🔍</div>
                        <div className="text-sm font-semibold mb-1">Không tìm thấy</div>
                        <div className="text-xs text-ink-muted">Không có kết quả cho "{searchQuery}"</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Notifications */}
              <StaffNotificationDropdown />

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] border-cream-dark hover:border-terracotta-300 transition"
                >
                  <div className={`w-8 h-8 ${colorClasses.bg} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {user?.avatar || user?.fullName?.[0] || 'S'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{user?.fullName}</div>
                    <div className="text-[10px] text-ink-muted">{roleLabel}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-ink-muted" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-cream-dark shadow-lg z-50 overflow-hidden">
                      <div className="p-3 border-b border-cream-dark">
                        <div className="text-xs text-ink-muted">Đăng nhập với</div>
                        <div className="text-sm font-semibold truncate">{user?.email}</div>
                        <div className={`text-xs ${colorClasses.text} font-semibold mt-0.5`}>{roleLabel}</div>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate(`/staff/${user?.role}/settings`) }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-warm-white transition"
                      >
                        <Settings className="w-4 h-4" /> Cài đặt
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-warm-white transition text-red-500"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}