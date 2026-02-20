"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabaseClient";

export default function EditEmailModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Modifier l’email">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Nouvel email</div>
          <Input
            placeholder="nouvel@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="soft" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={async () => {
              await supabase.auth.updateUser({ email });
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
