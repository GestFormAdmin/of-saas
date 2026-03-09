"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import EditProfileModal from "./modals/EditProfileModal";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  job_title: string | null;
};

export default function ProfileCard({
  loading,
  userId,
}: {
  loading: boolean;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !userId) return;

      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,phone,job_title")
        .eq("id", userId)
        .maybeSingle();

      setProfile(data ?? null);
    }

    void loadProfile();
  }, [userId, open]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">Profil</div>
          <div className="mt-1 text-lg font-semibold">
            Informations personnelles
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Nom</div>
              <div className="font-medium">
                {loading
                  ? "..."
                  : `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "-"}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Téléphone</div>
              <div className="font-medium">
                {loading ? "..." : profile?.phone ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Fonction</div>
              <div className="font-medium">
                {loading ? "..." : profile?.job_title ?? "-"}
              </div>
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={() => setOpen(true)}>
          Modifier
        </Button>
      </div>

      <EditProfileModal
        open={open}
        onClose={() => setOpen(false)}
        userId={userId}
        initial={profile}
      />
    </Card>
  );
}