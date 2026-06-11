import { query } from '../config/db.js'

export const findStaffByEmail = async (email) =>
  (await query('select * from nhan_vien where email=$1 and active=true', [email])).rows[0]

export const findStaffById = async (id) =>
  (await query('select id, ho_ten, email, vai_tro, chi_nhanh_id from nhan_vien where id=$1', [id])).rows[0]

export const findCustomerByEmail = async (email) =>
  (await query('select * from khach_hang where email=$1', [email])).rows[0]

export const findCustomerById = async (id) =>
  (await query('select id, ho_ten, email, gioi_tinh, so_dien_thoai from khach_hang where id=$1', [id])).rows[0]

export const createCustomer = async (c) => (await query(
  `insert into khach_hang (ho_ten, gioi_tinh, quoc_tich, loai_giay_to, so_giay_to, so_dien_thoai, email, ngay_sinh, mat_khau_hash)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, ho_ten, email, gioi_tinh, so_dien_thoai, so_giay_to, ngay_sinh`,
  [c.hoTen, c.gioiTinh, c.quocTich||'Việt Nam', c.loaiGiayTo||'CCCD', c.soGiayTo, c.soDienThoai, c.email, c.ngaySinh||null, c.matKhauHash]
)).rows[0]

// Tạo hồ sơ NGƯỜI Ở là thành viên nhóm — KHÔNG phải chủ tài khoản (không email/mật khẩu đăng nhập).
// Dùng khi khách đăng ký thuê theo nhóm và khai báo các thành viên ở cùng.
export const createResident = async (client, c) => (await (client || { query }).query(
  `insert into khach_hang (ho_ten, gioi_tinh, loai_giay_to, so_giay_to, so_dien_thoai)
   values ($1,$2,$3,$4,$5)
   returning id, ho_ten, gioi_tinh, so_giay_to, so_dien_thoai`,
  [c.hoTen, c.gioiTinh || null, c.soGiayTo ? 'CCCD' : null, c.soGiayTo || null, c.soDienThoai || null]
)).rows[0]

export const findCustomerByEmailAndPhone = async (email, phone) =>
  (await query('select * from khach_hang where email=$1 and so_dien_thoai=$2', [email, phone])).rows[0]

export const updateCustomerPassword = async (id, hash) =>
  query('update khach_hang set mat_khau_hash=$1 where id=$2', [hash, id])

// ===== Nhân viên: hồ sơ self-service (Settings) =====
export const findStaffProfile = async (id) =>
  (await query('select id, ho_ten, email, vai_tro, chi_nhanh_id, so_dien_thoai, preferences from nhan_vien where id=$1', [id])).rows[0]
export const findStaffWithHash = async (id) =>
  (await query('select * from nhan_vien where id=$1', [id])).rows[0]
export const staffEmailTakenByOther = async (email, id) =>
  (await query('select 1 from nhan_vien where email=$1 and id<>$2 limit 1', [email, id])).rows[0]
export const updateStaffProfile = async (id, p) => (await query(
  `update nhan_vien set ho_ten=$1, email=$2, so_dien_thoai=$3 where id=$4
   returning id, ho_ten, email, vai_tro, chi_nhanh_id, so_dien_thoai, preferences`,
  [p.hoTen, p.email, p.soDienThoai, id])).rows[0]
export const updateStaffPassword = async (id, hash) =>
  query('update nhan_vien set mat_khau_hash=$1 where id=$2', [hash, id])
export const updateStaffPrefs = async (id, prefs) => (await query(
  'update nhan_vien set preferences=$1::jsonb where id=$2 returning preferences',
  [JSON.stringify(prefs || {}), id])).rows[0]