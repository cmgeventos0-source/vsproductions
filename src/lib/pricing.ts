import type { AppConfig, Zone } from "./types";

export type ZonePricingInfo = {
  currentPrice: number;
  fullPrice: number;
  presalePrice: number | null;
  isPresale: boolean;
  presaleEndAt: string | null;
  savings: number;
};

export function getZonePricing(zone: Partial<Zone> & { price: number }): ZonePricingInfo {
  const fullPrice = Number(zone.price) || 0;
  const presalePrice = zone.presale_price !== undefined && zone.presale_price !== null ? Number(zone.presale_price) : null;
  const presaleEndAt = zone.presale_end_at ?? null;

  let isPresale = false;
  if (presalePrice !== null && !isNaN(presalePrice) && presalePrice > 0 && presalePrice < fullPrice) {
    if (!presaleEndAt || presaleEndAt.trim() === "") {
      isPresale = true;
    } else {
      const now = new Date();
      const endDate = new Date(presaleEndAt);
      if (!isNaN(endDate.getTime()) && now <= endDate) {
        isPresale = true;
      }
    }
  }

  const currentPrice = isPresale ? presalePrice! : fullPrice;
  const savings = isPresale ? fullPrice - presalePrice! : 0;

  return {
    currentPrice,
    fullPrice,
    presalePrice,
    isPresale,
    presaleEndAt,
    savings,
  };
}

// Cálculo de precios totalmente configurable desde app_config
export function computeTotals(
  config: AppConfig,
  items: { zone: Zone; quantity: number }[]
): { subtotal: number; serviceFee: number; tax: number; total: number } {
  const subtotal = items.reduce((acc, it) => acc + getZonePricing(it.zone).currentPrice * it.quantity, 0);
  const serviceFee =
    subtotal > 0
      ? config.service_fee_fixed.value + subtotal * config.service_fee_percent.value
      : 0;
  const tax = (subtotal + serviceFee) * config.tax_rate.value;
  const total = subtotal + serviceFee + tax;
  return {
    subtotal: round2(subtotal),
    serviceFee: round2(serviceFee),
    tax: round2(tax),
    total: round2(total),
  };
}

export function toCents(copAmount: number): number {
  return Math.round(copAmount * 100);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function loadConfig(
  rows: { key: string; value: unknown }[]
): AppConfig {
  const byKey: Record<string, unknown> = {};
  for (const r of rows) byKey[r.key] = r.value;

  return {
    company_name: byKey.company_name as AppConfig["company_name"],
    currency: (byKey.currency as { value: string }) ?? { value: "COP" },
    tax_rate: (byKey.tax_rate as { value: number }) ?? { value: 0 },
    service_fee_fixed: (byKey.service_fee_fixed as { value: number }) ?? { value: 0 },
    service_fee_percent: (byKey.service_fee_percent as { value: number }) ?? { value: 0 },
    hold_minutes: (byKey.hold_minutes as { value: number }) ?? { value: 15 },
  };
}
