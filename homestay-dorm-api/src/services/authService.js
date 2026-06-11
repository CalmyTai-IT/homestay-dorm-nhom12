import bcrypt from 'bcryptjs'
import * as users from '../repositories/userRepo.js'
import { signToken, verifyToken } from '../utils/jwt.js'
import { unauthorized, conflict, badRequest, notFound } from '../utils/errors.js'

// Định dạng ngày (date) -> 'yyyy-mm-dd' an toàn múi giờ
function fmtDate(d) {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}
// Hồ sơ khách đầy đủ trả cho client (để form tự điền)
function customerUser(c) {
  return {
    id: c.id, email: c.email, role: 'customer', hoTen: c.ho_ten,
    gioiTinh: c.gioi_tinh, soDienThoai: c.so_dien_thoai,
    soGiayTo: c.so_giay_to, ngaySinh: fmtDate(c.ngay_sinh),
  }
}

export async function staffLogin(email, password) {
  const u = await users.findStaffByEmail(email)
  if (!u || !(await bcrypt.compare(password, u.mat_khau_hash))) throw unauthorized('Sai email hoặc mật khẩu')
  const user = { id: u.id, email: u.email, role: u.vai_tro, hoTen: u.ho_ten, chiNhanhId: u.chi_nhanh_id }
  return { token: signToken({ id: u.id, role: u.vai_tro, email: u.email, chiNhanhId: u.chi_nhanh_id ?? null }), user }
}
export async function customerLogin(email, password) {
  const u = await users.findCustomerByEmail(email)
  if (!u || !u.mat_khau_hash || !(await bcrypt.compare(password, u.mat_khau_hash))) throw unauthorized('Sai email hoặc mật khẩu')
  const user = customerUser(u)
  return { token: signToken({ id: u.id, role: 'customer', email: u.email }), user }
}
export async function customerRegister(dto) {
  if (!dto.email || !dto.password || !dto.hoTen) throw badRequest('Thiếu họ tên, email hoặc mật khẩu')
  if (await users.findCustomerByEmail(dto.email)) throw conflict('Email đã được đăng ký')
  const matKhauHash = await bcrypt.hash(dto.password, 10)
  const c = await users.createCustomer({ ...dto, matKhauHash })
  return { token: signToken({ id: c.id, role: 'customer', email: c.email }),
           user: customerUser(c) }
}

// Quên mật khẩu (xác minh danh tính bằng email + SĐT đã đăng ký).
// Sản phẩm thật: thay vì trả resetToken trực tiếp, hãy GỬI EMAIL chứa link kèm token này.
export async function requestPasswordReset(email, soDienThoai) {
  if (!email || !soDienThoai) throw badRequest('Vui lòng nhập email và số điện thoại')
  const u = await users.findCustomerByEmailAndPhone(email, soDienThoai)
  if (!u) throw notFound('Không tìm thấy tài khoản khớp với email và số điện thoại đã đăng ký')
  const resetToken = signToken({ sub: u.id, purpose: 'reset' }, '15m') // hiệu lực 15 phút
  return { resetToken, hoTen: u.ho_ten }
}

// Đặt lại mật khẩu bằng resetToken
export async function resetPassword(resetToken, newPassword) {
  if (!newPassword || newPassword.length < 6) throw badRequest('Mật khẩu mới phải có ít nhất 6 ký tự')
  let payload
  try { payload = verifyToken(resetToken) }
  catch { throw unauthorized('Yêu cầu đặt lại đã hết hạn hoặc không hợp lệ') }
  if (payload.purpose !== 'reset') throw unauthorized('Token không hợp lệ')
  const hash = await bcrypt.hash(newPassword, 10)
  await users.updateCustomerPassword(payload.sub, hash)
  return { ok: true }
}

// ===== Nhân viên: self-service hồ sơ / mật khẩu / tuỳ chọn (trang Settings) =====
function staffProfile(u) {
  return {
    id: u.id, email: u.email, role: u.vai_tro, hoTen: u.ho_ten,
    chiNhanhId: u.chi_nhanh_id, soDienThoai: u.so_dien_thoai || '',
    preferences: u.preferences || {},
  }
}
export async function getStaffProfile(id) {
  const u = await users.findStaffProfile(id)
  if (!u) throw notFound('Không tìm thấy nhân viên')
  return staffProfile(u)
}
export async function updateStaffProfileInfo(id, dto) {
  if (!dto.hoTen || !dto.hoTen.trim()) throw badRequest('Họ tên không được để trống')
  if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) throw badRequest('Email không hợp lệ')
  if (await users.staffEmailTakenByOther(dto.email, id)) throw conflict('Email đã được dùng bởi tài khoản khác')
  const u = await users.updateStaffProfile(id, {
    hoTen: dto.hoTen.trim(), email: dto.email.trim(), soDienThoai: dto.soDienThoai?.trim() || null,
  })
  return staffProfile(u)
}
export async function changeStaffPassword(id, current, next) {
  if (!current || !next) throw badRequest('Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới')
  if (next.length < 6) throw badRequest('Mật khẩu mới phải có ít nhất 6 ký tự')
  const u = await users.findStaffWithHash(id)
  if (!u || !(await bcrypt.compare(current, u.mat_khau_hash))) throw unauthorized('Mật khẩu hiện tại không đúng')
  await users.updateStaffPassword(id, await bcrypt.hash(next, 10))
  return { ok: true }
}
export async function saveStaffPrefs(id, prefs) {
  const r = await users.updateStaffPrefs(id, prefs)
  return { preferences: r?.preferences || {} }
}
