import { query } from '../config/db.js'
const SEL = `select t.*, h.ma_hop_dong, h.gia_thue_thang, h.ngay_bat_dau, h.ngay_ket_thuc,
    k.ho_ten, k.so_dien_thoai, k.email,
    pdc.so_tien_coc,
    rm.ma_phong, rm.ten_chi_nhanh,
    bb.ket_qua_kiem_tra, bb.tinh_trang_ve_sinh,
    bds.ty_le_hoan_coc, bds.hoan_coc_co_ban, bds.tong_khau_tru, bds.so_tien_hoan_thuc_te
  from phieu_tra_phong t
  join hop_dong_thue h on h.id = t.hop_dong_id
  join khach_hang k on k.id = h.khach_hang_id
  left join phieu_dat_coc pdc on pdc.id = h.phieu_dat_coc_id
  left join lateral (
    select p.ma_phong, cn.ten as ten_chi_nhanh
    from chi_tiet_hop_dong ct
    join giuong g on g.id = ct.giuong_id
    join phong p on p.id = g.phong_id
    join chi_nhanh cn on cn.id = p.chi_nhanh_id
    where ct.hop_dong_id = h.id
    limit 1
  ) rm on true
  left join lateral (
    select ket_qua_kiem_tra, tinh_trang_ve_sinh
    from bien_ban_tra_phong b
    where b.phieu_tra_phong_id = t.id
    order by b.id desc limit 1
  ) bb on true
  left join lateral (
    select ty_le_hoan_coc, hoan_coc_co_ban, tong_khau_tru, so_tien_hoan_thuc_te
    from bang_doi_soat d
    where d.phieu_tra_phong_id = t.id
    order by d.id desc limit 1
  ) bds on true`
export const insert = async (client, t) => (await client.query(
  `insert into phieu_tra_phong (ma_phieu, hop_dong_id, nhan_vien_sale_id, ngay_tra_du_kien, ly_do, trang_thai)
   values ($1,$2,$3,$4,$5,'cho_kiem_tra') returning *`,
  [t.maPhieu, t.hopDongId, t.saleId||null, t.ngayTraDuKien||null, t.lyDo||null]
)).rows[0]
export const byCode = async (code) => (await query(SEL + ' where t.ma_phieu=$1', [code])).rows[0]
export const list = async (status, chiNhanhId = null) => {
  const where = []; const params = []; let i = 1
  if (status)            { where.push(`t.trang_thai=$${i++}`);  params.push(status) }
  if (chiNhanhId != null) { where.push(`h.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  const sql = SEL + (where.length ? ' where ' + where.join(' and ') : '') + ' order by t.ngay_dang_ky desc'
  return (await query(sql, params)).rows
}
export const setStatus = async (client, code, status) =>
  client.query('update phieu_tra_phong set trang_thai=$1 where ma_phieu=$2', [status, code])
export const addInspection = async (client, ptpId, nvId, ketQua, veSinh) =>
  client.query(`insert into bien_ban_tra_phong (phieu_tra_phong_id, nhan_vien_id, ket_qua_kiem_tra, tinh_trang_ve_sinh)
                values ($1,$2,$3,$4)`, [ptpId, nvId||null, ketQua||null, veSinh||null])
export const addReconcile = async (client, b) => (await client.query(
  `insert into bang_doi_soat (phieu_tra_phong_id, nhan_vien_ke_toan_id, ty_le_hoan_coc, tien_coc, hoan_coc_co_ban, tong_khau_tru, so_tien_hoan_thuc_te)
   values ($1,$2,$3,$4,$5,$6,$7) returning *`,
  [b.ptpId, b.keToanId||null, b.tyLe, b.tienCoc, b.hoanCoBan, b.tongKhauTru, b.hoanThuc]
)).rows[0]
export const addDeduction = async (client, bdsId, d) =>
  client.query('insert into khoan_khau_tru (bang_doi_soat_id, loai_khoan, mo_ta, so_tien) values ($1,$2,$3,$4)',
    [bdsId, d.loai, d.moTa||null, d.soTien])
