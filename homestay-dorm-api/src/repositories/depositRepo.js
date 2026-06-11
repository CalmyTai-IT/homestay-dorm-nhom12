import { query } from '../config/db.js'
const SEL = `select d.*, k.ho_ten, k.so_dien_thoai, k.email, k.so_giay_to,
    rm.ma_phong, rm.ma_chi_nhanh, rm.ten_chi_nhanh, rm.loai_phong, rm.gia_thue_giuong, rm.suc_chua, rm.so_giuong,
    pdk.thoi_han_thue, pdk.ngay_du_kien_vao_o,
    pdk.ma_phieu as dk_ma_phieu, pdk.tieu_chi as dk_tieu_chi,
    (exists(select 1 from hop_dong_thue h where h.phieu_dat_coc_id = d.id)) as has_contract,
    nvds.ho_ten as ten_doi_soat, nvct.ho_ten as ten_chot
  from phieu_dat_coc d
  join khach_hang k on k.id = d.khach_hang_id
  left join phieu_dang_ky_thue pdk on pdk.id = d.phieu_dang_ky_id
  left join nhan_vien nvds on nvds.id = d.nhan_vien_doi_soat_id
  left join nhan_vien nvct on nvct.id = d.nhan_vien_chot_id
  left join lateral (
    select p.ma_phong, p.loai_phong, p.gia_thue_giuong, p.suc_chua,
           cn.ma_chi_nhanh, cn.ten as ten_chi_nhanh,
           (select count(*) from chi_tiet_dat_coc c2 where c2.phieu_dat_coc_id = d.id) as so_giuong
    from chi_tiet_dat_coc ct
    join giuong g on g.id = ct.giuong_id
    join phong p on p.id = g.phong_id
    join chi_nhanh cn on cn.id = p.chi_nhanh_id
    where ct.phieu_dat_coc_id = d.id
    limit 1
  ) rm on true`
