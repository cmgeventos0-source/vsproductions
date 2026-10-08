import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    const { orderId, paymentMethod, amount, reference, phone, receiptUrl } = body;

    if (!orderId || !paymentMethod || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the payment method configuration
    const { data: method, error: methodError } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("id", paymentMethod)
      .limit(1)
      .single();

    if (methodError || !method) {
      console.error("Payment method not found:", paymentMethod);
      return new Response(
        JSON.stringify({ error: "Payment method not configured" }),
        { status: 400 }
      );
    }

    // If method doesn't require verification, mark as verified immediately
    if (!method.requires_verification) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "paid", payment_method: paymentMethod })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order:", updateError.message);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "verified",
          message: "Pago verificado automáticamente"
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // For methods that require verification, create a verification record
    const verification = {
      receipt_object_id: null,
      payment_method_id: method.id,
      extracted_data: {
        amount,
        reference,
        phone,
        type: paymentMethod,
        orderId,
      },
      matched_transaction: null,
      status: "pending_review",
      confidence_score: 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("payment_verifications")
      .insert(verification)
      .select();

    if (insertError) {
      console.error("Error inserting verification:", insertError.message);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500 }
      );
    }

    // Update order status to pending verification
    await supabase
      .from("orders")
      .update({ status: "pending", payment_method: paymentMethod })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        status: "pending_review",
        verificationId: inserted[0].id,
        message: "Pago en revisión manual"
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
});
