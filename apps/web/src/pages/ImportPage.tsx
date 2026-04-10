import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { FileDropzone } from "../components/import/FileDropzone";
import { ColumnMappingTable } from "../components/import/ColumnMappingTable";
import { ImportPreviewTable } from "../components/import/ImportPreviewTable";
import { ImportProgressBar } from "../components/import/ImportProgressBar";
import { ImportHistoryTable } from "../components/import/ImportHistoryTable";
import { useUploadFile, useCommitImport } from "../hooks/useImport";
import type { ColumnMappingInput, ImportJobRecord, UploadResponse } from "@log-monitor/shared";

// ---------------------------------------------------------------------------
// Wizard state machine
// ---------------------------------------------------------------------------
type WizardState =
  | { step: "idle" }
  | { step: "mapping"; upload: UploadResponse; fileName: string; fileSize: number }
  | { step: "preview"; upload: UploadResponse; mapping: ColumnMappingInput; fileName: string; fileSize: number }
  | { step: "importing"; jobId: string }
  | { step: "done"; job: ImportJobRecord };

const STEPS = ["Upload", "Map Columns", "Preview", "Import"];
const STEP_INDEX: Record<string, number> = { idle: 0, mapping: 1, preview: 2, importing: 3, done: 3 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ImportPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>({ step: "idle" });
  const [localMapping, setLocalMapping] = useState<Partial<ColumnMappingInput>>({});

  const uploadMutation = useUploadFile();
  const commitMutation = useCommitImport();

  // Step 0 → 1: upload and parse file
  async function handleFile(file: File) {
    try {
      const result = await uploadMutation.mutateAsync(file);
      setLocalMapping(result.suggestedMapping ?? {});
      setState({ step: "mapping", upload: result, fileName: file.name, fileSize: file.size });
    } catch (err) {
      // Error is shown via uploadMutation.error below
    }
  }

  // Step 1 → 2: validate mapping and advance to preview
  function handleMappingConfirm() {
    if (state.step !== "mapping") return;
    if (!localMapping.level || !localMapping.message) return;
    setState({
      step: "preview",
      upload: state.upload,
      mapping: localMapping as ColumnMappingInput,
      fileName: state.fileName,
      fileSize: state.fileSize,
    });
  }

  // Step 2 → 3: commit
  async function handleCommit() {
    if (state.step !== "preview") return;
    try {
      const { jobId } = await commitMutation.mutateAsync({
        uploadId:      state.upload.uploadId,
        fileName:      state.fileName,
        fileSize:      state.fileSize,
        columnMapping: state.mapping,
      });
      setState({ step: "importing", jobId });
    } catch {
      // error shown via commitMutation.error
    }
  }

  function reset() {
    setState({ step: "idle" });
    setLocalMapping({});
    uploadMutation.reset();
    commitMutation.reset();
  }

  const currentStep = STEP_INDEX[state.step] ?? 0;
  const upload = state.step === "mapping" || state.step === "preview" ? state.upload : null;
  const mapping = state.step === "preview" ? state.mapping : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-semibold">Import Log File</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload JSON, NDJSON, CSV, or plain text log files
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Step indicators */}
        <div className="flex items-center gap-0">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                idx < currentStep
                  ? "text-green-500"
                  : idx === currentStep
                  ? "text-primary"
                  : "text-muted-foreground/40"
              }`}>
                <span className={`w-4 h-4 rounded-full text-xs flex items-center justify-center border ${
                  idx < currentStep
                    ? "bg-green-500 border-green-500 text-white"
                    : idx === currentStep
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground/30"
                }`}>
                  {idx < currentStep ? "✓" : idx + 1}
                </span>
                {label}
              </div>
              {idx < STEPS.length - 1 && (
                <div className="w-8 h-px bg-border mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: File upload */}
        {state.step === "idle" && (
          <div className="space-y-3">
            <FileDropzone onFile={handleFile} isLoading={uploadMutation.isPending} />
            {uploadMutation.error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {(uploadMutation.error as Error).message}
              </p>
            )}
          </div>
        )}

        {/* Step 1: Column mapping */}
        {state.step === "mapping" && upload && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <span>Detected format: <strong className="text-foreground">{upload.format.toUpperCase()}</strong></span>
              <span>·</span>
              <span><strong className="text-foreground">{upload.totalRows.toLocaleString()}</strong> rows</span>
              <span>·</span>
              <span><strong className="text-foreground">{upload.headers.length}</strong> columns</span>
            </div>
            <ColumnMappingTable
              headers={upload.headers}
              mapping={localMapping}
              onChange={setLocalMapping}
              isTextFormat={upload.format === "text"}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:bg-muted">
                <ArrowLeft size={12} /> Back
              </button>
              <button
                onClick={handleMappingConfirm}
                disabled={!localMapping.level || !localMapping.message}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
              >
                Preview <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {state.step === "preview" && upload && mapping && (
          <div className="space-y-4">
            <ImportPreviewTable sampleRows={upload.sampleRows} mapping={mapping} />
            {commitMutation.error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {(commitMutation.error as Error).message}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setState({ step: "mapping", upload, fileName: state.fileName, fileSize: state.fileSize })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <button
                onClick={handleCommit}
                disabled={commitMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                Start Import ({upload.totalRows.toLocaleString()} rows)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {state.step === "importing" && (
          <div className="max-w-md">
            <ImportProgressBar
              jobId={state.jobId}
              onComplete={(job) => setState({ step: "done", job })}
            />
          </div>
        )}

        {/* Step 4: Done */}
        {state.step === "done" && (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-green-500" />
              <div>
                <p className="text-sm font-medium text-foreground">Import complete</p>
                <p className="text-xs text-muted-foreground">
                  {state.job.importedRows.toLocaleString()} rows imported from {state.job.fileName}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                <RotateCcw size={12} /> Import Another
              </button>
              <button
                onClick={() => navigate("/logs")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
              >
                View Logs <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Import history (always visible below wizard) */}
        {state.step !== "importing" && (
          <div className="pt-4 border-t border-border">
            <ImportHistoryTable />
          </div>
        )}
      </div>
    </div>
  );
}
