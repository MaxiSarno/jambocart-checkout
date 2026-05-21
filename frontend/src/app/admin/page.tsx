'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AnalyticsData, MethodStat, PaymentMethod } from '@/types/payment'
import { getAnalytics } from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const API = 'http://localhost:4000'

const TYPE_LABELS: Record<string, string> = {
  mobile_money:  'Mobile Money',
  card:          'Card',
  bnpl:          'Buy Now Pay Later',
  bank_transfer: 'Bank Transfer',
  wallet:        'Digital Wallet',
  aggregator:    'Aggregator',
}

const TYPE_STYLES: Record<string, string> = {
  mobile_money:  'bg-emerald-100 text-emerald-700',
  card:          'bg-blue-100 text-blue-700',
  bnpl:          'bg-purple-100 text-purple-700',
  bank_transfer: 'bg-orange-100 text-orange-700',
  wallet:        'bg-sky-100 text-sky-700',
  aggregator:    'bg-gray-100 text-gray-600',
}

const COUNTRY_TABS = [
  { code: 'KE',  label: '🇰🇪 Kenya' },
  { code: 'UG',  label: '🇺🇬 Uganda' },
  { code: 'TZ',  label: '🇹🇿 Tanzania' },
  { code: 'US',  label: '🌍 International' },
]

const PREVIEW_CONTEXT = {
  country: 'KE', currency: 'KES', deviceType: 'mobile' as const,
  amountUSD: 100, isReturning: false, previousMethodId: '', customerAge: '26-40' as const,
}

type SortKey = 'name' | 'volume' | 'approvalRate' | 'avgAmount' | 'trend'

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900 truncate">{value}</p>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

