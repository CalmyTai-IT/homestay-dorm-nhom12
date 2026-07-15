import { query } from '../config/db.js'

export async function search(f = {}) {
  // withDeleted: lấy tất cả (kể cả phòng đã xoá 'ngung') — dùng cho trang Quản lý phòng.
  // all: phòng còn hiệu lực (gồm bảo trì) nhưng KHÔNG gồm đã xoá. Mặc định: chỉ phòng hoạt động.
  const base = f.withDeleted ? '1=1' : (f.all ? "p.trang_thai <> 'ngung'" : "p.trang_thai='hoat_dong'")
  const where = [base]; const params = []; let i = 1
  if (f.chiNhanh)  { where.push(`c.ma_chi_nhanh=$${i++}`); params.push(f.chiNhanh) }
  if (f.chiNhanhId){ where.push(`p.chi_nhanh_id=$${i++}`); params.push(f.chiNhanhId) }   // lọc theo id chi nhánh (enforce phân quyền NV)
  if (f.loaiPhong) { where.push(`p.loai_phong=$${i++}`);  params.push(f.loaiPhong) }
  if (f.gioiTinh)  { where.push(`(p.gioi_tinh_ap_dung=$${i++} or p.gioi_tinh_ap_dung='khong_quy_dinh')`); params.push(f.gioiTinh) }
  if (f.giaMax)    { where.push(`p.gia_thue_giuong<=$${i++}`); params.push(f.giaMax) }
  const sql = `select p.*, c.ten as ten_chi_nhanh, c.dia_chi,
      (select count(*) from giuong g where g.phong_id=p.id and g.trang_thai='trong') as giuong_trong
    from phong p join chi_nhanh c on c.id=p.chi_nhanh_id
    where ${where.join(' and ')} order by p.ma_phong`
  return (await query(sql, params)).rows
}
export const findById = async (id) => (await query(
  `select p.*, c.ten as ten_chi_nhanh, c.dia_chi from phong p
   join chi_nhanh c on c.id=p.chi_nhanh_id where p.id::text=$1`, [String(id)])).rows[0]
export const bedsOfRoom = async (phongId) =>
  (await query('select * from giuong where phong_id=$1 order by ma_giuong', [phongId])).rows
export const availableBeds = async (phongId, limit) =>
  (await query(`select * from giuong where phong_id=$1 and trang_thai='trong' order by ma_giuong limit $2`, [phongId, limit])).rows
// Giữ giường NGUYÊN TỬ trong transaction (chống đặt cọc song song trùng giường):
// khóa các hàng giường trống bằng FOR UPDATE SKIP LOCKED rồi đổi trạng thái ngay trong 1 câu lệnh.
// Trả về id các giường ĐÃ GIỮ ĐƯỢC (có thể ít hơn n nếu không đủ trống) — service kiểm tra số lượng.
export const reserveBeds = async (client, phongId, n, status = 'giu_cho') =>
  (await client.query(
    `update giuong set trang_thai=$3
       where id in (
         select id from giuong
         where phong_id=$1 and trang_thai='trong'
         order by ma_giuong
         limit $2
         for update skip locked
       )
     returning id`,
    [phongId, n, status])).rows.map(r => r.id)
export const setBedStatus = async (client, bedIds, status) =>
  client.query(`update giuong set trang_thai=$1 where id = any($2::bigint[])`, [status, bedIds])

// ===== Quản lý phòng (UC-HT-13) =====
export const branchIdByName = async (name) => {
  // Tên/mã chi nhánh rỗng -> KHÔNG khớp (tránh '%%' khớp mọi chi nhánh rồi âm thầm chọn cái đầu tiên)
  if (!name || !String(name).trim()) return undefined
  return (await query(
    `select id from chi_nhanh where ten ilike '%'||$1||'%' or ma_chi_nhanh=$1 order by id limit 1`, [name])).rows[0]?.id
}

export const roomByCode = async (maPhong) =>
  (await query('select * from phong where ma_phong=$1', [maPhong])).rows[0]
// Mã phòng giờ chỉ duy nhất TRONG 1 chi nhánh → kiểm tra trùng phải kèm chi nhánh
export const roomByCodeInBranch = async (chiNhanhId, maPhong) =>
  (await query('select * from phong where chi_nhanh_id=$1 and ma_phong=$2', [chiNhanhId, maPhong])).rows[0]

export const insertRoom = async (client, p) => (await client.query(
  `insert into phong (ma_phong, chi_nhanh_id, loai_phong, gioi_tinh_ap_dung, suc_chua,
     gia_thue_giuong, gia_thue_nguyen_phong, tien_ich, mo_ta, hinh_anh, trang_thai)
   values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11) returning *`,
  [p.maPhong, p.chiNhanhId, p.loaiPhong, p.gioiTinh, p.sucChua, p.giaGiuong,
   p.giaNguyenPhong, JSON.stringify(p.tienIch || {}), p.moTa || null,
   JSON.stringify(p.hinhAnh || []), p.trangThai || 'hoat_dong'])).rows[0]

// Tạo n giường cho phòng, đánh mã <ma_phong>-G<idx>
export const insertBeds = async (client, phongId, maPhong, fromIdx, n) => {
  for (let k = 0; k < n; k++)
    await client.query('insert into giuong (ma_giuong, phong_id, trang_thai) values ($1,$2,$3)',
      [`${maPhong}-G${fromIdx + k}`, phongId, 'trong'])
}
export const countBeds = async (phongId) =>
  Number((await query('select count(*) c from giuong where phong_id=$1', [phongId])).rows[0].c)
export const countBedsInUse = async (phongId) =>
  Number((await query(`select count(*) c from giuong where phong_id=$1 and trang_thai<>'trong'`, [phongId])).rows[0].c)
export const deleteTrongBeds = async (client, phongId, n) =>
  client.query(`delete from giuong where id in (
    select id from giuong where phong_id=$1 and trang_thai='trong' order by id desc limit $2)`, [phongId, n])

export const updateRoomRow = async (client, phongId, f) => (await client.query(
  `update phong set chi_nhanh_id=coalesce($2,chi_nhanh_id), loai_phong=$3, gioi_tinh_ap_dung=$4,
     suc_chua=$5, gia_thue_giuong=$6, gia_thue_nguyen_phong=$7, tien_ich=$8::jsonb,
     mo_ta=$9, hinh_anh=$10::jsonb, trang_thai=$11
   where id=$1 returning *`,
  [phongId, f.chiNhanhId, f.loaiPhong, f.gioiTinh, f.sucChua, f.giaGiuong, f.giaNguyenPhong,
   JSON.stringify(f.tienIch || {}), f.moTa || null, JSON.stringify(f.hinhAnh || []), f.trangThai])).rows[0]

// Xoá mềm: đặt trạng thái 'ngung' (giữ lịch sử, tránh vi phạm khoá ngoại)
export const softDeleteRoom = async (client, phongId) =>
  client.query(`update phong set trang_thai='ngung' where id=$1`, [phongId])