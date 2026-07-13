-- ============================================================================
--  12_tao_csdl.sql  —  HỆ THỐNG KÝ TÚC XÁ "HOMESTAY DORM" (Nhóm 12 - CSC12004)
--  Script TẠO CSDL HỢP NHẤT (chạy MỘT LẦN trên một database TRỐNG).
--
--  Nội dung = schema gốc `homestay_dorm_schema_ver4.sql` ĐÃ GỘP SẴN toàn bộ
--  các migration rời (đánh dấu [migration_*] tại từng điểm gộp để đối chiếu báo cáo):
--    [migration_booking_status]      — 2 trạng thái xử lý đơn của Sale
--    [migration_contract_status]     — trạng thái cho_ky / da_ky của hợp đồng
--    [migration_checkout_reason]     — cột ly_do của phiếu trả phòng
--    [migration_deposit_proof]       — cột minh_chung_ck (ảnh chứng từ CK)
--    [migration_deposit_review]      — trạng thái cho_duyet + cột so_tien_thuc_nhan (cọc 2 bước)
--    [migration_deposit_method]      — cột hinh_thuc (tien_mat / chuyen_khoan)
--    [migration_deposit_timestamps]  — mốc đối soát/chốt + người thực hiện
--    [migration_deposit_refund_acct] — TK nhận hoàn tiền của khách (tk_hoan_*)
--    [migration_room_code_per_branch]— mã phòng duy nhất THEO chi nhánh
--
--  Chạy:  psql "<DATABASE_URL>" -f 12_tao_csdl.sql
--  An toàn chạy lại: phần đầu DROP toàn bộ bảng (CASCADE) rồi tạo mới.
--
--  Tài khoản demo (mật khẩu: 123456):
--    sale@homestay.vn / manager@homestay.vn / accountant@homestay.vn / admin@homestay.vn
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Dọn sạch (để chạy lại được trên DB đã có dữ liệu cũ)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS
  thong_bao, nhat_ky_he_thong, giao_dich_thanh_toan, khoan_khau_tru,
  bang_doi_soat, bien_ban_tra_phong, phieu_tra_phong, tai_san,
  bien_ban_ban_giao, phi_dich_vu, chi_tiet_hop_dong, hop_dong_thue,
  chi_tiet_dat_coc, phieu_dat_coc, lich_xem_phong, phieu_dang_ky_thue,
  nhom_thue_thanh_vien, nhom_thue, khach_hang, giuong, phong,
  cau_hinh_he_thong, quy_dinh_cho_thue, nhan_vien, chi_nhanh
CASCADE;

-- ===========================================================================
-- A) NHÓM QUẢN TRỊ & CẤU HÌNH
-- ===========================================================================

