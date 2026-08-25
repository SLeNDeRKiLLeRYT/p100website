// app/admin-panel-x8k2m9p7/admin-session.ts
// Server-side admin session: signed, httpOnly cookie. Edge-runtime safe (Web Crypto).
import 'server-only';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'p100_admin_session';
export const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours

const enc = new TextEncoder();

function sessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY;
  if (!s) throw new Error('ADMIN_SESSION_SECRET (or ADMIN_SECRET_KEY) must be set.');
  return s;
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(sessionSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  let bin = '';
  new Uint8Array(sig).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const payload = `admin.${Date.now() + ADMIN_MAX_AGE * 1000}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, exp, sig] = parts;
  if (role !== 'admin') return false;
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  return safeEqual(await sign(`${role}.${exp}`), sig);
}

export async function isAdminRequest(): Promise<boolean> {
  return verifySessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

/** Throws unless the caller holds a valid admin session cookie. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) throw new Error('Unauthorized');
}
