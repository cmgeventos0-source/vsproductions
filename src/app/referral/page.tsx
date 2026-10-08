'use client';

import { ReferralPanel } from '@/components/ReferralPanel';
import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function ReferralPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full" />
          </div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Se requiere autenticación</h1>
          <p className="text-gray-600 mb-6">Debes iniciar sesión para acceder a tu código referral</p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Programa de Referidos</h1>

        <Suspense fallback={<div className="text-center py-12">Cargando panel de referidos...</div>}>
          <ReferralPanel />
        </Suspense>
      </div>
    </div>
  );
}
