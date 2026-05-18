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

export interface CheckoutContext {
  country: string
  currency: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
  amountUSD: number
  isReturning: boolean
  previousMethodId: string
  customerAge: '18-25' | '26-40' | '41+'
}
