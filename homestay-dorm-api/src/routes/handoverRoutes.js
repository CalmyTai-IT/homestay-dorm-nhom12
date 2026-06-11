import { Router } from 'express'
import * as svc from '../services/handoverService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)

r.get('/', authenticate, requireRole('manager'), h(async (req,res)=>res.json(await svc.listHandovers(req.user.chiNhanhId))))
r.get('/:id', authenticate, requireRole('manager'), h(async (req,res)=>res.json(await svc.getHandover(req.params.id))))
r.post('/:id/complete', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await svc.completeHandover(req.params.id, req.body, req.user.id)
  admin.log(req.user.id, 'Hoàn tất bàn giao', 'bien_ban_ban_giao', String(req.params.id))
  res.json(out)
}))
export default r
