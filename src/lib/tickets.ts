import { randomBytes } from "crypto";

// Código corto y único para la boleta, legible en la validación manual
export function generateTicketCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `TB-${out}`;
}

export type TicketQrPayload = {
  t: string; // ticket id
  c: string; // code
  e: string; // event slug
};

export function buildQrData(ticketId: string, code: string, eventSlug: string): string {
  const payload: TicketQrPayload = { t: ticketId, c: code, e: eventSlug };
  return JSON.stringify(payload);
}

export function parseQrData(qrData: string): TicketQrPayload | null {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed && typeof parsed.t === "string" && typeof parsed.c === "string") {
      return parsed as TicketQrPayload;
    }
    return null;
  } catch {
    return null;
  }
}
