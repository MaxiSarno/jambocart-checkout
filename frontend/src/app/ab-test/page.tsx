'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'
import { rankPayments, getMethods } from '@/lib/api'
import type { CheckoutContext, FullPaymentMethod } from '@/types/payment'

// ── Constants ─────────────────────────────────────────────────────────────────

const SELECTION_PROBS = [0.90, 0.65, 0.45, 0.20]
const CHUNK_SIZE = 100
const AOV = 120 // average order value in USD

/**
 * 20 representative contexts spread across the target market.
 * Layout: KE(0-5) | UG(6-8) | TZ(9-11) | US(12-17) | GB(18-19)
 * Within each country: mobile/desktop × low($30)/mid($125)/high($350)
 */
const REP_CONTEXTS: CheckoutContext[] = [
  // KE — 6 contexts (mobile + desktop × 3 amount tiers)
  { country:'KE', currency:'KES', deviceType:'mobile',  amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'KE', currency:'KES', deviceType:'desktop', amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'KE', currency:'KES', deviceType:'mobile',  amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'KE', currency:'KES', deviceType:'desktop', amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'KE', currency:'KES', deviceType:'mobile',  amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'KE', currency:'KES', deviceType:'desktop', amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  // UG — 3 contexts (mobile only, 3 tiers)
  { country:'UG', currency:'UGX', deviceType:'mobile',  amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'UG', currency:'UGX', deviceType:'mobile',  amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'UG', currency:'UGX', deviceType:'mobile',  amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  // TZ — 3 contexts
  { country:'TZ', currency:'TZS', deviceType:'mobile',  amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'TZ', currency:'TZS', deviceType:'mobile',  amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'TZ', currency:'TZS', deviceType:'mobile',  amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  // US — 6 contexts
  { country:'US', currency:'USD', deviceType:'mobile',  amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'US', currency:'USD', deviceType:'desktop', amountUSD:30,  isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'US', currency:'USD', deviceType:'mobile',  amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'US', currency:'USD', deviceType:'desktop', amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'US', currency:'USD', deviceType:'mobile',  amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'US', currency:'USD', deviceType:'desktop', amountUSD:350, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  // GB — 2 contexts (mid amount only)
  { country:'GB', currency:'GBP', deviceType:'mobile',  amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
  { country:'GB', currency:'GBP', deviceType:'desktop', amountUSD:125, isReturning:false, previousMethodId:'', customerAge:'26-40' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimResult {
  controlConverted: number
  treatmentConverted: number
  controlMethodCounts:   Record<string, number>
  treatmentMethodCounts: Record<string, number>
  processed: number
}

interface SlimMethod { id: string; authRate: number }

// ── Simulation helpers ────────────────────────────────────────────────────────

const COUNTRY_POOL = [
  { country:'KE', currency:'KES', weight:60 },
  { country:'UG', currency:'UGX', weight:15 },
  { country:'TZ', currency:'TZS', weight:10 },
  { country:'US', currency:'USD', weight: 8 },
  { country:'GB', currency:'GBP', weight: 7 },
]

function weightedPick<T extends { weight: number }>(items: T[]): T {
  let r = Math.random() * items.reduce((s, i) => s + i.weight, 0)
  for (const item of items) { r -= item.weight; if (r <= 0) return item }
  return items[items.length - 1]
}

function generateCustomer() {
  const { country, currency } = weightedPick(COUNTRY_POOL)
  const deviceType  = Math.random() < 0.70 ? 'mobile' : 'desktop'
  const roll        = Math.random()
  const amountUSD   = roll < 0.30 ? 10 + Math.random() * 40
                    : roll < 0.80 ? 50 + Math.random() * 150
                    :              200 + Math.random() * 300
  const ageRoll     = Math.random()
  const customerAge = ageRoll < 0.30 ? '18-25' : ageRoll < 0.80 ? '26-40' : '41+'
  return { country, currency, deviceType, amountUSD: Math.round(amountUSD * 100) / 100, customerAge }
}

/** Maps a generated customer to one of the 20 pre-fetched representative contexts. */
function mapToRepIdx(country: string, deviceType: string, amountUSD: number): number {
  const tier = amountUSD < 50 ? 0 : amountUSD < 200 ? 1 : 2
  const dev  = deviceType === 'mobile' ? 0 : 1
  switch (country) {
    case 'KE': return tier * 2 + dev     // 0-5
    case 'UG': return 6 + tier            // 6-8
    case 'TZ': return 9 + tier            // 9-11
    case 'US': return 12 + tier * 2 + dev // 12-17
    case 'GB': return 18 + dev            // 18-19
    default:   return 15                  // fallback: US desktop mid
  }
}

function isEligible(m: FullPaymentMethod, country: string, currency: string, amount: number) {
  return (m.countries.includes('*') || m.countries.includes(country))
      && (m.currencies.includes('*') || m.currencies.includes(currency))
      && amount >= m.minAmount
      && (m.maxAmount === null || amount <= m.maxAmount)
}

/** One Monte Carlo trial — customer scrolls through methods and picks the first one they select. */
function simulateOne(methods: SlimMethod[]): { converted: boolean; selectedId: string | null } {
  for (let i = 0; i < methods.length; i++) {
    if (Math.random() < SELECTION_PROBS[Math.min(i, SELECTION_PROBS.length - 1)]) {
      return { converted: Math.random() < methods[i].authRate, selectedId: methods[i].id }
    }
  }
  return { converted: false, selectedId: null }
}

function getTopMethods(
  counts: Record<string, number>,
  nameMap: Map<string, string>,
  total: number,
  top = 5,
): { name: string; pct: number }[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([id, n]) => ({ name: nameMap.get(id) ?? id, pct: (n / total) * 100 }))
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, accent = false }: {
  title: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-black ${accent ? 'text-indigo-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function MethodBar({ name, pct, maxPct, color }: {
  name: string; pct: number; maxPct: number; color: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-gray-600 w-28 truncate flex-shrink-0" title={name}>{name}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${maxPct > 0 ? (pct / maxPct) * 100 : 0}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-12 text-right tabular-nums">
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'fetching' | 'simulating' | 'done'

export default function ABTestPage() {
  const [n, setN]                 = useState(1000)
  const [phase, setPhase]         = useState<Phase>('idle')
  const [progress, setProgress]   = useState(0)
  const [result, setResult]       = useState<SimResult | null>(null)
  const [nameMap, setNameMap]     = useState<Map<string, string>>(new Map())
  const [error, setError]         = useState<string | null>(null)

  const run = useCallback(async () => {
    setError(null)
    setResult(null)
    setProgress(0)
    setPhase('fetching')

    try {
      // Phase 1 — fetch method catalogue + 20 representative rankings in parallel
      const [allMethods, rankings] = await Promise.all([
        getMethods(),
        Promise.all(REP_CONTEXTS.map(ctx => rankPayments(ctx))),
      ])

      const authRateById = new Map(allMethods.map(m => [m.id, m.authRate]))
      const nm           = new Map(allMethods.map(m => [m.id, m.name]))
      setNameMap(nm)

      // Pre-build treatment (ranked) and control (alphabetical) method lists for each rep context
      const repData: { treatment: SlimMethod[]; control: SlimMethod[] }[] =
        REP_CONTEXTS.map((ctx, i) => ({
          treatment: rankings[i].map(pm => ({ id: pm.id, authRate: authRateById.get(pm.id) ?? 0.8 })),
          control:   allMethods
            .filter(m => isEligible(m, ctx.country, ctx.currency, ctx.amountUSD))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(m => ({ id: m.id, authRate: m.authRate })),
        }))

      // Phase 2 — Monte Carlo in chunks so React can re-render between them
      setPhase('simulating')

      const sim: SimResult = {
        controlConverted: 0, treatmentConverted: 0,
        controlMethodCounts: {}, treatmentMethodCounts: {},
        processed: 0,
      }

      for (let done = 0; done < n; done += CHUNK_SIZE) {
        const end = Math.min(done + CHUNK_SIZE, n)

        for (let i = done; i < end; i++) {
          const { country, currency, deviceType, amountUSD } = generateCustomer()
          const { treatment, control } = repData[mapToRepIdx(country, deviceType, amountUSD)]

          const ctrl = simulateOne(control)
          const trt  = simulateOne(treatment)

          if (ctrl.converted) sim.controlConverted++
          if (trt.converted)  sim.treatmentConverted++
          if (ctrl.selectedId) sim.controlMethodCounts[ctrl.selectedId]   = (sim.controlMethodCounts[ctrl.selectedId]   ?? 0) + 1
          if (trt.selectedId)  sim.treatmentMethodCounts[trt.selectedId]  = (sim.treatmentMethodCounts[trt.selectedId]  ?? 0) + 1
        }

        sim.processed = end
        setProgress(end / n)
        // Shallow-copy objects so React detects the change
        setResult({
          ...sim,
          controlMethodCounts:   { ...sim.controlMethodCounts },
          treatmentMethodCounts: { ...sim.treatmentMethodCounts },
        })
        await new Promise(r => setTimeout(r, 0)) // yield to renderer
      }

      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed. Is the backend running on port 4000?')
      setPhase('idle')
    }
  }, [n])

  // ── Derived display values ────────────────────────────────────────────────────
  const running        = phase === 'fetching' || phase === 'simulating'
  const processed      = result?.processed ?? 0
  const controlRate    = processed > 0 ? result!.controlConverted  / processed : 0
  const treatmentRate  = processed > 0 ? result!.treatmentConverted / processed : 0
  const liftPP         = (treatmentRate - controlRate) * 100
  const revenueImpact  = Math.round(liftPP * 10 * AOV) // per 1000 customers

  const controlTop     = result ? getTopMethods(result.controlMethodCounts,   nameMap, processed) : []
  const treatmentTop   = result ? getTopMethods(result.treatmentMethodCounts, nameMap, processed) : []
  const maxPct         = Math.max(...controlTop.map(m => m.pct), ...treatmentTop.map(m => m.pct), 1)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-black text-indigo-600 tracking-tight">JamboCart</Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm font-semibold text-gray-700 hidden sm:inline">A/B Test Simulator</span>
          </div>
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
            ← Checkout
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Title + description */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 mb-1">A/B Test Simulator</h1>
          <p className="text-gray-500 text-sm">
            Compares conversion rates between a fixed alphabetical list (Control) and JamboCart&apos;s
            smart ranking (Treatment) across a realistic synthetic customer distribution.
          </p>
        </div>

        {/* Controls card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Slider */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Simulations
                </label>
                <span className="text-sm font-black text-indigo-600">{n.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={100} max={5000} step={100}
                value={n}
                onChange={e => setN(Number(e.target.value))}
                disabled={running}
                className="w-full accent-indigo-600 disabled:opacity-40 cursor-pointer"
              />
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>100</span><span>5,000</span>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={run}
              disabled={running}
              className="sm:mb-0 px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 whitespace-nowrap"
            >
              {running ? 'Running…' : 'Run Simulation'}
            </button>
          </div>

          {/* Progress bar */}
          {running && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>
                  {phase === 'fetching'
                    ? 'Fetching rankings from backend (20 contexts)…'
                    : `Simulating customers… ${Math.round(progress * 100)}%`}
                </span>
                {phase === 'simulating' && (
                  <span className="tabular-nums">{processed.toLocaleString()} / {n.toLocaleString()}</span>
                )}
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                {phase === 'fetching' ? (
                  <div className="h-full w-full bg-indigo-300 animate-pulse rounded-full" />
                ) : (
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-150"
                    style={{ width: `${progress * 100}%` }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && processed > 0 && (
          <div className="animate-fade-slide-in">
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MetricCard
                title="Control rate"
                value={`${(controlRate * 100).toFixed(1)}%`}
                sub="Alphabetical order"
              />
              <MetricCard
                title="Treatment rate"
                value={`${(treatmentRate * 100).toFixed(1)}%`}
                sub="Smart ranking"
                accent
              />
              <MetricCard
                title="Lift"
                value={`${liftPP >= 0 ? '↑' : '↓'} ${Math.abs(liftPP).toFixed(1)} pp`}
                sub="Percentage points"
                accent={liftPP > 0}
              />
              <MetricCard
                title="Revenue impact"
                value={`${revenueImpact >= 0 ? '+' : ''}$${Math.abs(revenueImpact).toLocaleString()}`}
                sub={`Per 1,000 customers · $${AOV} AOV`}
                accent={revenueImpact > 0}
              />
            </div>

            {/* Method distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Control */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Control — top selections (alphabetical order)
                </h3>
                <div className="space-y-3">
                  {controlTop.map(m => (
                    <MethodBar key={m.name} name={m.name} pct={m.pct} maxPct={maxPct} color="bg-gray-400" />
                  ))}
                </div>
              </div>

              {/* Treatment */}
              <div className="bg-white border border-indigo-100 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-4">
                  Treatment — top selections (smart ranking)
                </h3>
                <div className="space-y-3">
                  {treatmentTop.map(m => (
                    <MethodBar key={m.name} name={m.name} pct={m.pct} maxPct={maxPct} color="bg-indigo-500" />
                  ))}
                </div>
              </div>
            </div>

            {/* Sample size note */}
            {phase === 'simulating' && (
              <p className="text-xs text-indigo-500 text-center mb-2">
                Live update — {processed.toLocaleString()} of {n.toLocaleString()} customers processed
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Simulation uses synthetic data. Conversion model simplified for demonstration.
        </p>
      </main>
    </div>
  )
}
