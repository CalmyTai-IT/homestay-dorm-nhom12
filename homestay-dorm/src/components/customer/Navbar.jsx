import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { User, Menu, LogOut, ChevronDown } from 'lucide-react'
import NotificationDropdown from '@/components/customer/NotificationDropdown'

const navItems = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/search', label: 'Tìm phòng' },
  { to: '/about', label: 'Về chúng tôi' },
  { to: '/my-bookings', label: 'Đặt phòng của tôi' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()  // Lấy user thật từ context
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 bg-warm-white/90 backdrop-blur-md border-b border-cream-dark">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center text-white font-display font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
            H
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-ink leading-none">HomeStay Dorm</div>
            <div className="text-[10px] text-ink-muted">Ngôi nhà thứ hai của bạn</div>
          </div>
        </Link>

        {/* NAV ITEMS */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-terracotta-500 bg-terracotta-50'
                    : 'text-ink-soft hover:text-ink hover:bg-warm-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationDropdown />

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] border-cream-dark hover:border-terracotta-300 transition"
                >
                  <div className="w-7 h-7 bg-terracotta-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {(user.fullName || user.email)[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">
                    {user.fullName || user.email.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-ink-muted" />
                </button>

                {userMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-cream-dark shadow-lg z-50 overflow-hidden">
                      <div className="p-3 border-b border-cream-dark">
                        <div className="text-xs text-ink-muted">Đăng nhập với</div>
                        <div className="text-sm font-semibold truncate">{user.email}</div>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/my-bookings') }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-warm-white transition"
                      >
                        <User className="w-4 h-4" /> Đặt phòng của tôi
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
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:flex">
                Đăng nhập
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                Đăng ký
              </Button>
            </>
          )}

          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden border-t border-cream-dark bg-warm-white">
          <div className="px-6 py-3 flex flex-col gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'text-terracotta-500 bg-terracotta-50' : 'text-ink-soft'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}