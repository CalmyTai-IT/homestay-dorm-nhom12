import { query } from '../config/db.js'
// Đọc cấu hình hệ thống (Module F): số tháng cọc, hạn TT, 4 mức hoàn cọc.
// Ưu tiên cấu hình RIÊNG của chi nhánh; nếu chi nhánh chưa có thì lấy cấu hình chung
// (hàng chi_nhanh_id NULL) hoặc hàng đầu tiên; cuối cùng mới dùng giá trị mặc định.
export async function getConfig(chiNhanhId = null) {
  let r = null
  if (chiNhanhId != null) {
    r = (await query('select * from cau_hinh_he_thong where chi_nhanh_id=$1 limit 1', [chiNhanhId])).rows[0]
  }
  if (!r) r = (await query('select * from cau_hinh_he_thong order by chi_nhanh_id nulls first limit 1')).rows[0]
  return r || { so_thang_coc: 2, han_thanh_toan_coc_gio: 24,
    ty_le_hoan_chua_ky: 80, ty_le_hoan_ky_duoi_6m: 50, ty_le_hoan_ky_tren_6m: 70, ty_le_hoan_het_han: 100 }
}

// Lưu cấu hình (Quản lý). Nếu là quản lý chi nhánh -> upsert ĐÚNG hàng của chi nhánh đó;
// nếu là quản lý toàn hệ thống (chiNhanhId null) -> upsert hàng cấu hình chung (chi_nhanh_id NULL).
export async function saveConfig(dto, chiNhanhId = null) {
  const vals = [
    Number(dto.so_thang_coc ?? 2),
    Number(dto.han_thanh_toan_coc_gio ?? 24),
    Number(dto.ty_le_hoan_chua_ky ?? 80),
    Number(dto.ty_le_hoan_ky_duoi_6m ?? 50),
    Number(dto.ty_le_hoan_ky_tren_6m ?? 70),
    Number(dto.ty_le_hoan_het_han ?? 100),
  ]
  const existing = chiNhanhId != null
    ? (await query('select id from cau_hinh_he_thong where chi_nhanh_id=$1 limit 1', [chiNhanhId])).rows[0]
    : (await query('select id from cau_hinh_he_thong where chi_nhanh_id is null limit 1')).rows[0]
  if (existing) {
    return (await query(
      `update cau_hinh_he_thong set so_thang_coc=$1, han_thanh_toan_coc_gio=$2,
         ty_le_hoan_chua_ky=$3, ty_le_hoan_ky_duoi_6m=$4, ty_le_hoan_ky_tren_6m=$5, ty_le_hoan_het_han=$6, updated_at=now()
       where id=$7 returning *`, [...vals, existing.id])).rows[0]
  }
  return (await query(
    `insert into cau_hinh_he_thong (chi_nhanh_id, so_thang_coc, han_thanh_toan_coc_gio,
       ty_le_hoan_chua_ky, ty_le_hoan_ky_duoi_6m, ty_le_hoan_ky_tren_6m, ty_le_hoan_het_han)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`, [chiNhanhId, ...vals])).rows[0]
}
