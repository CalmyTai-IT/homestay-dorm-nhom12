// staffUi.js — hằng số cấu hình + hàm thuần cho giao diện (UI helpers/labels).
// Tách từ data/mockStaff.js: CHỈ giữ các symbol còn dùng; đã loại bỏ dữ liệu mẫu & thao tác localStorage.

export const STAFF_ROLES = {
  SALE: 'sale',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
}

export const ROLE_LABELS = {
  sale: 'Nhân viên Sale',
  manager: 'Quản lý',
  accountant: 'Kế toán',
  admin: 'Quản trị hệ thống',
}

export const ROLE_COLORS = {
  sale: 'terracotta',
  manager: 'mint',
  accountant: 'gold',
  admin: 'ink',
}

// 3 tài khoản nhân viên mẫu

export const DEMO_STAFF = [
  {
    id: 'staff_sale_001',
    email: 'sale@homestay.vn',
    fullName: 'Trần Thị Mai',
    role: 'sale',
    branch: 'Quận 5',
    phone: '0901111111',
    avatar: 'M',
    joinedAt: '2024-03-15',
  },
  {
    id: 'staff_manager_001',
    email: 'manager@homestay.vn',
    fullName: 'Nguyễn Văn Hùng',
    role: 'manager',
    branch: 'Toàn hệ thống',
    phone: '0902222222',
    avatar: 'H',
    joinedAt: '2023-01-10',
  },
  {
    id: 'staff_accountant_001',
    email: 'accountant@homestay.vn',
    fullName: 'Lê Thị Hồng',
    role: 'accountant',
    branch: 'Toàn hệ thống',
    phone: '0903333333',
    avatar: 'H',
    joinedAt: '2023-06-20',
  },
  {
    id: 'staff_admin_001',
    email: 'admin@homestay.vn',
    fullName: 'Quản trị hệ thống',
    role: 'admin',
    branch: 'Toàn hệ thống',
    phone: '0900000004',
    avatar: 'A',
    joinedAt: '2023-01-01',
  },
]

// Tìm staff theo email (cho login)

export function getDefaultStaffHome(role) {
  const map = {
    sale: '/staff/sale/dashboard',
    manager: '/staff/manager/dashboard',
    accountant: '/staff/accountant/dashboard',
    admin: '/staff/admin/dashboard',
  }
  return map[role] || '/staff/login'
}