import { createClient } from "@/lib/supabase/server";
import TicketLookupView from "../../components/TicketLookupView";
import type { Ticket } from "@/lib/types";

export default async function MisBoletasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialTickets: Ticket[] = [];

  if (user) {
    const { data: tickets } = await supabase
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
      .order("issued_at", { ascending: false });

    initialTickets = (tickets as Ticket[]) ?? [];
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Mis Boletas Digitales</h1>
          <p className="mt-1 text-sm text-muted">
            Consulta tus entradas ingresando tu cédula o correo y presenta tus códigos QR en la puerta de entrada.
          </p>
        </div>

        <TicketLookupView initialTickets={initialTickets} isLoggedIn={!!user} />
      </div>
    </div>
  );
}
