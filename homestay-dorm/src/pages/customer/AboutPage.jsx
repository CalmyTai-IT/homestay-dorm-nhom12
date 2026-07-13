import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Shield, Sparkles, Users, MapPin, Phone, Mail, Clock, ChevronDown, ArrowRight, Award, Target, HandHeart } from 'lucide-react'

// Dữ liệu chi nhánh
const BRANCHES = [
  {
    name: 'Chi nhánh Quận 5',
    address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, Quận 5, TP.HCM',
    phone: '028 3835 4266',
    rooms: 80,
    near: 'Gần ĐH Khoa học Tự nhiên, ĐH Sư phạm, ĐH Y Dược',
    emoji: '🏙️',
  },
  {
    name: 'Chi nhánh Quận 10',
    address: '88 Tô Hiến Thành, Phường 14, Quận 10, TP.HCM',
    phone: '028 3835 4267',
    rooms: 60,
    near: 'Gần ĐH Bách Khoa, ĐH Kinh tế, ĐH Y Phạm Ngọc Thạch',
    emoji: '🏬',
  },
  {
    name: 'Chi nhánh Thủ Đức',
    address: 'Linh Trung, Khu phố 6, TP. Thủ Đức, TP.HCM',
    phone: '028 3835 4268',
    rooms: 70,
    near: 'Gần Làng Đại học Quốc gia, ĐH KHTN Thủ Đức',
    emoji: '🏘️',
  },
]

// Giá trị cốt lõi
const VALUES = [
  {
    icon: Shield,
    color: 'mint',
    title: 'Minh bạch',
    desc: 'Mọi điều khoản, chi phí và quy định đều được công khai rõ ràng từ đầu. Không có phí ẩn, không có bất ngờ.',
  },
  {
    icon: HandHeart,
    color: 'terracotta',
    title: 'Tận tâm',
    desc: 'Đội ngũ nhân viên luôn sẵn sàng hỗ trợ 24/7. Chúng tôi xem mỗi khách hàng như một thành viên trong gia đình.',
  },
  {
    icon: Sparkles,
    color: 'gold',
    title: 'Chất lượng',
    desc: 'Phòng ốc được vệ sinh và bảo trì thường xuyên. Tiện nghi đầy đủ, sẵn sàng cho cuộc sống thoải mái.',
  },
  {
    icon: Users,
    color: 'mint',
    title: 'Cộng đồng',
    desc: 'Không chỉ là nơi ở, HomeStay Dorm là cộng đồng kết nối những người trẻ năng động đến từ khắp nơi.',
  },
]

// FAQ
const FAQS = [
  {
    q: 'Tôi cần chuẩn bị giấy tờ gì để thuê phòng?',
    a: 'Bạn cần chuẩn bị CCCD/Passport bản gốc. Đối với khách quốc tế, vui lòng có Visa còn hạn. Khi ký hợp đồng cần cung cấp bản photo các giấy tờ này.',
  },
  {
    q: 'Số tiền cọc là bao nhiêu?',
    a: 'Tiền cọc = Tiền thuê 2 tháng × Số giường thuê. Ví dụ: thuê 1 giường với giá 1.5 triệu/tháng → cọc 3 triệu. Số tiền cọc sẽ được hoàn lại theo chính sách khi bạn trả phòng.',
  },
  {
    q: 'Nếu tôi muốn hủy thuê trước thời hạn thì sao?',
    a: 'Chính sách hoàn cọc của chúng tôi: Chưa ký HĐ (mới đặt cọc): hoàn 80%. Đã ký HĐ, lưu trú <6 tháng: hoàn 50%. Đã ký HĐ, lưu trú ≥6 tháng: hoàn 70%. Hết hạn HĐ: hoàn 100%.',
  },
  {
    q: 'Có hỗ trợ thuê nhóm không?',
    a: 'Có. Bạn có thể thuê nguyên phòng (2-6 người tùy phòng) hoặc thuê ghép theo nhóm bạn. Khi thuê nhóm, cần khai báo thông tin tất cả thành viên và chọn 1 người đại diện ký hợp đồng.',
  },
  {
    q: 'Phòng có wifi, điều hòa không?',
    a: 'Tất cả phòng đều có wifi miễn phí tốc độ cao. Hầu hết phòng đều có điều hòa. Bạn có thể xem chi tiết tiện nghi của từng phòng ở trang chi tiết phòng.',
  },
  {
    q: 'Quy định ra vào và sinh hoạt như thế nào?',
    a: 'Giờ giới nghiêm từ 23:00 — 05:00 (chỉ hạn chế ra vào, không cấm hoàn toàn nếu có lý do chính đáng). Cấm hút thuốc trong phòng, cấm nuôi thú cưng. Vệ sinh chung được dọn dẹp 2 lần/tuần.',
  },
  {
    q: 'Tôi có thể đổi phòng giữa chừng không?',
    a: 'Có thể, tùy thuộc vào phòng trống tại thời điểm đó. Bạn cần liên hệ nhân viên Sale để xin chuyển. Phí chuyển phòng (nếu có) sẽ được thông báo trước khi thực hiện.',
  },
]

