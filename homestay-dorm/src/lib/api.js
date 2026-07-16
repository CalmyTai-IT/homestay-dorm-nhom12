// src/lib/api.js — module gọi API dùng chung cho frontend React
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const tokenKey = 'homestay_token'
export const getToken = () => localStorage.getItem(tokenKey)
export const setToken = (t) => t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey)

// Các endpoint KHÔNG cần đăng nhập: 401 ở đây là do sai thông tin (vd sai mật khẩu),
// KHÔNG phải hết phiên -> giữ nguyên thông báo gốc, không đăng xuất.
const PUBLIC_AUTH_PATHS = [
  '/auth/staff/login', '/auth/customer/login', '/auth/customer/register',
  '/auth/forgot-password', '/auth/reset-password',
]

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // 401 trên route CẦN đăng nhập = token hết hạn/không hợp lệ -> dọn phiên (token + user)
    // để giao diện không còn hiển thị "đã đăng nhập" giả và yêu cầu đăng nhập lại.
    if (res.status === 401 && !PUBLIC_AUTH_PATHS.includes(path.split('?')[0])) {
      setToken(null)
      try { localStorage.removeItem('homestay_user') } catch { /* ignore */ }
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    throw new Error(data.error || `Lỗi ${res.status}`)
  }
  return data
}

// Sau khi đăng nhập/đăng ký: lưu token + chuẩn hoá user (thêm fullName cho khớp UI cũ)
const GENDER_VN = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }
function saveAuth(data) {
  if (data?.token) setToken(data.token)
  const u = data?.user
  if (u) {
    if (!u.fullName) u.fullName = u.hoTen || u.email
    if (!u.phone && u.soDienThoai) u.phone = u.soDienThoai
    if (!u.idNumber && u.soGiayTo) u.idNumber = u.soGiayTo
    if (!u.dateOfBirth && u.ngaySinh) u.dateOfBirth = u.ngaySinh
    if (!u.gender && u.gioiTinh) u.gender = GENDER_VN[u.gioiTinh] || u.gioiTinh
  }
  return data
}

