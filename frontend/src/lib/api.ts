import { CheckoutContext, FullPaymentMethod, PaymentMethod } from '@/types/payment'

const API_URL = 'http://localhost:4000'

export async function rankPayments(context: CheckoutContext): Promise<PaymentMethod[]> {
  const res = await fetch(`${API_URL}/api/rank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Server error ${res.status}`)
  }

  const data = await res.json()
  return data.ranked as PaymentMethod[]
}

export async function getMethods(): Promise<FullPaymentMethod[]> {
  const res = await fetch(`${API_URL}/api/methods`)
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  const data = await res.json()
  return data.methods as FullPaymentMethod[]
}
