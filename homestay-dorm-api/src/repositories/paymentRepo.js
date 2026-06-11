import { query } from '../config/db.js'
export const insert = async (client, p) => (await (client||{query}).query(
  `insert into giao_dich_thanh_toan (loai_giao_dich, so_tien, hinh_thuc, thoi_diem, nhan_vien_ke_toan_id, phieu_dat_coc_id, hop_dong_id, bang_doi_soat_id, ma_giao_dich, ghi_chu)
   values ($1,$2,$3, now(), $4,$5,$6,$7,$8,$9) returning *`,
  [p.loai, p.soTien, p.hinhThuc||'chuyen_khoan', p.keToanId||null, p.phieuDatCocId||null, p.hopDongId||null, p.bangDoiSoatId||null, p.maGiaoDich||null, p.ghiChu||null]
)).rows[0]
export const list = async (loai) => (await query(
  `select * from giao_dich_thanh_toan ${loai?'where loai_giao_dich=$1':''} order by thoi_diem desc`, loai?[loai]:[])).rows
export const summary = async () => (await query(
  `select loai_giao_dich, count(*)::int as so_gd, sum(so_tien)::bigint as tong from giao_dich_thanh_toan group by loai_giao_dich`)).rows
