import { createContext, useContext, useState, useEffect } from 'react'
import { api, setToken } from '@/lib/api'

// Context này quản lý trạng thái đăng nhập toàn ứng dụng
// Phân biệt 2 loại user: customer (khách) và staff (nhân viên)
const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth phải được dùng trong AuthProvider')
  }
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Khi app khởi động → khôi phục user từ localStorage RỒI xác thực token với server.
  // Nếu token đã hết hạn/không hợp lệ, đăng xuất ngay để UI không hiển thị "đã đăng nhập" giả
  // (tránh cảnh navbar hiện đã đăng nhập nhưng thao tác lại báo "Token không hợp lệ / hết phiên").
  useEffect(() => {
    let alive = true
    let stored = null
    try { stored = localStorage.getItem('homestay_user') } catch (e) { console.error('Lỗi đọc user từ localStorage:', e) }
    if (!stored) { setLoading(false); return }
    try { setUser(JSON.parse(stored)) } catch (e) { console.error('Lỗi đọc user từ localStorage:', e) }
    // Kiểm tra token còn hiệu lực (GET /auth/me). api.request() tự dọn token + user nếu gặp 401.
    api.me()
      .then(() => { if (alive) setLoading(false) })
      .catch(() => { if (alive) { setUser(null); setLoading(false) } })
    return () => { alive = false }
  }, [])

  // Login dùng cho khách hàng (customer)
  // userData: { id, email, fullName, phone, idNumber, gender, dateOfBirth }
  const login = (userData) => {
    const customerUser = { ...userData, role: 'customer' }
    setUser(customerUser)
    localStorage.setItem('homestay_user', JSON.stringify(customerUser))
  }

  // Login dùng cho nhân viên (staff)
  // staffData: { id, email, fullName, role: 'sale'|'manager'|'accountant', branch, avatar }
  const loginAsStaff = (staffData) => {
    setUser(staffData)
    localStorage.setItem('homestay_user', JSON.stringify(staffData))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('homestay_user')
  }

  const updateUser = (updates) => {
    const updated = { ...user, ...updates }
    setUser(updated)
    localStorage.setItem('homestay_user', JSON.stringify(updated))
  }

  // === HELPERS ===

  // user là khách hàng?
  const isCustomer = () => user?.role === 'customer'

  // user là nhân viên (bất kỳ role nào)?
  const isStaff = () => ['sale', 'manager', 'accountant', 'admin'].includes(user?.role)

  // user có role cụ thể không?
  const hasRole = (role) => user?.role === role

  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginAsStaff,
      logout,
      updateUser,
      loading,
      isCustomer,
      isStaff,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}