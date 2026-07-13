import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { CONTACT_TIME_SLOTS, CONTACT_METHODS, DURATION_OPTIONS } from '@/lib/bookingUi'
import { ArrowLeft, ArrowRight, Check, User, Phone, Mail, CreditCard, Users, Plus, X, AlertCircle, MapPin } from 'lucide-react'

export default function RegisterRentalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setRoomLoading(true)
    api.getRooms()
      .then(list => { if (alive) setRoom(list.find(r => String(r.id) === id) || null) })
      .catch(() => { if (alive) setRoom(null) })
      .finally(() => { if (alive) setRoomLoading(false) })
    return () => { alive = false }
  }, [id])

  // Step hiện tại (1, 2, 3)
  const [step, setStep] = useState(1)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // === FORM STATE — chia thành 3 phần theo 3 bước ===

  // Bước 1: Thông tin cá nhân (auto-fill từ user đăng nhập)
  const [personalInfo, setPersonalInfo] = useState({
    fullName: user?.fullName || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
    email: user?.email || '',
    phone: user?.phone || '',
    idNumber: user?.idNumber || '',
  })

  // Bước 2: Tiêu chí thuê
  const [rentalCriteria, setRentalCriteria] = useState({
    rentType: '',              // 'whole_room' hoặc 'shared_bed'
    numberOfPeople: 1,
    numberOfBeds: 1,
    duration: 6,
    moveInDate: '',
    priorities: [],            // Mảng các key trong PRIORITY_CRITERIA
    notes: '',
    // Nhóm thuê
    hasGroup: false,
    groupMembers: [],          // [{name, phone, idNumber, gender}, ...]
    representativeIsMe: true,  // Người đại diện = người đăng ký?
    representative: null,      // Nếu false → ai là đại diện
  })

  // Hình thức thuê bị ràng buộc theo loại phòng:
  //  - Phòng nguyên căn (nguyen_can) → chỉ "thuê nguyên phòng" (thuê trọn cho cả nhóm, không hỏi số giường)
  //  - Phòng ở ghép (o_ghep)        → chỉ "thuê giường (ghép)" (chọn số giường)
  const forcedRentType = room ? (room.roomType === 'nguyen_can' ? 'whole_room' : 'shared_bed') : ''
  useEffect(() => {
    if (!room) return
    const forced = room.roomType === 'nguyen_can' ? 'whole_room' : 'shared_bed'
    setRentalCriteria(rc => rc.rentType === forced ? rc : {
      ...rc,
      rentType: forced,
      numberOfBeds: forced === 'whole_room' ? room.capacity : 1,
      numberOfPeople: forced === 'whole_room' ? room.capacity : 1,
    })
  }, [room])

  // Bước 3: Khung giờ tiện liên lạc — KHÁCH chỉ đề xuất, NV Sale sẽ sắp xếp lịch xem thật sự
  const [contactPreference, setContactPreference] = useState({
    preferredTimes: [],      // Mảng các khung giờ ưa thích (multi-select)
    preferredMethod: 'phone', // Phương thức liên lạc ưa thích
    notes: '',
  })

  // === RÀNG BUỘC GIỚI TÍNH (khai báo TRƯỚC phần validation vì canProceedStep1 dùng tới) ===
  // Giới tính khách lấy từ hồ sơ (user.gender) và KHÓA, không cho đổi để tránh lách đăng ký phòng khác giới.
  const lockedGender = user?.gender || ''          // "Nam" | "Nữ" | "" (hồ sơ chưa có)
  const customerGender = lockedGender || personalInfo.gender
  const roomGenderLocked = !!(room?.gender && room.gender !== 'Hỗn hợp')   // phòng chỉ dành 1 giới tính
  const genderMismatch = roomGenderLocked && !!customerGender && customerGender !== room.gender

  // === VALIDATION ===
  const canProceedStep1 = personalInfo.fullName && personalInfo.phone &&
                          personalInfo.email && personalInfo.idNumber && personalInfo.gender &&
                          !genderMismatch
  const canProceedStep2 = rentalCriteria.rentType && rentalCriteria.moveInDate &&
                          rentalCriteria.numberOfBeds > 0
  // Bước 3 không bắt buộc — khách có thể bỏ trống, NV Sale sẽ liên hệ theo cách hợp lý
  const canSubmit = true

  // === HANDLERS ===
  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }
  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setSubmitError('')

    // 1) Kiểm tra thông tin bắt buộc trước khi gửi
    if (!personalInfo.fullName || !personalInfo.phone || !personalInfo.email ||
        !personalInfo.idNumber || !personalInfo.gender) {
      setSubmitError('Thiếu thông tin cá nhân. Vui lòng quay lại Bước 1 để bổ sung.')
      setStep(1)
      return
    }
    if (genderMismatch) {
      setSubmitError(`Phòng này chỉ dành cho khách ${room.gender}. Giới tính của bạn không phù hợp nên không thể đăng ký phòng này.`)
      setStep(1)
      return
    }
    if (!rentalCriteria.rentType || !rentalCriteria.moveInDate || !(rentalCriteria.numberOfBeds > 0)) {
      setSubmitError('Thiếu tiêu chí thuê. Vui lòng quay lại Bước 2 để hoàn thiện.')
      setStep(2)
      return
    }

    // 2) Gửi đơn lên API. tieu_chi lưu kèm roomId để trang "Đặt phòng của tôi" tra cứu phòng.
    // tieu_chi lưu kèm roomDbId (id số, để tra cứu chính xác khi mã phòng trùng giữa các chi nhánh)
    // và roomId (mã phòng) + branch để hiển thị.
    const tieuChi = {
      roomDbId: room.id,
      roomId: room.code,
      branch: room.branch,
      rentType: rentalCriteria.rentType,
      numberOfPeople: rentalCriteria.numberOfPeople ?? rentalCriteria.numberOfBeds ?? 1,
      numberOfBeds: rentalCriteria.numberOfBeds ?? 1,
      duration: rentalCriteria.duration ?? 6,
      moveInDate: rentalCriteria.moveInDate,
      priorities: rentalCriteria.priorities ?? [],
      notes: rentalCriteria.notes ?? '',
      hasGroup: rentalCriteria.hasGroup ?? false,
      groupMembers: rentalCriteria.groupMembers ?? [],
      representativeIsMe: rentalCriteria.representativeIsMe ?? true,
      representative: rentalCriteria.representative ?? null,
      personalInfo: { ...personalInfo },
      contactPreference: { ...contactPreference },
    }

    try {
      setSubmitting(true)
      const booking = await api.createBooking({
        tieuChi,
        ngayVaoO: rentalCriteria.moveInDate,
        thoiHan: rentalCriteria.duration ?? 6,
      })
      navigate(`/booking-success/${booking.ma_phieu}`)
    } catch (e) {
      setSubmitError(e.message || 'Không gửi được đơn. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  // Đang tải thông tin phòng
  if (roomLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <p className="text-ink-soft">Đang tải thông tin phòng…</p>
      </div>
    )
  }

  // Trường hợp không tìm thấy phòng
  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl font-bold mb-2">Không tìm thấy phòng</h1>
        <Button onClick={() => navigate('/search')}>Quay lại danh sách phòng</Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-up">
      <button onClick={() => navigate(`/room/${room.id}`)}
        className="inline-flex items-center gap-2 text-sm text-ink-soft mb-4 hover:text-terracotta-500">
        <ArrowLeft className="w-4 h-4" /> Quay lại phòng {room.code}
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* === FORM === */}
        <div className="lg:col-span-2">
          {/* Header + Stepper */}
          <Card className="mb-6 overflow-hidden">
            <div className="p-6 border-b border-cream-dark">
              <h1 className="font-display text-2xl font-bold mb-1">Đăng ký thuê phòng {room.code}</h1>
              <p className="text-sm text-ink-soft">
                Hoàn thành 3 bước để gửi yêu cầu cho nhân viên Sale
              </p>
            </div>

            {/* Stepper */}
            <div className="flex items-center px-6 py-5 bg-warm-white">
              {[
                { num: 1, label: 'Thông tin cá nhân' },
                { num: 2, label: 'Tiêu chí thuê' },
                { num: 3, label: 'Liên lạc & xác nhận' },
              ].map((s, idx) => (
                <div key={s.num} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                      step > s.num
                        ? 'bg-mint text-white'
                        : step === s.num
                        ? 'bg-terracotta-500 text-white ring-4 ring-terracotta-100'
                        : 'bg-cream-dark text-ink-muted'
                    }`}>
                      {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <div className="hidden sm:block">
                      <div className={`text-xs font-medium ${
                        step >= s.num ? 'text-ink' : 'text-ink-muted'
                      }`}>Bước {s.num}</div>
                      <div className={`text-sm font-display font-semibold ${
                        step >= s.num ? 'text-ink' : 'text-ink-muted'
                      }`}>{s.label}</div>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-0.5 mx-3 transition-all ${
                      step > s.num ? 'bg-mint' : 'bg-cream-dark'
                    }`}/>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* === BƯỚC 1: THÔNG TIN CÁ NHÂN === */}
          {step === 1 && (
            <Card className="p-6 animate-fade-up">
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold mb-1">Thông tin cá nhân</h2>
                <p className="text-sm text-ink-soft">
                  Chúng tôi đã tự động điền từ tài khoản của bạn. Vui lòng kiểm tra và bổ sung.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="fullName" className="mb-2 block">Họ và tên *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    <Input
                      id="fullName"
                      placeholder="Nguyễn Văn A"
                      value={personalInfo.fullName}
                      onChange={e => setPersonalInfo({...personalInfo, fullName: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dob" className="mb-2 block">Ngày sinh *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={personalInfo.dateOfBirth}
                      onChange={e => setPersonalInfo({...personalInfo, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender" className="mb-2 block">Giới tính *</Label>
                    <select
                      id="gender"
                      value={personalInfo.gender}
                      onChange={e => setPersonalInfo({...personalInfo, gender: e.target.value})}
                      disabled={!!lockedGender}
                      className="flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 text-sm focus:outline-none focus:border-terracotta-500 disabled:bg-cream-light disabled:text-ink-soft disabled:cursor-not-allowed"
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                    {lockedGender && (
                      <p className="text-[11px] text-ink-muted mt-1">Lấy từ hồ sơ của bạn — không thể thay đổi tại đây.</p>
                    )}
                  </div>
                </div>

                {genderMismatch && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Phòng <strong>{room.code || room.id}</strong> chỉ dành cho khách <strong>{room.gender}</strong>. Giới tính của bạn không phù hợp nên không thể đăng ký phòng này. Vui lòng chọn phòng khác.</span>
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="mb-2 block">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ban@email.com"
                      value={personalInfo.email}
                      onChange={e => setPersonalInfo({...personalInfo, email: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="mb-2 block">Số điện thoại *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                      <Input
                        id="phone"
                        placeholder="0901234567"
                        value={personalInfo.phone}
                        onChange={e => setPersonalInfo({...personalInfo, phone: e.target.value})}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cccd" className="mb-2 block">CCCD *</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                      <Input
                        id="cccd"
                        placeholder="079123456789"
                        value={personalInfo.idNumber}
                        onChange={e => setPersonalInfo({...personalInfo, idNumber: e.target.value})}
                        className="pl-10"
                        maxLength="12"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-mint-light/30 border border-mint/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-ink-soft">
                  <AlertCircle className="w-4 h-4 text-mint-dark flex-shrink-0 mt-0.5" />
                  <span>Thông tin sẽ được dùng để liên hệ xác nhận lịch xem phòng và lập hợp đồng. Vui lòng nhập chính xác.</span>
                </div>
              </div>
            </Card>
          )}

          {/* === BƯỚC 2: TIÊU CHÍ THUÊ === */}
          {step === 2 && (
            <Card className="p-6 animate-fade-up">
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold mb-1">Tiêu chí thuê</h2>
                <p className="text-sm text-ink-soft">Cho chúng tôi biết bạn muốn thuê như thế nào</p>
              </div>

              <div className="space-y-5">
                {/* Hình thức thuê — ràng buộc theo loại phòng */}
                <div>
                  <Label className="mb-2 block">Hình thức thuê *</Label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { value: 'shared_bed', emoji: '🛏️', title: 'Thuê giường (ghép)', desc: `${(room.pricePerBed/1000000).toFixed(1)}tr/giường/tháng` },
                      { value: 'whole_room', emoji: '🏠', title: 'Thuê nguyên phòng', desc: `${(room.priceWholeRoom/1000000).toFixed(1)}tr/phòng/tháng` },
                    ].filter(opt => opt.value === forcedRentType).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRentalCriteria({
                          ...rentalCriteria,
                          rentType: opt.value,
                          numberOfBeds: opt.value === 'whole_room' ? room.capacity : 1,
                          numberOfPeople: opt.value === 'whole_room' ? room.capacity : 1,
                        })}
                        className={`p-4 rounded-xl border-[1.5px] text-left transition ${
                          rentalCriteria.rentType === opt.value
                            ? 'border-terracotta-500 bg-terracotta-50'
                            : 'border-cream-dark hover:border-terracotta-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{opt.emoji}</div>
                        <div className="font-display font-bold mb-1">{opt.title}</div>
                        <div className="text-xs text-ink-soft">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted mt-1.5">
                    {forcedRentType === 'whole_room'
                      ? 'Phòng nguyên căn được thuê trọn cho cả nhóm — không tính theo từng giường.'
                      : 'Phòng ở ghép — bạn chọn số giường muốn thuê bên dưới.'}
                  </p>
                </div>

                {/* Số giường (chỉ hiện khi thuê ghép) */}
                {rentalCriteria.rentType === 'shared_bed' && (
                  <div>
                    <Label className="mb-2 block">Số giường muốn thuê *</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRentalCriteria({
                          ...rentalCriteria,
                          numberOfBeds: Math.max(1, rentalCriteria.numberOfBeds - 1),
                          numberOfPeople: Math.max(1, rentalCriteria.numberOfBeds - 1),
                        })}
                        className="w-10 h-10 rounded-lg border-[1.5px] border-cream-dark hover:border-terracotta-300 flex items-center justify-center font-bold text-lg"
                      >−</button>
                      <div className="flex-1 h-10 border-[1.5px] border-cream-dark rounded-lg flex items-center justify-center font-display font-bold">
                        {rentalCriteria.numberOfBeds} giường
                      </div>
                      <button
                        type="button"
                        onClick={() => setRentalCriteria({
                          ...rentalCriteria,
                          numberOfBeds: Math.min(room.bedsAvailable, rentalCriteria.numberOfBeds + 1),
                          numberOfPeople: Math.min(room.bedsAvailable, rentalCriteria.numberOfBeds + 1),
                        })}
                        className="w-10 h-10 rounded-lg border-[1.5px] border-cream-dark hover:border-terracotta-300 flex items-center justify-center font-bold text-lg"
                      >+</button>
                    </div>
                    <p className="text-xs text-ink-muted mt-1.5">
                      Còn {room.bedsAvailable} giường trống trong phòng này
                    </p>
                  </div>
                )}

                {/* Thuê nhóm */}
                {rentalCriteria.numberOfBeds >= 2 && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rentalCriteria.hasGroup}
                        onChange={e => setRentalCriteria({...rentalCriteria, hasGroup: e.target.checked})}
                        className="accent-terracotta-500 w-4 h-4"
                      />
                      <span className="text-sm font-medium">Thuê theo nhóm (cần khai báo thành viên)</span>
                    </label>
                    {rentalCriteria.hasGroup && (
                      <GroupMembersSection
                        members={rentalCriteria.groupMembers}
                        maxMembers={rentalCriteria.numberOfBeds - 1}
                        representativeIsMe={rentalCriteria.representativeIsMe}
                        representative={rentalCriteria.representative}
                        onMembersChange={(m) => setRentalCriteria({...rentalCriteria, groupMembers: m})}
                        onRepresentativeChange={(isMe, rep) =>
                          setRentalCriteria({...rentalCriteria, representativeIsMe: isMe, representative: rep})
                        }
                        currentUser={personalInfo}
                        requiredGender={roomGenderLocked ? room.gender : null}
                      />
                    )}
                  </div>
                )}

                {/* Ngày vào ở + Thời hạn */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="moveIn" className="mb-2 block">Ngày dự kiến vào ở *</Label>
                    <Input
                      id="moveIn"
                      type="date"
                      value={rentalCriteria.moveInDate}
                      onChange={e => setRentalCriteria({...rentalCriteria, moveInDate: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration" className="mb-2 block">Thời hạn thuê *</Label>
                    <select
                      id="duration"
                      value={rentalCriteria.duration}
                      onChange={e => setRentalCriteria({...rentalCriteria, duration: Number(e.target.value)})}
                      className="flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 text-sm focus:outline-none focus:border-terracotta-500"
                    >
                      {DURATION_OPTIONS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Ghi chú */}
                <div>
                  <Label htmlFor="notes" className="mb-2 block">Ghi chú thêm (không bắt buộc)</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    placeholder="Ví dụ: Tôi cần phòng tầng cao, không hút thuốc..."
                    value={rentalCriteria.notes}
                    onChange={e => setRentalCriteria({...rentalCriteria, notes: e.target.value})}
                    className="w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:border-terracotta-500"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* === BƯỚC 3: KHUNG GIỜ TIỆN LIÊN LẠC === */}
          {step === 3 && (
            <Card className="p-6 animate-fade-up">
                <div className="mb-6">
                <h2 className="font-display text-xl font-bold mb-1">Liên lạc & xác nhận</h2>
                <p className="text-sm text-ink-soft">
                    Cho chúng tôi biết cách liên hệ thuận tiện nhất. Nhân viên Sale sẽ chủ động gọi bạn để sắp xếp lịch xem phòng.
                </p>
                </div>

                <div className="space-y-5">
                {/* Phương thức liên lạc */}
                <div>
                    <Label className="mb-2 block">Bạn muốn được liên hệ qua đâu?</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CONTACT_METHODS.map(m => (
                        <button
                        key={m.value}
                        type="button"
                        onClick={() => setContactPreference({...contactPreference, preferredMethod: m.value})}
                        className={`p-3 rounded-lg border-[1.5px] text-center transition ${
                            contactPreference.preferredMethod === m.value
                            ? 'border-terracotta-500 bg-terracotta-50'
                            : 'border-cream-dark hover:border-terracotta-300'
                        }`}
                        >
                        <div className="text-2xl mb-1">{m.icon}</div>
                        <div className="text-xs font-semibold">{m.label}</div>
                        </button>
                    ))}
                    </div>
                </div>

                {/* Khung giờ tiện liên lạc */}
                <div>
                    <Label className="mb-2 block">Khung giờ thuận tiện (chọn nhiều)</Label>
                    <p className="text-xs text-ink-muted mb-2.5">
                    Đây chỉ là đề xuất giúp nhân viên liên hệ vào lúc bạn rảnh, không phải lịch xem phòng cố định.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                    {CONTACT_TIME_SLOTS.map(t => {
                        const isSelected = contactPreference.preferredTimes.includes(t.value)
                        return (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                            setContactPreference({
                                ...contactPreference,
                                preferredTimes: isSelected
                                ? contactPreference.preferredTimes.filter(x => x !== t.value)
                                : [...contactPreference.preferredTimes, t.value]
                            })
                            }}
                            className={`p-3 rounded-lg border-[1.5px] text-left flex items-center gap-3 transition ${
                            isSelected
                                ? 'border-terracotta-500 bg-terracotta-50'
                                : 'border-cream-dark hover:border-terracotta-300'
                            }`}
                        >
                            <div className="text-2xl flex-shrink-0">{t.icon}</div>
                            <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{t.label}</div>
                            <div className="text-xs text-ink-muted">{t.desc}</div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-terracotta-500 flex-shrink-0" />}
                        </button>
                        )
                    })}
                    </div>
                </div>

                {/* Ghi chú */}
                <div>
                    <Label htmlFor="contactNotes" className="mb-2 block">Ghi chú cho nhân viên (không bắt buộc)</Label>
                    <textarea
                    id="contactNotes"
                    rows={3}
                    placeholder="Ví dụ: Tôi đi học từ 7h-11h, sau đó rảnh. Hoặc: Vui lòng gọi bằng tiếng Anh..."
                    value={contactPreference.notes}
                    onChange={e => setContactPreference({...contactPreference, notes: e.target.value})}
                    className="w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:border-terracotta-500"
                    />
                </div>

                {/* Tóm tắt quy trình tiếp theo */}
                <div className="bg-mint-light/30 border border-mint/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-mint rounded-lg flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="font-display font-bold text-sm mb-2">Sau khi gửi đăng ký:</div>
                        <ol className="space-y-1.5 text-xs text-ink-soft">
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-mint-dark">1.</span>
                            <span>Đơn của bạn sẽ được gửi đến Nhân viên Sale phụ trách</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-mint-dark">2.</span>
                            <span>NV Sale kiểm tra phòng còn trống và đối chiếu điều kiện cho thuê</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-mint-dark">3.</span>
                            <span>NV liên hệ bạn theo phương thức & khung giờ đã chọn để xác nhận lịch xem phòng</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-mint-dark">4.</span>
                            <span>Bạn có thể theo dõi tiến độ tại mục <strong>"Đặt phòng của tôi"</strong></span>
                        </li>
                        </ol>
                    </div>
                    </div>
                </div>

                {/* Cảnh báo hotline */}
                <div className="bg-gold-light/30 border border-gold/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-ink-soft">
                    <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <span>Nếu cần xem phòng gấp, vui lòng gọi hotline <a href="tel:19001234" className="text-terracotta-500 font-semibold">1900 1234</a> để được hỗ trợ ngay.</span>
                </div>
                </div>
            </Card>
          )}

          {submitError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
          </div>
          )}

          {/* === NAVIGATION BUTTONS === */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </Button>
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              >
                Tiếp theo <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                variant="mint"
              >
                <Check className="w-4 h-4" /> {submitting ? 'Đang gửi…' : 'Gửi đăng ký'}
              </Button>
            )}
          </div>
        </div>

        {/* === SIDEBAR: TÓM TẮT PHÒNG === */}
        <aside className="lg:col-span-1">
          <Card className="p-5 sticky top-24">
            <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 rounded-xl flex items-center justify-center text-6xl mb-4">
              {room.emoji}
            </div>
            <h3 className="font-display font-bold text-lg mb-1">Phòng {room.code}</h3>
            <div className="flex items-center gap-1 text-xs text-ink-muted mb-3">
              <MapPin className="w-3.5 h-3.5" /> {room.address}
            </div>

            <div className="space-y-2 text-sm border-t border-cream-dark pt-3">
              <div className="flex justify-between">
                <span className="text-ink-soft">Loại phòng:</span>
                <span className="font-semibold">{room.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Sức chứa:</span>
                <span className="font-semibold">{room.capacity} người</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Giới tính:</span>
                <span className="font-semibold">{room.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Còn trống:</span>
                <span className="font-semibold text-mint-dark">{room.bedsAvailable} giường</span>
              </div>
            </div>

            <div className="border-t border-cream-dark pt-3 mt-3">
              <div className="text-xs text-ink-muted mb-1">Giá từ</div>
              <div className="font-display text-2xl font-bold text-terracotta-500">
                {(room.pricePerBed/1000000).toFixed(1)}tr<span className="text-sm font-normal text-ink-muted">/giường</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// ============== COMPONENT CON: KHAI BÁO THÀNH VIÊN NHÓM ==============
function GroupMembersSection({
  members, maxMembers, representativeIsMe, representative,
  onMembersChange, onRepresentativeChange, currentUser, requiredGender
}) {
  const [newMember, setNewMember] = useState({ name: '', phone: '', idNumber: '', gender: '' })
  const [memberError, setMemberError] = useState('')

  const addMember = () => {
    if (!newMember.name || !newMember.phone) {
      setMemberError('Vui lòng nhập đủ Tên và SĐT của thành viên')
      return
    }
    if (members.length >= maxMembers) {
      setMemberError(`Tối đa ${maxMembers} thành viên (chưa tính bạn)`)
      return
    }
    // Phòng dành riêng nam/nữ -> mọi thành viên phải đúng giới tính của phòng.
    if (requiredGender) {
      if (!newMember.gender) {
        setMemberError(`Phòng này chỉ dành cho khách ${requiredGender}. Vui lòng chọn giới tính của thành viên.`)
        return
      }
      if (newMember.gender !== requiredGender) {
        setMemberError(`Phòng này chỉ dành cho khách ${requiredGender}, nên thành viên ${newMember.gender.toLowerCase()} không thể ở cùng. Nhóm có cả nam và nữ vui lòng chọn phòng hỗn hợp.`)
        return
      }
    }
    setMemberError('')
    onMembersChange([...members, { ...newMember, id: Date.now() }])
    setNewMember({ name: '', phone: '', idNumber: '', gender: '' })
  }

  const removeMember = (id) => {
    const newList = members.filter(m => m.id !== id)
    onMembersChange(newList)
    // Nếu đại diện đang là member này → reset về "tôi"
    if (representative?.id === id) {
      onRepresentativeChange(true, null)
    }
  }

  return (
    <div className="mt-4 p-4 bg-warm-white rounded-xl border border-cream-dark space-y-4">
      {requiredGender && (
        <div className="flex items-start gap-2 p-2.5 bg-gold-light/40 border border-gold/40 rounded-lg text-xs text-ink-soft">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
          <span>Phòng này chỉ dành cho khách <strong>{requiredGender}</strong> — mọi thành viên trong nhóm phải là {requiredGender}. Nếu nhóm có cả nam và nữ, hãy chọn <strong>phòng hỗn hợp</strong>.</span>
        </div>
      )}
      {/* Người đại diện */}
      <div>
        <Label className="mb-2 block">Người đại diện ký hợp đồng *</Label>
        <div className="space-y-2">
          <label className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border-[1.5px] ${
            representativeIsMe ? 'border-terracotta-500 bg-terracotta-50' : 'border-cream-dark'
          }`}>
            <input
              type="radio"
              checked={representativeIsMe}
              onChange={() => onRepresentativeChange(true, null)}
              className="accent-terracotta-500"
            />
            <span className="text-sm font-medium">Tôi ({currentUser.fullName || 'người đang đăng ký'})</span>
          </label>
          {members.length > 0 && members.map(m => (
            <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border-[1.5px] ${
              !representativeIsMe && representative?.id === m.id ? 'border-terracotta-500 bg-terracotta-50' : 'border-cream-dark'
            }`}>
              <input
                type="radio"
                checked={!representativeIsMe && representative?.id === m.id}
                onChange={() => onRepresentativeChange(false, m)}
                className="accent-terracotta-500"
              />
              <span className="text-sm">{m.name} ({m.phone})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Danh sách thành viên đã thêm */}
      {members.length > 0 && (
        <div>
          <Label className="mb-2 block">Thành viên cùng thuê ({members.length}/{maxMembers})</Label>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-cream-dark">
                <Users className="w-4 h-4 text-ink-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-ink-muted">{m.phone} {m.gender && `· ${m.gender}`}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="text-red-500 hover:bg-red-50 rounded p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thêm thành viên */}
      {members.length < maxMembers && (
        <div className="space-y-2 pt-3 border-t border-cream-dark">
          <Label className="block">Thêm thành viên</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Họ tên *"
              value={newMember.name}
              onChange={e => setNewMember({...newMember, name: e.target.value})}
              className="text-sm"
            />
            <Input
              placeholder="SĐT *"
              value={newMember.phone}
              onChange={e => setNewMember({...newMember, phone: e.target.value})}
              className="text-sm"
            />
            <Input
              placeholder="CCCD"
              value={newMember.idNumber}
              onChange={e => setNewMember({...newMember, idNumber: e.target.value})}
              className="text-sm"
            />
            <select
              value={newMember.gender}
              onChange={e => setNewMember({...newMember, gender: e.target.value})}
              className="flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-3 text-sm"
            >
              <option value="">{requiredGender ? `Giới tính * (${requiredGender})` : 'Giới tính'}</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>
          {memberError && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {memberError}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addMember} className="w-full">
            <Plus className="w-4 h-4" /> Thêm thành viên
          </Button>
        </div>
      )}
    </div>
  )
}