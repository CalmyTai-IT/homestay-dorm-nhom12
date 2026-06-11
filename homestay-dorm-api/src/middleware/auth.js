import { verifyToken } from '../utils/jwt.js'
import { unauthorized, forbidden } from '../utils/errors.js'

// Xác thực JWT -> gắn req.user = { id, role, email }
export function authenticate(req, _res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return next(unauthorized())
  try { req.user = verifyToken(token); next() }
  catch { next(unauthorized('Token không hợp lệ hoặc đã hết hạn')) }
}

// Phân quyền theo vai trò (thay cho RLS — kiểm soát ở tầng Express)
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden(`Yêu cầu vai trò: ${roles.join('/')}`))

// Như authenticate nhưng KHÔNG chặn khi thiếu/sai token.
// Dùng cho route phục vụ cả KHÁCH (không token / token khách) lẫn NHÂN VIÊN:
// nếu là nhân viên có token hợp lệ -> gắn req.user để áp lọc theo chi nhánh; nếu không -> bỏ qua.
export function authenticateOptional(req, _res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (token) { try { req.user = verifyToken(token) } catch { /* token hỏng -> coi như chưa đăng nhập */ } }
  next()
}
