// src/lib/supabase/server.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return { url, anon };
}

// ✅ cookies() / headers() sont async => ce helper doit être async
export async function createSupabaseServerClient() {
  const { url, anon } = getSupabaseEnv();

  const cookieStore = await cookies();
  const headerStore = await headers();

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // ⚠️ En Server Component, Next interdit la mutation de cookies.
          // On ignore: on a juste besoin de lire la session.
        }
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // idem
        }
      },
    },
    global: {
      headers: {
        "x-forwarded-host": headerStore.get("x-forwarded-host") ?? "",
        "x-forwarded-proto": headerStore.get("x-forwarded-proto") ?? "",
      },
    },
  });
}