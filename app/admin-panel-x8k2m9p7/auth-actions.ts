'use server';
// Server-side admin authentication. The password NEVER reaches the browser.
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE, ADMIN_MAX_AGE, createSessionToken, isAdminRequest, safeEqual,
} from './admin-session';

export async function adminLogin(password: string): Promise<{ success: boolean; message?: string }> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { success: false, message: 'Server is missing ADMIN_PASSWORD.' };
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    // Uniform delay so timing cannot distinguish "wrong length" from "wrong value".
    await new Promise((r) => setTimeout(r, 250));
    return { success: false, message: 'Invalid password.' };
  }
  cookies().set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_MAX_AGE,
  });
  return { success: true };
}

export async function adminLogout(): Promise<{ success: boolean }> {
  cookies().delete(ADMIN_COOKIE);
  return { success: true };
}

export async function adminSessionActive(): Promise<boolean> {
  return isAdminRequest();
}
