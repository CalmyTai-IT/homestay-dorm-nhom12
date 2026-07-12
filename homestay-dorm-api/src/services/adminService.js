import bcrypt from 'bcryptjs'
import * as admin from '../repositories/adminRepo.js'
import { notFound, badRequest, conflict, forbidden } from '../utils/errors.js'

const ROLES = ['sale', 'manager', 'accountant', 'admin']
const DEFAULT_PASSWORD = '123456'
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '')

// ----- Nhân viên -----
const mapStaff = (n) => ({
  id: n.id, fullName: n.ho_ten, email: n.email, phone: n.so_dien_thoai || '',
  role: n.vai_tro, branch: n.ten_chi_nhanh || 'Toàn hệ thống',
})
export const listStaff = async (chiNhanhId = null) => (await admin.listStaff(chiNhanhId)).map(mapStaff)

async function resolveBranchId(branch) {
  if (!branch || branch === 'Toàn hệ thống') return null
  return (await admin.branchIdByName(branch)) || null
}

export async function createStaff(dto, actorChiNhanhId = null) {
  if (!dto.fullName?.trim()) throw badRequest('Họ tên không được trống')
  if (!emailOk(dto.email)) throw badRequest('Email không hợp lệ')
  if (!ROLES.includes(dto.role)) throw badRequest('Vai trò không hợp lệ')
  if (await admin.staffEmailTaken(dto.email)) throw conflict('Email đã được dùng')
  // Quản lý CHI NHÁNH chỉ được phân nhân viên cho chính chi nhánh của mình
  // (không được tạo nhân viên toàn hệ thống hay thuộc chi nhánh khác).
  // Quản lý TOÀN HỆ THỐNG (actorChiNhanhId = null) được phân tuỳ ý theo dto.branch.
  let chiNhanhId = await resolveBranchId(dto.branch)
  if (actorChiNhanhId != null) {
    if (chiNhanhId != null && chiNhanhId !== actorChiNhanhId)
      throw forbidden('Bạn chỉ được phân nhân viên cho chi nhánh của mình')
    chiNhanhId = actorChiNhanhId
  }
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  const r = await admin.insertStaff({
    hoTen: dto.fullName.trim(), email: dto.email.trim(), hash, vaiTro: dto.role,
    chiNhanhId, soDienThoai: dto.phone?.trim() || null,
  })
  return mapStaff(await admin.staffById(r.id))
}

export async function updateStaff(id, dto, actorChiNhanhId = null) {
  const cur = await admin.staffById(id)
  if (!cur) throw notFound('Không tìm thấy nhân viên')
  // Quản lý chi nhánh chỉ được sửa nhân viên thuộc chi nhánh mình
  if (actorChiNhanhId != null && cur.chi_nhanh_id !== actorChiNhanhId)
    throw forbidden('Bạn chỉ được quản lý nhân viên thuộc chi nhánh của mình')
  if (!dto.fullName?.trim()) throw badRequest('Họ tên không được trống')
  if (!emailOk(dto.email)) throw badRequest('Email không hợp lệ')
  if (!ROLES.includes(dto.role)) throw badRequest('Vai trò không hợp lệ')
  if (await admin.staffEmailTaken(dto.email, id)) throw conflict('Email đã được dùng')
  // Không cho chuyển nhân viên sang chi nhánh khác / toàn hệ thống nếu actor là QL chi nhánh
  let chiNhanhId = await resolveBranchId(dto.branch)
  if (actorChiNhanhId != null) {
    if (chiNhanhId != null && chiNhanhId !== actorChiNhanhId)
      throw forbidden('Bạn chỉ được phân nhân viên cho chi nhánh của mình')
    chiNhanhId = actorChiNhanhId
  }
  await admin.updateStaff(id, {
    hoTen: dto.fullName.trim(), email: dto.email.trim(), vaiTro: dto.role,
    chiNhanhId, soDienThoai: dto.phone?.trim() || null,
  })
  return mapStaff(await admin.staffById(id))
}

export async function deleteStaff(id, actorChiNhanhId = null) {
  const cur = await admin.staffById(id)
  if (!cur) throw notFound('Không tìm thấy nhân viên')
  if (actorChiNhanhId != null && cur.chi_nhanh_id !== actorChiNhanhId)
    throw forbidden('Bạn chỉ được quản lý nhân viên thuộc chi nhánh của mình')
  await admin.deactivateStaff(id)
  return { ok: true, id }
}

// ----- Chi nhánh -----
const mapBranch = (b) => ({
  id: b.id, name: b.ten, address: b.dia_chi || '', phone: b.so_dien_thoai || '',
  totalRooms: Number(b.so_phong || 0), code: b.ma_chi_nhanh,
})
export const listBranches = async () => (await admin.listBranches()).map(mapBranch)

export async function createBranch(dto) {
  if (!dto.name?.trim()) throw badRequest('Tên chi nhánh không được trống')
  const maChiNhanh = 'CN' + Date.now().toString().slice(-8)
  const b = await admin.insertBranch({
    maChiNhanh, ten: dto.name.trim(), diaChi: dto.address?.trim() || null,
    soDienThoai: dto.phone?.trim() || null, soPhong: Number(dto.totalRooms) || 0,
  })
  return mapBranch(b)
}

export async function updateBranch(id, dto) {
  const cur = await admin.branchById(id)
  if (!cur) throw notFound('Không tìm thấy chi nhánh')
  const b = await admin.updateBranch(id, {
    ten: dto.name?.trim() || cur.ten,
    diaChi: dto.address?.trim() ?? cur.dia_chi,
    soDienThoai: dto.phone?.trim() ?? cur.so_dien_thoai,
    soPhong: Number(dto.totalRooms ?? cur.so_phong) || 0,
  })
  return mapBranch(b)
}

export async function deleteBranch(id) {
  if (!(await admin.branchById(id))) throw notFound('Không tìm thấy chi nhánh')
  await admin.deactivateBranch(id)
  return { ok: true, id }
}

// ----- Nhật ký hệ thống -----
const mapAudit = (k) => ({
  id: k.id, time: k.thoi_diem, user: k.ho_ten || 'Hệ thống',
  role: k.vai_tro || 'manager', action: k.hanh_dong, detail: k.mo_ta || '',
})
export const listAudit = async () => (await admin.listAudit(100)).map(mapAudit)
// Ghi nhật ký (không chặn luồng chính nếu lỗi)
export const log = (nhanVienId, hanhDong, doiTuong, moTa) =>
  admin.insertAudit(nhanVienId, hanhDong, doiTuong, moTa).catch(() => {})

// ----- Điều kiện cho thuê -----
const COND_KEYS = { requireIdCard: 'require_id_card', genderMatch: 'gender_match', allowForeigner: 'allow_foreigner' }
const COND_DESC = {
  require_id_card: 'Bắt buộc giấy tờ tùy thân',
  gender_match: 'Khớp giới tính khu vực/phòng',
  allow_foreigner: 'Cho phép khách nước ngoài',
}
export async function getConditions() {
  const by = Object.fromEntries((await admin.listConditions()).map(r => [r.ma_dieu_kien, r.bat_buoc]))
  return {
    requireIdCard: by.require_id_card ?? true,
    genderMatch: by.gender_match ?? true,
    allowForeigner: by.allow_foreigner ?? true,
  }
}
export async function saveConditions(dto) {
  for (const [uiKey, code] of Object.entries(COND_KEYS)) {
    if (dto[uiKey] !== undefined) await admin.upsertCondition(code, !!dto[uiKey], COND_DESC[code])
  }
  return getConditions()
}