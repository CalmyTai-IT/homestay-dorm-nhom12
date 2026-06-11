# HomeStay Dorm API (Backend)

Backend Express + PostgreSQL (Supabase) cho hệ thống ký túc xá HomeStay Dorm.
Kiến trúc 4 tầng: **routes (controller) → services → repositories → CSDL**.

## 1. Cài đặt
```bash
npm install
cp .env.example .env   # rồi điền DATABASE_URL của Supabase + JWT_SECRET
```

## 2. Tạo CSDL trên Supabase
- Mở Supabase → SQL Editor → chạy `homestay_dorm_schema_ver4.sql` (tạo bảng + phòng/giường).
- (Tuỳ chọn) chạy `homestay_dorm_seed_business.sql` để có dữ liệu demo.
- `DATABASE_URL` lấy ở **Settings → Database → Connection string (URI)**.

## 3. Đặt mật khẩu demo & chạy
```bash
npm run seed:pw     # đặt mật khẩu 123456 cho 3 tài khoản nhân viên seed
npm start           # chạy API tại http://localhost:4000
npm run test:e2e    # kiểm thử toàn bộ luồng nghiệp vụ (cần server đang chạy)
```

## 4. Tài khoản demo (mật khẩu 123456)
sale@homestay.vn · manager@homestay.vn · accountant@homestay.vn

## 5. Danh sách API chính
| Method | Endpoint | Vai trò | Chức năng |
|---|---|---|---|
| POST | /api/auth/staff/login | — | Đăng nhập nhân viên |
| POST | /api/auth/customer/register · /login | — | Khách đăng ký / đăng nhập |
| GET  | /api/rooms · /api/rooms/:id | — | Tìm/xem phòng |
| POST | /api/bookings | customer | UC-HT-03 Lập phiếu đăng ký |
| GET  | /api/bookings · /me · /:code | sale/manager · customer | Danh sách / chi tiết |
| POST | /api/deposits | sale | UC-HT-04 Lập phiếu đặt cọc |
| POST | /api/deposits/:code/confirm | accountant | UC-HT-06 Xác nhận thanh toán cọc |
| POST | /api/deposits/:code/cancel | sale/accountant | UC-HT-05 Hủy cọc |
| POST | /api/contracts | manager | UC-HT-07 Lập hợp đồng |
| POST | /api/contracts/:code/sign | manager | UC-HT-08 Ký & bàn giao |
| POST | /api/checkouts | sale | UC-HT-09 Đăng ký trả phòng |
| POST | /api/checkouts/:code/inspect | manager | UC-HT-10 Kiểm tra hiện trạng |
| POST | /api/checkouts/:code/reconcile | accountant | UC-HT-11 Đối soát hoàn cọc |
| POST | /api/checkouts/:code/settle | accountant | UC-HT-12 Thanh lý & hoàn cọc |
| GET  | /api/payments · /summary | accountant/manager | Giao dịch & tổng hợp |

## 6. Bảo mật
- Đăng nhập trả JWT; mọi endpoint nghiệp vụ yêu cầu `Authorization: Bearer <token>`.
- Phân quyền theo vai trò ở middleware (`requireRole`) — thay cho RLS (mô hình React→Express→Supabase, client không chạm thẳng DB).
- API dùng connection string Supabase ở phía server; **không để lộ key này ra frontend**.
