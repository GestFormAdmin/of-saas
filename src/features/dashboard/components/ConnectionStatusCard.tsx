'use client'

export function ConnectionStatusCard() {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          État de connexion
        </h2>
        <p className="text-sm text-gray-500">
          Sécurité du compte
        </p>
      </div>

      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        Connexion active
      </span>
    </div>
  )
}
