import { query } from '../config/db.js'
const SEL = `select h.*, k.ho_ten, k.so_dien_thoai, k.email, k.so_giay_to, k.gioi_tinh, k.ngay_sinh,
    pdc.so_tien_coc,
    rm.ma_phong, rm.ten_chi_nhanh, rm.loai_phong, rm.suc_chua, rm.so_giuong
  from hop_dong_thue h
  join khach_hang k on k.id = h.khach_hang_id
  left join phieu_dat_coc pdc on pdc.id = h.phieu_dat_coc_id
  left join lateral (
    select p.ma_phong, p.loai_phong, p.suc_chua, cn.ten as ten_chi_nhanh,
           (select count(*) from chi_tiet_hop_dong c2 where c2.hop_dong_id = h.id) as so_giuong
    from chi_tiet_hop_dong ct
    join giuong g on g.id = ct.giuong_id
    join phong p on p.id = g.phong_id
    join chi_nhanh cn on cn.id = p.chi_nhanh_id
    where ct.hop_dong_id = h.id
    limit 1
  ) rm on true`
export const insert = async (client, h) => (await client.query(
  `insert into hop_dong_thue (ma_hop_dong, phieu_dat_coc_id, khach_hang_id, nhom_thue_id, chi_nhanh_id, ngay_bat_dau, ngay_ket_thuc, gia_thue_thang, ky_thanh_toan, noi_quy, trang_thai)
   values ($1,$2,$3,$4,$5,$6,$7,$8,'thang',$9,'cho_ky') returning *`,
  [h.maHopDong, h.phieuDatCocId, h.khachHangId, h.nhomThueId||null, h.chiNhanhId, h.ngayBatDau, h.ngayKetThuc, h.giaThueThang, h.noiQuy||'Nội quy KTX HomeStay Dorm']
)).rows[0]
export const addBeds = async (client, contractId, beds) => {
  for (const b of beds) await client.query('insert into chi_tiet_hop_dong (hop_dong_id, giuong_id, gia_giuong) values ($1,$2,$3)', [contractId, b.id, b.gia])
}
export const list = async (status, chiNhanhId = null) => {
  const where = []; const params = []; let i = 1
  if (status)            { where.push(`h.trang_thai=$${i++}`);  params.push(status) }
  if (chiNhanhId != null) { where.push(`h.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  const sql = SEL + (where.length ? ' where ' + where.join(' and ') : '') + ' order by h.created_at desc'
  return (await query(sql, params)).rows
}
export const byCode = async (code) => (await query(SEL + ' where h.ma_hop_dong=$1', [code])).rows[0]
// Một phiếu cọc chỉ được có TỐI ĐA 1 hợp đồng — dùng để chặn lập HĐ trùng
export const existsByDeposit = async (phieuDatCocId) =>
  (await query('select 1 from hop_dong_thue where phieu_dat_coc_id=$1 limit 1', [phieuDatCocId])).rows.length > 0
export const bedsOf = async (contractId) =>
  (await query('select giuong_id from chi_tiet_hop_dong where hop_dong_id=$1', [contractId])).rows.map(r=>r.giuong_id)
export const setStatus = async (client, code, status) =>
  client.query('update hop_dong_thue set trang_thai=$1 where ma_hop_dong=$2', [status, code])
// Ký hợp đồng: chuyển 'dang_hieu_luc' VÀ ghi mốc ký (ngay_ky) làm lịch sử ký vĩnh viễn
export const sign = async (client, code) =>
  client.query("update hop_dong_thue set trang_thai='dang_hieu_luc', ngay_ky=now() where ma_hop_dong=$1", [code])
export const addHandover = async (client, contractId, nhanVienId) =>
  client.query(`insert into bien_ban_ban_giao (hop_dong_id, nhan_vien_id, hien_trang, trang_thai)
                values ($1,$2,'Bàn giao đầu kỳ','da_ban_giao')`, [contractId, nhanVienId||null])
