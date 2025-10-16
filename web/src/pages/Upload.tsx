import { FormEvent, useState } from 'react';
import { useAdminToken } from '../lib/auth';
import { ApiRequestError, useUploadSpec } from '../lib/api';

export const UploadPage = () => {
  const { token, setToken } = useAdminToken();
  const [localToken, setLocalToken] = useState(token ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useUploadSpec();

  const handleSaveToken = () => {
    setToken(localToken || null);
    setMessage('Admin token saved.');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setMessage('Please save your Admin-Token before uploading.');
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      const result = await mutation.mutateAsync({ token, formData });
      setMessage(`Upload successful for ${result.slug}`);
      event.currentTarget.reset();
    } catch (error) {
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
            Slug
            <input name="slug" required className="rounded-lg border border-muted/30 px-3 py-2" />
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
          <textarea name="content" rows={8} className="rounded-lg border border-muted/30 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Or upload Markdown file
          <input type="file" name="file" accept="text/markdown,text/plain,.md" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Version
          <input name="version" type="number" min={1} defaultValue={1} className="w-32 rounded-lg border border-muted/30 px-3 py-2" />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Uploading...' : 'Upload Spec'}
        </button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </form>
    </section>
  );
};
