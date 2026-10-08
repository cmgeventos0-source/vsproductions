import { requireAuth, requireAdmin, requireCronSecret } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

describe("Auth Guards", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("debe retornar el usuario autenticado y su rol", async () => {
      const mockChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: "admin" } }),
      };

      mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "u-123", email: "admin@boleteria.com" } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue(mockChain),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const user = await requireAuth();
      expect(user.id).toBe("u-123");
      expect(user.email).toBe("admin@boleteria.com");
      expect(user.role).toBe("admin");
    });

    it("debe lanzar error si no hay usuario autenticado", async () => {
      mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Invalid session"),
          }),
        },
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await expect(requireAuth()).rejects.toThrow("No autenticado");
    });
  });

  describe("requireAdmin", () => {
    it("debe permitir el acceso si el rol es admin", async () => {
      const mockChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: "admin" } }),
      };

      mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "admin-1", email: "admin@test.com" } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue(mockChain),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const user = await requireAdmin();
      expect(user.role).toBe("admin");
    });

    it("debe rechazar si el usuario es customer", async () => {
      const mockChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: "customer" } }),
      };

      mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "user-1", email: "client@test.com" } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue(mockChain),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await expect(requireAdmin()).rejects.toThrow("Acceso denegado");
    });
  });

  describe("requireCronSecret", () => {
    const originalEnv = process.env.CRON_SECRET;

    afterEach(() => {
      process.env.CRON_SECRET = originalEnv;
    });

    it("debe retornar true con token correcto", () => {
      process.env.CRON_SECRET = "super-secret-cron-token";
      const req = {
        headers: {
          get: (name: string) => (name.toLowerCase() === "authorization" ? "Bearer super-secret-cron-token" : null),
        },
      };

      expect(requireCronSecret(req)).toBe(true);
    });

    it("debe retornar false con token incorrecto o faltante", () => {
      process.env.CRON_SECRET = "super-secret-cron-token";
      const req = {
        headers: {
          get: (name: string) => (name.toLowerCase() === "authorization" ? "Bearer invalid" : null),
        },
      };

      expect(requireCronSecret(req)).toBe(false);
    });
  });
});
