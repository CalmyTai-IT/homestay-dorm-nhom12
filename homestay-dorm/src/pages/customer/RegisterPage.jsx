import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { User, Calendar, Mail, Phone, CreditCard, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

// Form dùng 'Nam'/'Nữ' → DB yêu cầu 'nam'/'nu'/'khac'
const GENDER_MAP = { 'Nam': 'nam', 'Nữ': 'nu' }

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    idNumber: '',
    password: '',
    agreeTerms: false,
  })

  const update = (k, v) => setForm({ ...form, [k]: v })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.agreeTerms) {
      setError('Vui lòng đồng ý với điều khoản sử dụng')
      return
    }

    try {
      setLoading(true)
      // Gọi API đăng ký; api.js tự lưu token, trả về { user }
      const { user } = await api.customerRegister({
        hoTen: form.fullName,
        email: form.email,
        password: form.password,
        gioiTinh: GENDER_MAP[form.gender] || 'khac',
        soDienThoai: form.phone,
        soGiayTo: form.idNumber,
        ngaySinh: form.dateOfBirth || null,
      })
      login(user)
      navigate('/') // Đăng ký xong tự động đăng nhập + về trang chủ
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12 animate-fade-up grain-bg">
      <div className="w-full max-w-xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-terracotta-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
        </Link>

        <Card className="p-8 shadow-xl">
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-terracotta-500 rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-4">
              H
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">Tạo tài khoản 🏡</h1>
            <p className="text-sm text-ink-soft">Đăng ký để dễ dàng đặt phòng và quản lý hợp đồng</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Họ tên */}
            <div>
              <Label htmlFor="fullName" className="mb-2 block">Họ và tên *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="fullName"
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={e => update('fullName', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Ngày sinh + Giới tính */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dob" className="mb-2 block">Ngày sinh *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <Input
                    id="dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => update('dateOfBirth', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="gender" className="mb-2 block">Giới tính *</Label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={e => update('gender', e.target.value)}
                  className="flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 text-sm focus:outline-none focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-500/20"
                  required
                >
                  <option value="">Chọn giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="mb-2 block">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ban@email.com"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* SĐT + CCCD */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone" className="mb-2 block">Số điện thoại *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0901234567"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cccd" className="mb-2 block">CCCD *</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input
                    id="cccd"
                    placeholder="079123456789"
                    value={form.idNumber}
                    onChange={e => update('idNumber', e.target.value)}
                    className="pl-10"
                    maxLength="12"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Mật khẩu */}
            <div>
              <Label htmlFor="password" className="mb-2 block">Mật khẩu *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ít nhất 8 ký tự"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  className="pl-10 pr-10"
                  minLength="8"
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

            {/* Agree terms */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreeTerms}
                onChange={e => update('agreeTerms', e.target.checked)}
                className="accent-terracotta-500 w-4 h-4 mt-0.5"
              />
              <span className="text-sm text-ink-soft">
                Tôi đồng ý với{' '}
                <a href="#" className="text-terracotta-500 font-semibold hover:underline">Điều khoản sử dụng</a>{' '}
                và{' '}
                <a href="#" className="text-terracotta-500 font-semibold hover:underline">Chính sách bảo mật</a> của HomeStay Dorm
              </span>
            </label>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
            </Button>
          </form>

          {/* LOGIN LINK */}
          <div className="text-center mt-6 text-sm text-ink-soft">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-terracotta-500 font-semibold hover:underline">
              Đăng nhập
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
