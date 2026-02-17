# ARCHI

## Routes
- `src/app/**` : uniquement routes, layouts, pages (Next.js)

## Métier
- `src/features/<domaine>/**` : composants & logique métier du domaine
  - `components/` : composants UI métier
  - `index.ts` : exports publics du domaine

## Infra / transversal
- `src/lib/**` : helpers transverses (ui, supabase entrypoints)
- `src/services/**` : services (org/auth/billing)
- `src/utils/**` : fonctions utilitaires pures
