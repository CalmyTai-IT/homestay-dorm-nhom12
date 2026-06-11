import { Phone, Mail, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-ink text-cream mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        {/* BRAND */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center text-white font-display font-bold">H</div>
            <div className="font-display font-bold text-lg">HomeStay Dorm</div>
          </div>
          <p className="text-sm opacity-70 leading-relaxed">
            Hệ thống ký túc xá tư nhân cung cấp dịch vụ lưu trú dài hạn chất lượng cao tại TP.HCM.
          </p>
        </div>

        {/* SERVICES */}
        <div>
          <h4 className="font-display font-semibold mb-3">Dịch vụ</h4>
          <ul className="text-sm opacity-70 space-y-2">
            <li className="hover:opacity-100 cursor-pointer">Thuê phòng nguyên căn</li>
            <li className="hover:opacity-100 cursor-pointer">Thuê giường ở ghép</li>
            <li className="hover:opacity-100 cursor-pointer">Đặt cọc online</li>
            <li className="hover:opacity-100 cursor-pointer">Hỗ trợ 24/7</li>
          </ul>
        </div>

        {/* BRANCHES */}
        <div>
          <h4 className="font-display font-semibold mb-3">Chi nhánh</h4>
          <ul className="text-sm opacity-70 space-y-2">
            <li>Quận 5 — TP.HCM</li>
            <li>Quận 10 — TP.HCM</li>
            <li>Thủ Đức — TP.HCM</li>
          </ul>
        </div>

        {/* CONTACT */}
        <div>
          <h4 className="font-display font-semibold mb-3">Liên hệ</h4>
          <ul className="text-sm opacity-70 space-y-2">
            <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> 1900 1234</li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> hello@homestaydorm.vn</li>
            <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> 227 Nguyễn Văn Cừ, Q.5</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs opacity-50">
        © 2026 HomeStay Dorm. Đồ án môn Phân tích thiết kế hệ thống thông tin — Nhóm 12.
      </div>
    </footer>
  )
}
