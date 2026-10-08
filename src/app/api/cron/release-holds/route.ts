import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/auth-guards";

export async function GET(req: NextRequest) {
  try {
    if (!requireCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing Cron token" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: heldSeats } = await supabase
      .from("seats")
      .select("id")
      .eq("status", "held")
      .not("hold_expires_at", "is", null)
      .lte("hold_expires_at", now);

    let releasedSeats = 0;
    if (heldSeats && heldSeats.length > 0) {
      const ids = heldSeats.map((s) => s.id);
      const { data: updated } = await supabase
        .from("seats")
        .update({ status: "available", hold_expires_at: null })
        .in("id", ids)
        .select("id");
      releasedSeats = updated?.length ?? 0;
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "pending")
      .lte("created_at", thirtyMinAgo);

    let cancelledOrders = 0;
    if (staleOrders && staleOrders.length > 0) {
      for (const order of staleOrders) {
        const { data: items } = await supabase
          .from("order_items")
          .select("seat_id")
          .eq("order_id", order.id);

        if (items) {
          for (const item of items) {
            if (item.seat_id) {
              await supabase
                .from("seats")
                .update({ status: "available", hold_expires_at: null })
                .eq("id", item.seat_id);
            }
          }
        }

        await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", order.id);

        cancelledOrders++;
      }
    }

    return NextResponse.json({ releasedSeats, cancelledOrders, timestamp: now });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
