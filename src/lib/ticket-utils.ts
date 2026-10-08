import crypto from "crypto";

export function generateSecureTicketCode(): string {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TB-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
