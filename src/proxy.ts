import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authRoute = isAuthRoute(pathname);
  const { response, user, supabase, configured } = await updateSession(request);

  if (!configured) {
    if (authRoute) return response;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reason", "not-configured");
    return NextResponse.redirect(loginUrl);
  }

  if (!user) {
    if (authRoute) return response;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "inactive");

      const redirectResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  if (authRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png|.*\\..*).*)",
  ],
};
