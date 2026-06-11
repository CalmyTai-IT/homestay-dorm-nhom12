import { query } from '../config/db.js'

export const insert = async (n) => (await query(
  `insert into thong_bao (nguoi_nhan_role, nhan_vien_id, khach_hang_id, tieu_de, noi_dung, loai, do_uu_tien, url, icon)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
  [n.nguoiNhanRole || null, n.nhanVienId || null, n.khachHangId || null, n.tieuDe || null,
   n.noiDung || null, n.loai || null, n.doUuTien || 'normal', n.url || null, n.icon || null])).rows[0]

export const listForStaff = async (role, nhanVienId, limit = 50) => (await query(
  `select * from thong_bao where nguoi_nhan_role = $1 or nhan_vien_id = $2
   order by created_at desc limit $3`, [role, nhanVienId, limit])).rows
export const listForCustomer = async (khachHangId, limit = 50) => (await query(
  `select * from thong_bao where khach_hang_id = $1 order by created_at desc limit $2`,
  [khachHangId, limit])).rows

export const markRead = async (id) => query('update thong_bao set da_doc = true where id = $1', [id])
export const markAllStaff = async (role, nhanVienId) => query(
  'update thong_bao set da_doc = true where (nguoi_nhan_role = $1 or nhan_vien_id = $2) and da_doc = false',
  [role, nhanVienId])
export const markAllCustomer = async (khachHangId) => query(
  'update thong_bao set da_doc = true where khach_hang_id = $1 and da_doc = false', [khachHangId])
