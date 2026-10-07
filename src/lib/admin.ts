import "server-only";
import { getCurrentUser } from "./session";

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export const forbidden = () => Response.json({ error: "Admins only" }, { status: 403 });
