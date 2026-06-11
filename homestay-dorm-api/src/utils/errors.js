// Lỗi nghiệp vụ có mã HTTP
export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export const badRequest = (m) => new AppError(400, m)
export const unauthorized = (m='Chưa đăng nhập') => new AppError(401, m)
export const forbidden = (m='Không có quyền') => new AppError(403, m)
export const notFound = (m='Không tìm thấy') => new AppError(404, m)
export const conflict = (m) => new AppError(409, m)
