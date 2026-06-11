# HomeStay Dorm — Hệ thống quản lý ký túc xá tư nhân

Đồ án môn **Phân tích & Thiết kế Hệ thống Thông tin (CSC12004)** — Nhóm 12.

Ứng dụng web quản lý nghiệp vụ KTX: đăng ký thuê → đặt cọc (2 bước) → ký hợp đồng &
bàn giao → trả phòng & hoàn cọc; có thuê theo nhóm, phân quyền theo chi nhánh,
thông báo và nhật ký hệ thống.

## Cấu trúc repo

```
.
├── homestay-dorm/          # Frontend — React 19 + Vite + Tailwind
├── homestay-dorm-api/      # Backend  — Express + PostgreSQL (pg), kiến trúc 3 tầng
├── 12_tao_csdl_ver3.sql    # Script tạo CSDL hợp nhất (chạy 1 lần trên DB trống)
└── DEPLOY_HUONG_DAN.md     # Hướng dẫn deploy (Supabase + Render + Vercel)
```

## Công nghệ

- **Frontend:** React 19, Vite, Tailwind CSS, react-router, recharts.
- **Backend:** Node.js (ESM), Express, node-postgres (`pg`), JWT, bcryptjs. Kiến trúc
  layered: `routes → services → repositories`. Phân quyền theo vai trò (RBAC).
- **CSDL:** PostgreSQL (Supabase). 25 bảng.

## Chạy ở máy local

**1) Cơ sở dữ liệu:** tạo một DB PostgreSQL (hoặc dùng Supabase), chạy `12_tao_csdl_ver3.sql`.

**2) Backend** (`homestay-dorm-api/`):
```bash
cd homestay-dorm-api
cp .env.example .env          # rồi sửa DATABASE_URL, JWT_SECRET trong .env
npm install
npm start                     # mặc định http://localhost:4000
```

**3) Frontend** (`homestay-dorm/`):
```bash
cd homestay-dorm
npm install
npm run dev                   # http://localhost:5173 ; API mặc định http://localhost:4000/api
```

## Tài khoản demo (mật khẩu: `123456`)

| Vai trò   | Email                     |
|-----------|---------------------------|
| Sale      | sale@homestay.vn          |
| Quản lý   | manager@homestay.vn       |
| Kế toán   | accountant@homestay.vn    |

Khách hàng: đăng ký tài khoản mới trên giao diện.

## Deploy lên Internet

Xem `DEPLOY_HUONG_DAN.md` (Database → Supabase, Backend → Render, Frontend → Vercel).
