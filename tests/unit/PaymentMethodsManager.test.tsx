import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentMethodsManager } from '../../src/app/components/admin/PaymentMethodsManager'

// Mock fetch
global.fetch = jest.fn()

describe('PaymentMethodsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should render payment methods list', async () => {
    const mockMethods = [
      { id: 'nequi', name: 'Nequi', icon: 'smartphone', enabled: true, requires_verification: true, verification_config: {}, display_order: 1 },
      { id: 'transferencia', name: 'Transferencia', icon: 'banknote', enabled: true, requires_verification: true, verification_config: {}, display_order: 2 },
    ]

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMethods,
    })

    render(<PaymentMethodsManager />)

    await waitFor(() => {
      expect(screen.getByText('Nequi')).toBeInTheDocument()
      expect(screen.getByText('Transferencia')).toBeInTheDocument()
    })
  })

  test('should toggle method enabled status', async () => {
    const mockMethods = [
      { id: 'nequi', name: 'Nequi', icon: 'smartphone', enabled: true, requires_verification: true, verification_config: {}, display_order: 1 },
    ]

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockMethods })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockMethods[0], enabled: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockMethods })

    render(<PaymentMethodsManager />)

    await waitFor(() => expect(screen.getByText('Nequi')).toBeInTheDocument())

    const toggles = screen.getAllByRole('button')
    const toggleButton = toggles.find(btn => btn.getAttribute('data-testid')?.includes('toggle'))

    if (toggleButton) {
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/payment-methods/nequi'),
          expect.objectContaining({ method: 'PATCH' })
        )
      })
    }
  })

  test('should open modal to create new method', async () => {
    const mockMethods: any[] = []

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMethods,
    })

    render(<PaymentMethodsManager />)

    const newMethodBtn = await screen.findByText(/Nuevo método/i)
    fireEvent.click(newMethodBtn)

    await waitFor(() => {
      expect(screen.getByText('Nuevo Método')).toBeInTheDocument()
    })
  })

  test('should delete payment method', async () => {
    const mockMethods = [
      { id: 'nequi', name: 'Nequi', icon: 'smartphone', enabled: true, requires_verification: true, verification_config: {}, display_order: 1 },
    ]

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockMethods })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    render(<PaymentMethodsManager />)

    await waitFor(() => expect(screen.getByText('Nequi')).toBeInTheDocument())

    window.confirm = jest.fn(() => true)
    const deleteBtn = screen.getByRole('button', { name: /eliminar/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/payment-methods/nequi'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
