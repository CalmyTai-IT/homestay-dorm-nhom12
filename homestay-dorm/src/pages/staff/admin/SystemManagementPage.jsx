import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ROLE_LABELS, ROLE_COLORS,
} from '@/lib/staffUi'
import {
  formatDateTime,
} from '@/lib/systemHelpers'
import {
  Users, Building2, SlidersHorizontal, History,
  Plus, Pencil, Trash2, X, Check, Save, AlertTriangle, ShieldCheck, Lock,
} from 'lucide-react'

// ============ HELPERS DÙNG CHUNG ============

const selectCls =
  'flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 text-sm focus:outline-none focus:border-terracotta-500'

const ROLE_OPTIONS = [
  { value: 'sale', label: 'Nhân viên Sale' },
  { value: 'accountant', label: 'Kế toán' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'admin', label: 'Quản trị hệ thống' },
]

function RoleBadge({ role }) {
  const label = ROLE_LABELS[role] || role
  const color = ROLE_COLORS[role] || 'terracotta'
  const cls = {
    terracotta: 'bg-terracotta-100 text-terracotta-600',
    mint: 'bg-mint-light text-mint-dark',
    gold: 'bg-gold-light text-gold',
    ink: 'bg-cream-dark text-ink',
  }[color]
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
}

function Banner({ msg }) {
  if (!msg) return null
  const ok = msg.type === 'success'
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
      ok ? 'bg-mint-light text-mint-dark' : 'bg-red-50 text-red-600'
    }`}>
      {ok ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span>{msg.text}</span>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
        checked ? 'bg-terracotta-500' : 'bg-cream-dark'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl border border-cream-dark shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto custom-scrollbar`}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-white z-10">
          <h3 className="font-display font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-warm-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 p-5 pt-0">{footer}</div>}
      </div>
    </div>
  )
}

function ConfirmDelete({ open, onClose, onConfirm, name }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xác nhận xóa"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="w-4 h-4" /> Xóa
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Bạn chắc chắn muốn xóa <strong className="text-ink">{name}</strong>? Hành động này không thể hoàn tác.
      </p>
    </Modal>
  )
}

// ============ TAB 1: QUẢN LÝ NHÂN VIÊN ============