-- A1. Chi nhánh ------------------------------------------------------------
CREATE TABLE chi_nhanh (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_chi_nhanh  varchar NOT NULL UNIQUE,
  ten           varchar NOT NULL,
  dia_chi       varchar,
  so_dien_thoai varchar,
  so_phong      integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A2. Nhân viên (3 vai trò: sale / manager / accountant) --------------------
CREATE TABLE nhan_vien (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ho_ten        varchar NOT NULL,
  email         varchar NOT NULL UNIQUE,
  mat_khau_hash varchar NOT NULL,
  vai_tro       varchar NOT NULL
                  -- [migration_admin_role] thêm vai trò 'admin' (IT / quản trị hệ thống)
                  CHECK (vai_tro IN ('sale','manager','accountant','admin')),
  chi_nhanh_id  bigint REFERENCES chi_nhanh(id),   -- NULL = nhân viên toàn hệ thống
  so_dien_thoai varchar,
  ngay_vao_lam  date,
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A3. Quy định cho thuê (theo chi nhánh) -----------------------------------
CREATE TABLE quy_dinh_cho_thue (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chi_nhanh_id  bigint REFERENCES chi_nhanh(id),
  ma_dieu_kien  varchar NOT NULL,
  mo_ta         varchar,
  bat_buoc      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A4. Cấu hình hệ thống (số tháng cọc, hạn cọc, 4 mức tỷ lệ hoàn) -----------
CREATE TABLE cau_hinh_he_thong (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chi_nhanh_id           bigint UNIQUE REFERENCES chi_nhanh(id),
  so_thang_coc           integer NOT NULL DEFAULT 2,
  han_thanh_toan_coc_gio integer NOT NULL DEFAULT 24,
  ty_le_hoan_chua_ky     numeric NOT NULL DEFAULT 80,
  ty_le_hoan_ky_duoi_6m  numeric NOT NULL DEFAULT 50,
  ty_le_hoan_ky_tren_6m  numeric NOT NULL DEFAULT 70,
  ty_le_hoan_het_han     numeric NOT NULL DEFAULT 100,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- B) NHÓM LƯU TRÚ (PHÒNG & GIƯỜNG)
-- ===========================================================================

-- B1. Phòng ----------------------------------------------------------------
CREATE TABLE phong (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_phong              varchar NOT NULL,
  chi_nhanh_id          bigint NOT NULL REFERENCES chi_nhanh(id),
  khu_vuc               varchar,
  loai_phong            varchar NOT NULL
                          CHECK (loai_phong IN ('nguyen_can','o_ghep')),
  gioi_tinh_ap_dung     varchar
                          CHECK (gioi_tinh_ap_dung IN ('nam','nu','khong_quy_dinh')),
  suc_chua              integer NOT NULL CHECK (suc_chua > 0),
  gia_thue_giuong       numeric NOT NULL CHECK (gia_thue_giuong >= 0),
  gia_thue_nguyen_phong numeric CHECK (gia_thue_nguyen_phong >= 0),
  danh_gia              numeric CHECK (danh_gia >= 0 AND danh_gia <= 5),
  so_luot_danh_gia      integer NOT NULL DEFAULT 0,
  tien_ich              jsonb NOT NULL DEFAULT '{}'::jsonb,
  mo_ta                 text,
  hinh_anh              jsonb NOT NULL DEFAULT '[]'::jsonb,
  trang_thai            varchar NOT NULL DEFAULT 'hoat_dong'
                          CHECK (trang_thai IN ('hoat_dong','bao_tri','ngung')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- [migration_room_code_per_branch] mã phòng chỉ cần duy nhất TRONG 1 chi nhánh
  -- (cho phép P101 tồn tại đồng thời ở nhiều chi nhánh; định danh thật là cột id số).
  CONSTRAINT phong_chinhanh_maphong_key UNIQUE (chi_nhanh_id, ma_phong)
);

-- B2. Giường ---------------------------------------------------------------
CREATE TABLE giuong (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_giuong  varchar NOT NULL,
  phong_id   bigint NOT NULL REFERENCES phong(id),
  trang_thai varchar NOT NULL DEFAULT 'trong'
               CHECK (trang_thai IN ('trong','giu_cho','dat_coc','dang_thue','bao_tri')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- C) NHÓM KHÁCH HÀNG & NHÓM THUÊ
-- ===========================================================================

-- C1. Khách hàng -----------------------------------------------------------
CREATE TABLE khach_hang (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ho_ten             varchar NOT NULL,
  ngay_sinh          date,
  gioi_tinh          varchar CHECK (gioi_tinh IN ('nam','nu','khac')),
  quoc_tich          varchar,
  loai_giay_to       varchar,
  so_giay_to         varchar,
  so_dien_thoai      varchar,
  email              varchar,
  mat_khau_hash      varchar,
  dia_chi_thuong_tru varchar,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- C2. Nhóm thuê ------------------------------------------------------------
CREATE TABLE nhom_thue (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ten_nhom        varchar,
  dai_dien_id     bigint NOT NULL REFERENCES khach_hang(id),
  so_nguoi_du_kien integer CHECK (so_nguoi_du_kien > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- C3. Thành viên nhóm thuê -------------------------------------------------
CREATE TABLE nhom_thue_thanh_vien (
  nhom_thue_id  bigint NOT NULL REFERENCES nhom_thue(id),
  khach_hang_id bigint NOT NULL REFERENCES khach_hang(id),
  dat_dieu_kien boolean,
  CONSTRAINT nhom_thue_thanh_vien_pkey PRIMARY KEY (nhom_thue_id, khach_hang_id)
);

-- ===========================================================================
-- D) QUY TRÌNH ĐĂNG KÝ THUÊ
-- ===========================================================================

-- D1. Phiếu đăng ký thuê ---------------------------------------------------
CREATE TABLE phieu_dang_ky_thue (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_phieu         varchar NOT NULL UNIQUE,
  khach_hang_id    bigint NOT NULL REFERENCES khach_hang(id),
  nhom_thue_id     bigint REFERENCES nhom_thue(id),
  nhan_vien_sale_id bigint REFERENCES nhan_vien(id),
  chi_nhanh_id     bigint REFERENCES chi_nhanh(id),
  tieu_chi         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ngay_du_kien_vao_o date,
  thoi_han_thue    integer,
  -- [migration_booking_status] thêm 'dang_xu_ly' và 'da_hen_xem'
  trang_thai       varchar NOT NULL DEFAULT 'cho_xem_phong'
                     CHECK (trang_thai IN
                       ('cho_xem_phong','dang_xu_ly','da_hen_xem','da_xem_phong','da_dat_coc','huy')),
  ghi_chu          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- D2. Lịch xem phòng -------------------------------------------------------
CREATE TABLE lich_xem_phong (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phieu_dang_ky_id bigint NOT NULL REFERENCES phieu_dang_ky_thue(id),
  nhan_vien_sale_id bigint REFERENCES nhan_vien(id),
  thoi_gian_hen    timestamptz NOT NULL,
  trang_thai       varchar NOT NULL DEFAULT 'da_len_lich'
                     CHECK (trang_thai IN ('da_len_lich','da_xem','doi_lich','huy')),
  ghi_chu          text
);

-- ===========================================================================
-- E) QUY TRÌNH ĐẶT CỌC (2 bước kiểm soát: KT đối soát -> QL chốt)
-- ===========================================================================

-- E1. Phiếu đặt cọc --------------------------------------------------------
CREATE TABLE phieu_dat_coc (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_phieu          varchar NOT NULL UNIQUE,
  phieu_dang_ky_id  bigint REFERENCES phieu_dang_ky_thue(id),
  khach_hang_id     bigint NOT NULL REFERENCES khach_hang(id),
  nhom_thue_id      bigint REFERENCES nhom_thue(id),
  chi_nhanh_id      bigint NOT NULL REFERENCES chi_nhanh(id),
  nhan_vien_sale_id bigint REFERENCES nhan_vien(id),
  so_tien_coc       numeric NOT NULL CHECK (so_tien_coc >= 0),
  thoi_diem_tao     timestamptz NOT NULL DEFAULT now(),
  han_thanh_toan    timestamptz NOT NULL,
  -- [migration_deposit_review] thêm trạng thái trung gian 'cho_duyet'
  trang_thai        varchar NOT NULL DEFAULT 'cho_thanh_toan'
                      CHECK (trang_thai IN
                        ('cho_thanh_toan','cho_duyet','da_thanh_toan','da_huy')),
  ly_do_huy         varchar,
  minh_chung_ck     text,        -- [migration_deposit_proof] ảnh chứng từ chuyển khoản
  so_tien_thuc_nhan numeric,     -- [migration_deposit_review] số tiền thực nhận khi đối soát
  -- [migration_deposit_method] hình thức khách chọn
  hinh_thuc         varchar
                      CHECK (hinh_thuc IS NULL OR hinh_thuc IN ('tien_mat','chuyen_khoan')),
  -- [migration_deposit_timestamps] mốc + người đối soát / chốt
  thoi_diem_doi_soat    timestamptz,
  nhan_vien_doi_soat_id bigint REFERENCES nhan_vien(id),
  thoi_diem_chot        timestamptz,
  nhan_vien_chot_id     bigint REFERENCES nhan_vien(id),
  -- [migration_deposit_refund_acct] TK khách cung cấp để nhận hoàn cọc (khi chuyển khoản)
  tk_hoan_so        varchar,
  tk_hoan_ngan_hang varchar,
  tk_hoan_chu_tk    varchar
);

-- E2. Chi tiết đặt cọc (phiếu cọc <-> giường) ------------------------------
CREATE TABLE chi_tiet_dat_coc (
  phieu_dat_coc_id bigint NOT NULL REFERENCES phieu_dat_coc(id),
  giuong_id        bigint NOT NULL REFERENCES giuong(id),
  CONSTRAINT chi_tiet_dat_coc_pkey PRIMARY KEY (phieu_dat_coc_id, giuong_id)
);

-- ===========================================================================
-- F) QUY TRÌNH HỢP ĐỒNG, BÀN GIAO, DỊCH VỤ
-- ===========================================================================

-- F1. Hợp đồng thuê --------------------------------------------------------
CREATE TABLE hop_dong_thue (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_hop_dong      varchar NOT NULL UNIQUE,
  phieu_dat_coc_id bigint REFERENCES phieu_dat_coc(id),
  khach_hang_id    bigint NOT NULL REFERENCES khach_hang(id),
  nhom_thue_id     bigint REFERENCES nhom_thue(id),
  chi_nhanh_id     bigint NOT NULL REFERENCES chi_nhanh(id),
  ngay_bat_dau     date NOT NULL,
  ngay_ket_thuc    date NOT NULL,
  gia_thue_thang   numeric NOT NULL,
  ky_thanh_toan    varchar NOT NULL DEFAULT 'thang'
                     CHECK (ky_thanh_toan IN ('thang','quy','nam')),
  noi_quy          text,
  -- [migration_contract_status] thêm 'cho_ky' và 'da_ky'
  trang_thai       varchar NOT NULL DEFAULT 'cho_ky'
                     CHECK (trang_thai IN ('cho_ky','da_ky','dang_hieu_luc','da_thanh_ly')),
  ngay_ky          timestamptz,    -- [migration_contract_signed_at] mốc thời điểm ký HĐ (lịch sử ký, giữ vĩnh viễn)
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- F2. Chi tiết hợp đồng (HĐ <-> giường) ------------------------------------
CREATE TABLE chi_tiet_hop_dong (
  hop_dong_id bigint NOT NULL REFERENCES hop_dong_thue(id),
  giuong_id   bigint NOT NULL REFERENCES giuong(id),
  gia_giuong  numeric,
  CONSTRAINT chi_tiet_hop_dong_pkey PRIMARY KEY (hop_dong_id, giuong_id)
);

-- F3. Phí dịch vụ (điện/nước...; chi_so_dau = mốc công tơ lúc bàn giao) -----
CREATE TABLE phi_dich_vu (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hop_dong_id bigint NOT NULL REFERENCES hop_dong_thue(id),
  loai_phi    varchar NOT NULL,
  don_gia     numeric,
  don_vi      varchar,
  chi_so_dau  numeric
);

-- F4. Biên bản bàn giao ----------------------------------------------------
CREATE TABLE bien_ban_ban_giao (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hop_dong_id   bigint NOT NULL REFERENCES hop_dong_thue(id),
  nhan_vien_id  bigint REFERENCES nhan_vien(id),
  ngay_ban_giao timestamptz NOT NULL DEFAULT now(),
  hien_trang    text,
  trang_thai    varchar NOT NULL DEFAULT 'da_ban_giao'
                  CHECK (trang_thai IN ('da_ban_giao','huy'))
);

-- F5. Tài sản (ghi nhận trên biên bản bàn giao) ----------------------------
CREATE TABLE tai_san (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bien_ban_ban_giao_id bigint NOT NULL REFERENCES bien_ban_ban_giao(id),
  ten_tai_san          varchar NOT NULL,
  so_luong             integer NOT NULL DEFAULT 1,
  tinh_trang           varchar
);

-- ===========================================================================
-- G) QUY TRÌNH TRẢ PHÒNG & HOÀN CỌC
-- ===========================================================================

-- G1. Phiếu trả phòng ------------------------------------------------------
CREATE TABLE phieu_tra_phong (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_phieu         varchar NOT NULL UNIQUE,
  hop_dong_id      bigint NOT NULL REFERENCES hop_dong_thue(id),
  nhan_vien_sale_id bigint REFERENCES nhan_vien(id),
  ngay_dang_ky     timestamptz NOT NULL DEFAULT now(),
  ngay_tra_du_kien date,
  ngay_tra_thuc_te date,
  trang_thai       varchar NOT NULL DEFAULT 'cho_kiem_tra'
                     CHECK (trang_thai IN ('cho_kiem_tra','cho_doi_soat','cho_thanh_ly','hoan_tat')),
  ghi_chu          text,
  ly_do            text          -- [migration_checkout_reason] lý do trả phòng
);

-- G2. Biên bản trả phòng ---------------------------------------------------
CREATE TABLE bien_ban_tra_phong (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phieu_tra_phong_id bigint NOT NULL REFERENCES phieu_tra_phong(id),
  nhan_vien_id      bigint REFERENCES nhan_vien(id),
  ket_qua_kiem_tra  jsonb,
  tinh_trang_ve_sinh varchar,
  ngay_lap          timestamptz NOT NULL DEFAULT now(),
  da_thanh_ly       boolean NOT NULL DEFAULT false
);

-- G3. Bảng đối soát hoàn cọc -----------------------------------------------
CREATE TABLE bang_doi_soat (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phieu_tra_phong_id  bigint NOT NULL REFERENCES phieu_tra_phong(id),
  nhan_vien_ke_toan_id bigint REFERENCES nhan_vien(id),
  ty_le_hoan_coc      numeric NOT NULL,
  tien_coc            numeric NOT NULL,
  hoan_coc_co_ban     numeric NOT NULL,
  tong_khau_tru       numeric NOT NULL DEFAULT 0,
  so_tien_hoan_thuc_te numeric NOT NULL,
  ngay_lap            timestamptz NOT NULL DEFAULT now()
);

-- G4. Khoản khấu trừ (chi tiết trừ vào tiền cọc) ---------------------------
CREATE TABLE khoan_khau_tru (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bang_doi_soat_id bigint NOT NULL REFERENCES bang_doi_soat(id),
  loai_khoan      varchar NOT NULL,
  mo_ta           varchar,
  so_tien         numeric NOT NULL
);

-- ===========================================================================
-- H) GIAO DỊCH, NHẬT KÝ, THÔNG BÁO
-- ===========================================================================

-- H1. Giao dịch thanh toán -------------------------------------------------
CREATE TABLE giao_dich_thanh_toan (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loai_giao_dich   varchar NOT NULL
                     CHECK (loai_giao_dich IN ('thu_coc','thu_tien_thue','hoan_coc','thu_chenh_lech')),
  so_tien          numeric NOT NULL,
  hinh_thuc        varchar NOT NULL CHECK (hinh_thuc IN ('tien_mat','chuyen_khoan')),
  thoi_diem        timestamptz NOT NULL DEFAULT now(),
  nhan_vien_ke_toan_id bigint REFERENCES nhan_vien(id),
  phieu_dat_coc_id bigint REFERENCES phieu_dat_coc(id),
  hop_dong_id      bigint REFERENCES hop_dong_thue(id),
  bang_doi_soat_id bigint REFERENCES bang_doi_soat(id),
  ma_giao_dich     varchar,
  ghi_chu          text
);

-- H2. Nhật ký hệ thống (audit log) -----------------------------------------
CREATE TABLE nhat_ky_he_thong (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nhan_vien_id bigint REFERENCES nhan_vien(id),
  hanh_dong    varchar NOT NULL,
  doi_tuong    varchar,
  mo_ta        text,
  thoi_diem    timestamptz NOT NULL DEFAULT now()
);

-- H3. Thông báo ------------------------------------------------------------
CREATE TABLE thong_bao (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nguoi_nhan_role varchar,
  nhan_vien_id    bigint REFERENCES nhan_vien(id),
  khach_hang_id   bigint REFERENCES khach_hang(id),
  tieu_de         varchar,
  noi_dung        text,
  loai            varchar,
  do_uu_tien      varchar NOT NULL DEFAULT 'normal'
                    CHECK (do_uu_tien IN ('high','normal','low')),
  url             varchar,
  icon            varchar,
  da_doc          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- I) CHỈ MỤC (INDEX) — tăng tốc truy vấn theo trạng thái / chi nhánh / quan hệ
-- ===========================================================================
CREATE INDEX idx_phong_chi_nhanh        ON phong(chi_nhanh_id);
CREATE INDEX idx_giuong_phong           ON giuong(phong_id);
CREATE INDEX idx_giuong_trang_thai      ON giuong(trang_thai);
CREATE INDEX idx_dangky_trang_thai      ON phieu_dang_ky_thue(trang_thai);
CREATE INDEX idx_dangky_chi_nhanh       ON phieu_dang_ky_thue(chi_nhanh_id);
CREATE INDEX idx_datcoc_trang_thai      ON phieu_dat_coc(trang_thai);
CREATE INDEX idx_datcoc_chi_nhanh       ON phieu_dat_coc(chi_nhanh_id);
CREATE INDEX idx_hopdong_trang_thai     ON hop_dong_thue(trang_thai);
CREATE INDEX idx_hopdong_chi_nhanh      ON hop_dong_thue(chi_nhanh_id);
CREATE INDEX idx_traphong_hop_dong      ON phieu_tra_phong(hop_dong_id);
CREATE INDEX idx_giaodich_loai          ON giao_dich_thanh_toan(loai_giao_dich);
CREATE INDEX idx_thongbao_nhan_vien     ON thong_bao(nhan_vien_id);
CREATE INDEX idx_thongbao_khach_hang    ON thong_bao(khach_hang_id);

-- ===========================================================================
-- J) DỮ LIỆU MẪU (SEED)
-- ===========================================================================

-- J1. 3 chi nhánh ----------------------------------------------------------
INSERT INTO chi_nhanh (ma_chi_nhanh, ten, dia_chi, so_dien_thoai, so_phong) VALUES
  ('Q5',  'HomeStay Dorm Quận 5',  '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',  '02838354266', 4),
  ('Q10', 'HomeStay Dorm Quận 10', '12 Lý Thường Kiệt, Quận 10, TP.HCM', '02838354267', 4),
  ('TD',  'HomeStay Dorm Thủ Đức', '1 Võ Văn Ngân, Thủ Đức, TP.HCM',     '02838354268', 4);

-- J2. Cấu hình hệ thống cho từng chi nhánh (mặc định) ----------------------
INSERT INTO cau_hinh_he_thong (chi_nhanh_id) VALUES (1), (2), (3);

-- J3. Tài khoản nhân viên (mật khẩu: 123456) -------------------------------
--   Phân quyền theo chi nhánh:
--     - chi_nhanh_id = NULL  -> NHÂN VIÊN TOÀN HỆ THỐNG: thấy & quản lý mọi chi nhánh.
--     - chi_nhanh_id = <id>  -> NHÂN VIÊN KHU VỰC: chỉ thấy & quản lý đúng chi nhánh đó.
--
--   3 tài khoản demo chính = NHÂN VIÊN TOÀN HỆ THỐNG (quản lý toàn bộ).
INSERT INTO nhan_vien (ho_ten, email, mat_khau_hash, vai_tro, chi_nhanh_id, so_dien_thoai, ngay_vao_lam) VALUES
  ('NV Sale Demo',  'sale@homestay.vn',       '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'sale',       NULL, '0900000001', '2025-01-01'),
  ('Quản lý Demo',  'manager@homestay.vn',    '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'manager',    NULL, '0900000002', '2025-01-01'),
  ('Kế toán Demo',  'accountant@homestay.vn', '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'accountant', NULL, '0900000003', '2025-01-01');

--   [migration_admin_role] Tài khoản QUẢN TRỊ HỆ THỐNG (admin / IT) — toàn hệ thống.
--   Tách quản trị hệ thống (tài khoản, chi nhánh, cấu hình, nhật ký) khỏi Quản lý nghiệp vụ.
INSERT INTO nhan_vien (ho_ten, email, mat_khau_hash, vai_tro, chi_nhanh_id, so_dien_thoai, ngay_vao_lam) VALUES
  ('Quản trị hệ thống', 'admin@homestay.vn', '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'admin', NULL, '0900000004', '2025-01-01');

--   Nhân viên KHU VỰC (gắn chi nhánh) — để demo cơ chế phân quyền theo chi nhánh.
--   Có thể bỏ khối này nếu chỉ cần 3 tài khoản toàn hệ thống ở trên.
INSERT INTO nhan_vien (ho_ten, email, mat_khau_hash, vai_tro, chi_nhanh_id, so_dien_thoai, ngay_vao_lam) VALUES
  ('Sale Quận 5',     'sale.q5@homestay.vn',    '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'sale',    1, '0900000011', '2025-01-01'),
  ('Quản lý Quận 5',  'manager.q5@homestay.vn', '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'manager', 1, '0900000012', '2025-01-01'),
  ('Sale Quận 10',    'sale.q10@homestay.vn',   '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'sale',    2, '0900000021', '2025-01-01'),
  ('Quản lý Thủ Đức', 'manager.td@homestay.vn', '$2b$10$kKzdC.45W1vyjcn6A9nRgOEgCP928qUKXVqzMUiDgFHfwQQYKcBE2', 'manager', 3, '0900000031', '2025-01-01');

-- J4. Quy định cho thuê (áp dụng toàn hệ thống) ----------------------------
INSERT INTO quy_dinh_cho_thue (chi_nhanh_id, ma_dieu_kien, mo_ta, bat_buoc) VALUES
  (NULL, 'gioi_tinh', 'Giới tính khách phải phù hợp quy định của phòng', true),
  (NULL, 'giay_to',   'Phải có giấy tờ tùy thân hợp lệ (CCCD/hộ chiếu)', true),
  (NULL, 'do_tuoi',   'Khách thuê phải đủ 18 tuổi',                      true);

-- J5. 12 phòng (4 phòng / chi nhánh) ---------------------------------------
--     Giá là gia_thue_giuong (đồng/giường/tháng). Tiền cọc = giá giường x 2 x số giường.
INSERT INTO phong
  (ma_phong, chi_nhanh_id, khu_vuc, loai_phong, gioi_tinh_ap_dung, suc_chua,
   gia_thue_giuong, gia_thue_nguyen_phong, tien_ich, mo_ta) VALUES
  -- Chi nhánh Quận 5 (id 1)
  ('P101', 1, 'Quận 5',  'o_ghep',     'nam',            4, 1800000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam, ban công thoáng'),
  ('P102', 1, 'Quận 5',  'nguyen_can', 'nu',             2, 1600000, 3000000, '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng nguyên căn cho nữ'),
  ('P103', 1, 'Quận 5',  'o_ghep',     'nam',            6, 1500000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam 6 giường'),
  ('P104', 1, 'Quận 5',  'nguyen_can', 'khong_quy_dinh', 6, 1900000, 10000000,'{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng nguyên căn lớn'),
  -- Chi nhánh Quận 10 (id 2)
  ('P201', 2, 'Quận 10', 'o_ghep',     'nam',            6, 1500000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam'),
  ('P203', 2, 'Quận 10', 'o_ghep',     'nu',             4, 1900000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nữ cao cấp'),
  ('P204', 2, 'Quận 10', 'nguyen_can', 'khong_quy_dinh', 2, 1400000, 2600000, '{"dieu_hoa":false,"gui_xe":true,"wifi":true}'::jsonb, 'Phòng nguyên căn nhỏ'),
  ('P206', 2, 'Quận 10', 'o_ghep',     'nam',            6, 1500000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam'),
  -- Chi nhánh Thủ Đức (id 3)
  ('P301', 3, 'Thủ Đức', 'o_ghep',     'nam',            4, 1700000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam gần ĐH'),
  ('P303', 3, 'Thủ Đức', 'nguyen_can', 'khong_quy_dinh', 4, 1600000, 6000000, '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng nguyên căn'),
  ('P304', 3, 'Thủ Đức', 'o_ghep',     'nam',            6, 1400000, NULL,    '{"dieu_hoa":false,"gui_xe":true,"wifi":true}'::jsonb, 'Phòng ghép nam giá tốt'),
  ('P314', 3, 'Thủ Đức', 'o_ghep',     'nam',            4, 1500000, NULL,    '{"dieu_hoa":true,"gui_xe":true,"wifi":true}'::jsonb,  'Phòng ghép nam');

-- J6. Sinh giường cho mỗi phòng theo sức chứa (ma_giuong = <ma_phong>-G<n>) -
INSERT INTO giuong (ma_giuong, phong_id, trang_thai)
SELECT p.ma_phong || '-G' || g.n, p.id, 'trong'
FROM phong p
CROSS JOIN LATERAL generate_series(1, p.suc_chua) AS g(n);

COMMIT;

-- ============================================================================
--  KẾT THÚC. Kiểm tra nhanh:
--    SELECT count(*) FROM phong;    -- 12
--    SELECT count(*) FROM giuong;   -- 54
--    SELECT email, vai_tro FROM nhan_vien;
-- ============================================================================
