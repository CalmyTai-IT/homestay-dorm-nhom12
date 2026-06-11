import * as repo from '../repositories/notifyRepo.js'

const map = (n) => ({
  id: n.id, title: n.tieu_de, message: n.noi_dung, type: n.loai,
  priority: n.do_uu_tien, url: n.url, icon: n.icon,
  isRead: n.da_doc, createdAt: n.created_at,
})

// Gửi thông báo — không bao giờ chặn luồng nghiệp vụ chính nếu lỗi
export const send = (n) => repo.insert(n).catch(() => {})
export const toRole = (role, n) => send({ ...n, nguoiNhanRole: role })
export const toStaff = (nhanVienId, n) => send({ ...n, nhanVienId })
export const toCustomer = (khachHangId, n) => send({ ...n, khachHangId })

export async function listForStaff(role, nhanVienId) {
  return (await repo.listForStaff(role, nhanVienId)).map(map)
}
export async function listForCustomer(khachHangId) {
  return (await repo.listForCustomer(khachHangId)).map(map)
}
export const markRead = (id) => repo.markRead(id)
export const markAllStaff = (role, id) => repo.markAllStaff(role, id)
export const markAllCustomer = (id) => repo.markAllCustomer(id)
