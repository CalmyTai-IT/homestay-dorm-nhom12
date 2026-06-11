import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Send, Phone } from 'lucide-react'

// Tin nhắn chào hỏi tùy theo context (room đơn lẻ hoặc booking có trạng thái)
function getGreetingMessage(room, booking) {
  // Trường hợp 1: Liên hệ từ trang phòng (chưa có booking)
  if (!booking) {
    return `Chào bạn! Mình thấy bạn quan tâm đến phòng ${room.code || room.id} — ${room.branch}. Mình có thể hỗ trợ gì cho bạn ạ?`
  }

  // Trường hợp 2: Liên hệ trong context có booking → nội dung tùy trạng thái
  const greetings = {
    pending_confirm: `Chào bạn! Mình đã nhận được đơn đăng ký ${booking.code} cho phòng ${room.code || room.id}. Đơn của bạn đang được mình kiểm tra phòng trống và sẽ liên hệ lại sớm nhất. Bạn có câu hỏi gì không ạ?`,
    viewing_scheduled: `Chào bạn! Lịch xem phòng ${room.code || room.id} của bạn đã được sắp xếp. Mình rất mong gặp bạn theo lịch hẹn. Bạn cần hỗ trợ gì thêm không ạ?`,
    awaiting_deposit: `Chào bạn! Đơn ${booking.code} của bạn đang chờ thanh toán cọc. Nếu bạn gặp khó khăn trong việc thanh toán hoặc cần hỗ trợ, đừng ngại nói với mình nhé!`,
    deposited: `Chào bạn! Cảm ơn đã hoàn tất đặt cọc cho phòng ${room.code || room.id}. Mình sẽ liên hệ để hẹn ngày nhận phòng. Bạn có yêu cầu gì cho ngày nhận phòng không?`,
    contracted: `Chào bạn! Cảm ơn bạn đã trở thành khách thuê của HomeStay Dorm. Phòng ${room.code || room.id} đã sẵn sàng đón bạn. Có vấn đề gì trong quá trình ở, bạn cứ liên hệ mình nhé!`,
  }

  return greetings[booking.status] || greetings.pending_confirm
}

// Gợi ý tin nhắn nhanh theo trạng thái
function getSuggestedMessages(booking) {
  if (!booking) {
    return ['Phòng còn trống không?', 'Cho mình đặt lịch xem', 'Giá có thương lượng?']
  }

  const suggestions = {
    pending_confirm: ['Khi nào có lịch xem phòng?', 'Tôi muốn đổi tiêu chí thuê', 'Tôi muốn hủy đơn này'],
    viewing_scheduled: ['Đổi lịch xem được không?', 'Đi cùng người khác được không?', 'Tôi sẽ đến đúng giờ'],
    awaiting_deposit: ['Cách thanh toán cọc?', 'Có thể gia hạn không?', 'Tôi muốn đổi sang tiền mặt'],
    deposited: ['Khi nào nhận phòng?', 'Cần mang theo gì?', 'Lịch trình nhận phòng?'],
    contracted: ['Tôi có vấn đề về phòng', 'Hỏi về tiền điện nước', 'Yêu cầu sửa chữa'],
  }

  return suggestions[booking.status] || suggestions.pending_confirm
}

export default function ContactDialog({ room, booking = null, onClose }) {
  const greeting = getGreetingMessage(room, booking)

  const [messages, setMessages] = useState([
    {
      from: 'staff',
      name: 'Mai - NV Sale',
      text: greeting,
      time: 'vừa xong'
    }
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  // Auto scroll xuống dưới khi có tin nhắn mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg = { from: 'user', text: input, time: 'vừa xong' }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Mock: nhân viên auto-reply sau 1s
    setTimeout(() => {
      setMessages(prev => [...prev, {
        from: 'staff',
        name: 'Mai - NV Sale',
        text: 'Cảm ơn bạn đã nhắn tin! Mình sẽ liên hệ với bạn sớm nhất để hỗ trợ. Bạn cũng có thể gọi hotline 1900 1234 để được tư vấn ngay nhé!',
        time: 'vừa xong'
      }])
    }, 1000)
  }

  const handleCall = () => {
    alert('Đang kết nối với nhân viên qua hotline 1900 1234...')
  }

  const suggestedMessages = getSuggestedMessages(booking)

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-up p-4"
         onClick={onClose}>
      {/* Dialog */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]"
           onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className="flex items-center gap-3 p-4 border-b border-cream-dark">
          <div className="relative">
            <div className="w-11 h-11 bg-terracotta-500 rounded-full flex items-center justify-center text-white font-display font-bold">
              M
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-mint border-2 border-white rounded-full"></span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold flex items-center gap-1.5">
              Mai - NV Sale
              <span className="text-xs font-normal text-mint">● Đang hoạt động</span>
            </div>
            <div className="text-xs text-ink-muted">
              {booking
                ? `Đơn ${booking.code} · Phòng ${room.code || room.id}`
                : `Phòng ${room.code || room.id} — ${room.branch}`
              }
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* QUICK CALL */}
        <div className="px-4 py-3 bg-warm-white border-b border-cream-dark flex items-center justify-between">
          <div className="text-xs text-ink-soft">
            Muốn nói chuyện trực tiếp?
          </div>
          <Button size="sm" variant="mint" onClick={handleCall}>
            <Phone className="w-3.5 h-3.5" /> Gọi ngay
          </Button>
        </div>

        {/* MESSAGES */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${msg.from === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.from === 'staff' && (
                  <div className="text-[10px] text-ink-muted mb-1 px-2">{msg.name}</div>
                )}
                <div className={`px-4 py-2 rounded-2xl text-sm ${
                  msg.from === 'user'
                    ? 'bg-terracotta-500 text-white rounded-br-sm'
                    : 'bg-cream rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
                <div className="text-[10px] text-ink-muted mt-1 px-2">{msg.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* SUGGESTED MESSAGES */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {suggestedMessages.map(sug => (
              <button
                key={sug}
                onClick={() => { setInput(sug); }}
                className="text-xs px-3 py-1.5 bg-warm-white border border-cream-dark rounded-full hover:border-terracotta-300 hover:text-terracotta-600"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div className="p-3 border-t border-cream-dark flex gap-2 items-center">
          <Input
            placeholder="Nhập tin nhắn..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1"
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}