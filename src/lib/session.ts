import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "rs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

/** `version` must equal User.sessionVersion; bumping that column logs the user out everywhere. */
export async function createSession(userId: string, version: number) {
  const token = await new SignJWT({ sub: userId, v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function readSession(): Promise<{ id: string; v: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    return { id: payload.sub, v: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

export type CurrentUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  name: string | null;
  role: string;
  balance: number;
  status: string; // ACTIVE | PAUSED (FROZEN users never get here)
  statusNote: string | null;
  lossMode: string; // NORMAL | TIGHT | FORCE_LOSS
};

// cache(): the layout and the page share one lookup per request (fewer round trips to the database).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, email: true, username: true, firstName: true, lastName: true, phone: true, name: true,
      role: true, balance: true, status: true, statusNote: true, lossMode: true, sessionVersion: true,
    },
  });
  // FROZEN accounts and sessions from before a password reset are rejected on every request.
  if (!user || user.status === "FROZEN" || user.sessionVersion !== session.v) return null;
  const { sessionVersion: _v, ...rest } = user;
  void _v;
  return rest;
});

export const PAUSED_MESSAGE = "Your account is paused. Contact support to reactivate it.";

export function displayName(u: Pick<CurrentUser, "firstName" | "username" | "name" | "email">) {
  return u.firstName || u.username || u.name || u.email.split("@")[0];
}

export function fullName(u: Pick<CurrentUser, "firstName" | "lastName">) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}