export const api = {
  // ===== AUTH (tự lưu token) =====
  staffLogin: async (email, password) => saveAuth(await request('/auth/staff/login', { method: 'POST', body: { email, password } })),
  customerLogin: async (email, password) => saveAuth(await request('/auth/customer/login', { method: 'POST', body: { email, password } })),
  customerRegister: async (dto) => saveAuth(await request('/auth/customer/register', { method: 'POST', body: dto })),
  me: () => request('/auth/me'),
  // Quên / đặt lại mật khẩu (KHÔNG lưu token — resetToken chỉ dùng cho bước đổi mật khẩu)
  forgotPassword: (email, soDienThoai) => request('/auth/forgot-password', { method: 'POST', body: { email, soDienThoai } }),
  resetPassword: (resetToken, newPassword) => request('/auth/reset-password', { method: 'POST', body: { resetToken, newPassword } }),

  // ===== ROOMS =====
  getRooms: (q = {}) => request('/rooms?' + new URLSearchParams(q)).then(rs => rs.map(mapRoom)),
  getRoom: (id) => request('/rooms/' + id).then(mapRoom),
  // Quản lý phòng (UC-HT-13). Gửi nguyên shape form; backend tự map sang cột DB.
  createRoom: (dto) => request('/rooms', { method: 'POST', body: dto }),
  updateRoom: (id, dto) => request('/rooms/' + id, { method: 'PUT', body: dto }),
  deleteRoom: (id) => request('/rooms/' + id, { method: 'DELETE' }),

  // ===== CẤU HÌNH HỆ THỐNG (cau_hinh_he_thong) =====
  getConfig: () => request('/config'),
  saveConfig: (dto) => request('/config', { method: 'PUT', body: dto }),

  // ===== SETTINGS: hồ sơ nhân viên =====
  getStaffProfile: () => request('/auth/profile'),
  updateStaffProfile: (dto) => request('/auth/profile', { method: 'PUT', body: dto }),
  changePassword: (current, next) => request('/auth/change-password', { method: 'POST', body: { current, next } }),
  savePreferences: (preferences) => request('/auth/preferences', { method: 'PUT', body: { preferences } }),

  // ===== Quản lý hệ thống (Quản lý) =====
  listStaff: () => request('/admin/staff'),
  createStaff: (dto) => request('/admin/staff', { method: 'POST', body: dto }),
  updateStaff: (id, dto) => request('/admin/staff/' + id, { method: 'PUT', body: dto }),
  deleteStaff: (id) => request('/admin/staff/' + id, { method: 'DELETE' }),
  listBranches: () => request('/admin/branches'),
  // Danh sách chi nhánh (chỉ đọc) cho nhân viên — dùng cho dropdown chọn chi nhánh khi thêm/sửa phòng
  staffBranches: () => request('/branches'),
  createBranch: (dto) => request('/admin/branches', { method: 'POST', body: dto }),
  updateBranch: (id, dto) => request('/admin/branches/' + id, { method: 'PUT', body: dto }),
  deleteBranch: (id) => request('/admin/branches/' + id, { method: 'DELETE' }),
  listAudit: () => request('/admin/audit'),
  getConditions: () => request('/admin/conditions'),
  saveConditions: (dto) => request('/admin/conditions', { method: 'PUT', body: dto }),

  // ===== Thông báo (chuông) =====
  listNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // ===== Bàn giao phòng =====
  listHandovers: () => request('/handovers'),
  getHandover: (id) => request(`/handovers/${id}`),
  completeHandover: (id, dto) => request(`/handovers/${id}/complete`, { method: 'POST', body: dto }),

  // ===== BOOKINGS =====
  createBooking: (dto) => request('/bookings', { method: 'POST', body: dto }),
  myBookings: () => request('/bookings/me').then(rs => rs.map(mapBooking)),
  myBookingsFull: () => request('/bookings/me/full'),
  listBookings: (status) => request('/bookings' + (status ? `?status=${status}` : '')),
  setBookingStatus: (code, status, extra) => request(`/bookings/${code}/status`, { method: 'PATCH', body: { status, extra } }),
  // Lịch xem phòng (bảng lich_xem_phong): Sale sắp xếp/dời lịch, đánh dấu đã xem, xem lịch sử.
  scheduleViewing: (code, dto) => request(`/bookings/${code}/schedule-viewing`, { method: 'POST', body: dto }),
  markViewed: (code) => request(`/bookings/${code}/mark-viewed`, { method: 'POST' }),
  listViewings: (code) => request(`/bookings/${code}/viewings`),
  // Khách tự hủy đơn của mình (trước khi ký HĐ). Backend giải phóng giường + đánh dấu hoàn 80% nếu đã cọc.
  cancelBooking: (code, lyDo) => request(`/bookings/${code}/cancel`, { method: 'POST', body: { lyDo } }),
  // Luồng hủy đơn ĐÃ CỌC (Sale -> Quản lý -> Kế toán hoàn 80%)
  requestCancelDeposit: (code, lyDo) => request(`/bookings/${code}/cancel-request`, { method: 'POST', body: { lyDo } }),
  approveCancelDeposit: (code, approve = true) => request(`/bookings/${code}/cancel-approve`, { method: 'POST', body: { approve } }),
  refundCancelDeposit: (code) => request(`/bookings/${code}/cancel-refund`, { method: 'POST' }),
  listCancelRequests: (stage) => request('/bookings/cancel-requests' + (stage ? `?stage=${stage}` : '')),
  // Lấy chi tiết 1 phiếu của khách (kèm thông tin phòng) — dùng cho trang chi tiết đơn & thanh toán
  bookingDetail: async (code) => {
    const regs = await request('/bookings/me/full')
    const reg = (regs || []).find(r => r.ma_phieu === code)
    if (!reg) return { booking: null, room: null }
    const booking = mapFullBooking(reg)
    let room = null
    const roomRef = booking.roomDbId ?? booking.roomId
    if (roomRef != null) {
      try { room = mapRoom(await request('/rooms/' + roomRef)) } catch { room = null }
    }
    return { booking, room }
  },

  // ===== DEPOSITS =====
  createDeposit: (dto) => request('/deposits', { method: 'POST', body: dto }),
  listDeposits: (status) => request('/deposits' + (status ? `?status=${status}` : '')),
  confirmDeposit: (code, txn) => request(`/deposits/${code}/confirm`, { method: 'POST', body: txn }),
  reconcileDeposit: (code, body) => request(`/deposits/${code}/reconcile`, { method: 'POST', body }),
  chooseCashPayment: (code) => request(`/deposits/${code}/cash`, { method: 'POST' }),
  cancelDeposit: (code, lyDo) => request(`/deposits/${code}/cancel`, { method: 'POST', body: { lyDo } }),
  // Khách gửi ảnh chứng từ chuyển khoản (base64 data URL) lên phiếu cọc để Kế toán đối soát
  submitDepositProof: (code, anh, taiKhoan) => request(`/deposits/${code}/proof`, { method: 'POST', body: { anh, taiKhoan } }),
  // Cọc bị TỪ CHỐI đã nhận tiền -> Kế toán hoàn cọc
  listRejectedRefunds: () => request('/deposits/rejected-refunds'),
  refundRejectedDeposit: (code) => request(`/deposits/${code}/refund-rejected`, { method: 'POST' }),
  // Thuê nhóm — hoàn cọc dư do giảm giường (người không đủ điều kiện)
  listPartialRefunds: () => request('/deposits/partial-refunds'),
  refundPartialDeposit: (code) => request(`/deposits/${code}/refund-partial`, { method: 'POST' }),

  // ===== CONTRACTS =====
  createContract: (dto) => request('/contracts', { method: 'POST', body: dto }),
  listContracts: (status) => request('/contracts' + (status ? `?status=${status}` : '')),
  readyDeposits: () => request('/contracts/ready-deposits'),
  signContract: (code) => request(`/contracts/${code}/sign`, { method: 'POST' }),

  // ===== KIỂM TRA ĐIỀU KIỆN LƯU TRÚ (Quản lý) — nhóm & cá nhân =====
  getDepositMembers: (code) => request(`/deposits/${code}/members`),
  checkDepositMembers: (code, body) => request(`/deposits/${code}/check-members`, { method: 'POST', body }),
  checkDepositIndividual: (code, body) => request(`/deposits/${code}/check-individual`, { method: 'POST', body }),

  // ===== CHECKOUTS / REFUND =====
  registerCheckout: (dto) => request('/checkouts', { method: 'POST', body: dto }),
  // Khách tự yêu cầu trả phòng sớm cho hợp đồng đang hiệu lực
  requestCheckout: (contractCode, lyDo) => request('/checkouts/me', { method: 'POST', body: { contractCode, lyDo } }),
  listCheckouts: (status) => request('/checkouts' + (status ? `?status=${status}` : '')),
  inspectCheckout: (code, dto) => request(`/checkouts/${code}/inspect`, { method: 'POST', body: dto }),
  reconcileCheckout: (code, dto) => request(`/checkouts/${code}/reconcile`, { method: 'POST', body: dto }),
  settleCheckout: (code) => request(`/checkouts/${code}/settle`, { method: 'POST' }),

  // ===== PAYMENTS =====
  statsSale: () => request('/stats/sale'),
  statsManager: () => request('/stats/manager'),
  statsAccountant: () => request('/stats/accountant'),
  payments: (loai) => request('/payments' + (loai ? `?loai=${loai}` : '')),
  paymentSummary: () => request('/payments/summary'),
}

