"use client";

import { useMemo } from "react";
import type {
  DashboardPageConfig,
  DashboardWidget,
  FieldType,
  FormPageConfig,
  GridPageConfig,
  ListPageConfig,
  PageConfig,
  RecordDetailPageConfig,
} from "@tratable/shared";
import { useFields } from "@/lib/hooks/use-fields";
import type { TableSummary } from "@/lib/hooks/use-tables";
import { Select } from "@/components/ui/select";

/** Field types a form page can meaningfully collect a value for — the same
 * exclusion list form-page.tsx's FormFieldInput assumes. */
const FORM_CAPABLE_TYPES: FieldType[] = [
  "singleLineText", "longText", "number", "checkbox", "singleSelect",
  "multiSelect", "date", "dateTime", "email", "url", "phone",
];
const NUMERIC_TYPES: FieldType[] = ["number", "autoNumber"];

function TableSelect({ tables, value, onChange }: { tables: TableSummary[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="Choose a table…"
      options={tables.map((t) => ({ value: t.id, label: t.name }))}
    />
  );
}

/**
 * One form per page type, all sharing the same `config`/`onChange` contract
 * so the parent (create/edit dialog) doesn't need to know which type it's
 * editing. Deliberately not a drag-drop canvas — docs/PLAN.md calls that out
 * as a later layer the versioned PageConfig union leaves room for; this is
 * the straightforward "pick a table, pick some fields" builder v1 needs.
 */
export function PageConfigForm({
  config,
  tables,
  onChange,
}: {
  config: PageConfig;
  tables: TableSummary[];
  onChange: (config: PageConfig) => void;
}) {
  const tableId = "tableId" in config ? config.tableId : config.widgets[0]?.tableId;
  const { data: fields } = useFields(tableId);
  const fieldOptions = useMemo(() => fields ?? [], [fields]);

  switch (config.type) {
    case "grid":
      return <GridConfigForm config={config} tables={tables} fields={fieldOptions} onChange={onChange} />;
    case "list":
      return <ListConfigForm config={config} tables={tables} fields={fieldOptions} onChange={onChange} />;
    case "record_detail":
      return <RecordDetailConfigForm config={config} tables={tables} fields={fieldOptions} onChange={onChange} />;
    case "dashboard":
      return <DashboardConfigForm config={config} tables={tables} onChange={onChange} />;
    case "form":
      return <FormConfigForm config={config} tables={tables} fields={fieldOptions} onChange={onChange} />;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[12px] font-medium text-[var(--color-fg-muted)]">{label}</label>
      {children}
    </div>
  );
}

function FieldCheckboxList({
  fields,
  selected,
  onToggle,
  filter,
}: {
  fields: { id: string; name: string; type: FieldType }[];
  selected: string[];
  onToggle: (id: string) => void;
  filter?: (type: FieldType) => boolean;
}) {
  const list = filter ? fields.filter((f) => filter(f.type)) : fields;
  return (
    <div className="max-h-48 space-y-1 overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2">
      {list.map((f) => (
        <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-[var(--color-surface-hover)]">
          <input type="checkbox" checked={selected.includes(f.id)} onChange={() => onToggle(f.id)} className="accent-[var(--color-accent)]" />
          {f.name}
        </label>
      ))}
      {list.length === 0 && <p className="px-1.5 py-1 text-[12.5px] text-[var(--color-fg-subtle)]">No eligible fields</p>}
    </div>
  );
}

function GridConfigForm({
  config,
  tables,
  fields,
  onChange,
}: {
  config: GridPageConfig;
  tables: TableSummary[];
  fields: { id: string; name: string; type: FieldType }[];
  onChange: (c: PageConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Table">
        <TableSelect
          tables={tables}
          value={config.tableId}
          onChange={(tableId) => onChange({ ...config, tableId, visibleFieldIds: [] })}
        />
      </Field>
      <Field label="Visible fields">
        <FieldCheckboxList
          fields={fields}
          selected={config.visibleFieldIds}
          onToggle={(id) =>
            onChange({
              ...config,
              visibleFieldIds: config.visibleFieldIds.includes(id)
                ? config.visibleFieldIds.filter((x) => x !== id)
                : [...config.visibleFieldIds, id],
            })
          }
        />
      </Field>
    </div>
  );
}

function ListConfigForm({
  config,
  tables,
  fields,
  onChange,
}: {
  config: ListPageConfig;
  tables: TableSummary[];
  fields: { id: string; name: string; type: FieldType }[];
  onChange: (c: PageConfig) => void;
}) {
  const options = fields.map((f) => ({ value: f.id, label: f.name }));
  return (
    <div className="space-y-3">
      <Field label="Table">
        <TableSelect tables={tables} value={config.tableId} onChange={(tableId) => onChange({ ...config, tableId, titleFieldId: "" })} />
      </Field>
      <Field label="Title field">
        <Select value={config.titleFieldId} onChange={(v) => onChange({ ...config, titleFieldId: v })} options={options} placeholder="Choose…" />
      </Field>
      <Field label="Subtitle field (optional)">
        <Select
          value={config.subtitleFieldId ?? ""}
          onChange={(v) => onChange({ ...config, subtitleFieldId: v || undefined })}
          options={[{ value: "", label: "None" }, ...options]}
        />
      </Field>
      <Field label="Image field (optional)">
        <Select
          value={config.imageFieldId ?? ""}
          onChange={(v) => onChange({ ...config, imageFieldId: v || undefined })}
          options={[{ value: "", label: "None" }, ...fields.filter((f) => f.type === "attachment").map((f) => ({ value: f.id, label: f.name }))]}
        />
      </Field>
    </div>
  );
}

function RecordDetailConfigForm({
  config,
  tables,
  fields,
  onChange,
}: {
  config: RecordDetailPageConfig;
  tables: TableSummary[];
  fields: { id: string; name: string; type: FieldType }[];
  onChange: (c: PageConfig) => void;
}) {
  // v1 keeps this to a single "Details" section covering whichever fields
  // are checked — multiple named sections are a config the schema already
  // supports (see interface.dto.ts) but not a UI this pass builds.
  const section = config.sections[0] ?? { title: "Details", fieldIds: [] };
  return (
    <div className="space-y-3">
      <Field label="Table">
        <TableSelect
          tables={tables}
          value={config.tableId}
          onChange={(tableId) => onChange({ ...config, tableId, sections: [{ title: "Details", fieldIds: [] }] })}
        />
      </Field>
      <Field label="Fields to show">
        <FieldCheckboxList
          fields={fields}
          selected={section.fieldIds}
          onToggle={(id) =>
            onChange({
              ...config,
              sections: [
                {
                  ...section,
                  fieldIds: section.fieldIds.includes(id) ? section.fieldIds.filter((x) => x !== id) : [...section.fieldIds, id],
                },
              ],
            })
          }
        />
      </Field>
    </div>
  );
}

function DashboardConfigForm({
  config,
  tables,
  onChange,
}: {
  config: DashboardPageConfig;
  tables: TableSummary[];
  onChange: (c: PageConfig) => void;
}) {
  function updateWidget(idx: number, patch: Partial<DashboardWidget>) {
    const widgets = config.widgets.map((w, i) => (i === idx ? { ...w, ...patch } : w));
    onChange({ ...config, widgets });
  }
  function addWidget() {
    const tableId = tables[0]?.id ?? "";
    onChange({ ...config, widgets: [...config.widgets, { type: "number", tableId, aggregation: { fn: "count" } }] });
  }
  function removeWidget(idx: number) {
    onChange({ ...config, widgets: config.widgets.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      {config.widgets.map((widget, idx) => (
        <DashboardWidgetForm key={idx} widget={widget} tables={tables} onChange={(w) => updateWidget(idx, w)} onRemove={() => removeWidget(idx)} />
      ))}
      <button onClick={addWidget} className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline">
        + Add widget
      </button>
    </div>
  );
}

function DashboardWidgetForm({
  widget,
  tables,
  onChange,
  onRemove,
}: {
  widget: DashboardWidget;
  tables: TableSummary[];
  onChange: (w: Partial<DashboardWidget>) => void;
  onRemove: () => void;
}) {
  const { data: fields } = useFields(widget.tableId);
  const numericFields = (fields ?? []).filter((f) => NUMERIC_TYPES.includes(f.type));
  const groupableFields = fields ?? [];

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--color-fg-muted)]">Widget</span>
        <button onClick={onRemove} className="text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)]">
          Remove
        </button>
      </div>
      <Field label="Table">
        <TableSelect tables={tables} value={widget.tableId} onChange={(tableId) => onChange({ tableId, groupByFieldId: undefined })} />
      </Field>
      <Field label="Aggregation">
        <Select
          value={widget.aggregation.fn}
          onChange={(fn) => onChange({ aggregation: { fn: fn as DashboardWidget["aggregation"]["fn"], fieldId: fn === "count" ? undefined : widget.aggregation.fieldId } })}
          options={[
            { value: "count", label: "Count of records" },
            { value: "sum", label: "Sum of field" },
            { value: "avg", label: "Average of field" },
            { value: "min", label: "Minimum of field" },
            { value: "max", label: "Maximum of field" },
          ]}
        />
      </Field>
      {widget.aggregation.fn !== "count" && (
        <Field label="Number field">
          <Select
            value={widget.aggregation.fieldId ?? ""}
            onChange={(fieldId) => onChange({ aggregation: { ...widget.aggregation, fieldId } })}
            options={numericFields.map((f) => ({ value: f.id, label: f.name }))}
            placeholder="Choose…"
          />
        </Field>
      )}
      <Field label="Group by (optional)">
        <Select
          value={widget.groupByFieldId ?? ""}
          onChange={(v) => onChange({ groupByFieldId: v || undefined })}
          options={[{ value: "", label: "None" }, ...groupableFields.map((f) => ({ value: f.id, label: f.name }))]}
        />
      </Field>
    </div>
  );
}

function FormConfigForm({
  config,
  tables,
  fields,
  onChange,
}: {
  config: FormPageConfig;
  tables: TableSummary[];
  fields: { id: string; name: string; type: FieldType }[];
  onChange: (c: PageConfig) => void;
}) {
  const eligible = fields.filter((f) => FORM_CAPABLE_TYPES.includes(f.type));
  const selectedIds = config.fields.map((f) => f.fieldId);

  function toggleField(field: { id: string; name: string }) {
    if (selectedIds.includes(field.id)) {
      onChange({ ...config, fields: config.fields.filter((f) => f.fieldId !== field.id) });
    } else {
      onChange({ ...config, fields: [...config.fields, { fieldId: field.id, label: field.name, required: false }] });
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Table">
        <TableSelect tables={tables} value={config.tableId} onChange={(tableId) => onChange({ ...config, tableId, fields: [] })} />
      </Field>
      <Field label="Form fields">
        <div className="space-y-1.5">
          {eligible.map((f) => {
            const formField = config.fields.find((x) => x.fieldId === f.id);
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1.5">
                <input type="checkbox" checked={!!formField} onChange={() => toggleField(f)} className="accent-[var(--color-accent)]" />
                <span className="flex-1 truncate text-[13px]">{f.name}</span>
                {formField && (
                  <label className="flex items-center gap-1 text-[11.5px] text-[var(--color-fg-muted)]">
                    <input
                      type="checkbox"
                      checked={formField.required}
                      onChange={() =>
                        onChange({
                          ...config,
                          fields: config.fields.map((x) => (x.fieldId === f.id ? { ...x, required: !x.required } : x)),
                        })
                      }
                      className="accent-[var(--color-accent)]"
                    />
                    Required
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="Submit button text">
        <input
          value={config.submitText}
          onChange={(e) => onChange({ ...config, submitText: e.target.value })}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      </Field>
      <Field label="Success message">
        <input
          value={config.successMessage}
          onChange={(e) => onChange({ ...config, successMessage: e.target.value })}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
      </Field>
    </div>
  );
}

/** Sensible starting config for a freshly-chosen page type, before the user
 * has picked a table — every per-type form above tolerates an empty
 * tableId/fieldIds until they do. */
export function defaultConfigFor(type: PageConfig["type"], tableId: string): PageConfig {
  switch (type) {
    case "grid":
      return { v: 1, type: "grid", tableId, visibleFieldIds: [], allowEdit: false, allowCreate: false, allowDelete: false };
    case "list":
      return { v: 1, type: "list", tableId, titleFieldId: "" };
    case "record_detail":
      return { v: 1, type: "record_detail", tableId, recordSelector: "url_param", sections: [{ title: "Details", fieldIds: [] }] };
    case "dashboard":
      return { v: 1, type: "dashboard", widgets: [] };
    case "form":
      return { v: 1, type: "form", tableId, fields: [], submitText: "Submit", successMessage: "Thanks! Your response was recorded." };
  }
}
