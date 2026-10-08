import Link from "next/link";

export default function AccesoDenegadoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="text-7xl">🔒</div>
        <h1 className="text-3xl font-black text-white">Acceso Denegado</h1>
        <p className="text-muted leading-relaxed">
          No tienes permisos para acceder a esta sección. Si crees que esto es
          un error, contacta al administrador del sistema.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-primary">
            ← Volver al inicio
          </Link>
          <Link href="/login" className="btn-outline">
            Iniciar sesión con otra cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
