'use client';

import { useReferral } from '@/hooks/useReferral';
import { Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function ReferralPanel() {
  const { referralCode, stats, loading, copyToClipboard } = useReferral();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Share2 className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (!referralCode) {
    return (
      <div className="text-center py-8">
        <Share2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600">No tienes código referral</p>
      </div>
    );
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/referral/${referralCode.code}`;
  const shareMessage = `¡Usa mi código referral ${referralCode.code} y obtén ${referralCode.discountPercentage}% de descuento en boletas!`;

  return (
    <div className="space-y-6">
      {/* Código y compartir */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-4">Tu código referral</h3>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 p-3 bg-white border border-gray-300 rounded-lg font-mono text-lg font-bold text-center text-blue-600">
            {referralCode.code}
          </div>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar
              </>
            )}
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-gray-600">
            <strong>Descuento:</strong> {referralCode.discountPercentage}% para referidos
          </p>
          <p className="text-gray-600">
            <strong>Tu ganancia:</strong> 50% del descuento aplicado
          </p>
        </div>

        {/* Opciones de compartir */}
        <div className="mt-4 flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm text-center font-semibold"
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm text-center font-semibold"
          >
            Twitter
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm text-center font-semibold"
          >
            Facebook
          </a>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Tus estadísticas</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total de referidos</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalReferrals}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Ganancias acumuladas</p>
              <p className="text-3xl font-bold text-green-600">
                ${stats.totalEarned?.toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {/* Historial reciente */}
          {stats.recentUses && stats.recentUses.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Usos recientes</h4>
              <div className="space-y-2">
                {stats.recentUses.slice(0, 5).map((use: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm p-2 bg-gray-50 rounded"
                  >
                    <span className="text-gray-600">
                      {new Date(use.created_at).toLocaleDateString('es-CO')}
                    </span>
                    <span className="font-semibold text-green-600">
                      +${use.discount_applied?.toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instrucciones */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
        <p className="font-semibold mb-2">¿Cómo funciona?</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Comparte tu código con amigos</li>
          <li>Ellos lo usan al comprar boletas</li>
          <li>Ellos obtienen su descuento</li>
          <li>Tú recibes el 50% de su descuento</li>
        </ol>
      </div>
    </div>
  );
}
