import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { useApp } from "./context";
import { docTypes, type Upload } from "./types";

export function EvidencePanel({ productId }: { productId: string }) {
  const { account, token, signIn, busy, perform, transact, revision, refresh } =
    useApp();
  const [file, setFile] = useState<File>();
  const [docType, setDocType] = useState("0");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) {
      setUploads([]);
      return;
    }
    const abort = new AbortController();
    api<Upload[]>(
      `/products/${productId}/uploads`,
      { signal: abort.signal },
      token,
    )
      .then((data) => {
        setUploads(data);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [productId, token, revision]);
  async function upload(e: FormEvent) {
    e.preventDefault();
    await perform(async () => {
      if (!file) throw new Error("Choose a file to attach.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a file smaller than 10 MiB.");
      const session = await signIn();
      const body = new FormData();
      body.set("file", file);
      body.set("docType", docType);
      await api(
        `/products/${productId}/documents`,
        { method: "POST", body },
        session,
      );
      refresh();
    }, "File stored privately. Anchor its hash below to confirm it on-chain.");
  }
  async function download(record: Upload) {
    await perform(async () => {
      const response = await fetch(`/api/documents/${record.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error(
          "Download unavailable. Sign in again or check the file permissions.",
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Download ready.");
  }
  if (!account) return null;
  return (
    <section className="panel padded" id="private-evidence">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PRIVATE EVIDENCE</p>
          <h2>Upload and anchor a document</h2>
        </div>
      </div>
      <p className="muted">
        Only the current authorized custodian or a certifier can attach
        evidence. Files stay private to their uploader. The document hash is
        public.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!token && (
        <Button
          className="button outline"
          disabled={busy}
          onClick={() =>
            perform(async () => {
              await signIn();
            }, "Private evidence session started.")
          }
        >
          Sign in for private evidence
        </Button>
      )}
      <form noValidate onSubmit={upload} className="form-stack upload-form">
        <label htmlFor="document-file">Document (maximum 10 MiB)</label>
        <Input
          id="document-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
        <label htmlFor="document-type">Document type</label>
        <select
          id="document-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {docTypes.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <Button className="button" disabled={busy || !file}>
          Store file privately
        </Button>
      </form>
      <ul className="evidence-list">
        {uploads.map((record) => (
          <li key={record.id}>
            <div className="section-heading">
              <strong>{record.filename}</strong>
              <span className="badge">{record.status}</span>
            </div>
            <code className="break">{record.hash}</code>
            <div className="button-row">
              <Button
                disabled={busy}
                className="button small outline"
                onClick={() => download(record)}
              >
                Download
              </Button>
              {record.status === "pending" && (
                <Button
                  disabled={busy}
                  className="button small"
                  onClick={() =>
                    transact("anchorDocument", [
                      productId,
                      record.hash,
                      record.docType,
                    ])
                  }
                >
                  Anchor hash
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {token && (
        <Button
          className="text-button"
          disabled={busy}
          onClick={() =>
            perform(async () => {
              const result = await api<{ removed: number }>(
                "/maintenance/cleanup",
                { method: "POST" },
                token,
              );
              setError("");
              refresh();
              if (!result.removed) return;
            }, "Cleanup complete. Unanchored uploads older than 24 hours were removed.")
          }
        >
          Clean up expired pending uploads
        </Button>
      )}
    </section>
  );
}
