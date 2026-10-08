import { ShoppingCartComponent } from "@/components/ShoppingCartComponent";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrito de Compras | Boletería.CO",
  description: "Revisa y gestiona las boletas en tu carrito antes de completar la compra.",
};

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-black text-white sm:text-4xl">Carrito de Compras</h1>
        <p className="mt-1.5 text-sm text-muted">
          Gestiona las boletas seleccionadas, aplica códigos de descuento y procede al pago seguro.
        </p>
      </div>

      <ShoppingCartComponent />
    </div>
  );
}
