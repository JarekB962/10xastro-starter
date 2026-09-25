import React, { useState } from "react";
import { Clock, GitBranch, Hash, ListChecks, Save, Wrench } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";
import {
  MAX_NAME_LENGTH,
  TASK_FIELD_MESSAGES as MESSAGES,
  parseEffort,
  parsePredecessors,
  toTaskNumber,
} from "@/lib/validation/task-fields";

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
      next.number = MESSAGES.numberRequired;
    } else if (parsedNumber === null) {
      next.number = MESSAGES.numberInvalid;
    }

    if (!name.trim()) {
      next.name = MESSAGES.nameRequired;
    } else if (name.trim().length > MAX_NAME_LENGTH) {
      next.name = MESSAGES.nameTooLong;
    }

    if (!parseEffort(effort).ok) {
      next.effort = MESSAGES.effortInvalid;
    }

    const parsedPredecessors = parsePredecessors(predecessors);
    if (!parsedPredecessors.ok) {
      next.predecessors = parsedPredecessors.message;
    } else if (parsedNumber !== null && parsedPredecessors.value.includes(parsedNumber)) {
      next.predecessors = MESSAGES.selfPredecessor;
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
