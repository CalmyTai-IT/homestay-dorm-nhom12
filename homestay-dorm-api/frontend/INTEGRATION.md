# Nối frontend React với API (thay mock + localStorage)

## 1. Cấu hình
- Copy `api.js` vào `src/lib/api.js`.
- Thêm `.env` ở frontend: `VITE_API_URL=http://localhost:4000/api`
- Chạy backend (`npm start`) song song với `npm run dev` của Vite.

## 2. AuthContext — đổi login sang API
```jsx
import { api, setToken } from '@/lib/api'
const loginAsStaff = async (email, password) => {
  const { token, user } = await api.staffLogin(email, password)
  setToken(token); setUser(user)
}
const login = async (email, password) => {
  const { token, user } = await api.customerLogin(email, password)
  setToken(token); setUser(user)
}
const logout = () => { setToken(null); setUser(null) }
```

## 3. Ví dụ RegisterRentalPage.handleSubmit — thay localStorage bằng API
```jsx
import { api } from '@/lib/api'
const handleSubmit = async () => {
  setSubmitError('')
  // ... giữ nguyên phần validate bước 1 & 2 ...
  try {
    const booking = await api.createBooking({
      tieuChi: {
        rentType: rentalCriteria.rentType,
        numberOfBeds: rentalCriteria.numberOfBeds,
        numberOfPeople: rentalCriteria.numberOfPeople,
        moveInDate: rentalCriteria.moveInDate,
        notes: rentalCriteria.notes,
      },
      ngayVaoO: rentalCriteria.moveInDate,
      thoiHan: rentalCriteria.duration,
      chiNhanhId: null, // hoặc id chi nhánh của phòng
    })
    navigate(`/booking-success/${booking.ma_phieu}`)
  } catch (e) {
    setSubmitError(e.message || 'Không gửi được đơn. Vui lòng thử lại.')
  }
}
```

## 4. Ví dụ SaleDepositsPage — lập phiếu cọc
```jsx
const slip = await api.createDeposit({
  roomId: booking.roomId, rentType: booking.rentType,
  numberOfBeds: booking.numberOfBeds, khachHangId: booking.khachHangId,
  bookingCode: booking.code,
})
// tiền cọc do backend tính theo công thức đề, trả về slip.so_tien_coc
```

## 5. Mẫu các trang còn lại
- ManagerContractsPage: `api.listContracts('...')`, `api.createContract({ depositCode, ngayBatDau, thoiHan })`, `api.signContract(code)`.
- Accountant: `api.confirmDeposit(code, { soTien, hinhThuc })`, `api.reconcileCheckout(code, {...})`, `api.settleCheckout(code)`.
