"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExecuteImportDto, FieldType, ImportColumnMapping } from "@tratable/shared";
import type { TableSummary } from "@/lib/hooks/use-tables";
import { useFields } from "@/lib/hooks/use-fields";
import { Select } from "@/components/ui/select";
import {
  useAnalyzeImport,
  useExecuteImport,
  useImportStatus,
  useInvalidateAfterImport,
  useUploadImport,
} from "@/lib/hooks/use-imports";
import { DownloadIcon, UploadIcon, XIcon } from "@/components/ui/icons";

const CREATABLE_TYPES: { value: FieldType; label: string }[] = [
  { value: "singleLineText", label: "Single line text" },
  { value: "longText", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "singleSelect", label: "Single select" },
  { value: "multiSelect", label: "Multiple select" },
  { value: "date", label: "Date" },
  { value: "dateTime", label: "Date & time" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
];

const ACTION_OPTIONS = (allowMapToField: boolean) => [
  { value: "createField", label: "Create field" },
  ...(allowMapToField ? [{ value: "mapToField", label: "Map to existing" }] : []),
  { value: "skip", label: "Skip" },
];

type Step = "pick" | "mapping" | "running" | "done";
const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "pick", label: "Upload" },
  { key: "mapping", label: "Map" },
  { key: "running", label: "Import" },
  { key: "done", label: "Done" },
];

