import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)            // 1: xác minh · 2: đặt mật khẩu mới · 3: xong
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [form, setForm] = useState({ email: '', phone: '', newPassword: '', confirm: '' })
  const set = (k, v) => setForm({ ...form, [k]: v })

  // Bước 1: xác minh email + SĐT đã đăng ký
  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.phone) { setError('Vui lòng nhập email và số điện thoại'); return }
    try {
      setLoading(true)
      const { resetToken, hoTen } = await api.forgotPassword(form.email, form.phone)
      setResetToken(resetToken); setHoTen(hoTen); setStep(2)
    } catch (err) {
      setError(err.message || 'Không xác minh được tài khoản')
    } finally { setLoading(false) }
  }

  // Bước 2: đặt mật khẩu mới
  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) { setError('Mật khẩu mới phải có ít nhất 8 ký tự'); return }
    if (form.newPassword !== form.confirm) { setError('Mật khẩu xác nhận không khớp'); return }
    try {
      setLoading(true)
      await api.resetPassword(resetToken, form.newPassword)
      setStep(3)
    } catch (err) {
      setError(err.message || 'Đặt lại mật khẩu thất bại')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12 animate-fade-up grain-bg">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-terracotta-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
        </Link>

        <Card className="p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-terracotta-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">Quên mật khẩu 🔑</h1>
            <p className="text-sm text-ink-soft">
              {step === 1 && 'Xác minh danh tính bằng email và số điện thoại đã đăng ký'}
              {step === 2 && `Xin chào ${hoTen || ''}, hãy đặt mật khẩu mới`}
              {step === 3 && 'Hoàn tất!'}
            </p>
          </div>

          {/* BƯỚC 1 — XÁC MINH */}
          {step === 1 && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <Label htmlFor="email" className="mb-2 block">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input id="email" type="email" placeholder="ban@email.com" value={form.email}
                    onChange={e => set('email', e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="mb-2 block">Số điện thoại đã đăng ký</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input id="phone" type="tel" placeholder="0901234567" value={form.phone}
                    onChange={e => set('phone', e.target.value)} className="pl-10" required />
                </div>
              </div>
              {error && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</div>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Đang xác minh…' : 'Tiếp tục'}
              </Button>
            </form>
          )}

          {/* BƯỚC 2 — MẬT KHẨU MỚI */}
          {step === 2 && (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <Label htmlFor="newPassword" className="mb-2 block">Mật khẩu mới</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="Ít nhất 8 ký tự"
                    value={form.newPassword} onChange={e => set('newPassword', e.target.value)} className="pl-10 pr-10" minLength="8" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirm" className="mb-2 block">Xác nhận mật khẩu</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input id="confirm" type={showPassword ? 'text' : 'password'} placeholder="Nhập lại mật khẩu mới"
                    value={form.confirm} onChange={e => set('confirm', e.target.value)} className="pl-10" minLength="8" required />
                </div>
              </div>
              {error && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</div>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
              </Button>
            </form>
          )}

          {/* BƯỚC 3 — THÀNH CÔNG */}
          {step === 3 && (
            <div className="text-center space-y-5">
              <CheckCircle2 className="w-14 h-14 text-mint mx-auto" />
              <p className="text-sm text-ink-soft">Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
              <Button size="lg" className="w-full" onClick={() => navigate('/login')}>Đến trang đăng nhập</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
