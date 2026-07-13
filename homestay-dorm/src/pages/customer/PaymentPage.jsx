import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import {
  ArrowLeft, Copy, Check, Clock, CreditCard, Building2,
  AlertCircle, ShieldCheck, Upload, Banknote, QrCode
} from 'lucide-react'

// Thông tin chuyển khoản (mock)
const BANK_INFO = {
  bankName: 'Vietcombank',
  accountNumber: '1234567890123',
  accountHolder: 'CTY TNHH HOMESTAY DORM',
  branch: 'CN. TP. Hồ Chí Minh',
}

export default function PaymentPage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  // Phương thức thanh toán đang chọn: 'transfer' hoặc 'cash'
  const [method, setMethod] = useState('transfer')
  const [copied, setCopied] = useState('')
  const [proofUploaded, setProofUploaded] = useState(false)
  const [proofFileName, setProofFileName] = useState('')
  const [proofDataUrl, setProofDataUrl] = useState('')
  // TK nhận hoàn tiền (tùy chọn) — để Kế toán chuyển trả cọc nếu đơn bị hủy/từ chối
  const [refundAcc, setRefundAcc] = useState({ so: '', nganHang: '', chuTk: '' })

  // Đồng hồ đếm ngược 24h
  const [timeLeft, setTimeLeft] = useState(null)

  // Tải phiếu + phòng từ API
  useEffect(() => {
    let alive = true
    setLoading(true)
    api.bookingDetail(code)
      .then(({ booking, room }) => { if (alive) { setBooking(booking); setRoom(room) } })
      .catch(() => { if (alive) { setBooking(null); setRoom(null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [code])

  useEffect(() => {
    if (!booking?.depositInfo?.deadline) return

    const updateTimer = () => {
      const deadline = new Date(booking.depositInfo.deadline).getTime()
      const now = Date.now()
      const diff = deadline - now

      if (diff <= 0) {
        setTimeLeft({ expired: true })
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft({ hours, minutes, seconds, expired: false })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [booking])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-sm text-ink-soft">Đang tải thông tin thanh toán…</p>
      </div>
    )
  }

  // Nếu không tìm thấy booking hoặc không phải trạng thái chờ cọc
  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl font-bold mb-2">Không tìm thấy đơn</h1>
        <Button onClick={() => navigate('/my-bookings')}>Quay lại danh sách</Button>
      </div>
    )
  }

  if (booking.status !== 'awaiting_deposit') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="font-display text-2xl font-bold mb-2">Đơn không ở trạng thái chờ cọc</h1>
        <p className="text-ink-soft mb-6">Đơn {code} hiện đang ở trạng thái khác, không thể thanh toán cọc.</p>
        <Button onClick={() => navigate(`/my-bookings/${code}`)}>Xem chi tiết đơn</Button>
      </div>
    )
  }

  const depositAmount = booking.depositInfo.amount
  const paymentRef = booking.depositInfo.paymentCode || `HD${code.split('-').pop()}`

  // Copy text vào clipboard
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  // Đọc file chứng từ thành base64 (data URL) để gửi lên server
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      alert('Ảnh quá lớn (tối đa 3MB). Vui lòng chọn ảnh nhỏ hơn.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProofDataUrl(reader.result)   // data:image/...;base64,...
      setProofFileName(file.name)
      setProofUploaded(true)
    }
    reader.onerror = () => alert('Không đọc được file. Vui lòng thử lại.')
    reader.readAsDataURL(file)
  }

  // Xác nhận đã thanh toán
  const handleConfirmPayment = async () => {
    // === LUỒNG TIỀN MẶT ===
    // Khách chỉ "đăng ký" sẽ đến đóng tiền mặt — chưa phát sinh giao dịch.
    // Trạng thái cọc trên hệ thống KHÔNG đổi ở bước này; Kế toán mới là người
    // xác nhận đã nhận tiền (UC-HT-06). Ở đây chỉ điều hướng sang trang thông báo.
    if (method === 'cash') {
      try {
        if (booking.depositInfo?.depositCode) await api.chooseCashPayment(booking.depositInfo.depositCode)
      } catch { /* vẫn cho qua trang thông báo dù lưu hình thức lỗi */ }
      navigate(`/cash-payment-notice/${code}`)
      return
    }

    // === LUỒNG CHUYỂN KHOẢN ===
    // Khách chuyển khoản + upload chứng từ. Ảnh được gửi lên phiếu cọc để Kế toán đối soát.
    // Việc xác nhận cọc vẫn do Kế toán thực hiện (UC-HT-06), nên ở đây không tự đổi trạng thái.
    if (!proofUploaded) {
      alert('Vui lòng tải lên chứng từ chuyển khoản trước khi xác nhận')
      return
    }
    try {
      if (booking.depositInfo?.depositCode && proofDataUrl) {
        await api.submitDepositProof(booking.depositInfo.depositCode, proofDataUrl, refundAcc)
      }
      navigate(`/payment-success/${code}`)
    } catch (err) {
      alert(err.message || 'Không gửi được chứng từ. Vui lòng thử lại.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-up">
      <button onClick={() => navigate(`/my-bookings/${code}`)}
        className="inline-flex items-center gap-2 text-sm text-ink-soft mb-4 hover:text-terracotta-500">
        <ArrowLeft className="w-4 h-4" /> Quay lại chi tiết đơn
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* === LEFT: PAYMENT FORM === */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-terracotta-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-7 h-7 text-terracotta-600" />
              </div>
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold mb-1">Thanh toán cọc</h1>
                <p className="text-sm text-ink-soft">
                  Đơn <strong>{code}</strong> — Phòng {booking.roomId} ({room?.branch})
                </p>
              </div>
            </div>
          </Card>

          {/* Countdown */}
          {timeLeft && !timeLeft.expired && (
            <Card className="p-5 border-gold/40 bg-gold-light/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-ink-soft mb-0.5">Thời gian còn lại để thanh toán</div>
                  <div className="font-display text-xl font-bold flex items-center gap-1.5">
                    <span className="bg-white px-2 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span>:</span>
                    <span className="bg-white px-2 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span>:</span>
                    <span className="bg-white px-2 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="text-xs text-ink-muted ml-1">(giờ : phút : giây)</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {timeLeft?.expired && (
            <Card className="p-5 border-red-300 bg-red-50">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <div className="font-display font-bold text-red-600">Đã quá hạn thanh toán</div>
                  <div className="text-xs text-ink-soft">Đơn này có thể đã bị hủy. Vui lòng liên hệ NV để được hỗ trợ.</div>
                </div>
              </div>
            </Card>
          )}

          {/* Chọn phương thức */}
          <Card className="p-6">
            <h3 className="font-display font-bold mb-4">Chọn phương thức thanh toán</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMethod('transfer')}
                className={`p-4 rounded-xl border-[1.5px] text-left transition ${
                  method === 'transfer'
                    ? 'border-terracotta-500 bg-terracotta-50'
                    : 'border-cream-dark hover:border-terracotta-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-terracotta-600" />
                  <span className="font-display font-bold">Chuyển khoản</span>
                </div>
                <div className="text-xs text-ink-soft">Quét QR hoặc chuyển khoản qua app ngân hàng</div>
              </button>
              <button
                onClick={() => setMethod('cash')}
                className={`p-4 rounded-xl border-[1.5px] text-left transition ${
                  method === 'cash'
                    ? 'border-terracotta-500 bg-terracotta-50'
                    : 'border-cream-dark hover:border-terracotta-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-mint-dark" />
                  <span className="font-display font-bold">Tiền mặt</span>
                </div>
                <div className="text-xs text-ink-soft">Thanh toán trực tiếp tại chi nhánh</div>
              </button>
            </div>
          </Card>

          {/* CONTENT THEO PHƯƠNG THỨC */}
          {method === 'transfer' ? (
            <>
              {/* QR + thông tin chuyển khoản */}
              <Card className="p-6">
                <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-terracotta-500" /> Quét mã QR để thanh toán
                </h3>
                <div className="grid md:grid-cols-2 gap-6 items-start">
                  {/* QR Code mock */}
                  <div className="bg-white p-4 rounded-2xl border-2 border-cream-dark">
                    <div className="aspect-square bg-gradient-to-br from-warm-white to-cream rounded-xl flex items-center justify-center relative overflow-hidden">
                      {/* QR pattern giả lập */}
                      <div className="grid grid-cols-12 gap-0.5 p-4 w-full h-full">
                        {Array.from({ length: 144 }).map((_, i) => (
                          <div
                            key={i}
                            className={`aspect-square ${((i * 37 + (i % 7) * 13) % 3 === 0) ? 'bg-ink' : 'bg-transparent'} ${
                              (i < 24 || i % 12 < 2 || i % 12 > 9 || i > 119) && (i < 36 || i > 108) ? 'bg-ink' : ''
                            }`}
                          />
                        ))}
                      </div>
                      {/* Logo giữa */}
                      <div className="absolute w-12 h-12 bg-terracotta-500 rounded-xl flex items-center justify-center text-white font-display font-bold">
                        H
                      </div>
                    </div>
                    <div className="text-center mt-3 text-xs text-ink-muted">
                      Mở app ngân hàng để quét
                    </div>
                  </div>

                  {/* Thông tin ngân hàng */}
                  <div className="space-y-3">
                    <BankField label="Ngân hàng" value={BANK_INFO.bankName} />
                    <BankField label="Số tài khoản" value={BANK_INFO.accountNumber}
                      onCopy={() => handleCopy(BANK_INFO.accountNumber, 'account')}
                      copied={copied === 'account'} />
                    <BankField label="Chủ tài khoản" value={BANK_INFO.accountHolder} />
                    <BankField label="Chi nhánh" value={BANK_INFO.branch} />
                    <div className="border-t border-cream-dark pt-3">
                      <BankField label="Số tiền"
                        value={`${depositAmount.toLocaleString('vi-VN')}đ`}
                        onCopy={() => handleCopy(depositAmount.toString(), 'amount')}
                        copied={copied === 'amount'}
                        highlight />
                      <div className="mt-2">
                        <BankField label="Nội dung CK" value={paymentRef}
                          onCopy={() => handleCopy(paymentRef, 'ref')}
                          copied={copied === 'ref'}
                          highlight />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-3 bg-gold-light/30 border border-gold/30 rounded-lg flex items-start gap-2.5 text-xs text-ink-soft">
                  <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink">Quan trọng:</strong> Vui lòng nhập đúng nội dung chuyển khoản <strong>{paymentRef}</strong> để hệ thống tự động đối soát giao dịch.
                  </div>
                </div>
              </Card>

              {/* Upload chứng từ */}
              <Card className="p-6">
                <h3 className="font-display font-bold mb-1">Tải lên chứng từ chuyển khoản</h3>
                <p className="text-sm text-ink-soft mb-4">
                  Sau khi chuyển khoản, vui lòng tải lên ảnh chụp màn hình hoặc biên lai giao dịch
                </p>

                {proofUploaded ? (
                  <div className="p-4 bg-mint-light/40 border border-mint/30 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-mint rounded-lg flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{proofFileName}</div>
                      <div className="text-xs text-ink-muted">Đã tải lên thành công</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setProofUploaded(false); setProofFileName('') }}>
                      Đổi file
                    </Button>
                  </div>
                ) : (
                  <label className="block">
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                    <div className="border-2 border-dashed border-cream-dark hover:border-terracotta-500 rounded-xl p-8 text-center cursor-pointer transition">
                      <Upload className="w-10 h-10 text-ink-muted mx-auto mb-3" />
                      <div className="font-semibold text-sm mb-1">Click để chọn file</div>
                      <div className="text-xs text-ink-muted">Hỗ trợ JPG, PNG, PDF (tối đa 5MB)</div>
                    </div>
                  </label>
                )}
              </Card>

              {/* TK nhận hoàn tiền (tùy chọn) — phục vụ hoàn cọc nếu đơn bị hủy/từ chối */}
              <Card className="p-6">
                <h3 className="font-display font-bold mb-1">Tài khoản nhận hoàn tiền <span className="text-xs font-normal text-ink-muted">(tùy chọn)</span></h3>
                <p className="text-sm text-ink-soft mb-4">
                  Nếu đơn bị hủy/từ chối, chúng tôi sẽ hoàn cọc về tài khoản này. Bỏ trống nếu muốn hoàn về chính tài khoản bạn vừa chuyển.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    value={refundAcc.so}
                    onChange={e => setRefundAcc({ ...refundAcc, so: e.target.value })}
                    placeholder="Số tài khoản"
                    className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
                  />
                  <input
                    value={refundAcc.nganHang}
                    onChange={e => setRefundAcc({ ...refundAcc, nganHang: e.target.value })}
                    placeholder="Ngân hàng (vd: Vietcombank)"
                    className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500"
                  />
                  <input
                    value={refundAcc.chuTk}
                    onChange={e => setRefundAcc({ ...refundAcc, chuTk: e.target.value })}
                    placeholder="Chủ tài khoản"
                    className="h-11 px-4 rounded-lg border-[1.5px] border-cream-dark bg-white text-sm focus:outline-none focus:border-terracotta-500 sm:col-span-2"
                  />
                </div>
              </Card>            </>
          ) : (
            /* === HƯỚNG DẪN TIỀN MẶT === */
            <Card className="p-6">
              <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-mint-dark" /> Thanh toán bằng tiền mặt
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-4 bg-warm-white rounded-xl">
                  <div className="text-xs text-ink-muted mb-1">Số tiền cần thanh toán</div>
                  <div className="font-display text-3xl font-bold text-terracotta-600">
                    {depositAmount.toLocaleString('vi-VN')}đ
                  </div>
                </div>

                <div className="text-ink-soft">
                  <div className="font-semibold text-ink mb-2">Vui lòng đến chi nhánh:</div>
                  <div className="flex items-start gap-2 mb-1">
                    <Building2 className="w-4 h-4 mt-0.5 text-ink-muted flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{room?.branch}</div>
                      <div className="text-xs">{room?.address}</div>
                    </div>
                  </div>
                </div>

                <div className="text-ink-soft text-xs space-y-1.5">
                  <div className="font-semibold text-ink">Khi đến cần mang theo:</div>
                  <div>• CCCD/Passport bản gốc</div>
                  <div>• Mã đơn: <strong className="text-ink">{code}</strong></div>
                  <div>• Số tiền cọc đầy đủ</div>
                </div>

                <div className="text-ink-soft text-xs">
                  <div className="font-semibold text-ink mb-1">Giờ làm việc:</div>
                  <div>Thứ 2 - Thứ 7: 8:00 — 18:00 | Chủ nhật: 9:00 — 17:00</div>
                </div>

                <div className="p-3 bg-mint-light/40 border border-mint/30 rounded-lg flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-mint-dark flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    Nhân viên sẽ xuất biên lai có chữ ký và đóng dấu xác nhận cho bạn ngay sau khi nhận tiền.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Nút xác nhận */}
          <Button
            size="xl"
            className="w-full"
            onClick={handleConfirmPayment}
            disabled={timeLeft?.expired || (method === 'transfer' && !proofUploaded)}
          >
            <Check className="w-5 h-5" />
            {method === 'transfer'
                ? 'Xác nhận đã chuyển khoản'
                : 'Đăng ký đóng tiền mặt tại chi nhánh'
            }
          </Button>
        </div>

        {/* === RIGHT: SIDEBAR TÓM TẮT === */}
        <aside className="lg:col-span-1">
          <Card className="p-5 sticky top-24">
            <h3 className="font-display font-bold mb-4">Chi tiết thanh toán</h3>

            {room && (
              <div className="mb-4 pb-4 border-b border-cream-dark">
                <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 rounded-xl flex items-center justify-center text-5xl mb-3">
                  {room.emoji}
                </div>
                <div className="font-display font-bold">Phòng {room.code}</div>
                <div className="text-xs text-ink-muted">{room.branch}</div>
              </div>
            )}

            <div className="space-y-2.5 text-sm mb-4 pb-4 border-b border-cream-dark">
              <div className="flex justify-between">
                <span className="text-ink-soft">Hình thức thuê</span>
                <span className="font-semibold text-right">
                  {booking.rentalCriteria.rentType === 'whole_room' ? 'Nguyên phòng' : 'Ghép giường'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Số giường</span>
                <span className="font-semibold">{booking.rentalCriteria.numberOfBeds}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Thời hạn</span>
                <span className="font-semibold">{booking.rentalCriteria.duration} tháng</span>
              </div>
            </div>

            <div className="space-y-2.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-ink-soft">Cọc 2 tháng × {booking.rentalCriteria.numberOfBeds} giường</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-cream-dark">
                <span className="font-display font-bold">Tổng cọc</span>
                <span className="font-display text-2xl font-bold text-terracotta-500">
                  {depositAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <div className="p-3 bg-warm-white rounded-lg text-xs text-ink-soft flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-mint flex-shrink-0 mt-0.5" />
              <span>Cọc sẽ được hoàn trả khi trả phòng đúng quy định (xem chính sách hoàn cọc)</span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// ============== SUB COMPONENT ==============
function BankField({ label, value, onCopy, copied, highlight }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <div className={`font-semibold ${highlight ? 'text-terracotta-600 font-display text-lg' : ''}`}>
          {value}
        </div>
        {onCopy && (
          <button
            onClick={onCopy}
            className={`text-xs px-2 py-1 rounded transition flex items-center gap-1 ${
              copied
                ? 'bg-mint text-white'
                : 'bg-warm-white border border-cream-dark text-ink-soft hover:border-terracotta-300'
            }`}
          >
            {copied ? <><Check className="w-3 h-3" /> Đã copy</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        )}
      </div>
    </div>
  )
}