import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getZonePricing, getZoneMinorPrice, getZonePackagePromo } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const customerName = formData.get("customerName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const idNumber = formData.get("idNumber") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const receiptFile = formData.get("receiptFile") as File | null;
    const total = Number(formData.get("total"));
    const subtotal = Number(formData.get("subtotal"));
    const serviceFee = Number(formData.get("serviceFee"));
    const promoCode = formData.get("promoCode") as string | null;

    const functionId = formData.get("functionId") as string;
    const zoneId = formData.get("zoneId") as string;
    const seatIdsJson = formData.get("seatIds") as string;
    const seatIds: string[] = seatIdsJson ? JSON.parse(seatIdsJson) : [];
    const requestedQty = Number(formData.get("quantity")) || 1;

    if (!customerName?.trim() || !email?.trim() || !phone?.trim() || !idNumber?.trim()) {
      return NextResponse.json({ success: false, error: "Completa todos los datos del comprador." }, { status: 400 });
    }
    if (!functionId) {
      return NextResponse.json({ success: false, error: "Falta la función del evento." }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ success: false, error: "Selecciona un método de pago." }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    let zone: any = null;
    if (zoneId) {
      let { data: zData, error: zErr } = await adminClient
        .from("zones")
        .select("id, price, minor_price, minor_presale_price, presale_price, presale_end_at, is_promo_active, promo_single_price, promo_package_qty, promo_package_price, promo_package_name, promo_end_at, capacity, sold_count, function_id")
        .eq("id", zoneId)
        .single();

      if (zErr) {
        const fallback = await adminClient
          .from("zones")
          .select("id, price, presale_price, presale_end_at, capacity, sold_count, function_id")
          .eq("id", zoneId)
          .single();
        zData = fallback.data ? {
          ...fallback.data,
          minor_price: null,
          minor_presale_price: null,
          is_promo_active: false,
          promo_single_price: null,
          promo_package_qty: null,
          promo_package_price: null,
          promo_package_name: null,
          promo_end_at: null,
        } : null;
      }
      zone = zData;
    }

    if (zoneId && !zone) {
      return NextResponse.json({ success: false, error: "La zona seleccionada no existe." }, { status: 400 });
    }
    if (zone && zone.function_id !== functionId) {
      return NextResponse.json({ success: false, error: "La zona no corresponde a esta función." }, { status: 400 });
    }

    let allowsMinors = false;
    let maxMinorsPerAdult = 2;

    const { data: eventFunction } = await adminClient
      .from("event_functions")
      .select("id, event_id, event:events(id, allows_minors, max_minors_per_adult)")
      .eq("id", functionId)
      .maybeSingle();

    if (eventFunction?.event) {
      const ev = eventFunction.event as any;
      allowsMinors = Boolean(ev.allows_minors);
      maxMinorsPerAdult = ev.max_minors_per_adult || 2;
    }

    const rawAdultQty = formData.get("adultQuantity");
    const rawMinorQty = formData.get("minorQuantity");

    let adultQty = rawAdultQty !== null ? Math.max(1, Number(rawAdultQty)) : (seatIds.length > 0 ? seatIds.length : Math.max(1, requestedQty));
    let minorQty = allowsMinors && rawMinorQty !== null ? Math.max(0, Number(rawMinorQty)) : 0;

    if (allowsMinors && minorQty > 0) {
      if (adultQty < 1) {
        return NextResponse.json({ success: false, error: "Para comprar boleta de menor es obligatorio que esté acompañado por un adulto." }, { status: 400 });
      }
      if (minorQty > adultQty * maxMinorsPerAdult) {
        return NextResponse.json({ success: false, error: `Máximo permitido: ${maxMinorsPerAdult} menor(es) por cada adulto.` }, { status: 400 });
      }
    }

    const quantity = seatIds.length > 0 ? seatIds.length : (adultQty + minorQty);
    const pricing = zone ? getZonePricing(zone) : { currentPrice: 0, fullPrice: 0 };
    const minorUnitPrice = zone ? getZoneMinorPrice(zone) : pricing.currentPrice;

    const promoInfo = zone ? getZonePackagePromo(zone) : null;
    const effectiveSinglePrice = promoInfo?.hasPromo && promoInfo.singlePromoPrice !== null
      ? promoInfo.singlePromoPrice
      : pricing.currentPrice;

    let computedAdultSubtotal = effectiveSinglePrice * adultQty;
    if (promoInfo?.hasPromo && promoInfo.packageQty >= 2 && promoInfo.packagePrice > 0) {
      const packagesCount = Math.floor(adultQty / promoInfo.packageQty);
      const remainderQty = adultQty % promoInfo.packageQty;
      computedAdultSubtotal = (packagesCount * promoInfo.packagePrice) + (remainderQty * effectiveSinglePrice);
    }

    const unitPrice = effectiveSinglePrice;
    const computedSubtotal = computedAdultSubtotal + (minorUnitPrice * minorQty);
    const computedServiceFee = 0;

    if (zone && seatIds.length === 0) {
      if (zone.capacity != null && zone.sold_count + quantity > zone.capacity) {
        return NextResponse.json({ success: false, error: `No hay suficientes lugares disponibles en esta zona. Quedan ${zone.capacity - zone.sold_count}.` }, { status: 400 });
      }
    }

    const heldSeats: string[] = [];
    if (seatIds.length > 0) {
      const holdMinutes = 15;
      const holdExpiry = new Date(Date.now() + holdMinutes * 60000).toISOString();

      try {
        for (const seatId of seatIds) {
          const { data: seat } = await adminClient
            .from("seats")
            .select("id, status")
            .eq("id", seatId)
            .single();

          if (!seat || seat.status !== "available") {
            return NextResponse.json({ success: false, error: `La silla ${seatId} ya no está disponible.` }, { status: 400 });
          }

          const { error: holdErr } = await adminClient
            .from("seats")
            .update({ status: "held", hold_expires_at: holdExpiry })
            .eq("id", seatId)
            .eq("status", "available");

          if (holdErr) throw new Error("Error al reservar las sillas.");
          heldSeats.push(seatId);
        }
      } catch (err: any) {
        if (heldSeats.length > 0) {
          await adminClient
            .from("seats")
            .update({ status: "available", hold_expires_at: null })
            .in("id", heldSeats);
        }
        return NextResponse.json({ success: false, error: err.message || "Error al apartar sillas" }, { status: 400 });
      }
    }

    let receiptUrl = null;
    if (receiptFile && typeof receiptFile === "object" && "size" in receiptFile && receiptFile.size > 0) {
      try {
        const fileExt = (receiptFile.name || "jpg").split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await adminClient.storage
          .from("receipts")
          .upload(fileName, receiptFile);

        if (!uploadError) {
          const { data: { publicUrl } } = adminClient.storage
            .from("receipts")
            .getPublicUrl(fileName);
          receiptUrl = publicUrl;
        } else {
          console.warn("Error uploading receipt:", uploadError.message);
        }
      } catch (e: any) {
        console.warn("Exception uploading receipt:", e.message);
      }
    }

    let discountAmount = 0;
    if (promoCode) {
      const { data: promo } = await adminClient
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .single();

      if (promo) {
        const now = new Date().toISOString();
        const validEvent = !promo.event_id || promo.event_id === formData.get("eventId");
        const validExpiry = !promo.expires_at || promo.expires_at > now;
        const validUses = !promo.max_uses || promo.used_count < promo.max_uses;

        if (validEvent && validExpiry && validUses) {
          discountAmount = promo.discount_type === "percent"
            ? Math.round(computedSubtotal * (promo.discount_value / 100))
            : Math.min(promo.discount_value, computedSubtotal);

          await adminClient
            .from("promo_codes")
            .update({ used_count: promo.used_count + 1 })
            .eq("id", promo.id);
        }
      }
    }

    const finalSubtotal = Math.max(0, computedSubtotal - discountAmount);
    const finalTotal = finalSubtotal + computedServiceFee;

    const orderId = crypto.randomUUID();
    const { error: orderError } = await adminClient.from("orders").insert({
      id: orderId,
      user_id: user?.id || null,
      email,
      customer_name: customerName,
      customer_phone: phone,
      customer_id_number: idNumber,
      status: 'pending',
      subtotal: finalSubtotal,
      service_fee: computedServiceFee,
      total: finalTotal,
      payment_method: paymentMethod,
      receipt_url: receiptUrl
    });

    if (orderError) {
      return NextResponse.json({ success: false, error: orderError.message }, { status: 500 });
    }

    if (seatIds.length > 0) {
      const seatItems = seatIds.map(seatId => ({
        order_id: orderId,
        zone_id: zoneId,
        function_id: functionId,
        seat_id: seatId,
        quantity: 1,
        unit_price: unitPrice,
        item_type: 'adult'
      }));
      let { error: itemErr } = await adminClient.from("order_items").insert(seatItems);
      if (itemErr) {
        const retryItems = seatIds.map(seatId => ({
          order_id: orderId,
          zone_id: zoneId,
          function_id: functionId,
          seat_id: seatId,
          quantity: 1,
          unit_price: unitPrice
        }));
        await adminClient.from("order_items").insert(retryItems);
      }
    } else if (allowsMinors && minorQty > 0) {
      const adultItem = {
        order_id: orderId,
        zone_id: zoneId,
        function_id: functionId,
        quantity: adultQty,
        unit_price: effectiveSinglePrice,
        item_type: 'adult'
      };
      const minorItem = {
        order_id: orderId,
        zone_id: zoneId,
        function_id: functionId,
        quantity: minorQty,
        unit_price: minorUnitPrice,
        item_type: 'minor'
      };
      let { error: itemErr } = await adminClient.from("order_items").insert([adultItem, minorItem]);
      if (itemErr) {
        delete (adultItem as any).item_type;
        delete (minorItem as any).item_type;
        await adminClient.from("order_items").insert([adultItem, minorItem]);
      }
    } else {
      const generalItem = {
        order_id: orderId,
        zone_id: zoneId,
        function_id: functionId,
        quantity: quantity,
        unit_price: unitPrice,
        item_type: 'adult'
      };
      let { error: itemErr } = await adminClient.from("order_items").insert(generalItem);
      if (itemErr) {
        delete (generalItem as any).item_type;
        await adminClient.from("order_items").insert(generalItem);
      }
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error("Order creation API error:", err);
    return NextResponse.json({ success: false, error: err.message || "Error al procesar pedido" }, { status: 500 });
  }
}
