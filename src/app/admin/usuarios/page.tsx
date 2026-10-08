"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsersAction, updateUserRoleAction } from "../../actions";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const res = await getUsersAction();
    if (res.success) setUsers(res.users);
    setLoading(false);
  }

  async function changeRole(userId: string, newRole: string) {
    const res = await updateUserRoleAction(userId, newRole);
    if (res.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setToast("Rol actualizado");
      setTimeout(() => setToast(null), 2500);
    } else {
      setToast("Error: " + res.error);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button onClick={() => router.push("/admin")} className="btn-outline text-xs">← Volver</button>
          <h1 className="text-2xl font-black">Gestión de Usuarios</h1>
        </div>

        <div className="card p-6 space-y-4">
          <input
            className="input"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <p className="text-center text-muted py-8">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted uppercase">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Registro</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-2/50">
                      <td className="p-3 font-mono text-white">{u.email}</td>
                      <td className="p-3 text-muted">{u.name || "—"}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          u.role === "admin" ? "bg-purple-500/20 text-purple-300" :
                          u.role === "organizer" ? "bg-amber-500/20 text-amber-300" :
                          "bg-surface-2 text-muted"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-muted">{new Date(u.created_at).toLocaleDateString("es-CO")}</td>
                      <td className="p-3 text-right">
                        <select
                          className="input !w-auto !py-1 !text-xs"
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                        >
                          <option value="customer">customer</option>
                          <option value="organizer">organizer</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-surface border border-white/10 px-6 py-3 text-sm font-semibold shadow-2xl text-white animate-pulse">
          {toast}
        </div>
      )}
    </div>
  );
}