export const insert = async (client, d) => (await client.query(
  `insert into phieu_dat_coc (ma_phieu, phieu_dang_ky_id, khach_hang_id, nhom_thue_id, chi_nhanh_id, nhan_vien_sale_id, so_tien_coc, thoi_diem_tao, han_thanh_toan, trang_thai)
   values ($1,$2,$3,$4,$5,$6,$7, now(), $8, 'cho_thanh_toan') returning *`,
  [d.maPhieu, d.phieuDangKyId||null, d.khachHangId, d.nhomThueId||null, d.chiNhanhId, d.saleId||null, d.soTienCoc, d.hanThanhToan]
)).rows[0]
export const addBeds = async (client, depositId, bedIds) => {
  for (const b of bedIds) await client.query('insert into chi_tiet_dat_coc (phieu_dat_coc_id, giuong_id) values ($1,$2)', [depositId, b])
}
export const list = async (status, chiNhanhId = null) => {
  const where = []; const params = []; let i = 1
  if (status)            { where.push(`d.trang_thai=$${i++}`);  params.push(status) }
  if (chiNhanhId != null) { where.push(`d.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  const sql = SEL + (where.length ? ' where ' + where.join(' and ') : '') + ' order by d.thoi_diem_tao desc'
  return (await query(sql, params)).rows
}
export const byCode = async (code) => (await query(SEL + ' where d.ma_phieu=$1', [code])).rows[0]
// Cọc BỊ TỪ CHỐI (da_huy) đã nhận tiền nhưng CHƯA hoàn -> hàng đợi cho Kế toán hoàn cọc
export const listRejectedAwaitingRefund = async (chiNhanhId = null) => {
  const where = ["d.trang_thai='da_huy'", 'coalesce(d.so_tien_thuc_nhan,0) > 0',
    "not exists (select 1 from giao_dich_thanh_toan g where g.phieu_dat_coc_id=d.id and g.loai_giao_dich='hoan_coc')"]
  const params = []; let i = 1
  if (chiNhanhId != null) { where.push(`d.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  const sql = SEL + ' where ' + where.join(' and ') + ' order by d.thoi_diem_tao desc'
  return (await query(sql, params)).rows
}
// Đã có giao dịch hoàn cọc cho phiếu này chưa? (tránh hoàn 2 lần)
export const hasRefund = async (depositId) => (await query(
  "select 1 from giao_dich_thanh_toan where phieu_dat_coc_id=$1 and loai_giao_dich='hoan_coc' limit 1", [depositId])).rows.length > 0
// Phiếu cọc còn hiệu lực (chưa huỷ) mới nhất của một phiếu đăng ký — dùng khi khách tự hủy đơn
export const activeByBooking = async (phieuDangKyId) => (await query(
  `select * from phieu_dat_coc where phieu_dang_ky_id=$1 and trang_thai<>'da_huy' order by thoi_diem_tao desc limit 1`,
  [phieuDangKyId])).rows[0]
export const bedsOf = async (depositId) =>
  (await query('select giuong_id from chi_tiet_dat_coc where phieu_dat_coc_id=$1', [depositId])).rows.map(r=>r.giuong_id)
// Đổi trạng thái phiếu. Khi là quyết định cuối (chốt 'da_thanh_toan' / huỷ 'da_huy')
// thì lưu kèm MỐC THỜI GIAN + NGƯỜI quyết định (nguoiChotId; null = hệ thống/khách tự huỷ).
export const updateStatus = async (client, code, status, lyDo=null, nguoiChotId=null) => {
  // Khi chốt cọc / hủy (quyết định cuối của Quản lý) thì lưu thêm mốc + người chốt.
  const isChot = status === 'da_thanh_toan' || status === 'da_huy'
  if (isChot) {
    return client.query(
      `update phieu_dat_coc
         set trang_thai=$1, ly_do_huy=$2, thoi_diem_chot=now(), nhan_vien_chot_id=$4
       where ma_phieu=$3`,
      [status, lyDo, code, nguoiChotId])
  }
  return client.query(
    `update phieu_dat_coc set trang_thai=$1, ly_do_huy=$2 where ma_phieu=$3`,
    [status, lyDo, code])
}
// Kế toán đối soát đủ -> chuyển chờ duyệt + lưu số tiền thực nhận + mốc/đối soát viên
export const markReviewed = async (code, soTienThucNhan, keToanId=null) =>
  query(`update phieu_dat_coc set trang_thai='cho_duyet', so_tien_thuc_nhan=$2,
           nhan_vien_doi_soat_id=$3, thoi_diem_doi_soat=now() where ma_phieu=$1`,
        [code, soTienThucNhan, keToanId])
// Ghi nhận số tiền thực nhận (giữ nguyên trạng thái) — dùng khi nhận THIẾU để Kế toán nhớ đối soát lại
export const setReceived = async (code, soTienThucNhan, keToanId=null) =>
  query(`update phieu_dat_coc set so_tien_thuc_nhan=$2,
           nhan_vien_doi_soat_id=$3, thoi_diem_doi_soat=now() where ma_phieu=$1`,
        [code, soTienThucNhan, keToanId])
export const byId = async (id) =>
  (await query('select * from phieu_dat_coc where id=$1', [id])).rows[0]
// Lưu hình thức khách chọn: 'tien_mat' (chờ nộp) | 'chuyen_khoan' (có chứng từ)
export const setMethod = async (code, hinhThuc) =>
  query('update phieu_dat_coc set hinh_thuc=$2 where ma_phieu=$1', [code, hinhThuc])
// Lưu ảnh chứng từ chuyển khoản (base64/URL) do khách tải lên
export const saveProof = async (code, anh) =>
  query('update phieu_dat_coc set minh_chung_ck=$1 where ma_phieu=$2', [anh, code])
// Lưu TK nhận hoàn tiền của khách (khi chuyển khoản) — để Kế toán hoàn cọc nếu hủy/từ chối
export const saveRefundAccount = async (code, acc = {}) =>
  query(`update phieu_dat_coc set tk_hoan_so=$2, tk_hoan_ngan_hang=$3, tk_hoan_chu_tk=$4 where ma_phieu=$1`,
        [code, acc.so || null, acc.nganHang || null, acc.chuTk || null])
export const expired = async () =>
  (await query(`select * from phieu_dat_coc where trang_thai='cho_thanh_toan' and han_thanh_toan < now()`)).rows

// ===== THUÊ NHÓM — GIẢM GIƯỜNG THEO SỐ NGƯỜI ĐỦ ĐIỀU KIỆN =====
// Gỡ một số giường khỏi phiếu cọc (trả các giường của người không đủ điều kiện về 'trong').
export const removeBeds = async (client, depositId, bedIds) =>
  client.query('delete from chi_tiet_dat_coc where phieu_dat_coc_id=$1 and giuong_id = any($2::bigint[])',
    [depositId, bedIds])

// Cập nhật lại tiền cọc (và số thực nhận tương ứng) sau khi giảm giường.
export const setAmounts = async (client, code, soTienCoc, soTienThucNhan) =>
  client.query('update phieu_dat_coc set so_tien_coc=$2, so_tien_thuc_nhan=$3 where ma_phieu=$1',
    [code, soTienCoc, soTienThucNhan])

// Hàng đợi HOÀN CỌC GIẢM GIƯỜNG (nhóm): phiếu cọc còn hiệu lực nhưng đơn có
// tieu_chi.partialRefund.status='pending' (Quản lý đã chốt giảm giường, chờ Kế toán hoàn).
export const listPendingPartialRefunds = async (chiNhanhId = null) => {
  const where = [`pdk.tieu_chi->'partialRefund'->>'status' = 'pending'`]
  const params = []; let i = 1
  if (chiNhanhId != null) { where.push(`d.chi_nhanh_id=$${i++}`); params.push(chiNhanhId) }
  return (await query(SEL + ' where ' + where.join(' and ') + ' order by d.thoi_diem_tao desc', params)).rows
}