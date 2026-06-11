import { Router } from 'express'
import * as auth from '../services/authService.js'
import { authenticate } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.post('/staff/login', h(async (req,res)=>res.json(await auth.staffLogin(req.body.email, req.body.password))))
r.post('/customer/login', h(async (req,res)=>res.json(await auth.customerLogin(req.body.email, req.body.password))))
r.post('/customer/register', h(async (req,res)=>res.status(201).json(await auth.customerRegister(req.body))))
r.post('/forgot-password', h(async (req,res)=>res.json(await auth.requestPasswordReset(req.body.email, req.body.soDienThoai))))
r.post('/reset-password', h(async (req,res)=>res.json(await auth.resetPassword(req.body.resetToken, req.body.newPassword))))
r.get('/me', authenticate, (req,res)=>res.json(req.user))
// Self-service hồ sơ nhân viên (trang Settings)
r.get('/profile', authenticate, h(async (req,res)=>res.json(await auth.getStaffProfile(req.user.id))))
r.put('/profile', authenticate, h(async (req,res)=>res.json(await auth.updateStaffProfileInfo(req.user.id, req.body))))
r.post('/change-password', authenticate, h(async (req,res)=>res.json(await auth.changeStaffPassword(req.user.id, req.body.current, req.body.next))))
r.put('/preferences', authenticate, h(async (req,res)=>res.json(await auth.saveStaffPrefs(req.user.id, req.body.preferences))))
export default r
