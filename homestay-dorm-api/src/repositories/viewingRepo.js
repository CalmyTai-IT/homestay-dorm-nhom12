import { query } from '../config/db.js'

// ============================================================================
//  viewingRepo — Tầng truy cập BẢNG lich_xem_phong (Lịch xem phòng)
//  Trước đây lịch hẹn xem phòng bị lưu tạm trong phieu_dang_ky_thue.tieu_chi
//  (JSONB). Nay tách ra đúng THỰC THỂ lich_xem_phong như thiết kế CSDL:
//    id, phieu_dang_ky_id, nhan_vien_sale_id, thoi_gian_hen (timestamptz),
//    trang_thai (da_len_lich | da_xem | doi_lich | huy), ghi_chu
//  thoi_gian_hen được ghép từ (ngày + giờ) theo giờ Việt Nam (Asia/Ho_Chi_Minh).
// ============================================================================

// Ghép 'YYYY-MM-DD' + 'HH:MM' -> timestamptz theo giờ VN
const TS = (dp, tp) =>
  `(($${dp}::text || ' ' || $${tp}::text)::timestamp at time zone 'Asia/Ho_Chi_Minh')`

// Lịch xem phòng CÒN HIỆU LỰC (chưa xem, chưa huỷ) mới nhất của 1 phiếu đăng ký
export const activeByBooking = async (bookingId) => (await query(
  `select * from lich_xem_phong
   where phieu_dang_ky_id=$1 and trang_thai in ('da_len_lich','doi_lich')
   order by id desc limit 1`, [bookingId])).rows[0]

// Tạo lịch hẹn mới (lần đầu lên lịch)
export const insert = async (client, v) => (await (client || { query }).query(
  `insert into lich_xem_phong (phieu_dang_ky_id, nhan_vien_sale_id, thoi_gian_hen, trang_thai, ghi_chu)
   values ($1, $2, ${TS(3, 4)}, 'da_len_lich', $5)
   returning *`,
  [v.phieuDangKyId, v.saleId || null, v.date, v.time, v.ghiChu || null])).rows[0]

// Dời lịch (cập nhật lịch đang hiệu lực) -> đánh dấu trạng thái 'doi_lich'
export const reschedule = async (client, id, v) => (await (client || { query }).query(
  `update lich_xem_phong
     set thoi_gian_hen = ${TS(2, 3)},
         nhan_vien_sale_id = coalesce($4, nhan_vien_sale_id),
         trang_thai = 'doi_lich',
         ghi_chu = coalesce($5, ghi_chu)
   where id=$1 returning *`,
  [id, v.date, v.time, v.saleId || null, v.ghiChu || null])).rows[0]

// Đánh dấu ĐÃ dẫn khách xem phòng (lịch đang hiệu lực -> 'da_xem')
export const markViewedByBooking = async (client, bookingId) =>
  (client || { query }).query(
    `update lich_xem_phong set trang_thai='da_xem'
     where phieu_dang_ky_id=$1 and trang_thai in ('da_len_lich','doi_lich')`, [bookingId])

// Huỷ lịch còn hiệu lực (khi đơn bị huỷ/từ chối)
export const cancelByBooking = async (client, bookingId) =>
  (client || { query }).query(
    `update lich_xem_phong set trang_thai='huy'
     where phieu_dang_ky_id=$1 and trang_thai in ('da_len_lich','doi_lich')`, [bookingId])

// Lịch sử xem phòng của 1 phiếu đăng ký (cho trang chi tiết / đối chiếu)
export const listByBooking = async (bookingId) => (await query(
  `select l.*, nv.ho_ten as sale_ten,
          to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as ngay_hen,
          to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','HH24:MI')   as gio_hen
   from lich_xem_phong l left join nhan_vien nv on nv.id=l.nhan_vien_sale_id
   where l.phieu_dang_ky_id=$1 order by l.id desc`, [bookingId])).rows