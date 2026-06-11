import { Router } from 'express'
import * as svc from '../services/bookingService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.post('/', authenticate, h(async (req,res)=>res.status(201).json(await svc.createBooking(req.body, req.user.id))))
r.get('/', authenticate, requireRole('sale','manager'), h(async (req,res)=>res.json(await svc.listBookings(req.query.status, req.user.chiNhanhId))))
r.get('/me', authenticate, h(async (req,res)=>res.json(await svc.myBookings(req.user.id))))
r.get('/me/full', authenticate, h(async (req,res)=>res.json(await svc.myBookingsFull(req.user.id))))
// ===== Luồng HỦY ĐƠN ĐÃ CỌC: Sale lập -> Quản lý duyệt -> Kế toán hoàn 80% =====
// (đặt TRƯỚC '/:code' để '/cancel-requests' không bị '/:code' nuốt mất)
r.get('/cancel-requests', authenticate, requireRole('sale','manager','accountant'),
  h(async (req,res)=>res.json(await svc.listCancelRequests(req.query.stage, req.user.chiNhanhId))))
r.post('/:code/cancel-request', authenticate, requireRole('sale'), h(async (req,res)=>{
  const out = await svc.requestCancelDeposit(req.params.code, req.user.id, req.body.lyDo)
  admin.log(req.user.id, 'Lập yêu cầu hủy cọc', 'phieu_dang_ky_thue', req.params.code)
  res.status(201).json(out)
}))
r.post('/:code/cancel-approve', authenticate, requireRole('manager'), h(async (req,res)=>{
  const approve = req.body.approve !== false
  const out = await svc.approveCancelDeposit(req.params.code, req.user.id, approve)
  admin.log(req.user.id, approve ? 'Duyệt hủy cọc' : 'Từ chối hủy cọc', 'phieu_dang_ky_thue', req.params.code)
  res.json(out)
}))
r.post('/:code/cancel-refund', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.refundCancelDeposit(req.params.code, req.user.id)
  admin.log(req.user.id, 'Hoàn cọc do hủy đơn', 'phieu_dang_ky_thue', req.params.code)
  res.json(out)
}))
r.get('/:code', authenticate, h(async (req,res)=>res.json(await svc.getBooking(req.params.code))))
r.patch('/:code/status', authenticate, requireRole('sale'), h(async (req,res)=>res.json(await svc.setStatus(req.params.code, req.body.status, req.body.extra))))
r.post('/:code/cancel', authenticate, h(async (req,res)=>res.json(await svc.cancelByCustomer(req.params.code, req.user.id, req.body.lyDo))))
export default r
