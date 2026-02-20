"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import EditEmailModal from "./modals/EditEmailModal";
import EditPasswordModal from "./modals/EditPasswordModal";

export default function AccountCard({
  loading,
  email,
}: {
  loading: boolean;
  email: string;
}) {
  const [openEmail, setOpenEmail] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">Connexion</div>
          <div className="mt-1 text-lg font-semibold">Données de connexion</div>
          <div className="mt-3 text-sm">
            <div className="text-gray-500">Email</div>
            <div className="font-medium">{loading ? "..." : email || "-"}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpenEmail(true)}>
            Modifier l’email
          </Button>
          <Button variant="secondary" onClick={() => setOpenPassword(true)}>
            Mot de passe
          </Button>
        </div>
      </div>

      <EditEmailModal open={openEmail} onClose={() => setOpenEmail(false)} />
      <EditPasswordModal
        open={openPassword}
        onClose={() => setOpenPassword(false)}
      />
    </Card>
  );
}
