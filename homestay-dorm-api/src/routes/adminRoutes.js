import { Router } from 'express'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
// Quản trị hệ thống (tài khoản, chi nhánh, cấu hình, nhật ký) DÀNH RIÊNG cho vai trò 'admin' (IT),
// tách khỏi Quản lý nghiệp vụ (manager). Trước đây các route này do 'manager' đảm nhiệm.
const adm = [authenticate, requireRole('admin')]

// ===== Nhân viên =====
r.get('/staff', ...adm, h(async (req,res)=>res.json(await admin.listStaff(req.user.chiNhanhId))))
r.post('/staff', ...adm, h(async (req,res)=>{
  const s = await admin.createStaff(req.body, req.user.chiNhanhId)
  admin.log(req.user.id, 'Thêm nhân viên', 'nhan_vien', `${s.fullName} · ${s.role}`)
  res.status(201).json(s)
}))
r.put('/staff/:id', ...adm, h(async (req,res)=>{
  const s = await admin.updateStaff(req.params.id, req.body, req.user.chiNhanhId)
  admin.log(req.user.id, 'Cập nhật nhân viên', 'nhan_vien', s.fullName)
  res.json(s)
}))
r.delete('/staff/:id', ...adm, h(async (req,res)=>{
  const out = await admin.deleteStaff(req.params.id, req.user.chiNhanhId)
  admin.log(req.user.id, 'Vô hiệu hoá nhân viên', 'nhan_vien', `#${req.params.id}`)
  res.json(out)
}))

// ===== Chi nhánh =====
r.get('/branches', ...adm, h(async (req,res)=>res.json(await admin.listBranches())))
r.post('/branches', ...adm, h(async (req,res)=>{
  const b = await admin.createBranch(req.body)
  admin.log(req.user.id, 'Thêm chi nhánh', 'chi_nhanh', b.name)
  res.status(201).json(b)
}))
r.put('/branches/:id', ...adm, h(async (req,res)=>{
  const b = await admin.updateBranch(req.params.id, req.body)
  admin.log(req.user.id, 'Cập nhật chi nhánh', 'chi_nhanh', b.name)
  res.json(b)
}))
r.delete('/branches/:id', ...adm, h(async (req,res)=>{
  const out = await admin.deleteBranch(req.params.id)
  admin.log(req.user.id, 'Xoá chi nhánh', 'chi_nhanh', `#${req.params.id}`)
  res.json(out)
}))

// ===== Nhật ký hệ thống =====
r.get('/audit', ...adm, h(async (req,res)=>res.json(await admin.listAudit())))

// ===== Điều kiện cho thuê =====
r.get('/conditions', ...adm, h(async (req,res)=>res.json(await admin.getConditions())))
r.put('/conditions', ...adm, h(async (req,res)=>{
  const out = await admin.saveConditions(req.body)
  admin.log(req.user.id, 'Cập nhật điều kiện cho thuê', 'quy_dinh_cho_thue', null)
  res.json(out)
}))

export default r