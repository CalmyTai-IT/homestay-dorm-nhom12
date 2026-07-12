import { query } from '../config/db.js'
// Lịch xem phòng mới nhất (còn hiệu lực hoặc đã xem) của mỗi phiếu -> JSON {date,time,trang_thai,staffName}
// Lấy từ BẢNG lich_xem_phong (nguồn chuẩn), thay cho tieu_chi.scheduledViewing (JSONB) trước đây.
const LXP_JOIN = `
  left join lateral (
    select jsonb_build_object(
      'date', to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD'),
      'time', to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','HH24:MI'),
      'trang_thai', l.trang_thai,
      'staffName', nv.ho_ten
    ) as sv
    from lich_xem_phong l left join nhan_vien nv on nv.id=l.nhan_vien_sale_id
    where l.phieu_dang_ky_id = b.id and l.trang_thai <> 'huy'
    order by l.id desc limit 1
  ) lxp on true`
const SEL = `select b.*, k.ho_ten, k.so_dien_thoai, k.email, k.so_giay_to, k.gioi_tinh, k.ngay_sinh, c.ma_chi_nhanh,
    lxp.sv as scheduled_viewing
  from phieu_dang_ky_thue b join khach_hang k on k.id=b.khach_hang_id
  left join chi_nhanh c on c.id=b.chi_nhanh_id${LXP_JOIN}`
