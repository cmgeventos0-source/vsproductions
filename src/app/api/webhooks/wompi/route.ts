import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/wompi";
import { generateTicketsForOrder } from "@/app/actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify Wompi webhook signature
    const isValid = await verifyWebhookSignature(body);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature or missing secret" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const event = body.event;
    const data = body.data;

    switch (event) {
      case "transaction.updated":
      case "transaction.confirmed":
        return await handleTransactionSuccessOrFailure(data, supabase);

      case "transaction.failed":
        return await handleTransactionFailed(data, supabase);

      default:
        return NextResponse.json({ success: true, message: "Unhandled event" });
    }
  } catch (error) {
    console.error("[Wompi Webhook] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleTransactionSuccessOrFailure(data: any, supabase: any) {
  const transaction = data?.transaction;
  if (!transaction) return NextResponse.json({ success: true });

  const status = transaction.status;
  const referenceCode = transaction.reference_code ?? transaction.reference;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, email, customer_name, total")
    .eq("id", referenceCode)
    .single();

  if (orderError || !order) {
    console.warn("[Wompi Webhook] Order not found for reference:", referenceCode);
    return NextResponse.json({ success: true });
  }

  if (status === "APPROVED" && order.status !== "paid") {
    // 1. Mark order paid
    await supabase
      .from("orders")
      .update({ status: "paid", payment_method: "wompi" })
      .eq("id", order.id);

    // 2. Update seats and zones
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (items) {
      for (const item of items) {
        if (item.zone_id) {
          const { data: zone } = await supabase
            .from("zones")
            .select("sold_count")
            .eq("id", item.zone_id)
            .single();
          if (zone) {
            await supabase
              .from("zones")
              .update({ sold_count: (zone.sold_count || 0) + item.quantity })
              .eq("id", item.zone_id);
          }
        }
        if (item.seat_id) {
          await supabase
            .from("seats")
            .update({ status: "sold", hold_expires_at: null })
            .eq("id", item.seat_id);
        }
      }
    }

    // 3. Generate tickets
    await generateTicketsForOrder(order.id);
  } else if (status === "DECLINED" || status === "VOIDED" || status === "ERROR") {
    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", order.id);
  }

  return NextResponse.json({ success: true });
}

async function handleTransactionFailed(data: any, supabase: any) {
  const referenceCode = data?.transaction?.reference_code ?? data?.transaction?.reference;
  if (!referenceCode) return NextResponse.json({ success: true });

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", referenceCode)
    .single();

  if (order) {
    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", order.id);
  }

  return NextResponse.json({ success: true });
}
