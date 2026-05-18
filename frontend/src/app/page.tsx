'use client'

import { useState } from 'react'
import { CheckoutContext, PaymentMethod } from '@/types/payment'
import { rankPayments } from '@/lib/api'
import ContextForm from '@/components/ContextForm'
import RankingResults from '@/components/RankingResults'

const QUICK_SCENARIOS: { label: string; context: CheckoutContext }[] = [
  {
    label: '🇰🇪 Nairobi mobile shopper',
    context: {
      country: 'KE', currency: 'KES', deviceType: 'mobile',
      amountUSD: 45, isReturning: false, previousMethodId: '', customerAge: '26-40',
    },
  },
  {
    label: '🌍 International buyer',
    context: {
      country: 'US', currency: 'USD', deviceType: 'desktop',
      amountUSD: 250, isReturning: false, previousMethodId: '', customerAge: '41+',
    },
  },
  {
    label: '🎓 Student installments',
    context: {
      country: 'KE', currency: 'KES', deviceType: 'mobile',
      amountUSD: 150, isReturning: false, previousMethodId: '', customerAge: '18-25',
    },
  },
]

export default function Home() {
  const [results, setResults]           = useState<PaymentMethod[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [formValues, setFormValues]     = useState<Partial<CheckoutContext>>({})
  const [activeScenario, setActiveScenario] = useState<number | null>(null)
  const [hasSearched, setHasSearched]   = useState(false)

  const handleSubmit = async (context: CheckoutContext) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const ranked = await rankPayments(context)
      setResults(ranked)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickScenario = (scenario: typeof QUICK_SCENARIOS[0], idx: number) => {
    setActiveScenario(idx)
    setFormValues({ ...scenario.context })
    handleSubmit(scenario.context)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-indigo-600 tracking-tight">JamboCart</span>
            <span className="ml-2 text-sm text-gray-400 font-medium hidden sm:inline">
              Smart checkout for Africa
            </span>
          </div>
          <div className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            v1.0 · beta
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-10">

        {/* Quick scenario buttons */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2.5">
            Quick scenarios
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SCENARIOS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleQuickScenario(s, i)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                  activeScenario === i
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* Left: Form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:sticky lg:top-6 shadow-sm">
            <h1 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs">⚙</span>
              Checkout context
            </h1>
            <ContextForm
              onSubmit={handleSubmit}
              initialValues={formValues}
              loading={loading}
            />
          </div>

          {/* Right: Results */}
          <div>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!hasSearched && !loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">💳</div>
                <p className="text-gray-500 text-sm font-medium">
                  Select a scenario or fill the form to rank payment methods
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  The engine scores 12 methods across 5 signals
                </p>
              </div>
            ) : (
              <RankingResults ranked={results} loading={loading} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
