import React, { useState } from "react";
import { Clock, GitBranch, Hash, ListChecks, Save, Wrench } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 100;
const MAX_NUMBER = 2147483647;
const MAX_EFFORT = 99999999.99;
const MAX_PREDECESSORS = 50;

const NUMBER_INVALID = "Numer zadania musi być liczbą całkowitą od 1.";
const PREDECESSORS_INVALID = "Poprzednicy to numery zadań rozdzielone przecinkami.";

interface TaskFormValues {
  number: string;
  name: string;
  specialty: string;
  effort: string;
  predecessors: string;
}

interface Props {
  action: string;
  specialties: { id: string; name: string }[];
  initial?: TaskFormValues;
  serverError?: string | null;
  submitLabel: string;
}

type Errors = Partial<Record<keyof TaskFormValues, string>>;

function toTaskNumber(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_NUMBER ? value : null;
}

const hintClass = "mt-1 text-xs text-white/40";

export default function TaskForm({ action, specialties, initial, serverError, submitLabel }: Props) {
  const [number, setNumber] = useState(initial?.number ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  const [effort, setEffort] = useState(initial?.effort ?? "");
  const [predecessors, setPredecessors] = useState(initial?.predecessors ?? "");
  const [errors, setErrors] = useState<Errors>({});

  function clear(field: keyof TaskFormValues) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next: Errors = {};

    const numberText = number.trim();
    const parsedNumber = toTaskNumber(numberText);
    if (!numberText) {
      next.number = "Numer zadania jest wymagany.";
    } else if (parsedNumber === null) {
      next.number = NUMBER_INVALID;
    }

    if (!name.trim()) {
      next.name = "Nazwa zadania jest wymagana.";
    } else if (name.trim().length > MAX_NAME_LENGTH) {
      next.name = `Nazwa zadania może mieć najwyżej ${String(MAX_NAME_LENGTH)} znaków.`;
    }

    const effortText = effort.trim().replace(",", ".");
    if (effortText && (!/^\d+(\.\d{1,2})?$/.test(effortText) || Number(effortText) > MAX_EFFORT)) {
      next.effort = "Nakład musi być liczbą nie mniejszą niż 0.";
    }

    const predecessorsText = predecessors.trim();
    if (predecessorsText) {
      const parts = predecessorsText.split(",").map((part) => toTaskNumber(part.trim()));
      if (parts.includes(null)) {
        next.predecessors = PREDECESSORS_INVALID;
      } else if (new Set(parts).size > MAX_PREDECESSORS) {
        next.predecessors = `Zadanie może mieć najwyżej ${String(MAX_PREDECESSORS)} poprzedników.`;
      } else if (parsedNumber !== null && parts.includes(parsedNumber)) {
        next.predecessors = "Zadanie nie może być własnym poprzednikiem.";
      }
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
        id="task_number"
        label="Numer zadania"
        value={number}
        onChange={(v) => {
          setNumber(v);
          clear("number");
        }}
        placeholder="np. 1"
        autoComplete="off"
        inputMode="numeric"
        autoFocus
        error={errors.number}
        icon={<Hash className="size-4" />}
      />

      <FormField
        id="task_name"
        label="Nazwa zadania"
        value={name}
        onChange={(v) => {
          setName(v);
          clear("name");
        }}
        placeholder="np. Montaż instalacji"
        autoComplete="off"
        error={errors.name}
        icon={<ListChecks className="size-4" />}
      />

      <div>
        <label htmlFor="task_specialty" className="mb-1 block text-sm text-blue-100/80">
          Specjalność
        </label>
        <div className="relative">
          <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">
            <Wrench className="size-4" />
          </span>
          <select
            id="task_specialty"
            name="task_specialty"
            value={specialty}
            onChange={(e) => {
              setSpecialty(e.target.value);
            }}
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 pl-10 text-white transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none",
            )}
          >
            <option value="" className="text-slate-900">
              Bez specjalności
            </option>
            {specialties.map((item) => (
              <option key={item.id} value={item.id} className="text-slate-900">
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {specialties.length === 0 && (
          <p className={hintClass}>
            Ten projekt nie ma jeszcze specjalności.{" "}
            <a href="/specialties" className="text-purple-300 hover:underline">
              Dodaj specjalności
            </a>
          </p>
        )}
      </div>

      <FormField
        id="task_effort"
        label="Nakład"
        value={effort}
        onChange={(v) => {
          setEffort(v);
          clear("effort");
        }}
        placeholder="np. 2,5"
        autoComplete="off"
        inputMode="decimal"
        error={errors.effort}
        hint={<p className={hintClass}>Liczba, np. 2,5. Można zostawić puste.</p>}
        icon={<Clock className="size-4" />}
      />

      <FormField
        id="task_predecessors"
        label="Poprzednicy"
        value={predecessors}
        onChange={(v) => {
          setPredecessors(v);
          clear("predecessors");
        }}
        placeholder="np. 1, 2"
        autoComplete="off"
        error={errors.predecessors}
        hint={<p className={hintClass}>numery zadań po przecinku, np. 1, 2</p>}
        icon={<GitBranch className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<Save className="size-4" />}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
