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

type Step = "pick" | "mapping" | "running" | "done";

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

  async function onFileSelected() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await upload.mutateAsync({ baseId, file });
      setJobId(res.id);
      setStep("mapping");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
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
    if (!newTableName) setNewTableName("Imported table");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Import CSV</h2>
          <button onClick={onClose} className="text-sm text-[var(--color-muted)]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {step === "pick" && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-muted)]">Choose a .csv file to import.</p>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={onFileSelected} className="text-sm" />
              {upload.isPending && <p className="text-sm text-[var(--color-muted)]">Uploading…</p>}
            </div>
          )}

          {step === "mapping" && analysis && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Import into</label>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={targetMode === "new_table"} onChange={() => setTargetMode("new_table")} />
                    New table
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={targetMode === "append"} onChange={() => setTargetMode("append")} />
                    Append to existing
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={targetMode === "upsert"} onChange={() => setTargetMode("upsert")} />
                    Update or append (upsert)
                  </label>
                </div>

                {targetMode === "new_table" ? (
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Table name"
                    className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                ) : (
                  <select
                    value={targetTableId}
                    onChange={(e) => setTargetTableId(e.target.value)}
                    className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm outline-none"
                  >
                    <option value="">Select a table…</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                {targetMode === "upsert" && targetFields && (
                  <select
                    value={upsertKeyFieldId}
                    onChange={(e) => setUpsertKeyFieldId(e.target.value)}
                    className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm outline-none"
                  >
                    <option value="">Match rows on…</option>
                    {targetFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Column mapping</label>
                <div className="overflow-hidden rounded border border-[var(--color-border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-black/5 text-xs text-[var(--color-muted)] dark:bg-white/5">
                      <tr>
                        <th className="px-2 py-1.5 text-left">CSV column</th>
                        <th className="px-2 py-1.5 text-left">Action</th>
                        <th className="px-2 py-1.5 text-left">Field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m, idx) => (
                        <tr key={m.csvColumn} className="border-t border-[var(--color-border)]">
                          <td className="px-2 py-1.5">{m.csvColumn}</td>
                          <td className="px-2 py-1.5">
                            <select
                              value={m.action}
                              onChange={(e) => updateMapping(idx, { action: e.target.value as any })}
                              className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-xs"
                            >
                              <option value="createField">Create field</option>
                              {targetMode !== "new_table" && <option value="mapToField">Map to existing</option>}
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            {m.action === "createField" && (
                              <div className="flex gap-1">
                                <input
                                  value={m.fieldName ?? ""}
                                  onChange={(e) => updateMapping(idx, { fieldName: e.target.value })}
                                  className="w-28 rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-xs"
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
                              <select
                                value={m.fieldId ?? ""}
                                onChange={(e) => updateMapping(idx, { fieldId: e.target.value })}
                                className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-xs"
                              >
                                <option value="">Select field…</option>
                                {targetFields?.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            )}
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
            <div className="space-y-2 text-sm">
              <p>Importing… {status?.progressPercent ?? 0}%</p>
              <div className="h-2 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                <div
                  className="h-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${status?.progressPercent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {step === "done" && status && (
            <div className="space-y-2 text-sm">
              <p className={status.status === "failed" ? "text-red-600" : ""}>
                {status.status === "failed" ? "Import failed." : "Import complete."}
              </p>
              {status.stats && (
                <ul className="text-[var(--color-muted)]">
                  <li>Inserted: {status.stats.inserted}</li>
                  <li>Updated: {status.stats.updated}</li>
                  <li>Cell errors: {status.stats.failed}</li>
                </ul>
              )}
              {status.errorReportUrl && (
                <a href={status.errorReportUrl} className="text-[var(--color-accent)] underline">
                  Download error report
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          {step === "mapping" && (
            <button
              onClick={onRunImport}
              disabled={!canRun || execute.isPending}
              className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] disabled:opacity-50"
            >
              Import
            </button>
          )}
          {step === "done" && (
            <button
              onClick={onFinish}
              className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-accent-fg)]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
