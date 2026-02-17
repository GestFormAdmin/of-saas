'use client';

import { supabase } from '@/lib/supabaseClient';

export default function TestInvitePage() {
  const createInvite = async () => {
    const email = prompt('Email à inviter');
    if (!email) return;

    const { data, error } = await supabase.rpc('create_invite', {
      p_email: email,
    });

    alert(error ? error.message : 'INVITE CRÉÉE : ' + data);
  };

  return (
    <div style={{ padding: 40 }}>
      <button onClick={createInvite}>
        INVITER UN FORMATEUR
      </button>
    </div>
  );
}
