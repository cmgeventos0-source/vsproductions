import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  async function registerAction(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return redirect(`/registro?message=${encodeURIComponent(error.message)}`);
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        email: email,
        role: "customer",
      });
    }

    return redirect("/mis-boletas");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="card w-full p-8">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
            ✨
          </span>
          <h1 className="mt-4 text-2xl font-black">Crear Cuenta</h1>
          <p className="mt-1 text-sm text-muted">Regístrate para comprar y almacenar tus boletas digitales</p>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-semibold text-red-400">
            {message}
          </div>
        )}

        <form action={registerAction} className="mt-6 space-y-4">
          <div>
            <label className="label">Nombre Completo</label>
            <input name="fullName" type="text" required placeholder="Juan Pérez" className="input" />
          </div>
          <div>
            <label className="label">Correo Electrónico</label>
            <input name="email" type="email" required placeholder="tu@email.com" className="input" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input name="password" type="password" required placeholder="••••••••" className="input" />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Crear Mi Cuenta
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-accent-2 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
