import { useRef, useState, type DragEvent } from "react";
import { Send, FileText, CheckCircle2 } from "lucide-react";
import { ErrorMessage } from "../feedback/ErrorMessage";
import { ERRORS, type ErrorId } from "../feedback/errors";
import { Drawer } from "../layout/Drawer";
import { Button } from "../actions/Button";
import { Spinner } from "../data-display/Spinner";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine, SkeletonCircle, SkeletonButton } from "../data-display/Skeleton";
import { focusRing } from "../tokens/focusRing";

/* WelcomeUploadConnect — the Welcome wizard's Upload sub-flow: drag-and-drop or
   browse .md/.txt files through the same document → chunk → embed pipeline as
   GitHub sync. Per-file results (chunks / embedded / error) come straight from
   the server; re-uploading unchanged content honestly shows 0 embedded
   (content-hash skip). Local FileDropzone + UploadResultList are built here;
   POST /onboard/upload is simulated. Standalone: opens by default. */

const MAX_FILES = 20;
const MAX_BYTES = 25_000_000;

/* One list, used by the accept attribute, the validator, and the spec line
   under the Browse button. It used to accept only .md/.txt, which greyed out
   every other file in the picker while the copy promised more. */
const ACCEPTED_EXT = [".pdf", ".md", ".mdx", ".markdown", ".txt", ".html", ".htm", ".docx", ".csv"];
const ACCEPT_ATTR = ACCEPTED_EXT.join(",");
const SPEC_LINE = "PDF, Markdown, plain text, HTML, DOCX, or CSV. Up to 20 files, 25 MB each.";

type FileResult = { name: string; docId: number | null; chunks: number; embedded: number; error?: string };
type UploadResult = { files: FileResult[] };

// Deterministic per-name demo counts so re-dropping the same file skips embeds.
const seen = new Set<string>();
function supported(name: string): boolean {
  return ACCEPTED_EXT.some((ext) => name.toLowerCase().endsWith(ext));
}

function fakeIngest(name: string, size: number): FileResult {
  if (!supported(name)) return { name, docId: null, chunks: 0, embedded: 0, error: ERRORS["upload.unsupportedType"].title };
  const chunks = Math.max(1, Math.round(size / 1800) || 3 + (name.length % 5));
  const first = !seen.has(name);
  seen.add(name);
  return { name, docId: Math.floor(Math.random() * 9000), chunks, embedded: first ? chunks : 0 };
}

