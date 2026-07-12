import { api } from '@/lib/api'
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getDefaultStaffHome, DEMO_STAFF, ROLE_LABELS } from '@/lib/staffUi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Building2, Calculator
} from 'lucide-react'

export default function StaffLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginAsStaff } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectTo = location.state?.from

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu')
      return
    }

    try {
      setLoading(true)
      // API kiểm tra email + mật khẩu; api.js tự lưu token, trả về { user }
      const { user } = await api.staffLogin(form.email, form.password)
      loginAsStaff(user)
      // Chỉ quay lại trang trước nếu nó thuộc đúng vai trò vừa đăng nhập;
      // tránh trường hợp đổi tài khoản khác vai trò rồi bị văng vào trang 403.
      const home = getDefaultStaffHome(user.role)
      const safe = redirectTo && redirectTo.startsWith(`/staff/${user.role}/`) ? redirectTo : home
      navigate(safe)
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  // Đăng nhập nhanh demo: gọi API thật với mật khẩu demo (123456) để có token
  const handleQuickLogin = async (staff) => {
    setError('')
    try {
      setLoading(true)
      const { user } = await api.staffLogin(staff.email, '123456')
      loginAsStaff(user)
      navigate(getDefaultStaffHome(user.role))
    } catch (err) {
      setError(err.message || 'Không đăng nhập được tài khoản demo')
    } finally {
      setLoading(false)
    }
  }

  const roleIcons = {
    sale: ShieldCheck,
    manager: Building2,
    accountant: Calculator,
    admin: Lock,
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 grain-bg bg-cream">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-terracotta-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Về trang khách hàng
        </Link>

        <Card className="p-8 shadow-xl">
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-ink rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-4">
              H
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">Đăng nhập nhân viên 🛡️</h1>
            <p className="text-sm text-ink-soft">Cổng quản trị nội bộ HomeStay Dorm</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="mb-2 block">Email công vụ</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ten.bopha@homestay.vn"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="mb-2 block">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>

          {/* DIVIDER */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-cream-dark"></div>
            <span className="text-xs text-ink-muted">Hoặc dùng tài khoản demo</span>
            <div className="flex-1 h-px bg-cream-dark"></div>
          </div>

          {/* QUICK LOGIN — DEMO */}
          <div className="space-y-2">
            {DEMO_STAFF.map(staff => {
              const Icon = roleIcons[staff.role]
              return (
                <button
                  key={staff.id}
                  onClick={() => handleQuickLogin(staff)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border-[1.5px] border-cream-dark hover:border-terracotta-300 hover:bg-warm-white transition text-left disabled:opacity-60"
                >
                  <div className="w-9 h-9 bg-ink rounded-lg flex items-center justify-center text-white">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{ROLE_LABELS[staff.role]}</div>
                    <div className="text-xs text-ink-muted truncate">{staff.email}</div>
                  </div>
                  <div className="text-xs text-terracotta-500 font-semibold">
                    Đăng nhập →
                  </div>
                </button>
              )
            })}
          </div>

          <div className="text-center mt-6 text-xs text-ink-muted">
            💡 Tài khoản demo dùng mật khẩu <span className="font-semibold">123456</span>
          </div>
        </Card>

        <div className="text-center mt-4">
          <Link to="/login" className="text-xs text-ink-muted hover:text-terracotta-500">
            Bạn là khách hàng? Đăng nhập tại đây →
          </Link>
        </div>
      </div>
    </div>
  )
}
