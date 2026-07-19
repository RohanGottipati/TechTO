import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Keep old /twinto bookmarks working after the TechTO rebrand.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/twinto" || pathname.startsWith("/twinto/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/twinto/, "/techto");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/twinto", "/twinto/:path*"],
};
