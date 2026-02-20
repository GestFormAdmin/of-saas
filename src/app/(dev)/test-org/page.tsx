'use client';

import { supabase } from '@/lib/supabaseClient';

export default function TestOrgPage() {
  const runTest = async () => {
    const orgId = 'b74dbbc6-27b8-4dd4-9a2e-5db13589f569';

    const { error } = await supabase.rpc('set_current_org', {
      p_org_id: orgId,
    });

    alert(error ? error.message : 'set_current_org OK');

    const { data } = await supabase.rpc('current_org_id');
    alert('current_org_id = ' + data);
  };

  return (
    <div style={{ padding: 40 }}>
      <button onClick={runTest}>
        TEST set_current_org
      </button>
    </div>
  );
}
