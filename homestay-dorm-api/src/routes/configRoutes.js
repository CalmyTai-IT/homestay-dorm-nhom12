import { Router } from 'express'
import * as cfg from '../services/configService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.get('/', authenticate, h(async (req,res)=>res.json(await cfg.getConfig(req.user.chiNhanhId))))
r.put('/', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await cfg.saveConfig(req.body, req.user.chiNhanhId)
  admin.log(req.user.id, 'Cập nhật cấu hình hệ thống', 'cau_hinh_he_thong', null)
  res.json(out)
}))
export default r
