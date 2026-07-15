import { Router } from 'express'
import * as admin from '../services/adminService.js'
import { authenticate } from '../middleware/auth.js'
const r = Router()
const h = fn => (req,res,next)=>fn(req,res,next).catch(next)
// Danh sách chi nhánh (CHỈ ĐỌC) cho MỌI nhân viên đã đăng nhập — phục vụ dropdown chọn
// chi nhánh khi Quản lý thêm/sửa phòng. Việc TẠO/SỬA/XOÁ chi nhánh vẫn chỉ dành cho 'admin'
// (xem adminRoutes.js) — ở đây không lộ thao tác ghi.
r.get('/', authenticate, h(async (_req,res)=>res.json(await admin.listBranches())))
export default r