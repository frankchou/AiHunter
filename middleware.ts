export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/feed/:path*",
    "/saved/:path*",
    "/resume/:path*",
    "/industry/:path*",
    "/settings/:path*",
    "/job/:path*",
    "/onboarding/:path*",
  ],
};
