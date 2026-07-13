import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Bell, Check, ChevronRight, AlertTriangle } from 'lucide-react'
import { formatRelativeTime } from '@/lib/staffNotificationHelpers'
import { api } from '@/lib/api'

// Chỉ đẩy thông báo "mới thật sự" (tạo trong vòng 5 phút) để tránh đẩy lại backlog cũ
const RECENT_WINDOW_MS = 5 * 60 * 1000
// Tần suất kiểm tra thông báo mới (giả lập realtime; sau này thay bằng Supabase realtime)
const POLL_INTERVAL_MS = 20 * 1000

// Lưu id các thông báo đã đẩy để không đẩy trùng (qua nhiều lần reload)
const PUSHED_PREFIX = 'homestay_staff_pushed_'
function loadPushedIds(role) {
  try {
    return new Set(JSON.parse(localStorage.getItem(PUSHED_PREFIX + role) || '[]'))
  } catch {
    return new Set()
  }
}
function savePushedIds(role, set) {
  try {
    localStorage.setItem(PUSHED_PREFIX + role, JSON.stringify([...set]))
  } catch { /* bỏ qua lỗi localStorage */ }
}

// Giá trị mặc định cho tùy chọn thông báo (khi user chưa thiết lập)
const DEFAULT_PREFS = { emailNotif: true, smsNotif: false, desktopNotif: true }

// Có thể đẩy thông báo trình duyệt không?
function canDesktop(prefs) {
  return (
    prefs.desktopNotif &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  )
}

// Xin quyền hiển thị thông báo trình duyệt (gọi khi có thao tác của người dùng)
function requestDesktopPermission(prefs) {
  if (
    prefs.desktopNotif &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission()
  }
}

// Bộ điều phối kênh: 1 thông báo → đẩy qua các kênh đang bật
function dispatchNotification(notif, prefs, navigateRef) {
  // Kênh IN-APP: luôn có (chính là chuông + dropdown này)

  // Kênh DESKTOP (thật): Web Notification API
  if (canDesktop(prefs)) {
    try {
      const n = new Notification(notif.title, {
        body: notif.message,
        tag: notif.id,          // OS tự gộp nếu trùng tag
        icon: '/vite.svg',
      })
      n.onclick = () => {
        window.focus()
        if (notif.url && navigateRef?.current) navigateRef.current(notif.url)
        n.close()
      }
    } catch {
      // một số trình duyệt chặn tạo Notification trực tiếp — bỏ qua an toàn
    }
  }

  // Kênh EMAIL — cần backend, chưa gửi thật
  if (prefs.emailNotif) {
    console.info('[notify:email] (chờ backend) sẽ gửi email:', notif.title)
    // TODO(Supabase): await supabase.functions.invoke('send-email', {
    //   body: { to: <email NV>, subject: notif.title, text: notif.message }
    // })
  }

  // Kênh SMS — cần backend, chưa gửi thật
  if (prefs.smsNotif) {
    console.info('[notify:sms] (chờ backend) sẽ gửi SMS:', notif.title)
    // TODO(Supabase): await supabase.functions.invoke('send-sms', {
    //   body: { to: <SĐT NV>, text: `${notif.title}: ${notif.message}` }
    // })
  }
}

export default function StaffNotificationDropdown() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Ref giữ giá trị mới nhất để dùng trong setInterval / callback của Notification
  const prefs = { ...DEFAULT_PREFS, ...(user?.preferences || {}) }
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const pushedRef = useRef(new Set())

  // Đọc lại danh sách + cập nhật badge (KHÔNG đẩy thông báo)
  const refresh = async () => {
    if (!user?.role) return
    try {
      const list = await api.listNotifications()
      setNotifications(list)
      setUnreadCount(list.filter(n => !n.isRead).length)
    } catch { /* giữ nguyên nếu lỗi mạng */ }
  }

  // Đồng bộ + đẩy thông báo mới qua các kênh đang bật
  const syncAndNotify = async () => {
    if (!user?.role) return
    let list
    try { list = await api.listNotifications() } catch { return }
    setNotifications(list)
    setUnreadCount(list.filter(n => !n.isRead).length)

    const pushed = pushedRef.current
    const now = Date.now()
    let changed = false

    list.forEach(n => {
      const isFresh = now - new Date(n.createdAt).getTime() < RECENT_WINDOW_MS
      if (!n.isRead && isFresh && !pushed.has(n.id)) {
        dispatchNotification(n, prefsRef.current, navigateRef)
        pushed.add(n.id)
        changed = true
      }
    })

    if (changed) savePushedIds(user.role, pushed)
  }

  // Khi đổi role: nạp lại tập id đã đẩy + sync lần đầu
  useEffect(() => {
    if (!user?.role) return
    pushedRef.current = loadPushedIds(user.role)
    syncAndNotify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  // Poll định kỳ để phát hiện thông báo mới (giả lập realtime)
  useEffect(() => {
    if (!user?.role) return
    const timer = setInterval(syncAndNotify, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  // Mở dropdown thì refresh danh sách
  useEffect(() => {
    if (isOpen) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleBellClick = () => {
    // Click chuông là một "user gesture" hợp lệ để xin quyền thông báo
    requestDesktopPermission(prefsRef.current)
    setIsOpen(!isOpen)
  }

  const handleClickNotif = (notif) => {
    if (!notif.isRead) {
      api.markNotificationRead(notif.id).then(refresh).catch(() => {})
    }
    setIsOpen(false)
    if (notif.url) navigate(notif.url)
  }

  const handleMarkAllRead = () => {
    api.markAllNotificationsRead().then(refresh).catch(() => {})
  }

  if (!user?.role) return null

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="relative h-10 w-10 rounded-lg hover:bg-warm-white flex items-center justify-center transition"
      >
        <Bell className="w-5 h-5 text-ink-soft" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-terracotta-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-cream-dark shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-cream-dark">
              <div>
                <h3 className="font-display font-bold text-base">Thông báo công việc</h3>
                {unreadCount > 0 && (
                  <div className="text-xs text-ink-muted">{unreadCount} thông báo chưa đọc</div>
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

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">🔔</div>
                  <div className="text-sm text-ink-soft">Chưa có thông báo</div>
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
                    <div className="w-10 h-10 bg-warm-white rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {notif.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="font-display font-semibold text-sm leading-tight flex items-center gap-1">
                          {notif.title}
                          {notif.priority === 'high' && (
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                        {!notif.isRead && (
                          <span className="w-2 h-2 bg-terracotta-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <div className="text-xs text-ink-soft line-clamp-2 mb-1">{notif.message}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-ink-muted">{formatRelativeTime(notif.createdAt)}</div>
                        <div className="text-[10px] text-terracotta-500 font-semibold flex items-center gap-0.5">
                          Mở <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
