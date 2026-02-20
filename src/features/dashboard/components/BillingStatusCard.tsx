'use client'

import { useRouter } from 'next/navigation'

export function BillingStatusCard() {
  const router = useRouter()

  return (
    <div className="card">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-gray-900">
          Abonnement
        </h2>

        <p className="text-sm text-gray-500">
          Offre actuelle
        </p>

        <p className="text-lg font-medium text-gray-900">
          Gratuit
        </p>
      </div>

      <button
        className="btn btn-secondary mt-6"
        onClick={() => router.push('/settings/organisme')}
      >
        Voir les offres
      </button>
    </div>
  )
}