export const insert = async (client, b) => (await (client||{query}).query(
  `insert into phieu_dang_ky_thue (ma_phieu, khach_hang_id, nhom_thue_id, nhan_vien_sale_id, chi_nhanh_id, tieu_chi, ngay_du_kien_vao_o, thoi_han_thue, trang_thai, ghi_chu)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
  [b.maPhieu, b.khachHangId, b.nhomThueId||null, b.saleId||null, b.chiNhanhId||null, b.tieuChi, b.ngayVaoO||null, b.thoiHan||6, b.trangThai||'cho_xem_phong', b.ghiChu||null]
)).rows[0]
export const list = async (status, chiNhanhId = null) => {
  const where = []; const params = []; let i = 1
  if (status)            { where.push(`b.trang_thai=$${i++}`);  params.push(status) }
  if (chiNhanhId != null) { where.push(`b.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  const sql = SEL + (where.length ? ' where ' + where.join(' and ') : '') + ' order by b.created_at desc'
  return (await query(sql, params)).rows
}
export const byCode = async (code) => (await query(SEL + ' where b.ma_phieu=$1', [code])).rows[0]
export const byCustomer = async (khachHangId) => (await query(SEL + ' where b.khach_hang_id=$1 order by b.created_at desc', [khachHangId])).rows
export const updateStatus = async (client, code, status) =>
  (client||{query}).query('update phieu_dang_ky_thue set trang_thai=$1 where ma_phieu=$2', [status, code])

// Hủy phiếu (trong transaction): đặt trạng thái 'huy' + lưu lý do vào tieu_chi (giữ dữ liệu cũ)
export const cancelTx = async (client, code, lyDo) =>
  client.query(
    `update phieu_dang_ky_thue set trang_thai='huy',
       tieu_chi = coalesce(tieu_chi,'{}'::jsonb) || jsonb_build_object('rejectReason', $1::text)
     where ma_phieu=$2`,
    [lyDo, code])

// Tổng hợp: mỗi phiếu đăng ký kèm cọc (chưa huỷ) mới nhất và hợp đồng của cọc đó
export const fullByCustomer = async (khachHangId) => (await query(`
  select b.id, b.ma_phieu, b.trang_thai as dk_trang_thai, b.tieu_chi, b.created_at,
         b.ngay_du_kien_vao_o, b.thoi_han_thue,
         d.ma_phieu as coc_ma, d.trang_thai as coc_trang_thai, d.so_tien_coc, d.han_thanh_toan,
         h.ma_hop_dong, h.trang_thai as hd_trang_thai, h.ngay_bat_dau, h.ngay_ket_thuc,
         tp.ma_phieu as tra_ma, tp.trang_thai as tra_trang_thai, tp.ngay_dang_ky as tra_ngay,
         lxp.sv as viewing
  from phieu_dang_ky_thue b
  left join lateral (
    select jsonb_build_object(
      'date', to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD'),
      'time', to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','HH24:MI'),
      'trang_thai', l.trang_thai,
      'staffName', nv.ho_ten
    ) as sv
    from lich_xem_phong l left join nhan_vien nv on nv.id=l.nhan_vien_sale_id
    where l.phieu_dang_ky_id = b.id and l.trang_thai <> 'huy'
    order by l.id desc limit 1
  ) lxp on true
  left join lateral (
    select dc.* from phieu_dat_coc dc
    where dc.phieu_dang_ky_id = b.id and dc.trang_thai <> 'da_huy'
    order by dc.thoi_diem_tao desc limit 1
  ) d on true
  left join lateral (
    select hc.* from hop_dong_thue hc
    where hc.phieu_dat_coc_id = d.id
    order by hc.created_at desc limit 1
  ) h on true
  left join lateral (
    select tpc.ma_phieu, tpc.trang_thai, tpc.ngay_dang_ky from phieu_tra_phong tpc
    where tpc.hop_dong_id = h.id
    order by tpc.id desc limit 1
  ) tp on true
  where b.khach_hang_id = $1
  order by b.created_at desc
`, [khachHangId])).rows

// ===== Luồng HỦY ĐƠN ĐÃ CỌC (Sale lập -> QL duyệt -> Kế toán hoàn 80%) =====
// Tiến trình lưu trong tieu_chi.cancelStage: 'pending_manager' -> 'pending_accountant' -> 'done'
// (không thêm cột/trạng thái mới -> không phải đổi schema).

// Gộp thêm dữ liệu vào tieu_chi, KHÔNG đổi trang_thai (dùng cho bước Sale lập & QL duyệt)
export const patchTieuChi = async (client, code, patch) =>
  (client||{query}).query(
    `update phieu_dang_ky_thue set tieu_chi = coalesce(tieu_chi,'{}'::jsonb) || $1::jsonb where ma_phieu=$2`,
    [JSON.stringify(patch), code])

// Hoàn tất hủy: đặt trang_thai='huy' + gộp dữ liệu hủy vào tieu_chi
export const completeCancel = async (client, code, patch) =>
  client.query(
    `update phieu_dang_ky_thue set trang_thai='huy', tieu_chi = coalesce(tieu_chi,'{}'::jsonb) || $1::jsonb where ma_phieu=$2`,
    [JSON.stringify(patch), code])

// Liệt kê đơn theo giai đoạn hủy (cho QL: 'pending_manager'; cho Kế toán: 'pending_accountant')
export const listByCancelStage = async (stage, chiNhanhId = null) => {
  const params = [stage]; let i = 2; let branch = ''
  if (chiNhanhId != null) { branch = ` and b.chi_nhanh_id=$${i++}`; params.push(chiNhanhId) }
  return (await query(`
    select b.ma_phieu, b.tieu_chi, b.created_at, b.chi_nhanh_id,
           k.ho_ten, k.so_dien_thoai,
           d.ma_phieu as coc_ma, d.so_tien_coc, d.trang_thai as coc_trang_thai,
           d.hinh_thuc as coc_hinh_thuc, d.tk_hoan_so, d.tk_hoan_ngan_hang, d.tk_hoan_chu_tk
    from phieu_dang_ky_thue b
      join khach_hang k on k.id=b.khach_hang_id
      left join lateral (
        select dc.* from phieu_dat_coc dc
        where dc.phieu_dang_ky_id=b.id and dc.trang_thai<>'da_huy'
        order by dc.thoi_diem_tao desc limit 1
      ) d on true
    where b.tieu_chi->>'cancelStage' = $1${branch}
    order by b.created_at desc`, params)).rows
}

// Đổi trang_thai của đơn (+ gộp extra vào tieu_chi nếu có) — dùng cho Sale chuyển trạng thái/đặt lịch xem
export const updateStatusExtra = async (code, status, extra) => {
  if (extra && Object.keys(extra).length)
    return query(
      `update phieu_dang_ky_thue set trang_thai=$1,
         tieu_chi = coalesce(tieu_chi,'{}'::jsonb) || $2::jsonb
       where ma_phieu=$3`,
      [status, JSON.stringify(extra), code])
  return query('update phieu_dang_ky_thue set trang_thai=$1 where ma_phieu=$2', [status, code])
}