import { Router } from 'express'
import * as svc from '../services/depositService.js'
import * as group from '../services/groupService.js'
import * as admin from '../services/adminService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
r.post('/', authenticate, requireRole('sale'), h(async (req,res)=>{
  const d = await svc.createDeposit(req.body, req.user.id)
  admin.log(req.user.id, 'Lập phiếu đặt cọc', 'phieu_dat_coc', d?.ma_phieu || d?.code || null)
  res.status(201).json(d)
}))
r.get('/', authenticate, requireRole('sale','manager','accountant'), h(async (req,res)=>res.json(await svc.listDeposits(req.query.status, req.user.chiNhanhId))))
// Cọc bị TỪ CHỐI đã nhận tiền & chưa hoàn -> Kế toán xử lý (đặt TRƯỚC '/:code/...')
r.get('/rejected-refunds', authenticate, requireRole('accountant','manager'), h(async (req,res)=>
  res.json(await svc.listRejectedRefunds(req.user.chiNhanhId))))
// Hàng đợi HOÀN CỌC GIẢM GIƯỜNG (thuê nhóm) -> Kế toán xử lý (đặt TRƯỚC '/:code/...')
r.get('/partial-refunds', authenticate, requireRole('accountant','manager'), h(async (req,res)=>
  res.json(await svc.listPartialRefunds(req.user.chiNhanhId))))
r.post('/:code/refund-partial', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.refundPartial(req.params.code, req.user.id)
  admin.log(req.user.id, 'Hoàn cọc giảm giường (nhóm)', 'phieu_dat_coc', req.params.code)
  res.json(out)
}))
r.post('/:code/refund-rejected', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.refundRejected(req.params.code, req.user.id)
  admin.log(req.user.id, 'Hoàn cọc do từ chối', 'phieu_dat_coc', req.params.code)
  res.json(out)
}))
r.post('/:code/reconcile', authenticate, requireRole('accountant'), h(async (req,res)=>{
  const out = await svc.reconcileDeposit(req.params.code, req.body, req.user.id)
  admin.log(req.user.id, 'Đối soát cọc', 'phieu_dat_coc', `${req.params.code} · ${out.result}`)
  res.json(out)
}))
r.post('/:code/confirm', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await svc.confirmPayment(req.params.code, req.body, req.user.id)
  admin.log(req.user.id, 'Chốt cọc', 'phieu_dat_coc', req.params.code)
  res.json(out)
}))
r.post('/:code/cancel', authenticate, requireRole('sale','accountant','manager'), h(async (req,res)=>{
  const out = await svc.cancelDeposit(req.params.code, req.body.lyDo, req.user.id)
  admin.log(req.user.id, 'Hủy phiếu cọc', 'phieu_dat_coc', req.params.code)
  res.json(out)
}))
// ===== THUÊ THEO NHÓM: kiểm tra điều kiện lưu trú từng thành viên (Quản lý) =====
r.get('/:code/members', authenticate, requireRole('manager'),
  h(async (req,res)=>res.json(await group.membersForDeposit(req.params.code))))
r.post('/:code/check-members', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await group.checkAndDecide(req.params.code, req.body, req.user.id)
  admin.log(req.user.id,
    out.decision === 'cancelled' ? 'Hủy thuê nhóm (điều kiện lưu trú)' : 'Kiểm tra điều kiện lưu trú nhóm',
    'phieu_dat_coc', req.params.code)
  res.json(out)
}))
// ===== THUÊ CÁ NHÂN: kiểm tra điều kiện lưu trú của khách (Quản lý) =====
r.post('/:code/check-individual', authenticate, requireRole('manager'), h(async (req,res)=>{
  const out = await group.checkIndividual(req.params.code, req.body, req.user.id)
  admin.log(req.user.id,
    out.decision === 'rejected' ? 'Từ chối ký (điều kiện lưu trú cá nhân)' : 'Kiểm tra điều kiện lưu trú cá nhân',
    'phieu_dat_coc', req.params.code)
  res.json(out)
}))
r.post('/:code/proof', authenticate, h(async (req,res)=>res.json(await svc.attachProof(req.params.code, req.user.id, req.body.anh, req.body.taiKhoan))))
r.post('/:code/cash', authenticate, h(async (req,res)=>res.json(await svc.chooseCash(req.params.code, req.user.id))))
export default r