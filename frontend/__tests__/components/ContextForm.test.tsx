import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextForm from '@/components/ContextForm'
import { CheckoutContext } from '@/types/payment'

const mockSubmit = jest.fn()

beforeEach(() => mockSubmit.mockClear())

describe('ContextForm', () => {
  test('renders the country select defaulting to Kenya', () => {
    render(<ContextForm onSubmit={mockSubmit} />)
    expect(screen.getByDisplayValue('Kenya')).toBeInTheDocument()
  })

  test('renders the currency input defaulting to KES', () => {
    render(<ContextForm onSubmit={mockSubmit} />)
    expect(screen.getByDisplayValue('KES')).toBeInTheDocument()
  })

  test('renders the amount input, device buttons, and submit button', () => {
    render(<ContextForm onSubmit={mockSubmit} />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mobile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Find best payment methods/i })).toBeInTheDocument()
  })

  test('currency auto-updates to USD when country changes to United States', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.selectOptions(screen.getByDisplayValue('Kenya'), 'US')
    expect(screen.getByDisplayValue('USD')).toBeInTheDocument()
  })

  test('currency auto-updates to UGX when country changes to Uganda', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.selectOptions(screen.getByDisplayValue('Kenya'), 'UG')
    expect(screen.getByDisplayValue('UGX')).toBeInTheDocument()
  })

  test('does not show the previous method field for new customers by default', () => {
    render(<ContextForm onSubmit={mockSubmit} />)
    expect(screen.queryByText('Previous payment method')).not.toBeInTheDocument()
  })

  test('shows previous method field when "Returning" button is clicked', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.click(screen.getByRole('button', { name: /Returning/i }))
    expect(screen.getByText('Previous payment method')).toBeInTheDocument()
  })

  test('hides previous method field when "New customer" is clicked after "Returning"', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.click(screen.getByRole('button', { name: /Returning/i }))
    await user.click(screen.getByRole('button', { name: /New customer/i }))
    expect(screen.queryByText('Previous payment method')).not.toBeInTheDocument()
  })

  test('calls onSubmit with the current form values when submitted', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.click(screen.getByRole('button', { name: /Find best payment methods/i }))

    expect(mockSubmit).toHaveBeenCalledTimes(1)
    const ctx: CheckoutContext = mockSubmit.mock.calls[0][0]
    expect(ctx.country).toBe('KE')
    expect(ctx.currency).toBe('KES')
    expect(ctx.deviceType).toBe('mobile')
    expect(ctx.amountUSD).toBe(100)
    expect(ctx.isReturning).toBe(false)
  })

  test('submit button is disabled and shows "Ranking…" text when loading', () => {
    render(<ContextForm onSubmit={mockSubmit} loading={true} />)
    const btn = screen.getByRole('button', { name: /ranking/i })
    expect(btn).toBeDisabled()
  })

  test('applies initialValues to override form defaults', async () => {
    render(<ContextForm onSubmit={mockSubmit} initialValues={{ amountUSD: 250 }} />)
    expect(screen.getByRole('spinbutton')).toHaveValue(250)
  })

  test('clicking "Desktop" device button sets deviceType to desktop on submit', async () => {
    const user = userEvent.setup()
    render(<ContextForm onSubmit={mockSubmit} />)
    await user.click(screen.getByRole('button', { name: /desktop/i }))
    await user.click(screen.getByRole('button', { name: /Find best payment methods/i }))
    expect((mockSubmit.mock.calls[0][0] as CheckoutContext).deviceType).toBe('desktop')
  })
})
