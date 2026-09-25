import React, { useState } from "react";
import { Save, Wrench } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

const MAX_NAME_LENGTH = 100;

interface Props {
  action: string;
  initial?: { name: string };
  serverError?: string | null;
  submitLabel: string;
}

export default function SpecialtyForm({ action, initial, serverError, submitLabel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [errors, setErrors] = useState<{ name?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = "Nazwa specjalności jest wymagana.";
    } else if (name.trim().length > MAX_NAME_LENGTH) {
      next.name = `Nazwa specjalności może mieć najwyżej ${String(MAX_NAME_LENGTH)} znaków.`;
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
        id="specialty_name"
        label="Nazwa specjalności"
        value={name}
        onChange={(v) => {
          setName(v);
          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        placeholder="np. Elektryka"
        autoComplete="off"
        autoFocus
        error={errors.name}
        icon={<Wrench className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<Save className="size-4" />}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
