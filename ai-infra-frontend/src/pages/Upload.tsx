import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ApiRequestError, useUploadSpec } from '../lib/api';
import { useAuth } from '../lib/auth';

export const UploadPage = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedShortId, setUploadedShortId] = useState<string | null>(null);
  const [contentValue, setContentValue] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'file' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mutation = useUploadSpec();

  const redirectTarget = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true, state: { from: redirectTarget } });
    }
  }, [isLoading, user, navigate, redirectTarget]);

  if (isLoading) {
    return <p className="text-muted">Checking session…</p>;
  }

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUploadedShortId(null);
    const formElement = event.currentTarget;
    const fileInput = formElement.elements.namedItem('file') as HTMLInputElement | null;
    const selectedFile = fileInput?.files?.[0] ?? null;
    const contentText = inputMode === 'file' ? '' : contentValue.trim();
    if (selectedFile && contentText) {
      setMessage('Please choose either manual input or a file upload.');
      return;
    }
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.md')) {
      setMessage('Only .md files are allowed.');
      return;
    }
    const formData = new FormData(formElement);
    try {
      const result = await mutation.mutateAsync({ formData });
      setMessage('Upload successful.');
      setUploadedShortId(result.shortId);
      formElement.reset();
      setContentValue('');
      setInputMode(null);
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
      <div className="space-y-4 rounded-2xl bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-text">Upload a spec</h1>
          <p className="text-sm text-muted">
            Files uploaded from this page will be attributed to{' '}
            <span className="font-semibold text-primary">@{user.username}</span>.
          </p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Summary
            <textarea name="summary" rows={3} className="rounded-lg border border-muted/30 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Markdown content
            <textarea
              name="content"
              value={contentValue}
              onChange={(event) => {
                const next = event.target.value;
                setContentValue(next);
                if (next.trim()) {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  setInputMode('text');
                } else {
                  setInputMode(null);
                }
              }}
              rows={8}
              disabled={inputMode === 'file'}
              className="rounded-lg border border-muted/30 px-3 py-2 font-mono disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Or upload Markdown file
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept=".md,text/markdown"
              disabled={inputMode === 'text'}
              onChange={(event) => {
                const fileList = event.target.files;
                if (fileList && fileList.length > 0) {
                  setContentValue('');
                  setInputMode('file');
                } else {
                  setInputMode(contentValue.trim() ? 'text' : null);
                }
              }}
              className="disabled:opacity-50"
            />
            <p className="text-xs text-muted">You can only choose one method: type markdown or upload a file.</p>
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Uploading…' : 'Upload Spec'}
            </button>
            <p className="text-xs text-muted">
              The author field is generated automatically based on your account. You can edit content and metadata later from the spec detail page.
            </p>
          </div>
        </form>
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
      </div>
    </section>
  );
};
