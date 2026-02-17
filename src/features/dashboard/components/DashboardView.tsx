'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'

type AccountCtx = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  user_logo_url: string | null
  current_org_id: string | null
  org_name: string | null
  org_type: 'business' | 'personal' | null
  org_logo_url: string | null
  my_role: 'owner' | 'admin' | 'member' | null
}

type Membership = {
  org_id: string
  org_name: string
  org_type: 'business' | 'personal'
  role: 'owner' | 'admin' | 'member'
  logo_url?: string | null
}

export default function DashboardPage() {
  const router = useRouter()

  const [ctx, setCtx] = useState<AccountCtx | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ensureCurrentOrgSelected = async () => {
      await supabase.rpc('accept_my_pending_invites')

      const { data: m, error: e1 } = await supabase.rpc('get_my_memberships')
      if (e1) throw e1

      const list = (m || []) as Membership[]
      setMemberships(list)

      if (!list.length) return null

      // si pas de current org, on prend la première
      const { data: ctx0 } = await supabase.rpc('get_my_account_context')
      const currentOrgId = (ctx0?.[0]?.current_org_id as string | null) ?? null

      if (!currentOrgId) {
        const firstOrgId = list[0].org_id
        const { error: e2 } = await supabase.rpc('set_current_org', { p_org_id: firstOrgId })
        if (e2) throw e2
      }

      return list
    }

    const load = async () => {
      setLoading(true)

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        setLoading(false)
        return
      }

      // 1) s'assure qu'on a une org courante
      await ensureCurrentOrgSelected()

      // 2) recharge le contexte "Mon compte"
      const { data, error } = await supabase.rpc('get_my_account_context')
      if (error) {
        console.error(error)
        setCtx(null)
        setLoading(false)
        return
      }

      setCtx((data?.[0] ?? null) as AccountCtx | null)
      setLoading(false)
    }

    load()
  }, [])

  const fullName =
    ctx?.first_name && ctx?.last_name
      ? `${ctx.first_name} ${ctx.last_name}`
      : ctx?.email || '—'

const orgLabel = ctx?.org_name ?? '—'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Accueil</h1>
        <p className="text-sm text-gray-500">Gestion de votre compte et de vos accès</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* ACCÈS */}
        <div className="rounded-xl border bg-blue-50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-600">Accès & rôles</h2>
            <p className="mt-2 text-2xl font-semibold">Mes accès</p>
            <p className="mt-1 text-sm text-gray-500">Organismes & permissions</p>
          </div>
          <button className="mt-6 btn btn-primary" onClick={() => router.push('/settings/acces')}>
            Gérer
          </button>
        </div>

        {/* MON COMPTE */}
        <div className="rounded-xl border bg-green-50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-600">Mon compte</h2>

            <p className="mt-2 text-2xl font-semibold">{loading ? '—' : fullName}</p>

            <p className="mt-1 text-sm text-gray-500">Profil & organisme</p>

            <p className="mt-4 text-sm text-gray-500">
              Organisme : {loading ? '—' : orgLabel}
              <br />
              Rôle : {loading ? '—' : ctx?.my_role || '—'}
            </p>
          </div>

          <button className="mt-6 btn btn-primary" onClick={() => router.push('/settings/organisme')}>
            Gérer
          </button>
        </div>

        {/* ABONNEMENT */}
        <div className="rounded-xl border bg-gray-50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-600">Abonnement</h2>
            <p className="mt-2 text-2xl font-semibold">Gratuit</p>
            <p className="mt-1 text-sm text-gray-500">Configuration ultérieure</p>
          </div>
          <button className="mt-6 btn btn-secondary" onClick={() => router.push('/settings/abonnement')}>
            Gérer l’abonnement
          </button>
        </div>
      </div>
    </div>
  )
}