function SortHeader({ label, col, sortBy, sortDir, onSort }: {
  label: string; col: SortKey | null
  sortBy: SortKey; sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
}) {
  const active = col && sortBy === col
  return (
    <th
      onClick={() => col && onSort(col)}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${col ? 'cursor-pointer select-none hover:text-indigo-600' : ''} ${active ? 'text-indigo-600' : 'text-gray-500'}`}
    >
      {label}{active && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [analytics,     setAnalytics]     = useState<AnalyticsData | null>(null)
  const [loadingData,   setLoadingData]   = useState(true)
  const [dataError,     setDataError]     = useState<string | null>(null)
  const [activeCountry, setActiveCountry] = useState('KE')

  // Section 4 — boost/suppress
  const [boostValues,       setBoostValues]       = useState<Record<string, number>>({})
  const [suppressedMethods, setSuppressedMethods] = useState<Record<string, boolean>>({})
  const [previewRanking,    setPreviewRanking]    = useState<PaymentMethod[] | null>(null)
  const [previewLoading,    setPreviewLoading]    = useState(false)

  // Section 5 — sortable table
  const [sortBy,  setSortBy]  = useState<SortKey>('volume')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch(err => setDataError(err.message))
      .finally(() => setLoadingData(false))
  }, [])

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const handleApplyPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const boosts: Record<string, number | 'suppressed'> = {}
      Object.entries(suppressedMethods).forEach(([id, on]) => { if (on) boosts[id] = 'suppressed' })
      Object.entries(boostValues).forEach(([id, v]) => { if (!boosts[id] && v !== 0) boosts[id] = v })

      const res = await fetch(`${API}/api/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...PREVIEW_CONTEXT, boosts }),
      })
      const data = await res.json()
      setPreviewRanking(data.ranked)
    } catch { /* silent */ }
    finally { setPreviewLoading(false) }
  }, [boostValues, suppressedMethods])

  if (loadingData) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">Loading dashboard…</p>
    </div>
  )

  if (dataError || !analytics) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500 text-sm">{dataError ?? 'Failed to load analytics'}</p>
    </div>
  )

  const { overallStats: stats, signalPerformance, methodsByCountry, methodStats } = analytics
  const maxConversions = signalPerformance[0]?.conversions ?? 1
  const countryMethods = methodsByCountry[activeCountry] ?? []

  const sortedMethods = [...methodStats].sort((a: MethodStat, b: MethodStat) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'name' || sortBy === 'trend') return dir * a[sortBy].localeCompare(b[sortBy])
    return dir * ((a[sortBy] as number) - (b[sortBy] as number))
  })

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="text-sm text-gray-500 hover:text-indigo-600 font-medium transition-colors">
              ← Back to checkout
            </Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-xl font-black text-indigo-600 tracking-tight hidden sm:inline">JamboCart Admin</span>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full">
              Merchant Dashboard
            </span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            {stats.totalTransactions} transactions
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-10">

        {/* ── Section 1: Overview stats ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Transactions"    value={stats.totalTransactions.toString()} />
            <MetricCard label="Overall Approval Rate" value={`${stats.approvalRate}%`} />
            <MetricCard label="Top Performing Method" value={stats.topMethod} />
            <MetricCard label="Avg Transaction"       value={`$${stats.avgAmount}`} />
          </div>
        </section>

        {/* ── Section 2: Signal Performance ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-1">Ranking signals driving conversions</h2>
          <p className="text-xs text-gray-400 mb-4">How each scoring signal influences checkout outcomes across all transactions</p>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {signalPerformance.map((s, i) => (
              <div
                key={s.signal}
                className={`flex items-center gap-4 px-5 py-4 ${i < signalPerformance.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="w-44 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-800">{s.signal}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{s.description}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((s.conversions / maxConversions) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <span className="text-sm font-bold text-gray-900">{s.conversions}</span>
                  <p className="text-xs text-gray-400">conversions</p>
                </div>
                <div className="w-14 text-right flex-shrink-0 hidden lg:block">
                  <span className="text-sm font-bold text-indigo-600">+{s.avgScore}</span>
                  <p className="text-xs text-gray-400">avg pts</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Top methods by country ────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Top methods by country</h2>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {COUNTRY_TABS.map(tab => (
              <button
                key={tab.code}
                onClick={() => setActiveCountry(tab.code)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeCountry === tab.code
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {countryMethods.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">No data for this region</p>
            ) : (
              countryMethods.map((m, i) => (
                <div key={m.methodId} className={`flex items-center gap-4 px-5 py-4 ${i < countryMethods.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                    <TypeBadge type={m.type} />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.approvalRate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-emerald-700 w-12 text-right">{m.approvalRate}%</span>
                  </div>
                  <div className="w-20 text-right flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700">{m.volume}</span>
                    <p className="text-xs text-gray-400">transactions</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Section 4: Boost / Suppress controls ─────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-1">Promotional controls</h2>
          <p className="text-xs text-gray-400 mb-4">Manually adjust method visibility for business reasons</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Controls list */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {methodStats.map((m, i) => {
                const val        = boostValues[m.id] ?? 0
                const suppressed = suppressedMethods[m.id] ?? false
                return (
                  <div
                    key={m.id}
                    className={`px-5 py-4 ${i < methodStats.length - 1 ? 'border-b border-gray-100' : ''} transition-opacity ${suppressed ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                        <TypeBadge type={m.type} />
                      </div>
                      <button
                        onClick={() => setSuppressedMethods(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          suppressed
                            ? 'bg-red-50 border-red-200 text-red-600'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        {suppressed ? 'Suppressed' : 'Active'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 flex-shrink-0">Boost score:</span>
                      <input
                        type="range"
                        min={-50} max={50} step={5}
                        value={val}
                        disabled={suppressed}
                        onChange={e => setBoostValues(prev => ({ ...prev, [m.id]: parseInt(e.target.value) }))}
                        className="flex-1 accent-indigo-600 disabled:opacity-30"
                      />
                      <span className={`text-xs font-bold w-14 text-right flex-shrink-0 ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {val > 0 ? `+${val}` : val} pts
                      </span>
                    </div>
                  </div>
                )
              })}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={handleApplyPreview}
                  disabled={previewLoading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold transition"
                >
                  {previewLoading ? 'Ranking…' : 'Apply & Preview →'}
                </button>
              </div>
            </div>

            {/* Preview panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Ranking Preview — KE · mobile · $100
              </p>
              {!previewRanking ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-gray-400">
                  <div className="text-4xl mb-3">⚙️</div>
                  <p className="text-sm font-medium">Apply controls to see how rankings change</p>
                  <p className="text-xs mt-1">Adjust sliders or suppress methods, then click "Apply & Preview"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {previewRanking.map(r => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        r.rank === 1 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        r.rank === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {r.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {r.reasons
                            .filter(rs => rs.includes('merchant'))
                            .map((rs, j) => (
                              <span
                                key={j}
                                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  rs.includes('Promoted') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                }`}
                              >
                                {rs}
                              </span>
                            ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">{r.confidence}%</span>
                        <p className="text-xs text-gray-400">confidence</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 5: Method performance table ──────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Method performance</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <SortHeader label="Method"      col="name"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Type"        col={null}        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Volume"      col="volume"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Approval %"  col="approvalRate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Avg Amount"  col="avgAmount"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Trend"       col="trend"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedMethods.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 transition-colors ${i < sortedMethods.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{m.name}</td>
                    <td className="px-4 py-3"><TypeBadge type={m.type} /></td>
                    <td className="px-4 py-3 text-gray-700">{m.volume}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.approvalRate}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{m.approvalRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">${m.avgAmount}</td>
                    <td className="px-4 py-3 text-lg font-bold">
                      {m.trend === 'up'   && <span className="text-emerald-500">↑</span>}
                      {m.trend === 'down' && <span className="text-red-400">↓</span>}
                      {m.trend === 'stable' && <span className="text-gray-300">→</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}