// ===== Bộ chuyển dữ liệu Phòng: API (snake_case) -> shape UI (camelCase) =====
const GENDER = { nam: 'Nam', nu: 'Nữ', khong_quy_dinh: 'Hỗn hợp' }
const AMEN = { dieu_hoa: 'Điều hòa', gui_xe: 'Gửi xe', wifi: 'Wifi', tu_rieng: 'Tủ riêng',
               bep_rieng: 'Bếp riêng', may_giat: 'Máy giặt', ban_cong: 'Ban công' }
export const mapRoom = (r) => {
  // Khi tìm danh sách: API trả sẵn giuong_trong. Khi xem chi tiết: tự đếm từ mảng giuong.
  const trong = Array.isArray(r.giuong)
    ? r.giuong.filter(g => g.trang_thai === 'trong').length
    : Number(r.giuong_trong ?? 0)
  return {
    id: r.id,                 // id số (định danh duy nhất toàn hệ thống — dùng cho URL/CRUD/đặt phòng)
    code: r.ma_phong,         // mã phòng hiển thị (chỉ duy nhất trong 1 chi nhánh)
    branch: r.ten_chi_nhanh,
    address: r.dia_chi,
    type: r.loai_phong === 'nguyen_can' ? 'Phòng nguyên căn' : 'Phòng ghép',
    roomType: r.loai_phong,   // 'nguyen_can' (thuê nguyên căn) | 'o_ghep' (ở ghép theo giường)
    capacity: Number(r.suc_chua),
    bedsAvailable: trong,
    isFullyAvailable: trong === Number(r.suc_chua),
    gender: GENDER[r.gioi_tinh_ap_dung] || 'Hỗn hợp',
    pricePerBed: Number(r.gia_thue_giuong),
    priceWholeRoom: Number(r.gia_thue_nguyen_phong),
    emoji: Array.isArray(r.hinh_anh) ? r.hinh_anh[0] : '🛏️',
    amenities: Object.keys(r.tien_ich || {}).map(k => AMEN[k] || k),
    description: r.mo_ta,
    rating: Number(r.danh_gia || 0),
    reviewCount: Number(r.so_luot_danh_gia || 0),
    maintenance: r.trang_thai === 'bao_tri',
    status: r.trang_thai,   // 'hoat_dong' | 'bao_tri' | 'ngung' (đã xoá)
  }
}

