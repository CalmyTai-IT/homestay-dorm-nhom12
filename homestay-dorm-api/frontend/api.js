// Module gọi API dùng chung cho frontend React (đặt tại src/lib/api.js)
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const tokenKey = 'homestay_token'
export const getToken = () => localStorage.getItem(tokenKey)
export const setToken = (t) => t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey)

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`)
  return data
}

export const api = {
  // auth
  staffLogin: (email, password) => request('/auth/staff/login', { method: 'POST', body: { email, password } }),
  customerLogin: (email, password) => request('/auth/customer/login', { method: 'POST', body: { email, password } }),
  customerRegister: (dto) => request('/auth/customer/register', { method: 'POST', body: dto }),
  // rooms
  getRooms: (q = {}) => request('/rooms?' + new URLSearchParams(q)),
  getRoom: (id) => request('/rooms/' + id),
  // bookings
  createBooking: (dto) => request('/bookings', { method: 'POST', body: dto }),
  myBookings: () => request('/bookings/me'),
  listBookings: (status) => request('/bookings' + (status ? `?status=${status}` : '')),
  setBookingStatus: (code, status) => request(`/bookings/${code}/status`, { method: 'PATCH', body: { status } }),
  // deposits
  createDeposit: (dto) => request('/deposits', { method: 'POST', body: dto }),
  listDeposits: (status) => request('/deposits' + (status ? `?status=${status}` : '')),
  confirmDeposit: (code, txn) => request(`/deposits/${code}/confirm`, { method: 'POST', body: txn }),
  // contracts
  createContract: (dto) => request('/contracts', { method: 'POST', body: dto }),
  listContracts: (status) => request('/contracts' + (status ? `?status=${status}` : '')),
  signContract: (code) => request(`/contracts/${code}/sign`, { method: 'POST' }),
  // checkouts
  registerCheckout: (dto) => request('/checkouts', { method: 'POST', body: dto }),
  inspectCheckout: (code, dto) => request(`/checkouts/${code}/inspect`, { method: 'POST', body: dto }),
  reconcileCheckout: (code, dto) => request(`/checkouts/${code}/reconcile`, { method: 'POST', body: dto }),
  settleCheckout: (code) => request(`/checkouts/${code}/settle`, { method: 'POST' }),
  // payments
  paymentSummary: () => request('/payments/summary'),
}
