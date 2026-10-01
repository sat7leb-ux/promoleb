import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (err) {
    // A misconfigured env var should not hard-brick the whole site with a 500.
    // Let the request through; pages will surface a friendly setup error.
    console.error('[middleware] session refresh failed:', err);
    return undefined;
  }
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   _next/static, _next/image  -> build output
     *   favicon.ico, images, svg    -> public assets
     *   api/health                 -> uptime probe
     */
    '/((?!_next/static|_next/image|favicon.ico|images|svg|api/health).*)',
  ],
};