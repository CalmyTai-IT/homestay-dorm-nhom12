import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/staffUi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Building2, BadgeCheck, Calendar, Lock, Bell, Check, AlertCircle, Eye, EyeOff, Save } from 'lucide-react'

// Banner thông báo kết quả (thành công / lỗi)
function Banner({ msg }) {
  if (!msg) return null
  const ok = msg.type === 'success'
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
      ok ? 'bg-mint-light text-mint-dark' : 'bg-red-50 text-red-600'
    }`}>
      {ok ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span>{msg.text}</span>
    </div>
  )
}

// Công tắc bật/tắt (toggle switch)
function Toggle({ checked, onChange, activeClass }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
        checked ? activeClass : 'bg-cream-dark'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

// Header nhỏ cho mỗi card (icon + tiêu đề + mô tả)
function SectionHeader({ icon: Icon, title, desc, bgLight, text }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgLight}`}>
        <Icon className={`w-5 h-5 ${text}`} />
      </div>
      <div>
        <h2 className="font-display font-bold text-lg leading-tight">{title}</h2>
        <p className="text-xs text-ink-muted">{desc}</p>
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth()

  const roleLabel = ROLE_LABELS[user?.role] || 'Nhân viên'
  const roleColor = ROLE_COLORS[user?.role] || 'terracotta'
  const colorClasses = ({
    terracotta: { bg: 'bg-terracotta-500', text: 'text-terracotta-500', bgLight: 'bg-terracotta-50' },
    mint: { bg: 'bg-mint', text: 'text-mint-dark', bgLight: 'bg-mint-light' },
    gold: { bg: 'bg-gold', text: 'text-gold', bgLight: 'bg-gold-light' },
    ink: { bg: 'bg-ink', text: 'text-ink', bgLight: 'bg-cream-dark' },
  })[roleColor] || { bg: 'bg-terracotta-500', text: 'text-terracotta-500', bgLight: 'bg-terracotta-50' }

  // ===== Card 1: Thông tin cá nhân =====
  const [profile, setProfile] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [profileMsg, setProfileMsg] = useState(null)

  // Tùy chọn thông báo (khai báo TRƯỚC effect bên dưới vì effect có dùng setPrefs)
  const [prefs, setPrefs] = useState({
    emailNotif: user?.preferences?.emailNotif ?? true,
    smsNotif: user?.preferences?.smsNotif ?? false,
    desktopNotif: user?.preferences?.desktopNotif ?? true,
  })

  // Tải hồ sơ nhân viên thật (SĐT + tuỳ chọn không có sẵn trong token)
  useEffect(() => {
    api.getStaffProfile()
      .then(p => {
        setProfile({ fullName: p.hoTen || '', email: p.email || '', phone: p.soDienThoai || '' })
        if (p.preferences) setPrefs(pr => ({ ...pr, ...p.preferences }))
        updateUser({ fullName: p.hoTen, email: p.email, phone: p.soDienThoai, preferences: p.preferences || {} })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const profileChanged =
    profile.fullName !== (user?.fullName || '') ||
    profile.email !== (user?.email || '') ||
    profile.phone !== (user?.phone || '')

  const handleSaveProfile = async () => {
    if (!profile.fullName.trim()) {
      setProfileMsg({ type: 'error', text: 'Họ tên không được để trống.' })
      return
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())
    if (!emailOk) {
      setProfileMsg({ type: 'error', text: 'Email không hợp lệ.' })
      return
    }
    if (profile.phone.trim() && !/^0\d{9}$/.test(profile.phone.trim())) {
      setProfileMsg({ type: 'error', text: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.' })
      return
    }
    const newName = profile.fullName.trim()
    try {
      await api.updateStaffProfile({ hoTen: newName, email: profile.email.trim(), soDienThoai: profile.phone.trim() })
      updateUser({
        fullName: newName,
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        avatar: newName[0]?.toUpperCase() || user?.avatar,
      })
      setProfileMsg({ type: 'success', text: 'Đã lưu thông tin cá nhân.' })
    } catch (e) {
      setProfileMsg({ type: 'error', text: e.message || 'Không lưu được thông tin.' })
    }
  }

  // ===== Card 2: Đổi mật khẩu =====
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState(null)

  const handleChangePassword = async () => {
    if (!pwd.current || !pwd.next || !pwd.confirm) {
      setPwdMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ các trường mật khẩu.' })
      return
    }
    if (pwd.next.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' })
      return
    }
    if (pwd.next === pwd.current) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải khác mật khẩu hiện tại.' })
      return
    }
    try {
      await api.changePassword(pwd.current, pwd.next)
      setPwd({ current: '', next: '', confirm: '' })
      setPwdMsg({ type: 'success', text: 'Đổi mật khẩu thành công.' })
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.message || 'Không đổi được mật khẩu.' })
    }
  }


  const togglePref = (key) => {
    const nextVal = !prefs[key]
    const next = { ...prefs, [key]: nextVal }
    setPrefs(next)
    updateUser({ preferences: next }) // cập nhật cục bộ ngay
    api.savePreferences(next).catch(() => {}) // lưu lên server (không chặn UI)

    // Khi bật "thông báo trình duyệt" → xin quyền hiển thị của trình duyệt
    if (key === 'desktopNotif' && nextVal &&
        typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
    }
  }

  const notifRows = [
    { key: 'emailNotif', label: 'Thông báo qua Email', desc: 'Nhận email khi có đơn/giao dịch mới cần xử lý' },
    { key: 'smsNotif', label: 'Thông báo qua SMS', desc: 'Nhận tin nhắn cho các việc khẩn' },
    { key: 'desktopNotif', label: 'Thông báo trên trình duyệt', desc: 'Hiện thông báo đẩy khi đang mở hệ thống' },
  ]

  return (
    <div className="max-w-3xl mx-auto animate-fade-up space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="font-display text-2xl font-bold">Cài đặt tài khoản</h1>
        <p className="text-ink-soft text-sm">Quản lý thông tin cá nhân, bảo mật và tùy chọn thông báo</p>
      </div>

      {/* CARD 1 — THÔNG TIN CÁ NHÂN */}
      <Card>
        <CardContent className="p-6">
          <SectionHeader
            icon={User}
            title="Thông tin cá nhân"
            desc="Cập nhật họ tên, email và số điện thoại liên hệ"
            bgLight={colorClasses.bgLight}
            text={colorClasses.text}
          />

          {/* Avatar + role */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-cream-dark">
            <div className={`w-16 h-16 ${colorClasses.bg} rounded-2xl flex items-center justify-center text-white text-2xl font-display font-bold flex-shrink-0`}>
              {profile.fullName?.[0]?.toUpperCase() || user?.avatar || 'S'}
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">{profile.fullName || 'Nhân viên'}</div>
              <div className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 ${colorClasses.text}`}>
                <BadgeCheck className="w-3.5 h-3.5" /> {roleLabel}
              </div>
            </div>
          </div>

          {/* Form editable */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input
                id="fullName"
                value={profile.fullName}
                onChange={e => { setProfile({ ...profile, fullName: e.target.value }); setProfileMsg(null) }}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={e => { setProfile({ ...profile, email: e.target.value }); setProfileMsg(null) }}
                placeholder="email@homestay.vn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={e => { setProfile({ ...profile, phone: e.target.value }); setProfileMsg(null) }}
                placeholder="09xxxxxxxx"
              />
            </div>
          </div>

          {/* Read-only info */}
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label>Chi nhánh phụ trách</Label>
              <div className="flex items-center gap-2 h-11 px-4 rounded-lg bg-warm-white border-[1.5px] border-cream-dark text-sm text-ink-soft">
                <Building2 className="w-4 h-4 text-ink-muted" />
                {user?.branch || '—'}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày vào làm</Label>
              <div className="flex items-center gap-2 h-11 px-4 rounded-lg bg-warm-white border-[1.5px] border-cream-dark text-sm text-ink-soft">
                <Calendar className="w-4 h-4 text-ink-muted" />
                {formatDate(user?.joinedAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <Button onClick={handleSaveProfile} disabled={!profileChanged}>
              <Save className="w-4 h-4" /> Lưu thay đổi
            </Button>
            <Banner msg={profileMsg} />
          </div>
        </CardContent>
      </Card>

      {/* CARD 2 — ĐỔI MẬT KHẨU */}
      <Card>
        <CardContent className="p-6">
          <SectionHeader
            icon={Lock}
            title="Đổi mật khẩu"
            desc="Đặt mật khẩu mới để bảo vệ tài khoản"
            bgLight={colorClasses.bgLight}
            text={colorClasses.text}
          />

          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="currentPwd">Mật khẩu hiện tại</Label>
              <div className="relative">
                <Input
                  id="currentPwd"
                  type={showPwd ? 'text' : 'password'}
                  value={pwd.current}
                  onChange={e => { setPwd({ ...pwd, current: e.target.value }); setPwdMsg(null) }}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPwd">Mật khẩu mới</Label>
              <Input
                id="newPwd"
                type={showPwd ? 'text' : 'password'}
                value={pwd.next}
                onChange={e => { setPwd({ ...pwd, next: e.target.value }); setPwdMsg(null) }}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPwd">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPwd"
                type={showPwd ? 'text' : 'password'}
                value={pwd.confirm}
                onChange={e => { setPwd({ ...pwd, confirm: e.target.value }); setPwdMsg(null) }}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" onClick={handleChangePassword}>
                <Lock className="w-4 h-4" /> Cập nhật mật khẩu
              </Button>
            </div>
            <Banner msg={pwdMsg} />
          </div>
        </CardContent>
      </Card>

      {/* CARD 3 — TÙY CHỌN THÔNG BÁO */}
      <Card>
        <CardContent className="p-6">
          <SectionHeader
            icon={Bell}
            title="Tùy chọn thông báo"
            desc="Chọn cách bạn muốn nhận thông báo từ hệ thống"
            bgLight={colorClasses.bgLight}
            text={colorClasses.text}
          />

          <div className="divide-y divide-cream-dark">
            {notifRows.map(row => (
              <div key={row.key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div className="pr-4">
                  <div className="font-medium text-sm">{row.label}</div>
                  <div className="text-xs text-ink-muted">{row.desc}</div>
                </div>
                <Toggle
                  checked={prefs[row.key]}
                  onChange={() => togglePref(row.key)}
                  activeClass={colorClasses.bg}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