function FileDropzone({
  uploading, onFiles,
}: { uploading: boolean; onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={`grid place-items-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? "border-biscay-2 bg-biscay/[0.04]" : "border-ink/20"
      }`}
    >
      {uploading ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-ink/65"><Spinner size="md" /> Uploading and embedding…</span>
      ) : (
        <>
          <Send size={22} className="text-ink/65 -rotate-45" />
          <span className="text-[13px] text-ink/70">Drag files here, or</span>
          <Button compact onClick={() => inputRef.current?.click()}>Browse files</Button>
          {/* The spec sits directly under the button, where you look before
              you pick a file, not buried in the drawer footer. */}
          <span className="mt-1 max-w-[380px] text-[12.5px] font-medium text-ink/80">{SPEC_LINE}</span>
          <input
            ref={inputRef} type="file" multiple hidden accept={ACCEPT_ATTR}
            className={focusRing}
            onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}

function UploadResultList({ result }: { result: UploadResult }) {
  const ok = result.files.filter((f) => f.docId != null);
  const totalChunks = ok.reduce((n, f) => n + f.chunks, 0);
  const totalEmbedded = ok.reduce((n, f) => n + f.embedded, 0);
  return (
    <div className="mt-3">
      <div className="rounded-[4px] border border-moss/40 bg-moss/[0.06] px-3 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-moss">
          <CheckCircle2 size={15} /> {ok.length} file{ok.length === 1 ? "" : "s"} added to your shared library
        </p>
        <p className="mt-1 text-[12.5px] text-ink/70">
          Find them under Knowledge, filtered to the Upload source. {totalChunks} chunks, {totalEmbedded} embedded
          {totalEmbedded < totalChunks && <span className="text-ink/65"> (unchanged chunks skipped by content hash)</span>}.
        </p>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {result.files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-ink/12">
            <FileText size={14} className="text-ink/65 shrink-0" />
            <span className="text-[13px] text-ink truncate flex-1">{f.name}</span>
            {f.docId != null
              ? <span className="font-term text-[11px] text-ink/65 shrink-0">{f.chunks} chunks · {f.embedded} embedded</span>
              : <Chip label={f.error ?? "Upload failed"} tone="blocked" dot className="shrink-0 max-w-[220px] [&>span]:truncate" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export type WelcomeUploadConnectProps = {
  defaultOpen?: boolean;
  loading?: boolean;
  className?: string;
};

/* Loading silhouette mirroring the Upload connect panel: provider header, the
   drag-and-drop dropzone, and a couple of ingested-file result rows. */
function UploadConnectSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <SkeletonLine w="40%" h={14} />
          <SkeletonLine w="72%" h={10} />
        </div>
      </div>
      <Skeleton height={110} className="mt-5" />
      <div className="mt-3 space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-ink/12 p-2">
            <SkeletonCircle size={14} />
            <SkeletonLine w="35%" h={11} />
            <span className="ml-auto"><SkeletonLine w={120} h={9} /></span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-ink/10 pt-3">
        <SkeletonLine w="40%" h={10} />
        <span className="ml-auto"><SkeletonButton w={96} /></span>
      </div>
    </div>
  );
}

export function WelcomeUploadConnect({ defaultOpen = true, loading = false, className = "" }: WelcomeUploadConnectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ErrorId | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = (files: File[]) => {
    if (files.length === 0) return;
    setError(null); setErrorDetail("");
    const bad = files.find((f) => !supported(f.name));
    if (bad) { setError("upload.unsupportedType"); setErrorDetail(bad.name); return; }
    if (files.length > MAX_FILES) { setError("upload.tooLarge"); setErrorDetail(`You picked ${files.length} files; the limit is ${MAX_FILES}.`); return; }
    const over = files.find((f) => f.size > MAX_BYTES);
    if (over) { setError("upload.tooLarge"); setErrorDetail(over.name); return; }
    setUploading(true);
    window.setTimeout(() => {
      setResult({ files: files.map((f) => fakeIngest(f.name, f.size)) });
      setUploading(false);
    }, 1300);
  };

  const footer = (
    <div className="flex-1 flex items-center gap-3">
      <Button variant="primary" onClick={() => setOpen(false)}>
        {result ? <>Done <CheckCircle2 size={14} /></> : "Close"}
      </Button>
      <span className="text-[12px] text-ink/70 flex-1">{SPEC_LINE}</span>
    </div>
  );

  if (loading) return <UploadConnectSkeleton className={className} />;

  return (
    <div className={className}>
      <Button variant="primary" onClick={() => { setResult(null); setError(null); setErrorDetail(""); setOpen(true); }}>
        <Send size={14} className="-rotate-45" /> Upload files
      </Button>
      <Drawer open={open} onClose={() => !uploading && setOpen(false)} title="Upload files" subtitle="Connector setup"
        icon={<Send size={18} className="-rotate-45" />} footer={footer}>
        <p className="text-[13px] text-ink/70 mb-3">
          Files run the same document, chunk, embed pipeline as GitHub sync and land in your shared library.
        </p>
        <FileDropzone uploading={uploading} onFiles={upload} />
        {error && (
          <div className="mt-3">
            <ErrorMessage id={error} onDismiss={() => { setError(null); setErrorDetail(""); }}>
              {errorDetail}
            </ErrorMessage>
          </div>
        )}
        {result && <UploadResultList result={result} />}
      </Drawer>
    </div>
  );
}
