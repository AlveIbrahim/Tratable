"use client";

import { useState } from "react";
import type { FormPageConfig } from "@tratable/shared";
import type { RendererField } from "../renderer-types";
import { Select } from "@/components/ui/select";
import { chipStyle } from "@/lib/colors";

interface Choice {
  id: string;
  name: string;
}

/** One input per field type — the write-side counterpart to CellDisplay,
 * since a form has to actually collect a value rather than just show one.
 * attachment/linkToRecord/autoNumber/createdTime/lastModifiedTime aren't
 * offered here (the page builder excludes them from "add to form" — see
 * page-config-form.tsx — since none of them accept a plain typed value). */
function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field: RendererField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
      );
    case "singleSelect": {
      const choices = (field.options.choices as Choice[]) ?? [];
      return (
        <Select
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder="Choose…"
          options={choices.map((c) => ({ value: c.id, label: c.name }))}
        />
      );
    }
    case "multiSelect": {
      const choices = (field.options.choices as Choice[]) ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onChange(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])
              }
              className="rounded-full px-2 py-0.5 text-[11.5px] font-medium transition-opacity"
              style={{ ...chipStyle(c.id), opacity: selected.includes(c.id) ? 1 : 0.4 }}
            >
              {c.name}
            </button>
          ))}
        </div>
      );
    }
    case "number":
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      );
    case "date":
    case "dateTime":
      return (
        <input
          type={field.type === "dateTime" ? "datetime-local" : "date"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      );
    case "longText":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          rows={3}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      );
    default: {
      const inputType = field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text";
      return (
        <input
          type={inputType}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      );
    }
  }
}

export function FormPageRenderer({
  config,
  fields,
  onSubmit,
}: {
  config: FormPageConfig;
  fields: RendererField[];
  onSubmit: (data: Record<string, unknown>) => Promise<{ successMessage: string } | void>;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fieldById = (id: string) => fields.find((f) => f.id === id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(data);
      setSuccessMessage(result?.successMessage ?? config.successMessage);
      setData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-[15px] font-medium">{successMessage}</p>
        <button
          onClick={() => setSuccessMessage(null)}
          className="mt-4 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-6">
      {config.fields.map((formField) => {
        const field = fieldById(formField.fieldId);
        if (!field) return null;
        return (
          <div key={formField.fieldId}>
            <label className="mb-1 block text-[13px] font-medium">
              {formField.label}
              {formField.required && <span className="text-[var(--color-danger)]"> *</span>}
            </label>
            {formField.helpText && (
              <p className="mb-1.5 text-[12px] text-[var(--color-fg-subtle)]">{formField.helpText}</p>
            )}
            <FormFieldInput
              field={field}
              value={data[formField.fieldId]}
              onChange={(v) => setData((d) => ({ ...d, [formField.fieldId]: v }))}
            />
          </div>
        );
      })}
      {error && <p className="text-[13px] text-[var(--color-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : config.submitText}
      </button>
    </form>
  );
}
