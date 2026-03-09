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
  let alive = true;

  async function boot() {
    if (!supabase) {
      window.location.href = "/";
      return;
    }

    const { data } = await supabase.auth.getSession();

    if (!alive) return;

    if (!data.session) {
      window.location.href = "/";
      return;
    }

setUserId(data.session.user?.id ?? null);
    setLoading(false);
  }

  void boot();

  return () => {
    alive = false;
  };
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
