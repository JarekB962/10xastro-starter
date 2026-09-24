import React, { useState } from "react";
import { FolderKanban, Save } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

interface Props {
  action: string;
  initial?: { name: string; description: string };
  serverError?: string | null;
  submitLabel: string;
}

export default function ProjectForm({ action, initial, serverError, submitLabel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = "Nazwa projektu jest wymagana.";
    } else if (name.trim().length > MAX_NAME_LENGTH) {
      next.name = `Nazwa projektu może mieć najwyżej ${String(MAX_NAME_LENGTH)} znaków.`;
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      next.description = `Opis może mieć najwyżej ${String(MAX_DESCRIPTION_LENGTH)} znaków.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label="Nazwa projektu"
        value={name}
        onChange={(v) => {
          setName(v);
          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        placeholder="np. Modernizacja instalacji"
        error={errors.name}
        icon={<FolderKanban className="size-4" />}
      />

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-blue-100/80">
          Opis (opcjonalnie)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          className={cn(
            "w-full rounded-lg border bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:outline-none",
            errors.description ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        />
        {errors.description && <p className="mt-1 text-xs text-red-300">{errors.description}</p>}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<Save className="size-4" />}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
