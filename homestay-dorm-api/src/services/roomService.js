import * as rooms from '../repositories/roomRepo.js'
import { withTransaction } from '../config/db.js'
import { notFound, badRequest, conflict, forbidden } from '../utils/errors.js'

// Quản lý CHI NHÁNH chỉ thao tác phòng thuộc chi nhánh mình.
// Quản lý TOÀN HỆ THỐNG (chiNhanhId = null) được thao tác mọi chi nhánh.
function assertBranch(user, targetChiNhanhId) {
  if (user && user.chiNhanhId != null && Number(user.chiNhanhId) !== Number(targetChiNhanhId))
    throw forbidden('Bạn chỉ được quản lý phòng thuộc chi nhánh mình phụ trách')
}

export const searchRooms = (f) => rooms.search(f)
export async function getRoom(id) {
  const room = await rooms.findById(id)
  if (!room) throw notFound('Không tìm thấy phòng')
  room.giuong = await rooms.bedsOfRoom(room.id)
  return room
}

// ===== Mapping dữ liệu form (frontend) -> cột DB =====
const AMEN_CODE = {
  'Điều hòa': 'dieu_hoa', 'Gửi xe': 'gui_xe', 'Wifi': 'wifi', 'Tủ riêng': 'tu_rieng',
  'Bếp riêng': 'bep_rieng', 'Máy giặt': 'may_giat', 'Ban công': 'ban_cong',
}
const genderCode = (g) => g === 'Nam' ? 'nam' : g === 'Nữ' ? 'nu' : 'khong_quy_dinh'
const typeCode = (t) => t === 'Phòng nguyên căn' ? 'nguyen_can' : 'o_ghep'
const tienIchOf = (arr = []) => Object.fromEntries(arr.map(a => [AMEN_CODE[a] || a, true]))

async function mapForm(dto) {
  const chiNhanhId = await rooms.branchIdByName(dto.branch)
  if (!chiNhanhId) throw badRequest('Không tìm thấy chi nhánh: ' + dto.branch)
  return {
    chiNhanhId,
    loaiPhong: typeCode(dto.type),
    gioiTinh: genderCode(dto.gender),
    sucChua: Number(dto.capacity),
    giaGiuong: Number(dto.pricePerBed || 0),
    giaNguyenPhong: dto.priceWholeRoom != null ? Number(dto.priceWholeRoom) : null,
    tienIch: tienIchOf(dto.amenities),
    moTa: dto.description || null,
    hinhAnh: dto.emoji ? [dto.emoji] : [],
    trangThai: dto.maintenance ? 'bao_tri' : 'hoat_dong',
  }
}

// UC-HT-13: thêm phòng (kèm tạo đủ giường theo sức chứa)
export async function createRoom(dto, user = null) {
  if (!dto.id) throw badRequest('Thiếu mã phòng')
  if (!Number(dto.capacity) || Number(dto.capacity) <= 0) throw badRequest('Sức chứa không hợp lệ')
  const f = await mapForm(dto)   // f.chiNhanhId đã được resolve từ dto.branch
  assertBranch(user, f.chiNhanhId)   // chặn thêm phòng cho chi nhánh khác
  // Mã phòng chỉ cần duy nhất TRONG cùng chi nhánh (cho phép trùng giữa các chi nhánh).
  const existing = await rooms.roomByCodeInBranch(f.chiNhanhId, dto.id)
  if (existing) {
    if (existing.trang_thai === 'ngung')
      throw conflict('Mã phòng này đã từng tồn tại trong chi nhánh và bị xoá — vui lòng dùng mã khác (xem tab "Đã xóa").')
    throw conflict('Mã phòng đã tồn tại trong chi nhánh này')
  }
  const room = await withTransaction(async (c) => {
    const r = await rooms.insertRoom(c, { ...f, maPhong: dto.id })
    await rooms.insertBeds(c, r.id, dto.id, 1, f.sucChua)   // mã giường: <ma_phong>-G<idx> (duy nhất theo từng phòng)
    return r
  })
  return getRoom(room.id)
}

// UC-HT-13: sửa phòng (đồng bộ số giường nếu đổi sức chứa). id = id số của phòng.
export async function updateRoom(id, dto, user = null) {
  const cur = await rooms.findById(id)
  if (!cur) throw notFound('Không tìm thấy phòng')
  assertBranch(user, cur.chi_nhanh_id)   // chỉ sửa phòng thuộc chi nhánh mình
  const f = await mapForm(dto)
  assertBranch(user, f.chiNhanhId)        // và không được chuyển phòng sang chi nhánh khác
  await withTransaction(async (c) => {
    await rooms.updateRoomRow(c, cur.id, f)
    const total = await rooms.countBeds(cur.id)
    if (f.sucChua > total) {
      await rooms.insertBeds(c, cur.id, cur.ma_phong, total + 1, f.sucChua - total)
    } else if (f.sucChua < total) {
      const inUse = await rooms.countBedsInUse(cur.id)
      const removable = Math.max(0, total - Math.max(f.sucChua, inUse))
      if (removable > 0) await rooms.deleteTrongBeds(c, cur.id, removable)
    }
  })
  return getRoom(cur.id)
}

// UC-HT-13: xoá phòng (xoá mềm; chặn nếu còn giường đang dùng). id = id số của phòng.
export async function deleteRoom(id, user = null) {
  const cur = await rooms.findById(id)
  if (!cur) throw notFound('Không tìm thấy phòng')
  assertBranch(user, cur.chi_nhanh_id)   // chỉ xoá phòng thuộc chi nhánh mình
  const inUse = await rooms.countBedsInUse(cur.id)
  if (inUse > 0) throw conflict('Phòng đang có giường được giữ chỗ/đặt cọc/cho thuê — không thể xoá')
  await withTransaction(async (c) => { await rooms.softDeleteRoom(c, cur.id) })
  return { ok: true, id: cur.id, deleted: true }
}
