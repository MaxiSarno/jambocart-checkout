'use client'

import { useEffect, useState } from 'react'
import { CheckoutContext } from '@/types/payment'

const COUNTRIES = [
  { code: 'KE', label: 'Kenya', currency: 'KES' },
  { code: 'UG', label: 'Uganda', currency: 'UGX' },
  { code: 'TZ', label: 'Tanzania', currency: 'TZS' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'US', label: 'United States', currency: 'USD' },
]

const CURRENCY_BY_COUNTRY: Record<string, string> = Object.fromEntries(
  COUNTRIES.map(c => [c.code, c.currency])
)

const PAYMENT_METHODS = [
  { id: 'mpesa',        label: 'M-PESA' },
  { id: 'airtel_money', label: 'Airtel Money' },
  { id: 'mtn_momo',     label: 'MTN Mobile Money' },
  { id: 'visa',         label: 'Visa' },
  { id: 'mastercard',   label: 'Mastercard' },
  { id: 'lipa_later',   label: 'Lipa Later' },
  { id: 'aspira',       label: 'Aspira' },
  { id: 'pesalink',     label: 'PesaLink' },
  { id: 'swift',        label: 'SWIFT Transfer' },
  { id: 'paypal',       label: 'PayPal' },
  { id: 'equity_eazzy', label: 'Equity Eazzy Pay' },
  { id: 'pesapal',      label: 'PesaPal' },
]

const DEFAULT_CONTEXT: CheckoutContext = {
  country: 'KE',
  currency: 'KES',
  deviceType: 'mobile',
  amountUSD: 100,
  isReturning: false,
  previousMethodId: '',
  customerAge: '26-40',
}

interface ContextFormProps {
  onSubmit: (context: CheckoutContext) => void
  initialValues?: Partial<CheckoutContext>
  loading?: boolean
}

export default function ContextForm({ onSubmit, initialValues, loading }: ContextFormProps) {
  const [form, setForm] = useState<CheckoutContext>(DEFAULT_CONTEXT)

  useEffect(() => {
    if (!initialValues) return
    setForm(prev => ({ ...prev, ...initialValues }))
  }, [JSON.stringify(initialValues)]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof CheckoutContext>(key: K, value: CheckoutContext[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleCountry = (country: string) => {
    setForm(prev => ({ ...prev, country, currency: CURRENCY_BY_COUNTRY[country] ?? '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition'
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'
  const radioCls =
    'flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium transition select-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Country + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Country</label>
          <select className={inputCls} value={form.country} onChange={e => handleCountry(e.target.value)}>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <input
            className={`${inputCls} bg-gray-50 text-gray-500`}
            value={form.currency}
            readOnly
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className={labelCls}>Amount (USD)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={`${inputCls} pl-7`}
            value={form.amountUSD}
            onChange={e => set('amountUSD', parseFloat(e.target.value) || 0)}
            required
          />
        </div>
      </div>

      {/* Device */}
      <div>
        <label className={labelCls}>Device</label>
        <div className="flex gap-2">
          {(['mobile', 'desktop', 'tablet'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => set('deviceType', d)}
              className={`${radioCls} flex-1 justify-center ${
                form.deviceType === d
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span>{d === 'mobile' ? '📱' : d === 'desktop' ? '🖥️' : '📟'}</span>
              <span className="capitalize">{d}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer type */}
      <div>
        <label className={labelCls}>Customer</label>
        <div className="flex gap-2">
          {[
            { value: false, label: 'New customer' },
            { value: true,  label: 'Returning' },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => set('isReturning', value)}
              className={`${radioCls} flex-1 justify-center ${
                form.isReturning === value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Previous method — only when returning */}
      {form.isReturning && (
        <div>
          <label className={labelCls}>Previous payment method</label>
          <select
            className={inputCls}
            value={form.previousMethodId}
            onChange={e => set('previousMethodId', e.target.value)}
          >
            <option value="">— select method —</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Age */}
      <div>
        <label className={labelCls}>Age group</label>
        <select
          className={inputCls}
          value={form.customerAge}
          onChange={e => set('customerAge', e.target.value as CheckoutContext['customerAge'])}
        >
          <option value="18-25">18 – 25</option>
          <option value="26-40">26 – 40</option>
          <option value="41+">41+</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Ranking…
          </span>
        ) : (
          'Find best payment methods'
        )}
      </button>
    </form>
  )
}
