import { Router } from 'express'
import * as svc from '../services/statsService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req, res, next) => fn(req, res, next).catch(next)

r.get('/sale', authenticate, requireRole('sale', 'manager'), h(async (req, res) => res.json(await svc.sale(req.user.chiNhanhId))))
r.get('/manager', authenticate, requireRole('manager'), h(async (req, res) => res.json(await svc.manager(req.user.chiNhanhId))))
r.get('/accountant', authenticate, requireRole('accountant', 'manager'), h(async (req, res) => res.json(await svc.accountant(req.user.chiNhanhId))))

export default r
