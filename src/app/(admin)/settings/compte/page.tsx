'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

type OrgType = 'personal' | 'business' | null

export default function AccountPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const [billingStreet, setBillingStreet] = useState('')
  const [billingPostalCode, setBillingPostalCode] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingSiret, setBillingSiret] = useState('')
  const [billingVat, setBillingVat] = useState('')

  const [currentEmail, setCurrentEmail] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [currentOrgType, setCurrentOrgType] = useState<OrgType>(null)
  const [currentOrgName, setCurrentOrgName] = useState('')

  const [memberships, setMemberships] = useState<any[]>([])
  const [wantedOrgId, setWantedOrgId] = useState<string | null>(null)

  const [creatingPersonal, setCreatingPersonal] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refreshOrgs = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_org_id')
      .eq('id', userId)
      .single()

    const { data: m } = await supabase.rpc('get_my_memberships')

    const list = (m ?? []) as any[]
    setMemberships(list)

    const wanted = profile?.current_org_id ?? list?.[0]?.org_id ?? null
    setWantedOrgId(wanted)

    const current = list.find((x) => x?.org_id === wanted) ?? list?.[0] ?? null

    const normalized = String(current?.org_type ?? '').trim().toLowerCase()
    const normalizedType: OrgType =
      normalized === 'personal' || normalized === 'business' ? (normalized as OrgType) : null

    setCurrentOrgType(normalizedType)
    setCurrentOrgName(current?.org_name ?? '')
  }

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return

      setCurrentEmail(user.email ?? '')
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'first_name,last_name,phone,billing_street,billing_postal_code,billing_city,billing_siret,billing_vat'
        )
        .eq('id', user.id)
        .single()

      setFirstName(profile?.first_name ?? '')
      setLastName(profile?.last_name ?? '')
      setPhone(profile?.phone ?? '')

      setBillingStreet(profile?.billing_street ?? '')
      setBillingPostalCode(profile?.billing_postal_code ?? '')
      setBillingCity(profile?.billing_city ?? '')
      setBillingSiret(profile?.billing_siret ?? '')
      setBillingVat(profile?.billing_vat ?? '')

      await refreshOrgs(user.id)
      setLoading(false)
    }

    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        billing_street: billingStreet,
        billing_postal_code: billingPostalCode,
        billing_city: billingCity,
        billing_siret: billingSiret,
        billing_vat: billingVat,
      })
      .eq('id', user.id)
const { error: upErr } = await supabase
  .from('profiles')
  .update({
    first_name: firstName,
    last_name: lastName,
    phone,
    billing_street: billingStreet,
    billing_postal_code: billingPostalCode,
    billing_city: billingCity,
    billing_siret: billingSiret,
    billing_vat: billingVat,
  })
  .eq('id', user.id)

if (upErr) {
  setMessage(upErr.message)
  setSaving(false)
  return
}

    const payload: { email?: string; password?: string } = {}
    if (email !== currentEmail) payload.email = email
    if (password.length > 0) payload.password = password

    if (payload.email || payload.password) {
      await supabase.auth.updateUser(payload)
    }

    const refreshed = await supabase.auth.getUser()
    setCurrentEmail(refreshed.data.user?.email ?? '')
    setEmail(refreshed.data.user?.email ?? '')
    setPassword('')

    setMessage('Enregistré ✅')
    setSaving(false)
  }

  const deleteAccount = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: deletePassword,
    })

    if (error) {
      setMessage('Mot de passe incorrect')
      return
    }

    await supabase.rpc('delete_my_account')
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mon compte</h1>
          <p className="text-sm text-gray-500">Informations personnelles</p>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={loading || saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {message && (
        <div className="rounded-xl border bg-gray-50 p-4 text-sm font-medium text-gray-700">
          {message}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Profil</h2>

        <input className="input" placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="input" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Infos de facturation</h2>

        <input className="input" placeholder="Rue" value={billingStreet} onChange={(e) => setBillingStreet(e.target.value)} />
        <input className="input" placeholder="Code postal" value={billingPostalCode} onChange={(e) => setBillingPostalCode(e.target.value)} />
        <input className="input" placeholder="Ville" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
        <input className="input" placeholder="N° SIRET" value={billingSiret} onChange={(e) => setBillingSiret(e.target.value)} />
        <input className="input" placeholder="N° TVA" value={billingVat} onChange={(e) => setBillingVat(e.target.value)} />
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Identité de connexion</h2>

        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <div className="card space-y-4 border-red-200">
        <h2 className="text-lg font-medium text-red-600">Supprimer mon compte</h2>

        <input
          className="input"
          type="password"
          placeholder="Mot de passe pour confirmer"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} />
          Je comprends que cette action est irréversible
        </label>

        <button className="btn btn-danger" disabled={!confirmDelete || !deletePassword} onClick={deleteAccount}>
          Supprimer définitivement
        </button>
      </div>
    </div>
  )
}
