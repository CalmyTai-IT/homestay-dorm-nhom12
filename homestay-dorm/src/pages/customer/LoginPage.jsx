import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Trang trước đó (nếu bị redirect tới login) — sau khi login quay lại trang đó
  const redirectTo = location.state?.from || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu')
      return
    }

    try {
      setLoading(true)
      // Gọi API thật; api.js tự lưu token, trả về { user }
      const { user } = await api.customerLogin(form.email, form.password)
      login(user)
      navigate(redirectTo)
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12 animate-fade-up grain-bg">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-terracotta-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
        </Link>

        <Card className="p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-terracotta-500 rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-4">
              H
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">Chào mừng trở lại 👋</h1>
            <p className="text-sm text-ink-soft">Đăng nhập để quản lý đặt phòng của bạn</p>
          </div>

          {/* Thông báo nếu bị redirect tới login */}
          {location.state?.from && (
            <div className="mb-4 p-3 bg-gold-light/30 border border-gold/30 rounded-lg text-xs text-ink-soft">
              💡 Vui lòng đăng nhập để tiếp tục.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="mb-2 block">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ban@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Link to="/forgot-password" className="text-xs text-terracotta-500 font-semibold hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
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

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-terracotta-500 w-4 h-4" />
              <span className="text-sm text-ink-soft">Ghi nhớ đăng nhập</span>
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-cream-dark"></div>
            <span className="text-xs text-ink-muted">hoặc</span>
            <div className="flex-1 h-px bg-cream-dark"></div>
          </div>

          <div className="text-center text-sm text-ink-soft">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-terracotta-500 font-semibold hover:underline">
              Đăng ký ngay
            </Link>
          </div>
        </Card>

        <div className="text-center mt-4">
          <Link to="/staff/login" className="text-xs text-ink-muted hover:text-terracotta-500">
            Bạn là nhân viên? Đăng nhập tại đây →
          </Link>
        </div>
      </div>
    </div>
  )
}
