import React from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Guard serveur – le backend décide, le front affiche
 * - Si pas connecté => redirect /login
 * - Si RPC permissions refuse => redirect /unauthorized (ou /)
 *
 * IMPORTANT: ne pas importer createServerClient ici.
 * On utilise uniquement createSupabaseServerClient() (wrapper interne).
 */

type GuardProps = {
  children: React.ReactNode;
  // optionnel: url de redirection si pas connecté
  redirectTo?: string;
};

export default async function Guard({ children, redirectTo = "/login" }: GuardProps) {
const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(redirectTo);
  }

  // Si tu as une RPC de permissions, on la tente sans casser le build
  try {
    const { error } = await supabase.rpc("get_my_page_permissions");
    if (error) {
      redirect("/unauthorized");
    }
  } catch {
    // si la RPC n'existe pas / fail, on bloque pas le build, mais on sécurise
    redirect("/unauthorized");
  }

  return <>{children}</>;
}