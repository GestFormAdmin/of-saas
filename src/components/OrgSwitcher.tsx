'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Org = {
  org_id: string;
  org_name: string;
  org_type: 'business' | 'personal';
  role: string;
};

export default function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_my_orgs');
      if (!error && data) setOrgs(data);
      setLoading(false);
    };
    load();
  }, []);

  const switchOrg = async (orgId: string) => {
    await supabase.rpc('set_current_org', { p_org_id: orgId });
    window.location.reload(); // simple et fiable
  };

  if (loading) return null;

  return (
    <div style={{ padding: 8, border: '1px solid #ddd' }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>Changer d’espace</div>
      {orgs.map((org) => (
        <button
          key={org.org_id}
          onClick={() => switchOrg(org.org_id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: 6,
            marginBottom: 4,
          }}
        >
          {org.org_name}
          {org.role === 'admin' && ' ⭐'}
        </button>
      ))}
    </div>
  );
}
