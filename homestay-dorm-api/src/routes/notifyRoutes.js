import { Router } from 'express'
import * as svc from '../services/notifyService.js'
import { authenticate } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
const isCustomer = (req) => req.user?.role === 'customer'

// Danh sách thông báo của người đang đăng nhập (tự phân biệt khách / nhân viên)
r.get('/', authenticate, h(async (req,res)=>{
  const list = isCustomer(req)
    ? await svc.listForCustomer(req.user.id)
    : await svc.listForStaff(req.user.role, req.user.id)
  res.json(list)
}))
r.post('/:id/read', authenticate, h(async (req,res)=>{ await svc.markRead(req.params.id); res.json({ ok: true }) }))
r.post('/read-all', authenticate, h(async (req,res)=>{
  if (isCustomer(req)) await svc.markAllCustomer(req.user.id)
  else await svc.markAllStaff(req.user.role, req.user.id)
  res.json({ ok: true })
}))
export default r
