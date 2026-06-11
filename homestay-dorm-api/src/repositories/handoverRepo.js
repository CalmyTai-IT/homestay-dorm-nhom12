import { query } from '../config/db.js'

const SEL = `select bb.id, bb.hop_dong_id, bb.ngay_ban_giao, bb.hien_trang, bb.trang_thai,
    h.ma_hop_dong, h.ngay_bat_dau, h.ngay_ket_thuc,
    k.ho_ten, k.so_dien_thoai,
    nv.ho_ten as nhan_vien_ten,
    rm.ma_phong, rm.ten_chi_nhanh,
    (select count(*) from tai_san ts where ts.bien_ban_ban_giao_id = bb.id) as so_tai_san,
    (select count(*) from chi_tiet_hop_dong c where c.hop_dong_id = h.id) as so_giuong
  from bien_ban_ban_giao bb
  join hop_dong_thue h on h.id = bb.hop_dong_id
  join khach_hang k on k.id = h.khach_hang_id
  left join nhan_vien nv on nv.id = bb.nhan_vien_id
  left join lateral (
    select p.ma_phong, cn.ten as ten_chi_nhanh
    from chi_tiet_hop_dong ct
    join giuong g on g.id = ct.giuong_id
    join phong p on p.id = g.phong_id
    join chi_nhanh cn on cn.id = p.chi_nhanh_id
    where ct.hop_dong_id = h.id limit 1
  ) rm on true`

export const list = async (chiNhanhId = null) => {
  const where = [`bb.trang_thai='da_ban_giao'`]; const params = []
  if (chiNhanhId != null) { where.push(`h.chi_nhanh_id=$1`); params.push(chiNhanhId) }
  return (await query(SEL + ' where ' + where.join(' and ') + ' order by bb.ngay_ban_giao desc', params)).rows
}
export const byId = async (id) => (await query(SEL + ' where bb.id=$1', [id])).rows[0]
export const assetsOf = async (handoverId) =>
  (await query('select * from tai_san where bien_ban_ban_giao_id=$1 order by id', [handoverId])).rows
export const feesOf = async (hopDongId) =>
  (await query('select * from phi_dich_vu where hop_dong_id=$1 order by id', [hopDongId])).rows

// Hoàn tất bàn giao: ghi tài sản + chỉ số công tơ đầu + ghi chú hiện trạng (trong transaction)
export async function complete(client, { handoverId, hopDongId, nhanVienId, hienTrang, taiSan, dichVu }) {
  await client.query('update bien_ban_ban_giao set hien_trang=$1, nhan_vien_id=coalesce($3, nhan_vien_id) where id=$2',
    [hienTrang || null, handoverId, nhanVienId || null])
  await client.query('delete from tai_san where bien_ban_ban_giao_id=$1', [handoverId])
  for (const a of (taiSan || [])) {
    if (!a.ten) continue
    await client.query(
      'insert into tai_san (bien_ban_ban_giao_id, ten_tai_san, so_luong, tinh_trang) values ($1,$2,$3,$4)',
      [handoverId, a.ten, a.soLuong || 1, a.tinhTrang || null])
  }
  await client.query(`delete from phi_dich_vu where hop_dong_id=$1 and loai_phi in ('dien','nuoc')`, [hopDongId])
  for (const d of (dichVu || [])) {
    if (d.chiSoDau == null) continue
    await client.query(
      'insert into phi_dich_vu (hop_dong_id, loai_phi, don_gia, don_vi, chi_so_dau) values ($1,$2,$3,$4,$5)',
      [hopDongId, d.loaiPhi, d.donGia || null, d.donVi || null, d.chiSoDau])
  }
}
