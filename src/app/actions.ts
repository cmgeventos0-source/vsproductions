"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";
import { redirect } from "next/navigation";
import { generateSecureTicketCode } from "@/lib/ticket-utils";
import { getZonePricing } from "@/lib/pricing";
import { EmailService } from "@/lib/services/emailService";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

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
    throw new Error("Completa todos los datos del comprador.");
  }
  if (!functionId) {
    throw new Error("Falta la función del evento.");
  }
  if (!paymentMethod) {
    throw new Error("Selecciona un método de pago.");
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data: zone } = zoneId
    ? await supabase
        .from("zones")
        .select("id, price, presale_price, presale_end_at, capacity, sold_count, function_id")
        .eq("id", zoneId)
        .single()
    : { data: null };

  if (zoneId && !zone) {
    throw new Error("La zona seleccionada no existe.");
  }
  if (zone && zone.function_id !== functionId) {
    throw new Error("La zona no corresponde a esta función.");
  }

  const quantity = seatIds.length > 0 ? seatIds.length : Math.max(1, requestedQty);
  const pricing = zone ? getZonePricing(zone) : { currentPrice: 0, fullPrice: 0 };
  const unitPrice = pricing.currentPrice;
  const computedSubtotal = unitPrice * quantity;
  const computedServiceFee = 0;

  if (zone && seatIds.length === 0) {
    if (zone.capacity != null && zone.sold_count + quantity > zone.capacity) {
      throw new Error(`No hay suficientes lugares disponibles en esta zona. Quedan ${zone.capacity - zone.sold_count}.`);
    }
  }

  const heldSeats: string[] = [];
  if (seatIds.length > 0) {
    const holdMinutes = 15;
    const holdExpiry = new Date(Date.now() + holdMinutes * 60000).toISOString();

    try {
      for (const seatId of seatIds) {
        const { data: seat } = await supabase
          .from("seats")
          .select("id, status")
          .eq("id", seatId)
          .single();

        if (!seat || seat.status !== "available") {
          throw new Error(`La silla ${seatId} ya no está disponible.`);
        }

        const { error: holdErr } = await supabase
          .from("seats")
          .update({ status: "held", hold_expires_at: holdExpiry })
          .eq("id", seatId)
          .eq("status", "available");

        if (holdErr) throw new Error("Error al reservar las sillas.");
        heldSeats.push(seatId);
      }
    } catch (err) {
      if (heldSeats.length > 0) {
        await supabase
          .from("seats")
          .update({ status: "available", hold_expires_at: null })
          .in("id", heldSeats);
      }
      throw err;
    }
  }

  let receiptUrl = null;
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = receiptFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, receiptFile);

    if (uploadError) throw new Error(`Error subiendo el comprobante: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName);
    receiptUrl = publicUrl;
  }

  let discountAmount = 0;
  if (promoCode) {
    const { data: promo } = await supabase
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

        await supabase
          .from("promo_codes")
          .update({ used_count: promo.used_count + 1 })
          .eq("id", promo.id);
      }
    }
  }

  const finalSubtotal = Math.max(0, computedSubtotal - discountAmount);
  const finalTotal = finalSubtotal + computedServiceFee;

  const orderId = crypto.randomUUID();
  const { error: orderError } = await supabase.from("orders").insert({
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

  if (orderError) throw orderError;

  if (seatIds.length > 0) {
    const seatItems = seatIds.map(seatId => ({
      order_id: orderId,
      zone_id: zoneId,
      function_id: functionId,
      seat_id: seatId,
      quantity: 1,
      unit_price: unitPrice
    }));
    await supabase.from("order_items").insert(seatItems);
  } else {
    await supabase.from("order_items").insert({
      order_id: orderId,
      zone_id: zoneId,
      function_id: functionId,
      quantity: quantity,
      unit_price: unitPrice
    });
  }

  return { success: true, orderId };
}

export async function approveOrderAction(orderId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("orders")
    .update({ status: "paid" })
    .eq("id", orderId);

  if (error) return { success: false, error: error.message };

  // Actualizar verificaciones asociadas si existen
  await supabase
    .from("payment_verifications")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .filter("extracted_data->>orderId", "eq", orderId);

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
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

  await generateTicketsForOrder(orderId);
  return { success: true };
}

export async function rejectOrderAction(orderId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);
  if (error) return { success: false, error: error.message };

  const { data: items } = await supabase.from("order_items").select("seat_id").eq("order_id", orderId);
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

  return { success: true };
}

export async function cancelSaleAction(orderId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: orderError?.message || "Orden no encontrada" };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "La venta ya está anulada" };
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("zone_id, seat_id, quantity")
    .eq("order_id", orderId);

  if (itemsError) return { success: false, error: itemsError.message };

  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  if (updateOrderError) return { success: false, error: updateOrderError.message };

  const { error: ticketError } = await supabase
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("order_id", orderId);

  if (ticketError) return { success: false, error: ticketError.message };

  for (const item of items ?? []) {
    if (item.seat_id) {
      await supabase
        .from("seats")
        .update({ status: "available", hold_expires_at: null })
        .eq("id", item.seat_id);
    }

    if (order.status === "paid" && item.zone_id) {
      const { data: zone } = await supabase
        .from("zones")
        .select("sold_count")
        .eq("id", item.zone_id)
        .single();

      if (zone) {
        await supabase
          .from("zones")
          .update({ sold_count: Math.max(0, Number(zone.sold_count ?? 0) - Number(item.quantity ?? 0)) })
          .eq("id", item.zone_id);
      }
    }
  }

  return { success: true };
}

export async function deleteOrderAction(orderId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (!order) {
    return { success: false, error: "Orden no encontrada" };
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("zone_id, seat_id, quantity")
    .eq("order_id", orderId);

  for (const item of items ?? []) {
    if (item.seat_id) {
      await supabase
        .from("seats")
        .update({ status: "available", hold_expires_at: null })
        .eq("id", item.seat_id);
    }

    if (order.status === "paid" && item.zone_id) {
      const { data: zone } = await supabase
        .from("zones")
        .select("sold_count")
        .eq("id", item.zone_id)
        .single();

      if (zone) {
        await supabase
          .from("zones")
          .update({ sold_count: Math.max(0, Number(zone.sold_count ?? 0) - Number(item.quantity ?? 0)) })
          .eq("id", item.zone_id);
      }
    }
  }

  await supabase.from("payment_verifications").delete().filter("extracted_data->>orderId", "eq", orderId);
  await supabase.from("tickets").delete().eq("order_id", orderId);
  await supabase.from("order_items").delete().eq("order_id", orderId);
  const { error } = await supabase.from("orders").delete().eq("id", orderId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: "Venta eliminada por completo" };
}

export async function redeemTicketAction(ticketCode: string) {
  await requireAdmin();
  const supabase = await createClient();
  
  const { data: ticket, error: fetchError } = await supabase.from("tickets")
    .select("id, order_id, function_id, zone_id, seat_id, holder_name, code, qr_data, status, issued_at, redeemed_at")
    .eq("code", ticketCode)
    .single();

  if (fetchError || !ticket) {
    return { status: "invalid", message: "❌ Código Inválido o No Encontrado" };
  }

  if (ticket.status === "redeemed") {
    return { status: "already_redeemed", message: `⚠️ Boleta Ya Ingresada previamente a las ${new Date(ticket.redeemed_at).toLocaleTimeString()}` };
  }

  if (ticket.status !== "active") {
    return { status: "invalid", message: "❌ Boleta no está activa" };
  }

  let zone = null;
  let seat = null;
  let eventFunction = null;
  let event = null;

  if (ticket.zone_id) {
    const { data: zoneData } = await supabase.from("zones").select("id, name, color").eq("id", ticket.zone_id).maybeSingle();
    zone = zoneData;
  }

  if (ticket.seat_id) {
    const { data: seatData } = await supabase.from("seats").select("id, row_name, number").eq("id", ticket.seat_id).maybeSingle();
    seat = seatData;
  }

  if (ticket.function_id) {
    const { data: fnData } = await supabase.from("event_functions").select("id, name, starts_at, event_id").eq("id", ticket.function_id).maybeSingle();
    eventFunction = fnData;
    if (eventFunction?.event_id) {
      const { data: evData } = await supabase.from("events").select("id, name, image_url").eq("id", eventFunction.event_id).maybeSingle();
      event = evData;
    }
  }

  // Redeem
  await supabase.from("tickets")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", ticket.id);

  return { 
    status: "valid", 
    message: "✅ ¡ENTRADA VÁLIDA - INGRESO AUTORIZADO!",
    ticketDetails: {
      code: ticket.code,
      holder: ticket.holder_name,
      zone: zone?.name || "General",
      seat: seat ? `Fila ${seat.row_name} - Silla ${seat.number}` : "N/A",
      event: event?.name || "Evento"
    }
  };
}


export async function addToCart(data: { 
  functionId: string, 
  zoneId: string | null, 
  seatIds: string[], 
  quantity: number 
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Obtener o crear carrito para el usuario
  let { data: cart } = await supabase
    .from("shopping_carts")
    .select("id")
    .eq("user_id", user?.id || "") // Simplificado para usar user_id
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error: cartError } = await supabase
      .from("shopping_carts")
      .insert({ user_id: user?.id || null })
      .select("id")
      .single();
    if (cartError) throw cartError;
    cart = newCart;
  }

  // 2. Insertar items
  const items = data.seatIds.length > 0 
    ? data.seatIds.map(s => ({ 
        cart_id: cart.id, 
        function_id: data.functionId, 
        zone_id: data.zoneId, 
        seat_id: s, 
        quantity: 1 
      }))
    : [{ 
        cart_id: cart.id, 
        function_id: data.functionId, 
        zone_id: data.zoneId, 
        quantity: data.quantity 
      }];

  const { error: itemsError } = await supabase.from("shopping_cart_items").insert(items);
  if (itemsError) throw itemsError;
  return { success: true };
}

export async function saveAppConfig(key: string, value: any) {
  await requireAdmin();
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("app_config")
    .upsert({ key, value });

  if (error) throw error;
  return { success: true };
}

export async function getAppConfig(key: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .single();
    
  return data?.value || null;
}

export async function generateTicketsForOrder(orderId: string) {
  const supabase = await createClient();

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  if (!items) return;

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();

  for (const item of items) {
    let countToCreate = item.quantity;
    if (item.zone_id) {
      const { data: z } = await supabase.from("zones").select("sale_type, capacity").eq("id", item.zone_id).maybeSingle();
      if (z && z.sale_type === "full_zone" && z.capacity && z.capacity > 0) {
        countToCreate = item.quantity * z.capacity;
      }
    }

    for (let i = 0; i < countToCreate; i++) {
      const code = generateSecureTicketCode();
      await supabase.from("tickets").insert({
        order_id: orderId,
        function_id: item.function_id,
        zone_id: item.zone_id,
        seat_id: item.seat_id,
        holder_name: order?.customer_name,
        code,
        qr_data: code,
        status: 'active'
      });
    }
  }
}

export async function saveZoneCoordinatesAction(zoneId: string, coords: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("zones")
    .update({ map_coords: coords })
    .eq("id", zoneId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function renameZoneAction(zoneId: string, newName: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("zones")
    .update({ name: newName })
    .eq("id", zoneId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function divideZoneAction(
  parentZoneId: string,
  divisions: { name: string; capacity: number }[]
) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: parent, error: fetchErr } = await supabase
    .from("zones")
    .select("*")
    .eq("id", parentZoneId)
    .single();

  if (fetchErr || !parent) return { success: false, error: fetchErr?.message ?? "Zona no encontrada" };

  const children = divisions.map((d, i) => ({
    function_id: parent.function_id,
    parent_id: parentZoneId,
    name: d.name,
    price: parent.price,
    capacity: d.capacity,
    sold_count: 0,
    color: parent.color,
    sort_order: parent.sort_order + i + 1,
  }));

  const { data: created, error: insertErr } = await supabase
    .from("zones")
    .insert(children)
    .select();

  if (insertErr) return { success: false, error: insertErr.message };
  return { success: true, zones: created };
}

export async function addZoneAction(
  functionId: string,
  name: string,
  price: number,
  capacity: number | null,
  color: string,
  presalePrice?: number | null,
  presaleEndAt?: string | null,
  saleType?: "individual" | "full_zone"
) {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("zones")
    .select("*", { count: "exact", head: true })
    .eq("function_id", functionId);

  const payload: any = {
    function_id: functionId,
    name,
    price,
    capacity,
    color,
    sort_order: (count ?? 0) + 1,
    sale_type: saleType ?? "individual",
  };

  if (presalePrice !== undefined && presalePrice !== null) {
    payload.presale_price = presalePrice;
  }
  if (presaleEndAt) {
    payload.presale_end_at = presaleEndAt;
  }

  let { data, error } = await supabase
    .from("zones")
    .insert(payload)
    .select()
    .single();

  if (error && (error.message?.includes("presale_price") || error.message?.includes("presale_end_at") || error.message?.includes("sale_type") || error.code === "PGRST204")) {
    delete payload.presale_price;
    delete payload.presale_end_at;
    delete payload.sale_type;
    const retry = await supabase.from("zones").insert(payload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { success: false, error: error.message };
  return { success: true, zone: data };
}

export async function updateZoneAction(
  zoneId: string,
  data: {
    name?: string;
    price?: number;
    presale_price?: number | null;
    presale_end_at?: string | null;
    sale_type?: "individual" | "full_zone";
    capacity?: number | null;
    color?: string;
  }
) {
  await requireAdmin();
  const supabase = createAdminClient();

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.presale_price !== undefined) updateData.presale_price = data.presale_price;
  if (data.presale_end_at !== undefined) updateData.presale_end_at = data.presale_end_at;
  if (data.sale_type !== undefined) updateData.sale_type = data.sale_type;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.color !== undefined) updateData.color = data.color;

  let { data: updated, error } = await supabase
    .from("zones")
    .update(updateData)
    .eq("id", zoneId)
    .select()
    .single();

  if (error && (error.message?.includes("presale_price") || error.message?.includes("presale_end_at") || error.message?.includes("sale_type") || error.code === "PGRST204")) {
    delete updateData.presale_price;
    delete updateData.presale_end_at;
    delete updateData.sale_type;
    const retry = await supabase.from("zones").update(updateData).eq("id", zoneId).select().single();
    updated = retry.data;
    error = retry.error;
  }

  if (error) return { success: false, error: error.message };
  return { success: true, zone: updated };
}

export async function deleteZoneAction(zoneId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Find all zone IDs to delete (the target zone + any child subzones)
  const { data: childZones } = await supabase
    .from("zones")
    .select("id")
    .eq("parent_id", zoneId);

  const allZoneIds = [zoneId, ...(childZones ?? []).map((z) => z.id)];

  // Check if tickets exist for any of these zones
  const { count: ticketsCount } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .in("zone_id", allZoneIds);

  if (ticketsCount && ticketsCount > 0) {
    return {
      success: false,
      error: "No se puede eliminar la zona porque ya existen boletas emitidas asociadas a ella.",
    };
  }

  // Clear shopping cart items referencing these zones
  await supabase.from("shopping_cart_items").delete().in("zone_id", allZoneIds);

  // Clear seats referencing these zones
  await supabase.from("seats").delete().in("zone_id", allZoneIds);

  // Clear order_items reference if any
  await supabase.from("order_items").update({ zone_id: null }).in("zone_id", allZoneIds);

  // Delete child zones first if any
  if (childZones && childZones.length > 0) {
    const { error: childErr } = await supabase
      .from("zones")
      .delete()
      .in("id", childZones.map((z) => z.id));
    if (childErr) return { success: false, error: childErr.message };
  }

  // Delete target zone
  const { error } = await supabase.from("zones").delete().eq("id", zoneId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}


export async function generateSeatsAction(zoneId: string, rows: number, seatsPerRow: number) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: zone, error: zoneErr } = await supabase
    .from("zones")
    .select("function_id")
    .eq("id", zoneId)
    .single();

  if (zoneErr || !zone) return { success: false, error: zoneErr?.message ?? "Zona no encontrada" };

  const seats = [];
  for (let i = 0; i < rows; i++) {
    const rowName = String.fromCharCode(65 + i);
    for (let j = 1; j <= seatsPerRow; j++) {
      seats.push({
        zone_id: zoneId,
        function_id: zone.function_id,
        row_name: rowName,
        number: String(j),
        status: "available",
      });
    }
  }

  const { error } = await supabase.from("seats").insert(seats);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateEventStatusAction(eventId: string, status: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteEventAction(eventId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // 1) Obtener las funciones de este evento (las zonas/sillas se borran en cascade)
  const { data: functions, error: fErr } = await admin
    .from("event_functions")
    .select("id")
    .eq("event_id", eventId);
  if (fErr) return { success: false, error: fErr.message };
  const functionIds = (functions ?? []).map((f: any) => f.id);

  let zoneIds: string[] = [];
  let seatIds: string[] = [];
  if (functionIds.length) {
    const { data: zones } = await admin
      .from("zones")
      .select("id")
      .in("function_id", functionIds);
    zoneIds = (zones ?? []).map((z: any) => z.id);
    const { data: seats } = await admin
      .from("seats")
      .select("id")
      .in("function_id", functionIds);
    seatIds = (seats ?? []).map((s: any) => s.id);
  }

  // 2) Borrar filas hijas que NO tienen ON DELETE CASCADE en la BD:
  //    promo_codes.event_id, tickets.{function_id,zone_id,seat_id},
  //    order_items.{function_id,zone_id,seat_id}
  const { error: promoErr } = await admin
    .from("promo_codes")
    .delete()
    .eq("event_id", eventId);
  if (promoErr) return { success: false, error: promoErr.message };

  const childCols: Record<string, string[]> = {
    function_id: functionIds,
    zone_id: zoneIds,
    seat_id: seatIds,
  };
  for (const [col, ids] of Object.entries(childCols)) {
    if (!ids.length) continue;
    const { error: tErr } = await admin.from("tickets").delete().in(col, ids as any);
    if (tErr) return { success: false, error: tErr.message };
    const { error: oErr } = await admin
      .from("order_items")
      .delete()
      .in(col, ids as any);
    if (oErr) return { success: false, error: oErr.message };
  }

  // 3) Borrar el evento. event_functions -> zones -> seats se eliminán en cascade.
  const { error } = await admin.from("events").delete().eq("id", eventId);
  if (error) return { success: false, error: error.message };

  return { success: true };
}

export async function getUsersAction() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: users, error: usersErr } = await admin.auth.admin.listUsers();
  if (usersErr) return { success: false, error: usersErr.message, users: [] };

  const { data: profiles, error: profilesErr } = await admin.from("profiles").select("*");
  if (profilesErr) return { success: false, error: profilesErr.message, users: [] };

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const merged = (users?.users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    name: profileMap.get(u.id)?.full_name ?? u.user_metadata?.full_name ?? "",
    role: profileMap.get(u.id)?.role ?? "customer",
  }));

  return { success: true, users: merged };
}

export async function updateUserRoleAction(userId: string, role: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function createCategoryAction(name: string, slug: string, icon: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("categories").insert({ name, slug, icon }).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, category: data };
}

export async function updateCategoryAction(id: string, name: string, slug: string, icon: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("categories").update({ name, slug, icon }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteCategoryAction(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function createVenueAction(name: string, city: string, address: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("venues").insert({ name, city, address }).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, venue: data };
}

export async function updateVenueAction(id: string, name: string, city: string, address: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("venues").update({ name, city, address }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteVenueAction(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("venues").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function uploadImageAction(file: File) {
  const supabase = await createClient();
  const fileExt = file.name.split(".").pop();
  const fileName = `events/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const { error } = await supabase.storage.from("images").upload(fileName, file, { contentType: file.type });
  if (error) return { success: false, error: error.message };
  const { data } = supabase.storage.from("images").getPublicUrl(fileName);
  return { success: true, url: data.publicUrl };
}

