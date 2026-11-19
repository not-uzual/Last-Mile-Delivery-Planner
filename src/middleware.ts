import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    // 1. RBAC
    if (path === '/' || path.startsWith('/login')) {
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('app_role').eq('id', user.id).single();
            if (profile?.app_role === 'admin') return NextResponse.redirect(new URL('/admin/team', request.url));
            if (profile?.app_role === 'ops') return NextResponse.redirect(new URL('/ops/calendar', request.url));
            if (profile?.app_role === 'crew') return NextResponse.redirect(new URL('/crew/today', request.url));
        }
        return supabaseResponse;
    }

    // 2. Protect all other routes
    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3. Role-based Route Protection
    const { data: profile } = await supabase.from('profiles').select('app_role').eq('id', user.id).single();
    const role = profile?.app_role;

    if (path.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(new URL('/', request.url));
    if (path.startsWith('/ops') && role !== 'ops') return NextResponse.redirect(new URL('/', request.url));
    if (path.startsWith('/crew') && role !== 'crew') return NextResponse.redirect(new URL('/', request.url));

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images, icons, etc.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};