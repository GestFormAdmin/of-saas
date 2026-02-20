"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabaseClient";

export default function EditProfileModal({
  open,
  onClose,
  userId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: any;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    setFirstName(initial?.first_name ?? "");
    setLastName(initial?.last_name ?? "");
    setPhone(initial?.phone ?? "");
    setJobTitle(initial?.job_title ?? "");
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title="Modifier mes informations">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Prénom</div>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-gray-500">Nom</div>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-gray-500">Téléphone</div>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1">
          <div className="text-sm text-gray-500">Fonction</div>
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={async () => {
              await supabase.from("profiles").upsert({
                id: userId,
                first_name: firstName,
                last_name: lastName,
                phone,
                job_title: jobTitle,
              });
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
