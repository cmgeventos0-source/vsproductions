import { createOrder, approveOrderAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireAuth } from '@/lib/auth-guards';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/auth-guards', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'admin' }),
  requireAuth: jest.fn().mockResolvedValue({ id: 'user-1', role: 'customer' }),
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('Acciones de Pedido y Aprobación de Pago', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockChain: any = {
      select: jest.fn().mockImplementation(() => mockChain),
      insert: jest.fn().mockImplementation(() => mockChain),
      update: jest.fn().mockImplementation(() => mockChain),
      delete: jest.fn().mockImplementation(() => mockChain),
      eq: jest.fn().mockImplementation(() => mockChain),
      in: jest.fn().mockImplementation(() => mockChain),
      filter: jest.fn().mockImplementation(() => mockChain),
      single: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } }),
      },
      from: jest.fn().mockReturnValue(mockChain),
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/receipt.jpg' } }),
        }),
      },
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('createOrder', () => {
    it('debe registrar una orden correctamente para boleta sin silla asignada', async () => {
      const formData = new FormData();
      formData.append('customerName', 'Juan Pérez');
      formData.append('email', 'juan@example.com');
      formData.append('phone', '3001234567');
      formData.append('idNumber', '1098765432');
      formData.append('paymentMethod', 'nequi');
      formData.append('functionId', 'fn-1');
      formData.append('zoneId', 'zone-1');
      formData.append('quantity', '2');
      formData.append('total', '100000');
      formData.append('subtotal', '90000');
      formData.append('serviceFee', '10000');

      const mockZone = { id: 'zone-1', price: 45000, capacity: 100, sold_count: 10, function_id: 'fn-1' };
      const chain = mockSupabase.from();
      chain.single.mockResolvedValueOnce({ data: mockZone, error: null });

      const result = await createOrder(formData);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
    });

    it('debe rechazar si faltan campos obligatorios del comprador', async () => {
      const formData = new FormData();
      formData.append('customerName', '');

      await expect(createOrder(formData)).rejects.toThrow(
        'Completa todos los datos del comprador.'
      );
    });
  });

  describe('approveOrderAction', () => {
    it('debe aprobar el pedido, actualizar orden a paid, cambiar sillas a sold e incrementar zonas', async () => {
      const orderId = 'order-test-uuid';

      const mockOrderItems = [
        { id: 'item-1', order_id: orderId, zone_id: 'zone-1', seat_id: 'seat-101', function_id: 'fn-1', quantity: 1 },
      ];
      const mockOrder = { id: orderId, customer_name: 'Juan Pérez', status: 'paid' };
      const mockZone = { id: 'zone-1', sold_count: 5 };

      const chain = mockSupabase.from();
      
      // Simular respuestas consecutivas de Supabase
      chain.single
        .mockResolvedValueOnce({ data: mockZone, error: null }) // para la zona
        .mockResolvedValueOnce({ data: mockOrder, error: null }); // para el pedido en generateTicketsForOrder

      // Mock para la consulta de order_items
      chain.eq.mockImplementation((field: string, val: any) => {
        if (field === 'order_id') {
          return {
            select: () => Promise.resolve({ data: mockOrderItems, error: null }),
            ...chain,
          };
        }
        return chain;
      });

      const result = await approveOrderAction(orderId);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      expect(mockSupabase.from).toHaveBeenCalledWith('payment_verifications');
    });
  });
});
