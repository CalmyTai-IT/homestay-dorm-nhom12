import { Router } from 'express'
import * as svc from '../services/refundService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.post('/', authenticate, requireRole('sale'), h(async (req,res)=>{
  const out = await svc.registerCheckout(req.body, req.user.id)
  admin.log(req.user.id, 'Đăng ký trả phòng', 'phieu_tra_phong', out?.ma_phieu || out?.code || null)
  res.status(201).json(out)
}))
// Khách tự đăng ký trả phòng sớm (UC-HT-09, do khách khởi tạo) — chỉ cần đăng nhập
r.post('/me', authenticate, h(async (req,res)=>{
  const out = await svc.registerCheckoutByCustomer(req.body.contractCode, req.user.id, req.body.lyDo)
  res.status(201).json(out)
}))
r.get('/', authenticate, requireRole('sale','manager','accountant'), h(async (req,res)=>res.json(await svc.listCheckouts(req.query.status, req.user.chiNhanhId))))
r.post('/:code/inspect', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await svc.inspect(req.params.code, req.body, req.user.id)
  admin.log(req.user.id, 'Kiểm tra trả phòng', 'phieu_tra_phong', req.params.code)
  res.json(out)
}))
r.post('/:code/reconcile', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.reconcile(req.params.code, req.body, req.user.id)
  admin.log(req.user.id, 'Đối soát hoàn cọc', 'phieu_tra_phong', req.params.code)
  res.json(out)
}))
r.post('/:code/settle', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.settle(req.params.code, req.user.id)
  admin.log(req.user.id, 'Hoàn cọc', 'phieu_tra_phong', req.params.code)
  res.json(out)
}))
export default r
