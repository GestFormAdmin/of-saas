// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/* =========================
   Helpers
========================= */

function isProtectedPath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/clients' ||
    pathname === '/sessions' ||
    pathname === '/factures' ||
    pathname === '/produits' ||
    pathname === '/depenses' ||
    pathname === '/apprenants' ||
    pathname === '/settings'
  )
}

function isDevTestPath(pathname: string) {
  return (
    pathname.startsWith('/test-org') ||
    pathname.startsWith('/test-personal-org') ||
    pathname.startsWith('/test-invite')
  )
}

/* =========================
   Middleware
========================= */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  /* 1️⃣ Bloquer les routes de test en production */
  if (process.env.NODE_ENV === 'production' && isDevTestPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  /* 2️⃣ Préparer la réponse (cookies SSR) */
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  /* 3️⃣ Accès dashboard racine */
  if (pathname === '/dashboard') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    url.pathname = membership?.org_id ? '/dashboard' : '/onboarding'
    return NextResponse.redirect(url)
  }

  /* 4️⃣ Auth guard */
  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  /* 5️⃣ Org guard */
  if (isProtectedPath(pathname) && user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership?.org_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  /* 6️⃣ Onboarding inverse */
  if (pathname === '/onboarding' && user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.org_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}

/* =========================
   Matcher
========================= */

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