export async function regenerateTicketsAction(orderId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  if (count && count > 0) {
    return { success: true, message: `Ya existen ${count} boletas para este pedido` };
  }

  await generateTicketsForOrder(orderId);
  return { success: true, message: "Boletas generadas" };
}

export async function transferTicketAction(ticketId: string, newHolderEmail: string, newHolderName?: string) {
  const user = await requireAuth();
  const supabase = await createClient();
  
  if (!newHolderEmail || !newHolderEmail.includes('@')) {
    return { success: false, error: 'Ingresa un correo electrónico válido.' };
  }

  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select("id, status, order_id")
    .eq("id", ticketId)
    .single();

  if (fetchErr || !ticket) {
    return { success: false, error: 'Boleta no encontrada.' };
  }

  if (ticket.status !== 'active') {
    return { success: false, error: 'Solo se pueden transferir boletas activas.' };
  }

  // Verificar pertenencia de la orden
  const { data: order } = await supabase
    .from("orders")
    .select("user_id, email")
    .eq("id", ticket.order_id)
    .single();

  const isOwner = order && (order.user_id === user.id || order.email === user.email);
  if (!isOwner && user.role !== 'admin') {
    return { success: false, error: 'No tienes permisos para transferir esta boleta.' };
  }

  const newCode = generateSecureTicketCode();
  const displayName = newHolderName?.trim() || newHolderEmail.split('@')[0];

  const { error: updateErr } = await supabase
    .from("tickets")
    .update({
      holder_name: displayName,
      code: newCode,
      qr_data: newCode,
    })
    .eq("id", ticketId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  return { success: true, newCode, holderName: displayName };
}

export async function getTicketsByDocumentAction(query: string) {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 4) {
    return { success: false, error: "Ingresa un número de cédula o correo válido." };
  }

  const admin = createAdminClient();

  const isEmail = cleanQuery.includes("@");
  let orderQuery = admin
    .from("orders")
    .select("id, customer_name, customer_id_number, email, status, created_at, total, payment_method");

  if (isEmail) {
    orderQuery = orderQuery.ilike("email", cleanQuery);
  } else {
    orderQuery = orderQuery.eq("customer_id_number", cleanQuery);
  }

  const { data: orders, error: ordersErr } = await orderQuery;

  if (ordersErr) {
    return { success: false, error: ordersErr.message, tickets: [], orders: [] };
  }

  if (!orders || orders.length === 0) {
    return { success: true, tickets: [], orders: [], message: "No se encontraron registros de compra asociados a este documento o correo." };
  }

  const orderIds = orders.map((o) => o.id);

  const { data: tickets, error: ticketsErr } = await admin
    .from("tickets")
    .select(`
      *,
      zone:zones(*),
      seat:seats(*),
      function:event_functions(
        *,
        event:events(*)
      )
    `)
    .in("order_id", orderIds)
    .order("issued_at", { ascending: false });

  if (ticketsErr) {
    return { success: false, error: ticketsErr.message, tickets: [], orders };
  }

  return { success: true, tickets: tickets || [], orders };
}

