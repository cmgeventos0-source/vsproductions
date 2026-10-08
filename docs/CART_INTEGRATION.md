# Guía de Integración: Carrito Persistente

## 📋 Resumen

Sistema completo de carrito persistente con:
- Almacenamiento en localStorage + Supabase
- Multi-evento en un carrito
- Códigos promocionales
- Sistema de favoritos
- Programa de referidos
- Recordatorios de carrito abandonado por email

## 🔧 Integración en Páginas de Eventos

### 1. Página de Detalles del Evento

```tsx
// src/app/eventos/[eventId]/page.tsx
'use client';

import { FavoriteButton } from '@/components/FavoriteButton';
import { useShoppingCart } from '@/hooks/useShoppingCart';
import { useState } from 'react';

export default function EventDetailPage({ params }: { params: { eventId: string } }) {
  const { cart, addItem } = useShoppingCart();
  const [selectedZone, setSelectedZone] = useState('');
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async () => {
    if (!selectedZone) {
      alert('Selecciona una zona');
      return;
    }

    try {
      await addItem({
        functionId: 'function-id',
        eventId: params.eventId,
        zoneId: selectedZone,
        quantity,
        price: 50000, // Obtener del evento
        eventName: 'Nombre del Evento',
        zoneName: 'Nombre de la zona',
        functionDateTime: '2026-09-01 20:00',
      });

      alert('¡Boleta añadida al carrito!');
    } catch (error) {
      alert('Error al añadir al carrito');
    }
  };

  return (
    <div>
      {/* Detalles del evento */}
      <div className="flex justify-between items-center mb-6">
        <h1>Nombre del Evento</h1>
        <FavoriteButton eventId={params.eventId} />
      </div>

      {/* Selector de zona y cantidad */}
      <div className="space-y-4">
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="w-full border rounded-lg p-2"
        >
          <option value="">Selecciona una zona</option>
          <option value="vip">VIP - $50.000</option>
          <option value="general">General - $30.000</option>
        </select>

        <input
          type="number"
          min="1"
          max="10"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          className="w-full border rounded-lg p-2"
        />

        <button
          onClick={handleAddToCart}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          Añadir al Carrito
        </button>
      </div>

      {/* Mostrar items en carrito */}
      {cart?.items.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="font-semibold">
            Items en carrito: {cart.items.length} • Total: ${cart.total.toLocaleString('es-CO')}
          </p>
          <a href="/carrito" className="text-blue-600 hover:underline">
            Ver carrito →
          </a>
        </div>
      )}
    </div>
  );
}
```

### 2. Card de Evento en Listado

```tsx
// src/components/EventCard.tsx
'use client';

import { FavoriteButton } from '@/components/FavoriteButton';
import Link from 'next/link';

interface EventCardProps {
  id: string;
  name: string;
  image: string;
  date: string;
  price: number;
  city: string;
}

export function EventCard({ id, name, image, date, price, city }: EventCardProps) {
  return (
    <Link href={`/eventos/${id}`}>
      <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition">
        <img src={image} alt={name} className="w-full h-48 object-cover" />

        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900">{name}</h3>
            <FavoriteButton eventId={id} />
          </div>

          <p className="text-sm text-gray-600">{city}</p>
          <p className="text-sm text-gray-500">{new Date(date).toLocaleDateString('es-CO')}</p>

          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
            <span className="font-bold text-lg text-blue-600">
              ${price.toLocaleString('es-CO')}
            </span>
            <button className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
              Ver detalles →
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

### 3. Mini Carrito en Header

```tsx
// src/components/CartHeader.tsx
'use client';

import { useShoppingCart } from '@/hooks/useShoppingCart';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export function CartHeader() {
  const { cart, loading } = useShoppingCart();

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Link href="/carrito" className="relative">
      <div className="flex items-center gap-2 hover:text-blue-600">
        <ShoppingCart className="w-6 h-6" />
        {itemCount > 0 && (
          <>
            <span className="text-sm font-semibold">{itemCount}</span>
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
              ${cart?.total.toLocaleString('es-CO')}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
```

## 📊 Flujo de Datos

```
Usuario en evento
    ↓
Selecciona zona + cantidad
    ↓
Clic en "Añadir al Carrito"
    ↓
addItem(item) en useShoppingCart
    ↓
API POST /api/cart/add
    ↓
CartService.addItem()
    ↓
Supabase: shopping_carts.update()
    ↓
localStorage: cart_data
    ↓
UI actualiza con nuevo carrito
```

## 🎁 Aplicar Código Promocional

```tsx
// En ShoppingCartComponent.tsx, el código ya está implementado
const handleApplyPromo = async () => {
  try {
    await applyPromoCode(promoCode);
    // UI se actualiza automáticamente
  } catch (err) {
    setPromoError(err.message);
  }
};
```

## ❤️ Sistema de Favoritos

```tsx
// En cualquier página
import { useFavorites } from '@/hooks/useFavorites';

const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();

// Usar
if (isFavorite(eventId)) {
  // Mostrar corazón relleno
} else {
  // Mostrar corazón vacío
}
```

## 🔗 Sistema de Referidos

```tsx
// En perfil de usuario
import { useReferral } from '@/hooks/useReferral';

const { referralCode, stats, copyToClipboard } = useReferral();

// Compartir código
<button onClick={copyToClipboard}>
  Copiar: {referralCode?.code}
</button>

// Ver ganancias
<p>Total ganado: ${stats?.totalEarned}</p>
```

## 📧 Recordatorios Automáticos

Se envían automáticamente cuando:
- El carrito no se completa en 24 horas
- El carrito contiene items
- El usuario está autenticado

**Configurar cron:**
```bash
# Ejecutar diariamente a las 10 AM
curl -X POST http://localhost:3000/cron/abandoned-carts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 🗄️ Base de Datos

### Tablas principales:
- `shopping_carts`: carritos con items y totales
- `promo_codes`: códigos promocionales
- `promo_code_uses`: historial de uso de cupones
- `favorites`: eventos favoritos del usuario
- `referral_codes`: códigos únicos de referidos
- `referral_uses`: historial de referidos usados

## 📱 LocalStorage

Se sincroniza automáticamente:
- `cart_session_id`: ID de sesión para no autenticados
- `cart_data`: datos completos del carrito
- `favorites_data`: lista de favoritos
- `referral_code`: código del programa de referidos
- `referral_stats`: estadísticas de referidos

## 🔐 Seguridad

- ✅ RLS activado en todas las tablas
- ✅ Validación de usuario en endpoints
- ✅ Verificación de propiedad del carrito
- ✅ Límites de compra mínima en promociones
- ✅ Validación de fechas en códigos

## 📈 Métricas Recomendadas

Rastrear en analytics:
- Tasa de abandono de carrito
- Valor promedio del carrito
- Código promocional más usado
- Eventos más favoritos
- Ingresos por referidos

## 🚀 Próximos Pasos

1. **Búsqueda avanzada**: Implementar ElasticSearch
2. **Filtros geográficos**: Radio de búsqueda
3. **Descuentos por cantidad**: Bulk pricing
4. **Sincronización multidevice**: Para usuarios autenticados
5. **Notificaciones en tiempo real**: WebSocket para favoritos
