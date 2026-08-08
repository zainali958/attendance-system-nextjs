import { cookies } from "next/headers";

export type FlashCategory = "success" | "danger" | "warning" | "info";

export interface FlashMessage {
  category: FlashCategory;
  message: string;
}

const FLASH_COOKIE = "flash";

// Mirrors Flask's flash()/get_flashed_messages(): set a message before a
// redirect, then read (and clear) it on the next page render.
export async function setFlash(category: FlashCategory, message: string) {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify({ category, message }), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 30,
  });
}

// NOTE: reading + clearing happens client-side (see components/FlashBanner.tsx)
// because Next.js Server Components are not allowed to mutate cookies during
// render (only Server Actions/Route Handlers can). The cookie is not
// httpOnly specifically so the client component can read and clear it.
export const FLASH_COOKIE_NAME = FLASH_COOKIE;
