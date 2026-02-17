'use client'

import { useRouter } from 'next/navigation'

export function OrgSwitcherCard() {
  const router = useRouter()

  return (
    <div className="card flex flex-col justify-between">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-gray-900">
          Espace actif
        </h2>

        <p className="text-sm text-gray-500">
          Vous travaillez actuellement dans
        </p>

        <p className="text-lg font-medium text-gray-900">
          Mon organisme
        </p>
      </div>

      <button
        className="btn btn-primary mt-6"
        onClick={() => router.push('/settings/organisme')}
      >
        Changer d’espace
      </button>
    </div>
  )
}
