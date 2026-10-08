import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "../../components/CheckoutForm";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ functionId?: string; zoneId?: string; seats?: string; qty?: string }>;
}) {
  const { functionId, zoneId, seats: seatIdsParam, qty } = await searchParams;
  const supabase = await createClient();

  if (!functionId) {
    return (
      <div className="mx-auto max-w-md py-12 text-center card p-6 my-10">
        No se especificó la función a comprar.
      </div>
    );
  }

  // Cargar datos de la función
  const { data: eventFunction } = await supabase
    .from("event_functions")
    .select("id, event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at, is_active")
    .eq("id", functionId)
    .maybeSingle();

  if (!eventFunction) {
    return (
      <div className="mx-auto max-w-md py-12 text-center card p-6 my-10">
        La función especificada no existe.
      </div>
    );
  }

  if (eventFunction?.event_id) {
    const { data: ev } = await supabase.from("events").select("id, slug, name, description, image_url, sale_mode, status, category_id, venue_id").eq("id", eventFunction.event_id).maybeSingle();
    (eventFunction as any).event = ev || null;
  }

  let zone = null;
  if (zoneId) {
    const { data: zoneData } = await supabase.from("zones").select("*").eq("id", zoneId).single();
    zone = zoneData;
  }

  let seats = [];
  if (seatIdsParam) {
    const seatIds = seatIdsParam.split(",");
    const { data: seatsData } = await supabase.from("seats").select("*").in("id", seatIds);
    seats = seatsData ?? [];
    if (seats.length > 0 && !zone) {
      const { data: zoneData } = await supabase
        .from("zones")
        .select("*")
        .eq("id", seats[0].zone_id)
        .single();
      zone = zoneData;
    }
  }

  const parsedQty = qty ? parseInt(qty, 10) : 1;

  return (
    <CheckoutForm
      eventFunction={eventFunction}
      zone={zone}
      seats={seats}
      initialQuantity={isNaN(parsedQty) ? 1 : parsedQty}
    />
  );
}
