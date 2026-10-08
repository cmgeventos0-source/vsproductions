// Integración con Wompi (Colombia): tarjetas y PSE.
// Docs: https://docs.wompi.co

const BASE_URL =
  process.env.WOMPI_ENV === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";

export const WOMPI_MODE = process.env.PAYMENT_MODE === "wompi" ? "wompi" : "simulate";

export type WompiMerchantInfo = {
  acceptance_token?: string;
  personal_auth_token?: string;
  currency?: string;
};

// Obtiene los tokens de aceptación (obligatorios en Colombia)
export async function getMerchantInfo(): Promise<WompiMerchantInfo> {
  const publicKey = process.env.WOMPI_PUBLIC_KEY!;
  const res = await fetch(`${BASE_URL}/merchants/${publicKey}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Wompi: no se pudo consultar el merchant (${res.status})`);
  }
  const json = await res.json();
  const data = json?.data ?? {};
  return {
    acceptance_token:
      data.presigned_acceptance?.acceptance_token ?? data.acceptance_token ?? undefined,
    personal_auth_token:
      data.presigned_personal_data_auth?.acceptance_token ?? undefined,
    currency: data.currency,
  };
}

export type WompiTransactionResult = {
  id: string;
  status: string; // APPROVED | PENDING | DECLINED | VOIDED | ERROR
  amount_in_cents: number;
  reference: string;
  payment_method_type?: string;
};

export type CreateTransactionInput = {
  amountInCents: number;
  email: string;
  reference: string;
  cardToken?: string;
  installments?: number;
  customerData?: { full_name?: string; phone_number?: string; legal_id?: string };
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<WompiTransactionResult> {
  const privateKey = process.env.WOMPI_PRIVATE_KEY!;
  const { acceptance_token, personal_auth_token } = await getMerchantInfo();

  const body: Record<string, unknown> = {
    amount_in_cents: input.amountInCents,
    currency: "COP",
    customer_email: input.email,
    reference: input.reference,
    payment_method: {
      type: "CARD",
      token: input.cardToken,
      installments: input.installments ?? 1,
    },
  };

  if (input.customerData?.full_name) {
    body.customer_data = {
      full_name: input.customerData.full_name,
      phone_number: input.customerData.phone_number ?? "3000000000",
      legal_id: input.customerData.legal_id ?? "",
      legal_id_type: "CC",
    };
  }

  if (acceptance_token) {
    body.acceptance_token = acceptance_token;
  }
  body.accept_personal_auth = "1";

  const res = await fetch(`${BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${privateKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Wompi: error creando transacción (${res.status}) ${JSON.stringify(json)}`
    );
  }

  const data = json?.data ?? {};
  return {
    id: data.id,
    status: data.status,
    amount_in_cents: data.amount_in_cents,
    reference: data.reference,
    payment_method_type: data.payment_method_type,
  };
}

export async function getTransaction(id: string): Promise<WompiTransactionResult> {
  const privateKey = process.env.WOMPI_PRIVATE_KEY!;
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Wompi: error consultando transacción (${res.status})`);
  }
  const json = await res.json();
  const data = json?.data ?? {};
  return {
    id: data.id,
    status: data.status,
    amount_in_cents: data.amount_in_cents,
    reference: data.reference,
    payment_method_type: data.payment_method_type,
  };
}

/**
 * Genera la firma de integridad SHA-256 para el Web Checkout de Wompi.
 * Algoritmo oficial: SHA256(reference + amountInCents + currency + integritySecret)
 */
export async function generateIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string = "COP",
  secretOverride?: string
): Promise<string> {
  const secret = secretOverride || process.env.WOMPI_INTEGRITY_SECRET || "";
  const stringToHash = `${reference}${amountInCents}${currency}${secret}`;
  const { createHash } = await import("crypto");
  return createHash("sha256").update(stringToHash).digest("hex");
}

// Verifica la firma del webhook de Wompi
export async function verifyWebhookSignature(
  eventObj: any,
  rawBody?: string
): Promise<boolean> {
  const secret = process.env.WOMPI_EVENT_SECRET ?? process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    console.error("[Wompi] WOMPI_EVENT_SECRET no está configurado. Rechazando webhook por seguridad.");
    return false;
  }

  try {
    const checksum = eventObj?.signature?.checksum;
    const properties = eventObj?.signature?.properties;
    if (!checksum || !properties || !Array.isArray(properties)) return false;

    let concatenated = "";
    for (const propPath of properties) {
      const keys = propPath.split(".");
      let val: any = eventObj.data;
      for (const k of keys) {
        val = val?.[k];
      }
      concatenated += val !== undefined && val !== null ? val : "";
    }
    concatenated += secret;

    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(concatenated).digest("hex");
    return hash.toLowerCase() === checksum.toLowerCase();
  } catch (err) {
    console.error("[Wompi] Error al validar firma del webhook:", err);
    return false;
  }
}
