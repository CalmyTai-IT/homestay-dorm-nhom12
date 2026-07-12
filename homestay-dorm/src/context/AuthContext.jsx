import { createContext, useContext, useState, useEffect } from 'react'
import { setToken } from '@/lib/api'

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

  // Khi app khởi động → đọc user đã login từ localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('homestay_user')
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Lỗi đọc user từ localStorage:', e)
    }
    setLoading(false)
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