"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabaseClient";

export default function EditPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Changer le mot de passe">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Nouveau mot de passe</div>
          <Input
            type="password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={async () => {
              await supabase.auth.updateUser({ password });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