function StepIndicator({ step }: { step: Step }) {
  const idx = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-semibold transition-colors ${
              i < idx
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                : i === idx
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]"
                  : "bg-[var(--color-surface-hover)] text-[var(--color-fg-subtle)]"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-[12px] ${i === idx ? "font-medium text-[var(--color-fg)]" : "text-[var(--color-fg-subtle)]"}`}
          >
            {s.label}
          </span>
          {i < STEP_LABELS.length - 1 && <div className="h-px w-4 bg-[var(--color-border)]" />}
        </div>
      ))}
    </div>
  );
}

export function ImportWizard({
  baseId,
  tables,
  onClose,
  onImported,
}: {
  baseId: string;
  tables: TableSummary[];
  onClose: () => void;
  onImported: (tableId: string) => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const fileRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const [targetMode, setTargetMode] = useState<"new_table" | "append" | "upsert">("new_table");
  const [newTableName, setNewTableName] = useState("");
  const [targetTableId, setTargetTableId] = useState<string>("");
  const [upsertKeyFieldId, setUpsertKeyFieldId] = useState<string>("");
  const [mappings, setMappings] = useState<ImportColumnMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadImport();
  const { data: analysis } = useAnalyzeImport(jobId ?? undefined);
  const execute = useExecuteImport();
  const { data: status } = useImportStatus(jobId ?? undefined, step === "running");
  const { data: targetFields } = useFields(targetMode !== "new_table" ? targetTableId : undefined);
  const invalidate = useInvalidateAfterImport();

  const isDone = status?.status === "completed" || status?.status === "failed";
  useEffect(() => {
    if (isDone && step === "running") setStep("done");
  }, [isDone, step]);

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const res = await upload.mutateAsync({ baseId, file });
      setJobId(res.id);
      setUploadedFileName(res.originalName);
      setStep("mapping");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  /** A name colliding with an existing table is exactly what caused the
   * blank-error "Import failed" dialog: the wizard used to always suggest
   * the same literal "Imported table" string, and a base that already had
   * a table by that name (including a leftover test one, in the case that
   * surfaced this) made every single import attempt fail identically with
   * no visible reason. Deriving the suggestion from the file's own name,
   * and nudging past any collision, makes a repeat collision far less
   * likely — though the backend's own pre-check (see csv.service.ts) is
   * the actual guarantee, not this. */
  function suggestTableName(fileName: string): string {
    const base = fileName.replace(/\.[^./]+$/, "").replace(/[_-]+/g, " ").trim() || "Imported table";
    const existingNames = new Set(tables.map((t) => t.name));
    if (!existingNames.has(base)) return base;
    let n = 2;
    while (existingNames.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  // Seed mappings from the analysis once it arrives.
  const mappingsInitialized = useRef(false);
  if (analysis && !mappingsInitialized.current) {
    mappingsInitialized.current = true;
    setMappings(
      analysis.columns.map((c) => ({
        csvColumn: c.name,
        action: "createField" as const,
        fieldName: c.name,
        fieldType: c.inferredType,
      })),
    );
    if (!newTableName) setNewTableName(suggestTableName(uploadedFileName));
  }

  function updateMapping(idx: number, patch: Partial<ImportColumnMapping>) {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  async function onRunImport() {
    setError(null);
    const dto: ExecuteImportDto = {
      targetMode,
      tableId: targetMode !== "new_table" ? targetTableId : undefined,
      newTableName: targetMode === "new_table" ? newTableName.trim() : undefined,
      upsertKeyFieldId: targetMode === "upsert" ? upsertKeyFieldId : undefined,
      mappings,
    };
    try {
      await execute.mutateAsync({ jobId: jobId!, dto });
      setStep("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start import");
    }
  }

  function onFinish() {
    invalidate();
    const finalTableId = status?.stats ? targetTableId || undefined : undefined;
    onImported(finalTableId ?? targetTableId);
    onClose();
  }

  const canRun = useMemo(() => {
    if (targetMode === "new_table") return newTableName.trim().length > 0;
    if (targetMode === "append") return !!targetTableId;
    return !!targetTableId && !!upsertKeyFieldId;
  }, [targetMode, targetTableId, newTableName, upsertKeyFieldId]);

  const modeCards: { value: typeof targetMode; title: string; desc: string }[] = [
    { value: "new_table", title: "New table", desc: "Create a table from this file" },
    { value: "append", title: "Append", desc: "Add rows to an existing table" },
    { value: "upsert", title: "Upsert", desc: "Update matches, append the rest" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-raised)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">Import CSV</h2>
            <div className="mt-1.5">
              <StepIndicator step={step} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
          >
            <XIcon width={15} height={15} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {error && (
            <p className="mb-3 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
              {error}
            </p>
          )}

          {step === "pick" && (
            <div>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragOver
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <UploadIcon width={20} height={20} />
                </div>
                <div className="text-[13.5px] font-medium">Drop a .csv file here, or click to browse</div>
                <div className="text-[12px] text-[var(--color-fg-subtle)]">CSV, TSV, or plain text — up to 50MB</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {upload.isPending && (
                <p className="mt-3 text-center text-[13px] text-[var(--color-fg-muted)]">Uploading…</p>
              )}
            </div>
          )}

          {step === "mapping" && analysis && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-fg-muted)]">Import into</label>
                <div className="grid grid-cols-3 gap-2">
                  {modeCards.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setTargetMode(c.value)}
                      className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                        targetMode === c.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <div
                        className={`text-[12.5px] font-medium ${targetMode === c.value ? "text-[var(--color-accent)]" : ""}`}
                      >
                        {c.title}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--color-fg-subtle)]">{c.desc}</div>
                    </button>
                  ))}
                </div>

                {targetMode === "new_table" ? (
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Table name"
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]"
                  />
                ) : (
                  <Select
                    value={targetTableId}
                    onChange={setTargetTableId}
                    placeholder="Select a table…"
                    options={tables.map((t) => ({ value: t.id, label: t.name }))}
                  />
                )}

                {targetMode === "upsert" && targetFields && (
                  <Select
                    value={upsertKeyFieldId}
                    onChange={setUpsertKeyFieldId}
                    placeholder="Match rows on…"
                    options={targetFields.map((f) => ({ value: f.id, label: f.name }))}
                  />
                )}
              </div>

              <div className="space-y-2.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-fg-muted)]">Column mapping</label>
                <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <table className="w-full text-[13px]">
                    <thead className="bg-[var(--color-surface)] text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-left">CSV column</th>
                        <th className="px-3 py-2 text-left">Action</th>
                        <th className="px-3 py-2 text-left">Field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m, idx) => (
                        <tr key={m.csvColumn} className="border-t border-[var(--color-border)]">
                          <td className="px-3 py-2 font-medium">{m.csvColumn}</td>
                          <td className="px-3 py-2">
                            <Select
                              className="w-40"
                              value={m.action}
                              onChange={(v) => updateMapping(idx, { action: v as any })}
                              options={ACTION_OPTIONS(targetMode !== "new_table")}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {m.action === "createField" && (
                              <div className="flex gap-1.5">
                                <input
                                  value={m.fieldName ?? ""}
                                  onChange={(e) => updateMapping(idx, { fieldName: e.target.value })}
                                  className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
                                />
                                <Select
                                  className="w-36"
                                  value={m.fieldType ?? "singleLineText"}
                                  onChange={(v) => updateMapping(idx, { fieldType: v as FieldType })}
                                  options={CREATABLE_TYPES}
                                />
                              </div>
                            )}
                            {m.action === "mapToField" && (
                              <Select
                                className="w-44"
                                value={m.fieldId ?? ""}
                                onChange={(v) => updateMapping(idx, { fieldId: v })}
                                placeholder="Select field…"
                                options={(targetFields ?? []).map((f) => ({ value: f.id, label: f.name }))}
                              />
                            )}
                            {m.action === "skip" && <span className="text-[var(--color-fg-subtle)]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === "running" && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${status?.progressPercent ?? 0}%` }}
                />
              </div>
              <p className="text-[13px] text-[var(--color-fg-muted)]">Importing… {status?.progressPercent ?? 0}%</p>
            </div>
          )}

          {step === "done" && status && (
            <div className="space-y-3">
              <p
                className={`text-[14px] font-medium ${status.status === "failed" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}
              >
                {status.status === "failed" ? "Import failed" : "Import complete"}
              </p>
              {status.stats && "error" in status.stats && (
                <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
                  {status.stats.error}
                </p>
              )}
              {status.stats && "inserted" in status.stats && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[18px] font-semibold">{status.stats.inserted}</div>
                    <div className="text-[11.5px] text-[var(--color-fg-subtle)]">Inserted</div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[18px] font-semibold">{status.stats.updated}</div>
                    <div className="text-[11.5px] text-[var(--color-fg-subtle)]">Updated</div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
                    <div
                      className={`text-[18px] font-semibold ${status.stats.failed > 0 ? "text-[var(--color-danger)]" : ""}`}
                    >
                      {status.stats.failed}
                    </div>
                    <div className="text-[11.5px] text-[var(--color-fg-subtle)]">Cell errors</div>
                  </div>
                </div>
              )}
              {status.errorReportUrl && (
                <a
                  href={status.errorReportUrl}
                  className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
                >
                  <DownloadIcon width={13} height={13} />
                  Download error report
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5">
          {step === "mapping" && (
            <button
              onClick={onRunImport}
              disabled={!canRun || execute.isPending}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              Import
            </button>
          )}
          {step === "done" && status?.status === "failed" && (
            <button
              onClick={() => setStep("mapping")}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-1.5 text-[13px] font-medium hover:bg-[var(--color-surface-hover)]"
            >
              Back to mapping
            </button>
          )}
          {step === "done" && (
            <button
              onClick={onFinish}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
