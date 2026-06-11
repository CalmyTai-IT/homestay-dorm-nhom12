import { query } from '../config/db.js'

// ===================== NHÂN VIÊN =====================
const STAFF_SEL = `select n.id, n.ho_ten, n.email, n.vai_tro, n.so_dien_thoai, n.chi_nhanh_id,
    n.active, n.ngay_vao_lam, c.ten as ten_chi_nhanh
  from nhan_vien n left join chi_nhanh c on c.id = n.chi_nhanh_id`
export const listStaff = async (chiNhanhId = null) => {
  const where = ['n.active = true']; const params = []
  if (chiNhanhId != null) { where.push('n.chi_nhanh_id = $1'); params.push(chiNhanhId) }
  return (await query(`${STAFF_SEL} where ${where.join(' and ')} order by n.id`, params)).rows
}
export const staffById = async (id) =>
  (await query(`${STAFF_SEL} where n.id = $1`, [id])).rows[0]
export const staffEmailTaken = async (email, exceptId = 0) =>
  (await query('select 1 from nhan_vien where email=$1 and id<>$2 limit 1', [email, exceptId])).rows[0]
export const insertStaff = async (s) => (await query(
  `insert into nhan_vien (ho_ten, email, mat_khau_hash, vai_tro, chi_nhanh_id, so_dien_thoai)
   values ($1,$2,$3,$4,$5,$6) returning id`,
  [s.hoTen, s.email, s.hash, s.vaiTro, s.chiNhanhId, s.soDienThoai])).rows[0]
export const updateStaff = async (id, s) => (await query(
  `update nhan_vien set ho_ten=$1, email=$2, vai_tro=$3, chi_nhanh_id=$4, so_dien_thoai=$5
   where id=$6 returning id`,
  [s.hoTen, s.email, s.vaiTro, s.chiNhanhId, s.soDienThoai, id])).rows[0]
export const deactivateStaff = async (id) =>
  query('update nhan_vien set active=false where id=$1', [id])

// ===================== CHI NHÁNH =====================
export const listBranches = async () =>
  (await query(`select id, ma_chi_nhanh, ten, dia_chi, so_dien_thoai, so_phong, active
    from chi_nhanh where active=true order by id`)).rows
export const branchById = async (id) =>
  (await query('select * from chi_nhanh where id=$1', [id])).rows[0]
export const branchIdByName = async (name) => (await query(
  `select id from chi_nhanh where ten ilike '%'||$1||'%' or ma_chi_nhanh=$1 order by id limit 1`, [name])).rows[0]?.id
export const insertBranch = async (b) => (await query(
  `insert into chi_nhanh (ma_chi_nhanh, ten, dia_chi, so_dien_thoai, so_phong)
   values ($1,$2,$3,$4,$5) returning *`,
  [b.maChiNhanh, b.ten, b.diaChi, b.soDienThoai, b.soPhong])).rows[0]
export const updateBranch = async (id, b) => (await query(
  `update chi_nhanh set ten=$1, dia_chi=$2, so_dien_thoai=$3, so_phong=$4 where id=$5 returning *`,
  [b.ten, b.diaChi, b.soDienThoai, b.soPhong, id])).rows[0]
export const deactivateBranch = async (id) =>
  query('update chi_nhanh set active=false where id=$1', [id])

// ===================== NHẬT KÝ HỆ THỐNG =====================
export const listAudit = async (limit = 100) => (await query(
  `select k.id, k.hanh_dong, k.doi_tuong, k.mo_ta, k.thoi_diem, n.ho_ten, n.vai_tro
   from nhat_ky_he_thong k left join nhan_vien n on n.id = k.nhan_vien_id
   order by k.thoi_diem desc limit $1`, [limit])).rows
export const insertAudit = async (nhanVienId, hanhDong, doiTuong, moTa) =>
  query('insert into nhat_ky_he_thong (nhan_vien_id, hanh_dong, doi_tuong, mo_ta) values ($1,$2,$3,$4)',
    [nhanVienId || null, hanhDong, doiTuong || null, moTa || null])

// ===================== ĐIỀU KIỆN CHO THUÊ (quy_dinh_cho_thue, toàn hệ thống = chi_nhanh_id null) =====================
export const listConditions = async () =>
  (await query('select ma_dieu_kien, bat_buoc from quy_dinh_cho_thue where chi_nhanh_id is null')).rows
export const upsertCondition = async (maDieuKien, batBuoc, moTa) => {
  const ex = (await query(
    'select id from quy_dinh_cho_thue where chi_nhanh_id is null and ma_dieu_kien=$1 limit 1', [maDieuKien])).rows[0]
  if (ex) return query('update quy_dinh_cho_thue set bat_buoc=$1, mo_ta=$2 where id=$3', [batBuoc, moTa || null, ex.id])
  return query('insert into quy_dinh_cho_thue (chi_nhanh_id, ma_dieu_kien, mo_ta, bat_buoc) values (null,$1,$2,$3)',
    [maDieuKien, moTa || null, batBuoc])
}
