'use client';

export default function LegalPricingText() {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
      <p className="font-semibold">Règles de tarification</p>

      <p>
        La tarification de l’application est basée sur le nombre total d’apprenants déclarés pour l’année précédente
        (N-1).
      </p>

      <p>
        Le plan applicable est calculé <strong>une seule fois par an</strong>, au début de l’année civile, et reste
        inchangé jusqu’à la fin de l’année, même en cas de dépassement des seuils en cours d’année.
      </p>

      <p>
        En cas de dépassement des seuils pendant l’année en cours, le changement de plan est appliqué automatiquement
        <strong>l’année suivante</strong>, sans impact immédiat sur l’abonnement en cours.
      </p>

      <p>
        Aucun bridage fonctionnel n’est appliqué : toutes les fonctionnalités restent disponibles quel que soit le plan.
        Seule la taille de l’organisation (volume d’apprenants) détermine le plan tarifaire.
      </p>
    </div>
  );
}
