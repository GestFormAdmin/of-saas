"use client";

type Props = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ClientRowActions({ onView, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
        aria-label="Voir"
        title="Voir"
      >
        👁
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
        aria-label="Modifier"
        title="Modifier"
      >
        ✏️
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="h-10 w-10 rounded-xl border border-red-200 bg-white hover:bg-red-50 flex items-center justify-center"
        aria-label="Supprimer"
        title="Supprimer"
      >
        🗑️
      </button>
    </div>
  );
}
