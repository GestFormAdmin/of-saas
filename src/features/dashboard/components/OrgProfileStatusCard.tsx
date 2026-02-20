'use client'

import { useRouter } from 'next/navigation'

export function OrgProfileStatusCard() {
  const router = useRouter()

  return (
    <div className="card border-l-4 border-orange-400">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">
          Profil organisme
        </h2>

        <p className="text-sm text-orange-600">
          Le nom de l’organisme est requis pour activer l’abonnement
        </p>
      </div>

      <button
        className="btn btn-primary mt-6"
        onClick={() => router.push('/settings/organisme')}
      >
        Compléter le profil
      </button>
    </div>
  )
}
