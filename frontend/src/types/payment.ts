export interface PaymentMethod {
  rank: number
  id: string
  name: string
  type: 'mobile_money' | 'card' | 'bnpl' | 'bank_transfer' | 'wallet' | 'aggregator'
  description: string
  score: number
  confidence: number
  reasons: string[]
}

export interface FullPaymentMethod {
  id: string
  name: string
  type: 'mobile_money' | 'card' | 'bnpl' | 'bank_transfer' | 'wallet' | 'aggregator'
  description: string
  countries: string[]
  currencies: string[]
  authRate: number
  avgProcessingSeconds: number
  minAmount: number
  maxAmount: number | null
  popularOnMobile: boolean
}

export interface CheckoutContext {
  country: string
  currency: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
  amountUSD: number
  isReturning: boolean
  previousMethodId: string
  customerAge: '18-25' | '26-40' | '41+'
  boosts?: Record<string, number | 'suppressed'>
}

// ── Analytics types ───────────────────────────────────────────────────────────

export interface SignalStat {
  signal: string
  conversions: number
  avgScore: number
  description: string
}

export interface CountryMethodStat {
  methodId: string
  name: string
  type: PaymentMethod['type']
  approvalRate: number
  volume: number
}

export interface MethodStat {
  id: string
  name: string
  type: PaymentMethod['type']
  volume: number
  approvalRate: number
  avgAmount: number
  trend: 'up' | 'down' | 'stable'
}

export interface AnalyticsData {
  signalPerformance: SignalStat[]
  methodsByCountry: Record<string, CountryMethodStat[]>
  overallStats: {
    totalTransactions: number
    approvalRate: number
    topMethod: string
    avgAmount: number
  }
  methodStats: MethodStat[]
}
