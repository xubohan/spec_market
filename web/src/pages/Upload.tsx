import { FormEvent, useState } from 'react';
import { useAdminToken } from '../lib/auth';
import { ApiRequestError, useUploadSpec } from '../lib/api';

export const UploadPage = () => {
  const { token, setToken } = useAdminToken();
  const [localToken, setLocalToken] = useState(token ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedShortId, setUploadedShortId] = useState<string | null>(null);
  const mutation = useUploadSpec();

  const handleSaveToken = () => {
    setToken(localToken || null);
    setMessage('Admin token saved.');
    setUploadedShortId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setMessage('Please save your Admin-Token before uploading.');
      setUploadedShortId(null);
      return;
    }
    setMessage(null);
    setUploadedShortId(null);
    const formElement = event.currentTarget;
    const fileInput = formElement.elements.namedItem('file') as HTMLInputElement | null;
    const selectedFile = fileInput?.files?.[0] ?? null;
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.md')) {
      setMessage('Only .md files are allowed.');
      return;
    }
    const formData = new FormData(formElement);
    try {
      const result = await mutation.mutateAsync({ token, formData });
      setMessage('Upload successful.');
      setUploadedShortId(result.shortId);
      formElement.reset();
    } catch (error) {
      setUploadedShortId(null);
      if (error instanceof ApiRequestError) {
        setMessage(error.statusMsg);
      } else {
        setMessage((error as Error).message);
      }
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Admin Upload</h1>
        <p className="mt-2 text-sm text-muted">
          Provide your Admin-Token to authenticate uploads. This temporarily replaces a dedicated login page.
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={localToken}
            onChange={(e) => setLocalToken(e.target.value)}
            placeholder="Enter Admin-Token"
            className="flex-1 rounded-lg border border-muted/30 px-4 py-2"
          />
          <button
            onClick={handleSaveToken}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Save Token
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input name="title" required className="rounded-lg border border-muted/30 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Category
            <input name="category" required className="rounded-lg border border-muted/30 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tags (comma separated)
            <input name="tags" className="rounded-lg border border-muted/30 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Author
            <input name="author" required className="rounded-lg border border-muted/30 px-3 py-2" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary
          <textarea name="summary" rows={3} className="rounded-lg border border-muted/30 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Markdown content
          <textarea name="content" rows={8} className="rounded-lg border border-muted/30 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Or upload Markdown file
          <input type="file" name="file" accept=".md,text/markdown" />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Uploading...' : 'Upload Spec'}
        </button>
        {message && <p className="text-sm text-muted">{message}</p>}
        {uploadedShortId && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Short ID:</span>
            <code className="rounded bg-muted/20 px-2 py-1 font-mono text-xs text-text">{uploadedShortId}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(uploadedShortId);
                setMessage('Short ID copied to clipboard.');
              }}
              className="rounded bg-muted/20 px-2 py-1 text-xs font-medium text-text hover:bg-muted/30"
            >
              Copy Short ID
            </button>
          </div>
        )}
      </form>
    </section>
  );
};
