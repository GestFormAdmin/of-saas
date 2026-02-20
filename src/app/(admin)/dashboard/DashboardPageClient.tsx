'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

import { PageHeader } from '@/components/ui/PageHeader';
import AccountCard from './components/AccountCard';
import ProfileCard from './components/ProfileCard';
import BillingCard from './components/BillingCard';

export default function DashboardPageClient() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    (async () => {
      // 1) session obligatoire
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/';
        return;
      }

      // 2) auto-accept des invitations en attente
      await supabase.rpc('accept_my_pending_invites');

      // 3) infos user
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? '');
      setUserId(u.user?.id ?? '');

      // ======================================================
      // 🔥 TEST WORKFLOW SESSION (TEMPORAIRE – À SUPPRIMER)
      // ======================================================

      const SESSION_ID = 'COLLE_ICI_SESSION_ID';
      const TRAINER_USER_ID = 'COLLE_ICI_USER_ID_FORMATEUR';
      const ORG_ID = 'COLLE_ICI_ORG_ID';
      const APPRENANT_ID = 'COLLE_ICI_APPRENANT_ID';

      // ⚠️ NE DÉCOMMENTER QU’UNE SEULE ACTION À LA FOIS

      // 1️⃣ OF (owner/admin) : assigner le formateur
      // await supabase.rpc('assign_trainer', {
      //   p_session_id: SESSION_ID,
      //   p_trainer_user_id: TRAINER_USER_ID,
      // });

      // 2️⃣ OF (owner/admin) : démarrer la session
      // await supabase.rpc('start_session', {
      //   p_session_id: SESSION_ID,
      // });

      // 3️⃣ FORMATEUR : ajouter un apprenant
      // await supabase.from('session_attendees').insert({
      //   org_id: ORG_ID,
      //   session_id: SESSION_ID,
      //   apprenant_id: APPRENANT_ID,
      //   added_by_user_id: u.user?.id,
      // });

      // 4️⃣ FORMATEUR : terminer la session
      // await supabase.rpc('submit_session', {
      //   p_session_id: SESSION_ID,
      // });

      // 5️⃣ OF (owner/admin) : valider la session
      // await supabase.rpc('validate_session', {
      //   p_session_id: SESSION_ID,
      // });

      console.log('✅ Dashboard chargé + test exécuté');

      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Accueil" description="Mon compte" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AccountCard loading={loading} email={email} />
          <ProfileCard loading={loading} userId={userId} />
        </div>

        <div className="space-y-6">
          <BillingCard loading={loading} />
        </div>
      </div>
    </div>
  );
}
