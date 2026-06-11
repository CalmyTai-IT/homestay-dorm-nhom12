# HƯỚNG DẪN DEPLOY — HomeStay Dorm

Mục tiêu: đưa ứng dụng lên Internet để **bất kỳ ai có đường link đều mở web chạy được**
(phục vụ chấm bài / demo). Toàn bộ dùng gói **miễn phí**, không cần thẻ tín dụng.

## Kiến trúc deploy

Ứng dụng gồm 3 mảnh, deploy lên 3 nơi và trỏ vào nhau:

```
  Người dùng (trình duyệt)
        │  mở link
        ▼
  FRONTEND (React/Vite)  ──►  Vercel        →  link chia sẻ: https://....vercel.app
        │  gọi API (VITE_API_URL)
        ▼
  BACKEND (Express/Node) ──►  Render        →  https://....onrender.com
        │  pg (DATABASE_URL, Session pooler)
        ▼
  DATABASE (PostgreSQL)  ──►  Supabase
```

**Thứ tự deploy bắt buộc: Database → Backend → Frontend.**
(Backend cần URL của Database; Frontend cần URL của Backend.)

---

## Bước 0 — Đưa code lên GitHub

Render và Vercel deploy trực tiếp từ GitHub. Tạo 2 repo (hoặc 1 repo chứa 2 thư mục con):

- `homestay-dorm`      (frontend)
- `homestay-dorm-api`  (backend)

```bash
# Trong từng thư mục:
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
git push -u origin main
```

> Nếu để CHUNG 1 repo (monorepo) thì khi cấu hình Render/Vercel nhớ đặt
> **Root Directory** trỏ đúng thư mục con (xem các bước dưới).

**Quan trọng:** thêm `.gitignore` để KHÔNG đẩy `node_modules/` và `.env` (chứa mật khẩu).

---

## Bước 1 — Database trên Supabase

1. Vào https://supabase.com → tạo project (hoặc dùng project sẵn có của nhóm).
   Ghi nhớ **Database password** lúc tạo (nếu quên, có thể reset trong Settings → Database).
2. Mở **SQL Editor** → New query → dán **toàn bộ** nội dung `12_tao_csdl_ver3.sql` → **Run**.
   - Script tự `DROP ... CASCADE` rồi tạo lại nên chạy lại nhiều lần vẫn an toàn.
   - Kết quả: 25 bảng + seed (3 chi nhánh, 7 nhân viên, 12 phòng, 54 giường).
   - Tài khoản demo đăng nhập được ngay (mật khẩu `123456`).
3. Lấy chuỗi kết nối: nhấn nút **Connect** (góc trên) → chọn **Session pooler** → copy.
   - Dạng: `postgresql://postgres.<project-ref>:[PASSWORD]@aws-<region>.pooler.supabase.com:5432/postgres`
   - **DÙNG Session pooler (port 5432), KHÔNG dùng Direct connection.**
     Direct connection chỉ chạy IPv6 → host backend IPv4-only sẽ timeout.
   - Thay `[PASSWORD]` bằng mật khẩu DB. Nếu mật khẩu có ký tự đặc biệt
     (`@ : / ? # &` ...) phải **URL-encode** (vd `@` → `%40`).

Giữ chuỗi này lại để dán vào `DATABASE_URL` ở Bước 2.

> Lưu ý: project Supabase miễn phí sẽ **tạm dừng sau ~1 tuần không hoạt động**.
> Trước buổi demo, vào dashboard nhấn **Resume** nếu thấy project đang paused.

---

## Bước 2 — Backend trên Render

1. Vào https://render.com → đăng nhập bằng GitHub.
2. **New → Web Service** → chọn repo `homestay-dorm-api`.
3. Cấu hình:
   - **Root Directory:** để trống nếu repo chỉ có backend; nếu monorepo thì điền `homestay-dorm-api`.
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`   (tương đương `node src/server.js`)
   - **Instance Type:** Free
4. **Environment Variables** (mục Environment) — thêm:
   - `DATABASE_URL` = chuỗi Session pooler ở Bước 1
   - `JWT_SECRET`   = một chuỗi ngẫu nhiên dài (sinh bằng
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `JWT_EXPIRES`  = `2h`
   - **KHÔNG cần** đặt `PORT` (Render tự inject; code đã đọc `process.env.PORT`).
5. **Create Web Service** → đợi build & deploy xong → lấy URL, dạng
   `https://homestay-dorm-api.onrender.com`.