export default function AboutPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(0)  // FAQ đầu tiên mở mặc định

  return (
    <div className="animate-fade-up">
      {/* =================== HERO =================== */}
      <section className="grain-bg relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-mint-light rounded-full text-xs text-mint-dark font-semibold mb-6">
            <span className="w-2 h-2 bg-mint rounded-full"></span>
            Hoạt động từ 2020
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Chúng tôi tin rằng <br />
            <span className="text-terracotta-500">một nơi ở tốt</span> sẽ thay đổi mọi thứ
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed max-w-2xl mx-auto">
            HomeStay Dorm ra đời với sứ mệnh mang đến cho sinh viên và người trẻ những không gian sống chất lượng,
            an toàn và minh bạch. Nơi mà bạn có thể tập trung học tập, làm việc và phát triển bản thân.
          </p>
        </div>
      </section>

      {/* =================== CÂU CHUYỆN =================== */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
              Câu chuyện của chúng tôi
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
              Từ một căn nhà nhỏ <br/>đến cộng đồng 1500+ khách
            </h2>
            <div className="space-y-4 text-ink-soft leading-relaxed">
              <p>
                Năm 2020, HomeStay Dorm khởi đầu chỉ với một căn nhà 4 phòng tại Quận 5,
                phục vụ các bạn sinh viên ĐH KHTN — ĐHQG TP.HCM.
              </p>
              <p>
                Chúng tôi nhận thấy thị trường thuê phòng dành cho sinh viên còn nhiều bất cập:
                hợp đồng không rõ ràng, giá cả thay đổi tùy tiện, dịch vụ kém. Vì vậy, chúng tôi
                xây dựng HomeStay Dorm với tiêu chí <strong className="text-ink">"Minh bạch — Tận tâm — Chất lượng"</strong>.
              </p>
              <p>
                Sau hơn 5 năm, từ 4 phòng ban đầu, HomeStay Dorm đã mở rộng thành <strong className="text-ink">3 chi nhánh
                với hơn 200 phòng</strong>, phục vụ <strong className="text-ink">hơn 1500 khách hàng</strong>
                là sinh viên, người đi làm và các nhóm bạn trẻ.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square bg-gradient-to-br from-terracotta-200 to-terracotta-300 rounded-[3rem] flex items-center justify-center text-9xl shadow-xl">
              🏡
            </div>
            <Card className="absolute -bottom-6 -right-6 p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <Award className="w-10 h-10 text-gold" />
                <div>
                  <div className="font-display font-bold text-lg leading-none">5+ năm</div>
                  <div className="text-xs text-ink-muted mt-1">Kinh nghiệm</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* =================== THÔNG SỐ =================== */}
      <section className="bg-warm-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
              Con số biết nói
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              HomeStay Dorm trong những con số
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: '200+', label: 'Phòng cho thuê', icon: '🛏️' },
              { num: '3', label: 'Chi nhánh tại TP.HCM', icon: '📍' },
              { num: '1500+', label: 'Khách hàng tin tưởng', icon: '😊' },
              { num: '4.8/5', label: 'Đánh giá trung bình', icon: '⭐' },
            ].map((stat, i) => (
              <Card key={i} className="p-6 text-center hover:-translate-y-1 hover:shadow-md transition">
                <div className="text-4xl mb-2">{stat.icon}</div>
                <div className="font-display text-3xl font-extrabold text-terracotta-500 mb-1">
                  {stat.num}
                </div>
                <div className="text-sm text-ink-soft">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =================== GIÁ TRỊ CỐT LÕI =================== */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
            Giá trị cốt lõi
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Những điều chúng tôi tin
          </h2>
          <p className="text-ink-soft">4 giá trị định hình mọi quyết định của HomeStay Dorm</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {VALUES.map((v, i) => {
            const Icon = v.icon
            const colorMap = {
              mint: 'bg-mint-light text-mint-dark',
              terracotta: 'bg-terracotta-100 text-terracotta-600',
              gold: 'bg-gold-light text-gold',
            }
            return (
              <Card key={i} className="p-6 hover:-translate-y-1 hover:shadow-md transition">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${colorMap[v.color]}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">{v.title}</h3>
                <p className="text-ink-soft leading-relaxed">{v.desc}</p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* =================== CHI NHÁNH =================== */}
      <section className="bg-warm-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
              Hệ thống chi nhánh
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
              3 vị trí thuận lợi tại TP.HCM
            </h2>
            <p className="text-ink-soft">Đặt tại các khu vực gần các trường đại học lớn</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {BRANCHES.map((branch, i) => (
              <Card key={i} className="overflow-hidden hover:-translate-y-1 hover:shadow-lg transition">
                <div className="aspect-video bg-gradient-to-br from-terracotta-100 to-terracotta-200 flex items-center justify-center text-7xl">
                  {branch.emoji}
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg mb-1">{branch.name}</h3>
                  <div className="text-xs text-mint-dark font-semibold mb-3">
                    {branch.rooms} phòng cho thuê
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0" />
                      <span className="text-ink-soft">{branch.address}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0" />
                      <a href={`tel:${branch.phone.replace(/\s/g, '')}`} className="text-ink-soft hover:text-terracotta-500">
                        {branch.phone}
                      </a>
                    </div>
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0" />
                      <span className="text-ink-soft text-xs">{branch.near}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =================== FAQ =================== */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
            FAQ
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Câu hỏi thường gặp
          </h2>
          <p className="text-ink-soft">Những thắc mắc phổ biến khi thuê phòng tại HomeStay Dorm</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i
            return (
              <Card key={i} className="overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-warm-white transition"
                >
                  <span className="font-display font-semibold text-ink">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-terracotta-500 flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-ink-soft leading-relaxed border-t border-cream-dark pt-4">
                    {faq.a}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      {/* =================== LIÊN HỆ =================== */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <Card className="p-8 md:p-12 bg-gradient-to-br from-terracotta-50 to-warm-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-xs text-terracotta-500 font-bold uppercase tracking-wider mb-3">
                Liên hệ với chúng tôi
              </div>
              <h2 className="font-display text-3xl font-bold mb-4">
                Còn thắc mắc? Chúng tôi luôn sẵn sàng hỗ trợ
              </h2>
              <p className="text-ink-soft mb-6">
                Đội ngũ tư vấn của HomeStay Dorm hoạt động 24/7. Đừng ngại liên hệ với chúng tôi qua bất kỳ kênh nào.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-terracotta-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted">Hotline</div>
                    <a href="tel:19001234" className="font-display font-bold hover:text-terracotta-500">
                      1900 1234
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-mint rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted">Email</div>
                    <a href="mailto:hello@homestaydorm.vn" className="font-display font-bold hover:text-terracotta-500">
                      hello@homestaydorm.vn
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted">Giờ làm việc</div>
                    <div className="font-display font-bold">24/7 — Mọi ngày trong tuần</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-8xl mb-4">🏠</div>
              <h3 className="font-display text-2xl font-bold mb-2">Sẵn sàng tìm tổ ấm?</h3>
              <p className="text-sm text-ink-soft mb-5">
                Khám phá 200+ phòng đang chờ đón bạn
              </p>
              <Button size="xl" onClick={() => navigate('/search')} className="w-full md:w-auto">
                Tìm phòng ngay <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}