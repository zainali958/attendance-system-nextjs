"use client";

import { useEffect, useState } from "react";

interface FlashMessage {
  category: "success" | "danger" | "warning" | "info";
  message: string;
}

const FLASH_COOKIE = "flash";

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

export default function FlashBanner() {
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    const raw = readCookie(FLASH_COOKIE);
    if (raw) {
      try {
        setFlash(JSON.parse(raw));
      } catch {
        // ignore malformed cookie
      }
      deleteCookie(FLASH_COOKIE);
    }
  }, []);

  if (!flash) return null;

  return (
    <div
      className={`alert alert-${flash.category} alert-dismissible fade show`}
      role="alert"
    >
      {flash.message}
      <button
        type="button"
        className="btn-close"
        onClick={() => setFlash(null)}
        aria-label="Close"
      />
    </div>
  );
}