// ===== Bộ chuyển Phiếu đăng ký (API) -> shape "booking" mà UI đang dùng =====
const BOOKING_STATUS = {
  cho_xem_phong: 'pending_confirm',
  da_xem_phong: 'viewing_scheduled',
  da_dat_coc: 'deposited',
  huy: 'cancelled',
}
export const mapBooking = (b) => {
  const tc = b.tieu_chi || {}
  return {
    code: b.ma_phieu,
    roomId: tc.roomId || null,
    status: BOOKING_STATUS[b.trang_thai] || 'pending_confirm',
    createdAt: b.created_at,
    rentalCriteria: {
      rentType: tc.rentType,
      numberOfBeds: tc.numberOfBeds,
      numberOfPeople: tc.numberOfPeople,
      duration: tc.duration ?? b.thoi_han_thue,
      moveInDate: tc.moveInDate || b.ngay_du_kien_vao_o,
      notes: tc.notes,
    },
    isDemo: false,
  }
}

// ===== Bộ chuyển "phiếu đầy đủ" (/bookings/me/full) -> shape chi tiết mà các trang khách dùng =====
// Khác mapBooking ở chỗ kèm cọc/hợp đồng/lịch hẹn để trang chi tiết + thanh toán hiển thị đầy đủ.
export const mapFullBooking = (reg) => {
  const tc = reg.tieu_chi || {}
  const b = {
    code: reg.ma_phieu,
    status: reg.ui_status,            // backend đã suy ra trạng thái 6 bước
    roomId: tc.roomId || null,
    roomDbId: tc.roomDbId ?? null,    // id số của phòng (để tra cứu khi mã trùng giữa chi nhánh)
    isDemo: false,
    createdAt: reg.created_at,
    rentalCriteria: {
      rentType: tc.rentType,
      numberOfBeds: tc.numberOfBeds,
      numberOfPeople: tc.numberOfPeople,
      duration: reg.thoi_han_thue ?? tc.duration,
      moveInDate: reg.ngay_du_kien_vao_o || tc.moveInDate,
      priorities: tc.priorities || [],
      notes: tc.notes,
    },
    // Lịch hẹn xem phòng: ưu tiên bảng lich_xem_phong (reg.viewing), fallback tieu_chi cho dữ liệu cũ.
    scheduledViewing: (() => {
      const v = reg.viewing || tc.scheduledViewing
      return v ? { date: v.date, time: v.time, staffName: v.staffName || 'phụ trách' } : null
    })(),
    cancelReason: tc.rejectReason || null,
    cancelledAt: reg.ui_status === 'cancelled' ? reg.created_at : null,
  }
  if (reg.deposit) {
    b.depositInfo = {
      amount: Number(reg.deposit.so_tien_coc),
      deadline: reg.deposit.han_thanh_toan,
      paymentCode: reg.deposit.ma_phieu,
      depositCode: reg.deposit.ma_phieu,
    }
  }
  if (reg.contract) {
    b.contractInfo = { code: reg.contract.ma_hop_dong, contractCode: reg.contract.ma_hop_dong, endDate: reg.contract.ngay_ket_thuc }
  }
  // Trạng thái yêu cầu trả phòng (nếu có) + cờ đang chờ xử lý
  b.checkoutPending = !!reg.checkout_pending
  // Luồng hủy đơn đã cọc (Sale->QL->KT): cờ đang xử lý + thông tin hoàn cọc khi xong
  b.cancelStage = tc.cancelStage || null
  b.cancelPending = tc.cancelStage === 'pending_manager' || tc.cancelStage === 'pending_accountant'
  b.cancelRefund = tc.cancelRefundAmount != null
    ? { amount: Number(tc.cancelRefundAmount), rate: Number(tc.cancelRefundRate || 0) }
    : null
  if (reg.checkout) {
    b.checkoutInfo = { code: reg.checkout.ma_phieu, status: reg.checkout.trang_thai, createdAt: reg.checkout.ngay_dang_ky }
  }
  return b
}