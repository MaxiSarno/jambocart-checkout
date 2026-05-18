'use client'

import { useState } from 'react'
import { PaymentMethod } from '@/types/payment'
import PaymentCard from './PaymentCard'

function SkeletonCard() {
  return (
    <div className="p-5 rounded-xl border border-gray-200 bg-white animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
      <div className="mt-4 h-1.5 bg-gray-200 rounded-full" />
      <div className="mt-3 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="h-3 bg-gray-100 rounded w-3/5" />
      </div>
    </div>
  )
}

interface RankingResultsProps {
  ranked: PaymentMethod[]
  loading: boolean
}

export default function RankingResults({ ranked, loading }: RankingResultsProps) {
  const [showMore, setShowMore] = useState(false)

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 bg-gray-200 rounded w-40 animate-pulse mb-4" />
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-500 text-sm font-medium">
          No payment methods available for this combination
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Try a different country, currency, or amount.
        </p>
      </div>
    )
  }

  const top     = ranked.slice(0, 3)
  const rest    = ranked.slice(3)

  return (
    <div>
      {/* Recommended */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Recommended for you
      </h2>
      <div className="space-y-3">
        {top.map((method, i) => (
          <div
            key={method.id}
            className="animate-fade-slide-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <PaymentCard method={method} />
          </div>
        ))}
      </div>

      {/* Also available */}
      {rest.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowMore(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 uppercase tracking-wide hover:text-indigo-600 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fillRule="evenodd" clipRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              />
            </svg>
            {showMore ? 'Hide' : `Show ${rest.length} more option${rest.length > 1 ? 's' : ''}`}
          </button>

          {showMore && (
            <div className="mt-3 space-y-2">
              {rest.map((method, i) => (
                <div
                  key={method.id}
                  className="animate-fade-slide-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <PaymentCard method={method} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
