import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

const HOME = { admin: '/admin', ops: '/ops', crew: '/crew' } as const;

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<Database>(
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
    const isLogin = path.startsWith('/login');

    // Customer booking links are public: the token in the URL is the only access check.
    if (path.startsWith('/book/')) return supabaseResponse;

    if (!user) {
        if (isLogin) return supabaseResponse;
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: profile } = await supabase.from('profiles').select('app_role').eq('id', user.id).maybeSingle();
    const role = profile?.app_role;
    const home = role ? HOME[role] : null;

    // Signed in: send "/" and "/login" to the role's workspace.
    if (path === '/' || isLogin) {
        return home ? NextResponse.redirect(new URL(home, request.url)) : supabaseResponse;
    }

    // Each role may only open its own area.
    const area = (['admin', 'ops', 'crew'] as const).find((a) => path === `/${a}` || path.startsWith(`/${a}/`));
    if (area && area !== role) {
        return NextResponse.redirect(new URL(home ?? '/login', request.url));
    }

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