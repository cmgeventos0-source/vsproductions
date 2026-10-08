'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReferralCode } from '@/types/cart';
import { useAuth } from '@/hooks/useAuth';

export function useReferral() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReferralCode = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/referral/code');

      if (!response.ok) {
        throw new Error('Error al cargar código referral');
      }

      const data = await response.json();
      setReferralCode(data);

      // Guardar en localStorage
      localStorage.setItem('referral_code', JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Intentar recuperar del localStorage
      const stored = localStorage.getItem('referral_code');
      if (stored) {
        setReferralCode(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/referral/apply');

      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }

      const data = await response.json();
      setStats(data);

      // Guardar en localStorage
      localStorage.setItem('referral_stats', JSON.stringify(data));
    } catch (err) {
      console.error('Error loading stats:', err);
      // Intentar recuperar del localStorage
      const stored = localStorage.getItem('referral_stats');
      if (stored) {
        setStats(JSON.parse(stored));
      }
    }
  }, [user]);

  useEffect(() => {
    loadReferralCode();
  }, [user, loadReferralCode]);

  useEffect(() => {
    if (referralCode) {
      loadStats();
    }
  }, [referralCode, loadStats]);

  const generateReferralCode = useCallback(
    async (discountPercentage: number = 5) => {
      if (!user) {
        setError('Se requiere autenticación');
        return;
      }

      try {
        setError(null);

        const response = await fetch('/api/referral/code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ discountPercentage }),
        });

        if (!response.ok) {
          throw new Error('Error al generar código referral');
        }

        const data = await response.json();
        setReferralCode(data);
        localStorage.setItem('referral_code', JSON.stringify(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [user]
  );

  const copyToClipboard = useCallback(() => {
    if (referralCode?.code) {
      navigator.clipboard.writeText(referralCode.code);
    }
  }, [referralCode]);

  return {
    referralCode,
    stats,
    loading,
    error,
    generateReferralCode,
    copyToClipboard,
    reload: loadReferralCode,
  };
}
