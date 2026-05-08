import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: [
    "/feed/:path*",
    "/saved/:path*",
    "/resume/:path*",
    "/industry/:path*",
    "/settings/:path*",
    "/job/:path*",
  ],
};
