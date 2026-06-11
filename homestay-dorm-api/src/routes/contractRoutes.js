import { Router } from 'express'
import * as svc from '../services/contractService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.post('/', authenticate, requireRole('manager'), h(async (req,res)=>{
  const c = await svc.createContract(req.body, req.user.id)
  admin.log(req.user.id, 'Lập hợp đồng', 'hop_dong_thue', c?.ma_hop_dong || c?.code || null)
  res.status(201).json(c)
}))
r.get('/', authenticate, requireRole('sale','manager','accountant'), h(async (req,res)=>res.json(await svc.listContracts(req.query.status, req.user.chiNhanhId))))
r.get('/ready-deposits', authenticate, requireRole('manager'), h(async (req,res)=>res.json(await svc.depositsReadyForContract())))
r.post('/:code/sign', authenticate, requireRole('manager','accountant'), h(async (req,res)=>{
  const out = await svc.signContract(req.params.code, req.user.id)
  admin.log(req.user.id, 'Ký hợp đồng', 'hop_dong_thue', req.params.code)
  res.json(out)
}))
export default r