6. **Kiểm tra sống:** mở `https://<url-backend>/api/health` trên trình duyệt →
   phải thấy `{"ok":true,"service":"homestay-dorm-api"}`.

> **Cold start (gói Free):** sau 15 phút không có request, service "ngủ"; request kế
> tiếp mất ~30–60 giây để dậy. Bình thường cho đồ án. Muốn tránh khi demo:
> - Mở `/api/health` trước vài phút cho server "ấm", hoặc
> - Dùng dịch vụ ping miễn phí (vd cron-job.org) gọi `/api/health` mỗi ~10 phút.

---

## Bước 3 — Frontend trên Vercel

1. Thêm file **`vercel.json`** (đã kèm theo) vào **thư mục gốc của repo frontend**
   (`homestay-dorm/vercel.json`). File này bật rewrite SPA để các đường dẫn
   react-router (vd `/staff/login`, `/my-bookings`) không bị lỗi 404 khi tải trực tiếp.
   Commit & push.
2. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New → Project** →
   import repo `homestay-dorm`.
3. Cấu hình (Vercel thường tự nhận Vite):
   - **Framework Preset:** Vite
   - **Root Directory:** để mặc định nếu repo chỉ có frontend; nếu monorepo thì chọn `homestay-dorm`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables** — thêm:
   - `VITE_API_URL` = `https://<url-backend>.onrender.com/api`
     (BẮT BUỘC có `/api` ở cuối, KHÔNG có dấu `/` thừa)
5. **Deploy** → xong sẽ có link dạng `https://homestay-dorm.vercel.app`.
   **Đây chính là đường link bạn gửi cho người khác.**

> `VITE_API_URL` là biến **build-time**: nếu sau này đổi URL backend, phải vào Vercel
> đổi biến rồi **Redeploy** thì mới có hiệu lực.

---

## Bước 4 — Kiểm tra cuối

Mở link Vercel và thử:

1. Trang khách hiển thị, tìm phòng / xem phòng chạy được (chứng tỏ FE gọi được BE & DB).
2. Vào `/staff/login` → đăng nhập tài khoản demo (mật khẩu `123456`):
   - `sale@homestay.vn` (Nhân viên Sale)
   - `manager@homestay.vn` (Quản lý)
   - `accountant@homestay.vn` (Kế toán)
3. Chạy thử một mạch nghiệp vụ ngắn (đăng ký khách → Sale tiếp nhận → lập cọc …).

Nếu FE mở được nhưng thao tác lỗi mạng → thường do `VITE_API_URL` sai (thiếu `/api`,
sai URL backend) hoặc backend đang cold-start (đợi ~1 phút rồi thử lại).

---

## Checklist nhanh & lỗi thường gặp

- [ ] Database: đã chạy `12_tao_csdl_ver3.sql` trên Supabase, `/api/health` trả OK.
- [ ] Backend: `DATABASE_URL` dùng **Session pooler (5432)**, mật khẩu đã URL-encode.
- [ ] Backend: đã đặt `JWT_SECRET`.
- [ ] Frontend: đã thêm `vercel.json`; `VITE_API_URL` đúng và có `/api`.
- [ ] Thứ tự deploy đúng: DB → BE → FE.
- CORS: backend đã mở sẵn (`app.use(cors())`) nên gọi chéo Vercel→Render chạy ngay,
  KHÔNG cần sửa. (Muốn siết chặt thì cấu hình `cors({ origin: '<link-vercel>' })`.)
- Không commit `.env` thật (chứa mật khẩu/JWT_SECRET) lên GitHub.

---

## Phương án thay thế (tuỳ chọn)

- **Frontend trên Render Static Site** (giữ mọi thứ trên 1 nền tảng): New → Static Site,
  Build `npm run build`, Publish `dist`, thêm Rewrite Rule `Source /* → Destination /index.html`
  (Action: Rewrite), và env `VITE_API_URL`. Khi đó không cần `vercel.json`.
- **Frontend trên Netlify**: tương tự Vercel; thay `vercel.json` bằng file
  `public/_redirects` chứa đúng 1 dòng: `/*  /index.html  200`.
