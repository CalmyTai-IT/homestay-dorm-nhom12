import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Component bọc các trang cần đăng nhập
// Nếu chưa login → redirect về /login và lưu lại đường dẫn để sau khi login quay lại
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Đang kiểm tra localStorage → hiện loading
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-ink-soft">Đang tải...</div>
      </div>
    )
  }

  // Chưa đăng nhập → redirect, kèm theo "from" để biết quay lại đâu
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return children
}