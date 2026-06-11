import { Card } from '@/components/ui/card'
import { Construction } from 'lucide-react'

// Trang tạm cho các chức năng staff chưa được làm
// Sẽ được thay thế dần ở các Phần B, C, D, E, F
export default function StaffPlaceholderPage({ title, description }) {
  return (
    <div className="max-w-3xl mx-auto py-12 animate-fade-up">
      <Card className="p-12 text-center">
        <div className="w-16 h-16 bg-gold-light rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Construction className="w-8 h-8 text-gold" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">{title || 'Đang phát triển'}</h1>
        <p className="text-ink-soft">
          {description || 'Chức năng này sẽ được phát triển trong các phần tiếp theo của đồ án.'}
        </p>
      </Card>
    </div>
  )
}