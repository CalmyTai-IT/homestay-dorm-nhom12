import { Component } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

// Error Boundary phải là class component (React chưa có bản hook tương đương)
// Bắt mọi lỗi render ở cây con và hiển thị giao diện dự phòng thay vì trắng màn
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log cho dev; khi lên production có thể gửi về dịch vụ giám sát (Sentry, LogRocket…)
    console.error('ErrorBoundary bắt được lỗi:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-cream-dark shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-terracotta-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-terracotta-500" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Đã có lỗi tạm thời</h2>
            <p className="text-sm text-ink-soft mb-1">
              Trang gặp sự cố khi hiển thị. Dữ liệu của bạn vẫn được lưu an toàn.
            </p>
            <p className="text-xs text-ink-muted mb-6">
              Vui lòng tải lại trang. Nếu vẫn lỗi, liên hệ hotline{' '}
              <a href="tel:19001234" className="text-terracotta-500 font-semibold">1900 1234</a>.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { window.location.href = '/' }}>
                <Home className="w-4 h-4" /> Về trang chủ
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="w-4 h-4" /> Tải lại trang
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