function StaffPanel() {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [branches, setBranches] = useState([])
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'sale', branch: '' })
  const [toDelete, setToDelete] = useState(null)

  // Quản lý CHI NHÁNH (user.chiNhanhId != null) chỉ được phân nhân viên cho chi nhánh mình.
  // Quản lý TOÀN HỆ THỐNG (chiNhanhId null) được chọn bất kỳ chi nhánh / toàn hệ thống.
  const myBranchId = user?.chiNhanhId ?? null
  const isBranchManager = myBranchId != null
  const myBranchName = branches.find(b => b.id === myBranchId)?.name || ''

  const refresh = () => { api.listStaff().then(setList).catch(() => {}) }
  useEffect(() => {
    refresh()
    api.listBranches().then(setBranches).catch(() => {})
  }, [])

  const openAdd = () => {
    setForm({ fullName: '', email: '', phone: '', role: 'sale', branch: isBranchManager ? myBranchName : (branches[0]?.name || '') })
    setEditing({})
    setMsg(null)
  }

  const openEdit = (s) => {
    // Cách 1: không cho sửa tài khoản Quản lý khác
    if (s.role === 'manager') {
      setMsg({ type: 'error', text: 'Không thể chỉnh sửa tài khoản Quản lý.' })
      return
    }
    setForm({ fullName: s.fullName, email: s.email, phone: s.phone || '', role: s.role, branch: s.branch || '' })
    setEditing(s)
    setMsg(null)
  }

  const handleSave = async () => {
    if (!form.fullName.trim()) return setMsg({ type: 'error', text: 'Vui lòng nhập họ tên.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setMsg({ type: 'error', text: 'Email không hợp lệ.' })
    try {
      if (editing.id) {
        await api.updateStaff(editing.id, form)
        setMsg({ type: 'success', text: 'Đã cập nhật nhân viên.' })
      } else {
        await api.createStaff(form)
        setMsg({ type: 'success', text: 'Đã thêm nhân viên mới (mật khẩu mặc định: 123456).' })
      }
      refresh()
      setEditing(null)
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Không lưu được nhân viên.' })
    }
  }

  const handleDelete = async () => {
    // Không cho xóa tài khoản Quản lý (gồm cả chính mình)
    if (toDelete.role === 'manager') {
      setToDelete(null)
      return setMsg({ type: 'error', text: 'Không thể xóa tài khoản Quản lý.' })
    }
    try {
      await api.deleteStaff(toDelete.id)
      refresh()
      setToDelete(null)
      setMsg({ type: 'success', text: 'Đã xóa nhân viên.' })
    } catch (e) {
      setToDelete(null)
      setMsg({ type: 'error', text: e.message || 'Không xóa được nhân viên.' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Banner msg={msg} />
        <Button onClick={openAdd} className="ml-auto">
          <Plus className="w-4 h-4" /> Thêm nhân viên
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-bold">Nhân viên</th>
                <th className="px-4 py-3 font-bold">Vai trò</th>
                <th className="px-4 py-3 font-bold">Chi nhánh</th>
                <th className="px-4 py-3 font-bold">Liên hệ</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {list.map(s => {
                const isManager = s.role === 'manager'
                return (
                  <tr key={s.id} className="hover:bg-warm-white transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-terracotta-100 text-terracotta-600 flex items-center justify-center font-display font-bold flex-shrink-0">
                          {s.avatar || s.fullName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold">{s.fullName}</div>
                          <div className="text-xs text-ink-muted">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={s.role} /></td>
                    <td className="px-4 py-3 text-ink-soft">{s.branch || '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {isManager ? (
                        // Tài khoản Quản lý: chỉ đọc (Quản lý không quản trị Quản lý khác)
                        <div className="flex items-center justify-end gap-1 text-xs text-ink-muted" title="Không thể chỉnh sửa tài khoản Quản lý">
                          <Lock className="w-3.5 h-3.5" /> Chỉ đọc
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg hover:bg-cream-dark flex items-center justify-center text-ink-soft" title="Sửa">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setToDelete(s)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500" title="Xóa">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">Chưa có nhân viên nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        <Lock className="w-3 h-3 inline -mt-0.5 mr-1" />
        Có thể thêm tài khoản Quản lý mới, nhưng không sửa/xóa Quản lý hiện có tại đây (xử lý ở cơ sở dữ liệu).
      </p>

      {/* Modal thêm/sửa */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={handleSave}><Save className="w-4 h-4" /> Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Banner msg={msg} />
          <div className="space-y-1.5">
            <Label>Họ và tên</Label>
            <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Nguyễn Văn A" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@homestay.vn" />
            </div>
            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <select className={selectCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Chi nhánh</Label>
              {isBranchManager ? (
                <>
                  <select className={selectCls} value={form.branch} disabled>
                    <option value={myBranchName}>{myBranchName || '— Chi nhánh của bạn —'}</option>
                  </select>
                  <p className="text-[11px] text-ink-muted mt-1">Bạn chỉ có thể phân nhân viên cho chi nhánh của mình.</p>
                </>
              ) : (
                <select className={selectCls} value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}>
                  <option value="">— Chọn —</option>
                  <option value="Toàn hệ thống">Toàn hệ thống</option>
                  {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDelete open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={handleDelete} name={toDelete?.fullName} />
    </div>
  )
}

// ============ TAB 2: QUẢN LÝ CHI NHÁNH ============

function BranchPanel() {
  const [list, setList] = useState([])
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', totalRooms: '', phone: '' })
  const [toDelete, setToDelete] = useState(null)

  const refresh = () => { api.listBranches().then(setList).catch(() => {}) }
  useEffect(() => { refresh() }, [])

  const openAdd = () => { setForm({ name: '', address: '', totalRooms: '', phone: '' }); setEditing({}); setMsg(null) }
  const openEdit = (b) => { setForm({ name: b.name, address: b.address || '', totalRooms: b.totalRooms ?? '', phone: b.phone || '' }); setEditing(b); setMsg(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return setMsg({ type: 'error', text: 'Vui lòng nhập tên chi nhánh.' })
    try {
      if (editing.id) {
        await api.updateBranch(editing.id, form)
        setMsg({ type: 'success', text: 'Đã cập nhật chi nhánh.' })
      } else {
        await api.createBranch(form)
        setMsg({ type: 'success', text: 'Đã thêm chi nhánh mới.' })
      }
      refresh()
      setEditing(null)
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Không lưu được chi nhánh.' })
    }
  }

  const handleDelete = async () => {
    try {
      await api.deleteBranch(toDelete.id)
      refresh()
      setToDelete(null)
      setMsg({ type: 'success', text: 'Đã xóa chi nhánh.' })
    } catch (e) {
      setToDelete(null)
      setMsg({ type: 'error', text: e.message || 'Không xóa được chi nhánh.' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Banner msg={msg} />
        <Button onClick={openAdd} className="ml-auto">
          <Plus className="w-4 h-4" /> Thêm chi nhánh
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-bold">Chi nhánh</th>
                <th className="px-4 py-3 font-bold">Địa chỉ</th>
                <th className="px-4 py-3 font-bold text-center">Số phòng/giường</th>
                <th className="px-4 py-3 font-bold">Điện thoại</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {list.map(b => (
                <tr key={b.id} className="hover:bg-warm-white transition">
                  <td className="px-4 py-3 font-semibold">{b.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{b.address || '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold">{b.totalRooms}</td>
                  <td className="px-4 py-3 text-ink-soft">{b.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(b)} className="w-8 h-8 rounded-lg hover:bg-cream-dark flex items-center justify-center text-ink-soft" title="Sửa">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setToDelete(b)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">Chưa có chi nhánh nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={handleSave}><Save className="w-4 h-4" /> Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Banner msg={msg} />
          <div className="space-y-1.5">
            <Label>Tên chi nhánh</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Quận 5" />
          </div>
          <div className="space-y-1.5">
            <Label>Địa chỉ</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="125 Trần Phú, Quận 5, TP.HCM" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Số phòng/giường</Label>
              <Input type="number" min="0" value={form.totalRooms} onChange={e => setForm({ ...form, totalRooms: e.target.value })} placeholder="80" />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="028xxxxxxxx" />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDelete open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={handleDelete} name={toDelete?.name} />
    </div>
  )
}

// ============ TAB 3: CẤU HÌNH QUY ĐỊNH & HỆ THỐNG ============

function ConfigPanel() {
  const [cfg, setCfg] = useState({
    depositMonths: 2, depositDeadlineHours: 24,
    refundRates: { notSigned: 80, under6m: 50, over6m: 70, expired: 100 },
    conditions: { requireIdCard: true, genderMatch: true, allowForeigner: true },
  })
  const [msg, setMsg] = useState(null)

  // Tải cấu hình thật từ cau_hinh_he_thong (map snake_case -> shape UI)
  useEffect(() => {
    api.getConfig().then(r => setCfg(c => ({
      ...c,
      depositMonths: Number(r.so_thang_coc ?? 2),
      depositDeadlineHours: Number(r.han_thanh_toan_coc_gio ?? 24),
      refundRates: {
        notSigned: Number(r.ty_le_hoan_chua_ky ?? 80),
        under6m: Number(r.ty_le_hoan_ky_duoi_6m ?? 50),
        over6m: Number(r.ty_le_hoan_ky_tren_6m ?? 70),
        expired: Number(r.ty_le_hoan_het_han ?? 100),
      },
    }))).catch(() => {})
    // Tải điều kiện cho thuê (quy_dinh_cho_thue)
    api.getConditions().then(c => setCfg(prev => ({ ...prev, conditions: c }))).catch(() => {})
  }, [])

  const setRate = (key, val) => setCfg({ ...cfg, refundRates: { ...cfg.refundRates, [key]: Number(val) || 0 } })
  const setCond = (key) => setCfg({ ...cfg, conditions: { ...cfg.conditions, [key]: !cfg.conditions[key] } })

  const handleSave = async () => {
    try {
      await api.saveConfig({
        so_thang_coc: cfg.depositMonths,
        han_thanh_toan_coc_gio: cfg.depositDeadlineHours,
        ty_le_hoan_chua_ky: cfg.refundRates.notSigned,
        ty_le_hoan_ky_duoi_6m: cfg.refundRates.under6m,
        ty_le_hoan_ky_tren_6m: cfg.refundRates.over6m,
        ty_le_hoan_het_han: cfg.refundRates.expired,
      })
      await api.saveConditions(cfg.conditions)
      setMsg({ type: 'success', text: 'Đã lưu cấu hình hệ thống.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Không lưu được cấu hình' })
    }
  }

  const refundRows = [
    { key: 'notSigned', label: 'Đã cọc, chưa ký hợp đồng' },
    { key: 'under6m', label: 'Đã ký HĐ, lưu trú < 6 tháng' },
    { key: 'over6m', label: 'Đã ký HĐ, lưu trú ≥ 6 tháng' },
    { key: 'expired', label: 'Hết hạn hợp đồng' },
  ]
  const condRows = [
    { key: 'requireIdCard', label: 'Bắt buộc giấy tờ tùy thân', desc: 'Khách phải xuất trình CCCD/hộ chiếu khi ký HĐ' },
    { key: 'genderMatch', label: 'Khớp giới tính khu vực/phòng', desc: 'Áp dụng quy định giới tính theo phòng/khu' },
    { key: 'allowForeigner', label: 'Cho phép khách nước ngoài', desc: 'Nhận khách có quốc tịch nước ngoài' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-5">
        <h3 className="font-display font-bold text-base mb-1">Quy định tiền cọc</h3>
        <p className="text-xs text-ink-muted mb-4">Công thức tính tiền cọc khi khách đặt cọc</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Số tháng tiền thuê làm cọc</Label>
            <Input type="number" min="1" value={cfg.depositMonths}
              onChange={e => setCfg({ ...cfg, depositMonths: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label>Hạn thanh toán cọc (giờ)</Label>
            <Input type="number" min="1" value={cfg.depositDeadlineHours}
              onChange={e => setCfg({ ...cfg, depositDeadlineHours: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="mt-3 text-xs bg-warm-white border border-cream-dark rounded-lg px-3 py-2 text-ink-soft">
          Tiền cọc = (Tiền thuê <strong className="text-ink">{cfg.depositMonths}</strong> tháng) × Số giường thuê.
          Quá <strong className="text-ink">{cfg.depositDeadlineHours}</strong> giờ chưa thanh toán → tự động hủy đặt cọc.
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-bold text-base mb-1">Tỷ lệ hoàn cọc</h3>
        <p className="text-xs text-ink-muted mb-4">% tiền cọc được hoàn theo tình trạng thuê khi trả phòng</p>
        <div className="space-y-3">
          {refundRows.map(r => (
            <div key={r.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink-soft flex-1">{r.label}</span>
              <div className="flex items-center gap-1.5 w-28">
                <Input type="number" min="0" max="100" value={cfg.refundRates[r.key]}
                  onChange={e => setRate(r.key, e.target.value)} className="text-right" />
                <span className="text-sm text-ink-muted">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-bold text-base mb-1">Điều kiện cho thuê</h3>
        <p className="text-xs text-ink-muted mb-2">Quy định áp dụng khi tiếp nhận khách thuê</p>
        <div className="divide-y divide-cream-dark">
          {condRows.map(c => (
            <div key={c.key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
              <div className="pr-4">
                <div className="font-medium text-sm">{c.label}</div>
                <div className="text-xs text-ink-muted">{c.desc}</div>
              </div>
              <Toggle checked={cfg.conditions[c.key]} onChange={() => setCond(c.key)} />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}><Save className="w-4 h-4" /> Lưu cấu hình</Button>
        <Banner msg={msg} />
      </div>
    </div>
  )
}

// ============ TAB 4: NHẬT KÝ HOẠT ĐỘNG ============

function AuditPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [refreshedAt, setRefreshedAt] = useState(null)

  // Chỉ THAY danh sách khi nhận được mảng hợp lệ; nếu lỗi thì GIỮ NGUYÊN dữ liệu cũ
  // (tránh trường hợp bấm "Làm mới" làm nhật ký biến mất).
  const load = () => {
    setLoading(true); setErr('')
    api.listAudit()
      .then(d => { if (Array.isArray(d)) setLogs(d) })
      .catch(e => setErr(e?.message || 'Không tải được nhật ký'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleRefresh = () => {
    load()
    setRefreshedAt(new Date())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {loading ? 'Đang tải nhật ký…' : `${logs.length} hoạt động gần đây`}
          {refreshedAt && !loading && (
            <span className="ml-2 text-mint-dark">· đã làm mới lúc {refreshedAt.toLocaleTimeString('vi-VN')}</span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <History className="w-4 h-4" /> Làm mới
        </Button>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-3 py-2 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{err} — giữ nguyên dữ liệu đã tải trước đó.</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-bold">Thời gian</th>
                <th className="px-4 py-3 font-bold">Người thực hiện</th>
                <th className="px-4 py-3 font-bold">Hành động</th>
                <th className="px-4 py-3 font-bold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-warm-white transition">
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(l.time)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.user}</span>
                      <RoleBadge role={l.role} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{l.action}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.detail || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-muted">Chưa có hoạt động nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ============ TRANG CHÍNH ============

export default function SystemManagementPage() {
  const { user } = useAuth()
  const actor = { id: user?.id, user: user?.fullName || 'Quản lý', role: user?.role || 'manager' }
  const [tab, setTab] = useState('staff')

  const tabs = [
    { id: 'staff', label: 'Nhân viên', icon: Users },
    { id: 'branch', label: 'Chi nhánh', icon: Building2 },
    { id: 'config', label: 'Cấu hình', icon: SlidersHorizontal },
    { id: 'audit', label: 'Nhật ký', icon: History },
  ]

  return (
    <div className="max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-mint-light flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6 text-mint-dark" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Quản lý hệ thống</h1>
          <p className="text-ink-soft text-sm">Nhân viên, chi nhánh, cấu hình quy định và nhật ký hoạt động</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-warm-white border border-cream-dark rounded-xl mb-6 overflow-x-auto w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                active ? 'bg-white text-terracotta-500 shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'staff' && <StaffPanel actor={actor} />}
      {tab === 'branch' && <BranchPanel actor={actor} />}
      {tab === 'config' && <ConfigPanel actor={actor} />}
      {tab === 'audit' && <AuditPanel />}
    </div>
  )
}
