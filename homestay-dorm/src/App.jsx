import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Layout, route-guard và ErrorBoundary dùng ở MỌI route -> nạp sẵn (eager).
import CustomerLayout from '@/layouts/CustomerLayout'
import StaffLayout from '@/layouts/StaffLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProtectedStaffRoute from '@/components/ProtectedStaffRoute'
import ErrorBoundary from '@/components/ErrorBoundary'

// Các TRANG: nạp theo nhu cầu (React.lazy -> code-splitting). Mỗi trang thành 1 chunk riêng,
// giúp bundle ban đầu nhỏ gọn (chỉ tải trang đang xem thay vì toàn bộ ứng dụng).
// Customer
const HomePage = lazy(() => import('@/pages/customer/HomePage'))
const LoginPage = lazy(() => import('@/pages/customer/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/customer/ForgotPasswordPage'))
const RegisterPage = lazy(() => import('@/pages/customer/RegisterPage'))
const SearchPage = lazy(() => import('@/pages/customer/SearchPage'))
const RoomDetailPage = lazy(() => import('@/pages/customer/RoomDetailPage'))
const AboutPage = lazy(() => import('@/pages/customer/AboutPage'))
const RegisterRentalPage = lazy(() => import('@/pages/customer/RegisterRentalPage'))
const BookingSuccessPage = lazy(() => import('@/pages/customer/BookingSuccessPage'))
const MyBookingsPage = lazy(() => import('@/pages/customer/MyBookingsPage'))
const BookingDetailPage = lazy(() => import('@/pages/customer/BookingDetailPage'))
const PaymentPage = lazy(() => import('@/pages/customer/PaymentPage'))
const PaymentSuccessPage = lazy(() => import('@/pages/customer/PaymentSuccessPage'))
const CashPaymentNoticePage = lazy(() => import('@/pages/customer/CashPaymentNoticePage'))

// Staff
const StaffLoginPage = lazy(() => import('@/pages/staff/StaffLoginPage'))
const SaleDashboard = lazy(() => import('@/pages/staff/sale/SaleDashboard'))
const ManagerDashboard = lazy(() => import('@/pages/staff/manager/ManagerDashboard'))
const AccountantDashboard = lazy(() => import('@/pages/staff/accountant/AccountantDashboard'))
const AccountantPaymentsPage = lazy(() => import('@/pages/staff/accountant/AccountantPaymentsPage'))
const AccountantRefundsPage = lazy(() => import('@/pages/staff/accountant/AccountantRefundsPage'))
const ManagerDepositsPage = lazy(() => import('@/pages/staff/manager/ManagerDepositsPage'))
const ManagerContractsPage = lazy(() => import('@/pages/staff/manager/ManagerContractsPage'))
const ManagerHandoversPage = lazy(() => import('@/pages/staff/manager/ManagerHandoversPage'))
const ManagerCheckoutsPage = lazy(() => import('@/pages/staff/manager/ManagerCheckoutsPage'))
const ManagerRoomsPage = lazy(() => import('@/pages/staff/manager/ManagerRoomsPage'))
const SaleRoomsPage = lazy(() => import('@/pages/staff/sale/SaleRoomsPage'))
const SaleCheckoutsPage = lazy(() => import('@/pages/staff/sale/SaleCheckoutsPage'))
const AccountantDepositRequestsPage = lazy(() => import('@/pages/staff/accountant/AccountantDepositRequestsPage'))
const SaleBookingsPage = lazy(() => import('@/pages/staff/sale/SaleBookingsPage'))
const SaleDepositsPage = lazy(() => import('@/pages/staff/sale/SaleDepositsPage'))
const SettingsPage = lazy(() => import('@/pages/staff/SettingsPage'))
const SystemManagementPage = lazy(() => import('@/pages/staff/admin/SystemManagementPage'))

// Màn chờ hiển thị trong lúc tải chunk của trang.
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2">
      <div className="text-3xl animate-pulse">⏳</div>
      <p className="text-sm text-ink-soft">Đang tải…</p>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ============ CUSTOMER ROUTES ============ */}
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/room/:id" element={<RoomDetailPage />} />
            <Route path="/about" element={<AboutPage />} />

            <Route path="/register-rental/:id" element={
              <ProtectedRoute><RegisterRentalPage /></ProtectedRoute>
            } />
            <Route path="/booking-success/:code" element={
              <ProtectedRoute><BookingSuccessPage /></ProtectedRoute>
            } />
            <Route path="/my-bookings" element={
              <ProtectedRoute><MyBookingsPage /></ProtectedRoute>
            } />
            <Route path="/my-bookings/:code" element={
              <ProtectedRoute><BookingDetailPage /></ProtectedRoute>
            } />
            <Route path="/payment/:code" element={
              <ProtectedRoute><PaymentPage /></ProtectedRoute>
            } />
            <Route path="/payment-success/:code" element={
              <ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>
            } />
            <Route path="/cash-payment-notice/:code" element={
              <ProtectedRoute><CashPaymentNoticePage /></ProtectedRoute>
            } />
          </Route>

          {/* ============ STAFF ROUTES ============ */}
          {/* Staff login - public (không cần auth) */}
          <Route path="/staff/login" element={<StaffLoginPage />} />

          {/* Staff Sale */}
          <Route element={
            <ProtectedStaffRoute allowedRoles={['sale']}>
              <StaffLayout />
            </ProtectedStaffRoute>
          }>
            <Route path="/staff/sale/dashboard" element={<SaleDashboard />} />
            <Route path="/staff/sale/bookings" element={<SaleBookingsPage />} />
            <Route path="/staff/sale/deposits" element={<SaleDepositsPage />} />
            <Route path="/staff/sale/checkouts" element={<SaleCheckoutsPage />} />
            <Route path="/staff/sale/rooms" element={<SaleRoomsPage />} />
            <Route path="/staff/sale/settings" element={<SettingsPage />} />
          </Route>

          {/* Staff Manager */}
          <Route element={
            <ProtectedStaffRoute allowedRoles={['manager']}>
              <StaffLayout />
            </ProtectedStaffRoute>
          }>
            <Route path="/staff/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/staff/manager/deposits" element={<ManagerDepositsPage />} />
            <Route path="/staff/manager/contracts" element={<ManagerContractsPage />} />
            <Route path="/staff/manager/handovers" element={<ManagerHandoversPage />} />
            <Route path="/staff/manager/checkouts" element={<ManagerCheckoutsPage />} />
            <Route path="/staff/manager/rooms" element={<ManagerRoomsPage />} />
            <Route path="/staff/manager/settings" element={<SettingsPage />} />
          </Route>

          {/* Staff Admin (Quản trị hệ thống / IT) — tách khỏi Quản lý nghiệp vụ */}
          <Route element={
            <ProtectedStaffRoute allowedRoles={['admin']}>
              <StaffLayout />
            </ProtectedStaffRoute>
          }>
            <Route path="/staff/admin/dashboard" element={<SystemManagementPage />} />
            <Route path="/staff/admin/settings" element={<SettingsPage />} />
          </Route>

          {/* Staff Accountant */}
          <Route element={
            <ProtectedStaffRoute allowedRoles={['accountant']}>
              <StaffLayout />
            </ProtectedStaffRoute>
          }>
            <Route path="/staff/accountant/dashboard" element={<AccountantDashboard />} />
            <Route path="/staff/accountant/deposit-requests" element={<AccountantDepositRequestsPage />} />
            <Route path="/staff/accountant/payments" element={<AccountantPaymentsPage />} />
            <Route path="/staff/accountant/refunds" element={<AccountantRefundsPage />} />
            <Route path="/staff/accountant/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
