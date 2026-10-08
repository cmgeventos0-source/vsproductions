import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="text-lg font-black">
            Boletería<span className="text-accent-2">.</span>CO
          </p>
          <p className="mt-2 text-sm text-muted">
            Sistema configurable de boletería: conciertos, teatro, deportes,
            festivales y experiencias en Colombia.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Categorías
          </p>
          <ul className="space-y-2 text-sm text-muted">
            {["Conciertos", "Teatro", "Deportes", "Festivales", "Experiencias"].map((c) => (
              <li key={c}>
                <Link href={`/eventos?categoria=${c.toLowerCase()}`} className="hover:text-foreground">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Ayuda
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/mis-boletas" className="hover:text-foreground">Mis boletas</Link></li>
            <li><Link href="/admin" className="hover:text-foreground">Panel admin</Link></li>
            <li><Link href="/login" className="hover:text-foreground">Mi cuenta</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Boletería.CO · Hecho en Colombia 🇨🇴
      </div>
    </footer>
  );
}
