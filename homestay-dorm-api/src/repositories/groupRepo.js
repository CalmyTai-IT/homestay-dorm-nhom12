import { query } from '../config/db.js'

// ====== NHÓM THUÊ (thuê theo nhóm: đại diện + nhiều thành viên ở ghép/nguyên căn) ======
// Đại diện (dai_dien_id) là khách hàng CHỦ TÀI KHOẢN đứng đơn — người ký hợp đồng.
// Mỗi thành viên (kể cả đại diện) là 1 bản ghi khach_hang, gắn vào nhóm qua nhom_thue_thanh_vien.
// Cột dat_dieu_kien lưu KẾT QUẢ kiểm tra điều kiện lưu trú của từng người:
//   null  = chưa kiểm tra | true = đạt | false = không đạt

export const insertGroup = async (client, g) => (await client.query(
  `insert into nhom_thue (ten_nhom, dai_dien_id, so_nguoi_du_kien)
   values ($1,$2,$3) returning *`,
  [g.tenNhom || null, g.daiDienId, g.soNguoiDuKien || null]
)).rows[0]

// Thêm 1 người vào nhóm (idempotent theo khóa chính (nhom_thue_id, khach_hang_id))
export const addMember = async (client, nhomThueId, khachHangId, datDieuKien = null) =>
  client.query(
    `insert into nhom_thue_thanh_vien (nhom_thue_id, khach_hang_id, dat_dieu_kien)
     values ($1,$2,$3)
     on conflict (nhom_thue_id, khach_hang_id) do nothing`,
    [nhomThueId, khachHangId, datDieuKien])

// Danh sách người ở của nhóm (kèm hồ sơ + cờ đại diện), đại diện xếp đầu
export const membersOf = async (nhomThueId) => (await query(
  `select tv.khach_hang_id, tv.dat_dieu_kien,
          k.ho_ten, k.gioi_tinh, k.so_giay_to, k.so_dien_thoai,
          (k.id = nt.dai_dien_id) as is_dai_dien
   from nhom_thue_thanh_vien tv
   join khach_hang k on k.id = tv.khach_hang_id
   join nhom_thue   nt on nt.id = tv.nhom_thue_id
   where tv.nhom_thue_id = $1
   order by (k.id = nt.dai_dien_id) desc, k.id`,
  [nhomThueId])).rows

// Ghi nhận kết quả kiểm tra điều kiện của 1 thành viên
export const setEligibility = async (client, nhomThueId, khachHangId, datDieuKien) =>
  (client || { query }).query(
    `update nhom_thue_thanh_vien set dat_dieu_kien=$3
       where nhom_thue_id=$1 and khach_hang_id=$2`,
    [nhomThueId, khachHangId, datDieuKien])

export const byId = async (id) =>
  (await query('select * from nhom_thue where id=$1', [id])).rows[0]