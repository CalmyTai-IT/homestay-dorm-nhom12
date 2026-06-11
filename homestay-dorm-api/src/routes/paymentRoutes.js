import { Router } from 'express'
import * as repo from '../repositories/paymentRepo.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.get('/', authenticate, requireRole('accountant','manager'), h(async (req,res)=>res.json(await repo.list(req.query.loai))))
r.get('/summary', authenticate, requireRole('accountant','manager'), h(async (_req,res)=>res.json(await repo.summary())))
export default r
