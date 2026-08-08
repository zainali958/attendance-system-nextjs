import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

function getSecret(): Uint8Array {
  const secret = process.env.SECRET_KEY || "your-secret-key-here";
  return new TextEncoder().encode(secret);
}

async function isAuthenticated(req: NextRequest): Promise<{
  authed: boolean;
  isAdmin: boolean;
}> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { authed: false, isAdmin: false };
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { authed: true, isAdmin: Boolean((payload as any).isAdmin) };
  } catch {
    return { authed: false, isAdmin: false };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!isProtected) return NextResponse.next();

  const { authed, isAdmin } = await isAuthenticated(req);

  if (!authed) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !isAdmin) {
    const dashUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
