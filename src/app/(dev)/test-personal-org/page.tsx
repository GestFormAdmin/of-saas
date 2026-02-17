'use client';

import { supabase } from '@/lib/supabaseClient';

export default function TestPersonalOrgPage() {
  const runTest = async () => {
    const { data, error } = await supabase.rpc('create_personal_org');

    if (error) {
      alert('ERREUR : ' + error.message);
    } else {
      alert('ORG PERSONNELLE CRÉÉE : ' + data);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <button
        onClick={runTest}
        style={{
          padding: 20,
          fontSize: 18,
        }}
      >
        CRÉER MON ESPACE PERSONNEL
      </button>
    </div>
  );
}
