import { withTransaction } from '../config/db.js'
import * as repo from '../repositories/handoverRepo.js'
import { notFound } from '../utils/errors.js'

const monthsBetween = (a, b) => {
  if (!a || !b) return 0
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24 * 30)))
}

const mapRow = (r) => ({
  id: r.id,
  code: r.ma_hop_dong,
  customer: { fullName: r.ho_ten || '—', phone: r.so_dien_thoai || '' },
  roomId: r.ma_phong || '—',
  branch: r.ten_chi_nhanh || '',
  startDate: r.ngay_bat_dau,
  endDate: r.ngay_ket_thuc,
  duration: monthsBetween(r.ngay_bat_dau, r.ngay_ket_thuc),
  numberOfBeds: Number(r.so_giuong || 0),
  handoverDate: r.ngay_ban_giao,
  hienTrang: r.hien_trang,
  handoverBy: r.nhan_vien_ten || 'Quản lý',
  hasDetails: Number(r.so_tai_san || 0) > 0,
})

export async function listHandovers(chiNhanhId = null) {
  return (await repo.list(chiNhanhId)).map(mapRow)
}

export async function getHandover(id) {
  const row = await repo.byId(id)
  if (!row) throw notFound('Không tìm thấy biên bản bàn giao')
  const assets = await repo.assetsOf(id)
  const fees = await repo.feesOf(row.hop_dong_id)
  const dien = fees.find(f => f.loai_phi === 'dien')
  const nuoc = fees.find(f => f.loai_phi === 'nuoc')
  return {
    ...mapRow(row),
    handoverInfo: {
      handoverBy: row.nhan_vien_ten || 'Quản lý',
      handoverAt: row.ngay_ban_giao,
      items: assets.map(a => ({
        key: String(a.id), label: a.ten_tai_san,
        quantity: a.so_luong, condition: a.tinh_trang || 'good',
      })),
      electricStart: dien?.chi_so_dau != null ? Number(dien.chi_so_dau) : null,
      waterStart: nuoc?.chi_so_dau != null ? Number(nuoc.chi_so_dau) : null,
      notes: row.hien_trang || '',
    },
  }
}

export async function completeHandover(id, dto, nhanVienId) {
  const row = await repo.byId(id)
  if (!row) throw notFound('Không tìm thấy biên bản bàn giao')
  await withTransaction((c) => repo.complete(c, {
    handoverId: id,
    hopDongId: row.hop_dong_id,
    nhanVienId,
    hienTrang: dto.notes,
    taiSan: (dto.items || []).map(i => ({ ten: i.label, soLuong: i.quantity, tinhTrang: i.condition })),
    dichVu: [
      { loaiPhi: 'dien', donGia: 3500, donVi: 'kWh', chiSoDau: dto.electricStart },
      { loaiPhi: 'nuoc', donGia: 25000, donVi: 'm3', chiSoDau: dto.waterStart },
    ],
  }))
  return { ok: true, id }
}
