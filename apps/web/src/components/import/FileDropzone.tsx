import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";

const ACCEPTED = [".json", ".ndjson", ".csv", ".log", ".txt"];
const MAX_SIZE = 50 * 1024 * 1024;

interface Props {
  onFile: (file: File) => void;
  isLoading: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDropzone({ onFile, isLoading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (file.size > MAX_SIZE) return `File is too large (${formatSize(file.size)}). Maximum is 50 MB.`;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (ACCEPTED.length > 0 && !ACCEPTED.includes(ext) && !file.name.includes(".")) {
      // Allow files with no extension (some log files have none)
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setError(err); setSelected(null); return; }
    setError(null);
    setSelected(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={onInputChange}
        />
        <Upload size={32} className={dragging ? "text-primary" : "text-muted-foreground/50"} />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {dragging ? "Drop file here" : "Click or drag a log file here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JSON · NDJSON · CSV · .log · .txt — max 50 MB
          </p>
        </div>
      </div>

      {/* Selected file info */}
      {selected && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted border border-border">
          <FileText size={18} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(selected.size)}</p>
          </div>
          <button
            onClick={() => onFile(selected)}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60 shrink-0"
          >
            {isLoading ? "Parsing…" : "Parse File"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
