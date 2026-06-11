import { Router } from 'express'
import * as rooms from '../services/roomService.js'
import * as admin from '../services/adminService.js'
import { authenticate, authenticateOptional, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.get('/', authenticateOptional, h(async (req,res)=>{
  const q = { ...req.query }
  const u = req.user
  // Nhân viên thuộc 1 chi nhánh -> CHỈ thấy phòng chi nhánh đó.
  // Khách hàng & nhân viên toàn hệ thống (chiNhanhId=null) -> thấy tất cả.
  if (u && u.role !== 'customer' && u.chiNhanhId != null) q.chiNhanhId = u.chiNhanhId
  res.json(await rooms.searchRooms(q))
}))
r.get('/:id', h(async (req,res)=>res.json(await rooms.getRoom(req.params.id))))
// Quản lý phòng (UC-HT-13) — chỉ Quản lý, và chỉ trong chi nhánh mình quản lý
r.post('/', authenticate, requireRole('manager'), h(async (req,res)=>{
  const room = await rooms.createRoom(req.body, req.user)
  admin.log(req.user.id, 'Thêm phòng', 'phong', req.body.id)
  res.status(201).json(room)
}))
r.put('/:id', authenticate, requireRole('manager'), h(async (req,res)=>{
  const room = await rooms.updateRoom(req.params.id, req.body, req.user)
  admin.log(req.user.id, 'Cập nhật phòng', 'phong', req.params.id)
  res.json(room)
}))
r.delete('/:id', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await rooms.deleteRoom(req.params.id, req.user)
  admin.log(req.user.id, 'Xoá phòng', 'phong', req.params.id)
  res.json(out)
}))
export default r