export async function resendTicketsEmailAction(orderId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, email, customer_name, total, status, created_at")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  if (!order.email) {
    return { success: false, error: "El pedido no tiene correo electrónico asociado" };
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      code,
      status,
      zone:zones(name),
      seat:seats(row_name, number),
      function:event_functions(
        name,
        starts_at,
        event:events(name)
      )
    `)
    .eq("order_id", orderId);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://vsproductions.vercel.app";

  let ticketsHtml = "";
  if (tickets && tickets.length > 0) {
    ticketsHtml = tickets
      .map((t: any) => {
        const eventName = t.function?.event?.name || "Evento";
        const functionName = t.function?.name || "";
        const zoneName = t.zone?.name || "General";
        const seatStr = t.seat ? `Fila ${t.seat.row_name} · Silla ${t.seat.number}` : "";
        return `
          <div style="background:#181825; border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:10px; color:#ffffff;">
            <p style="margin:0; font-weight:bold; font-size:14px; color:#a855f7;">${eventName} - ${functionName}</p>
            <p style="margin:4px 0 0 0; font-size:12px; color:#cccccc;">Zona: ${zoneName} ${seatStr ? `| ${seatStr}` : ""}</p>
            <p style="margin:6px 0 0 0; font-family:monospace; font-weight:bold; font-size:14px; color:#22c55e;">Código: ${t.code}</p>
          </div>
        `;
      })
      .join("");
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090f; color: #ffffff; padding: 24px; border-radius: 12px;">
      <h2 style="color: #a855f7; margin-top: 0;">¡Hola ${order.customer_name || 'Comprador'}!</h2>
      <p style="color: #cccccc;">Te reenviamos la información de tus entradas para la orden <strong>${order.id.substring(0, 8).toUpperCase()}</strong>.</p>
      
      <div style="margin: 20px 0;">
        ${ticketsHtml || "<p style='color: #888;'>Boletas disponibles digitalmente.</p>"}
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/pago/${order.id}"
           style="display: inline-block; padding: 12px 24px; background-color: #9333ea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          🎟️ Ver y descargar mis boletas
        </a>
      </div>
      <p style="margin-top: 24px; color: #666666; font-size: 12px; text-align: center;">
        Boletería Digital - Conserve este correo para la entrada al evento.
      </p>
    </div>
  `;

  const emailRes = await EmailService.sendEmail({
    to: order.email,
    subject: `🎟️ Tus boletas para ${order.id.substring(0, 8).toUpperCase()}`,
    html,
  });

  if (!emailRes.success) {
    return { success: false, error: emailRes.error || "No se pudo enviar el correo" };
  }

  return { success: true, message: `Boletas reenviadas con éxito a ${order.email}` };
}
