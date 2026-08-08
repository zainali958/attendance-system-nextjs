import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface SessionPayload {
  username: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  isAdmin: boolean;
}

const SESSION_COOKIE = "session";
const DEVICE_COOKIE = "device_token";

function getSecret(): Uint8Array {
  const secret = process.env.SECRET_KEY || "your-secret-key-here";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5y") // "remember me" style, matches Flask-Login remember=True
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getDeviceTokenCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value;
}

export async function setDeviceTokenCookie(token: string) {
  const store = await cookies();
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 years, matches the Flask app
  });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const DEVICE_COOKIE_NAME = DEVICE_COOKIE;
