import { PaymentMethod } from '@/types/payment'

const TYPE_STYLES: Record<PaymentMethod['type'], string> = {
  mobile_money:  'bg-emerald-100 text-emerald-700',
  card:          'bg-blue-100 text-blue-700',
  bnpl:          'bg-purple-100 text-purple-700',
  bank_transfer: 'bg-orange-100 text-orange-700',
  wallet:        'bg-sky-100 text-sky-700',
  aggregator:    'bg-gray-100 text-gray-600',
}

const TYPE_LABELS: Record<PaymentMethod['type'], string> = {
  mobile_money:  'Mobile Money',
  card:          'Card',
  bnpl:          'Buy Now Pay Later',
  bank_transfer: 'Bank Transfer',
  wallet:        'Digital Wallet',
  aggregator:    'Aggregator',
}

function confidenceColor(confidence: number) {
  if (confidence >= 70) return 'bg-emerald-500'
  if (confidence >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

interface PaymentCardProps {
  method: PaymentMethod
  compact?: boolean
}

export default function PaymentCard({ method, compact = false }: PaymentCardProps) {
  const isTop = method.rank === 1
  const padding = compact ? 'p-3.5' : 'p-5'

  const containerCls = isTop
    ? `${padding} rounded-xl border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-white shadow-sm`
    : `${padding} rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow`

  return (
    <div className={containerCls}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div
          className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
            isTop
              ? 'bg-indigo-600 text-white'
              : method.rank <= 3
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          #{method.rank}
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
              {method.name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[method.type]}`}>
              {TYPE_LABELS[method.type]}
            </span>
            {isTop && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white">
                Best match
              </span>
            )}
          </div>
          {!compact && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{method.description}</p>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Confidence</span>
          <span className={`text-xs font-semibold ${
            method.confidence >= 70 ? 'text-emerald-600' :
            method.confidence >= 40 ? 'text-amber-600' : 'text-red-500'
          }`}>
            {method.confidence}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${confidenceColor(method.confidence)}`}
            style={{ width: `${method.confidence}%` }}
          />
        </div>
      </div>

      {/* Reasons */}
      {method.reasons.length > 0 && (
        <ul className={`mt-3 space-y-1 ${compact ? 'hidden sm:block' : ''}`}>
          {method.reasons.slice(0, compact ? 2 : undefined).map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
              <span className="text-emerald-500 flex-shrink-0 font-bold mt-px">✓</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
