import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronRight } from 'lucide-react'
import { formatRelativeTime } from '@/lib/notificationHelpers'
import { api } from '@/lib/api'

export default function NotificationDropdown() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshNotifications = async () => {
    try {
      const list = await api.listNotifications()
      setNotifications(list)
      setUnreadCount(list.filter(n => !n.isRead).length)
    } catch { /* bỏ qua nếu lỗi/chưa đăng nhập */ }
  }

  // Load notifications khi component mount + khi mở dropdown
  useEffect(() => {
    refreshNotifications()
  }, [isOpen])

  // Click 1 notification → đánh dấu đã đọc + chuyển trang
  const handleClickNotif = (notif) => {
    if (!notif.isRead) {
      api.markNotificationRead(notif.id).then(refreshNotifications).catch(() => {})
    }
    setIsOpen(false)
    if (notif.url) navigate(notif.url)
  }

  const handleMarkAllRead = () => {
    api.markAllNotificationsRead().then(refreshNotifications).catch(() => {})
  }

  return (
    <div className="relative">
      {/* Nút chuông */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 rounded-lg hover:bg-warm-white flex items-center justify-center transition"
      >
        <Bell className="w-5 h-5 text-ink-soft" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-terracotta-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop để click ngoài đóng */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-cream-dark shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-cream-dark">
              <div>
                <h3 className="font-display font-bold text-base">Thông báo</h3>
                {unreadCount > 0 && (
                  <div className="text-xs text-ink-muted">
                    Bạn có {unreadCount} thông báo chưa đọc
                  </div>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-terracotta-500 font-semibold hover:underline flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Đánh dấu đã đọc
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">🔔</div>
                  <div className="text-sm text-ink-soft">Chưa có thông báo nào</div>
                </div>
              ) : (
                notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    className={`w-full text-left p-4 border-b border-cream-dark last:border-0 hover:bg-warm-white transition flex gap-3 ${
                      !notif.isRead ? 'bg-terracotta-50/30' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 bg-warm-white rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {notif.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="font-display font-semibold text-sm leading-tight">
                          {notif.title}
                        </div>
                        {!notif.isRead && (
                          <span className="w-2 h-2 bg-terracotta-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <div className="text-xs text-ink-soft line-clamp-2 mb-1">
                        {notif.message}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-ink-muted">
                          {formatRelativeTime(notif.createdAt)}
                        </div>
                        {notif.bookingCode && (
                          <div className="text-[10px] text-terracotta-500 font-semibold flex items-center gap-0.5">
                            Xem đơn <ChevronRight className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-cream-dark text-center">
              <button
                onClick={() => { setIsOpen(false); navigate('/my-bookings') }}
                className="text-xs text-terracotta-500 font-semibold hover:underline"
              >
                Xem tất cả đặt phòng →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}