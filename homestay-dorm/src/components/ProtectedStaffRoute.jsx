import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Bảo vệ route dành cho nhân viên
// - allowedRoles: mảng các role được phép (vd: ['sale'] hoặc ['sale', 'manager'])
// - Nếu undefined → cho phép mọi nhân viên (bất kỳ role nào)
export default function ProtectedStaffRoute({ children, allowedRoles }) {
  const { user, loading, isStaff } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-soft">Đang tải...</div>
      </div>
    )
  }

  // Chưa đăng nhập → redirect tới trang login staff
  if (!user) {
    return <Navigate to="/staff/login" state={{ from: location.pathname }} replace />
  }

  // Đăng nhập rồi nhưng không phải nhân viên (là customer) → redirect tới login staff
  if (!isStaff()) {
    return <Navigate to="/staff/login" state={{ from: location.pathname }} replace />
  }

  // Có giới hạn role mà user không có role đúng → trang lỗi 403
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-4">🚫</div>
          <h1 className="font-display text-2xl font-bold mb-2">Không có quyền truy cập</h1>
          <p className="text-ink-soft mb-6">
            Trang này dành cho {allowedRoles.join(', ')}. Vai trò hiện tại của bạn là <strong>{user.role}</strong>.
          </p>
          <a href={`/staff/${user.role}/dashboard`} className="text-terracotta-500 font-semibold hover:underline">
            ← Về dashboard của tôi
          </a>
        </div>
      </div>
    )
  }

  return children
}