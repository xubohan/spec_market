import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '../lib/auth';
import { ApiRequestError, useSpecDetail, useUpdateSpec } from '../lib/api';

export const EditSpecPage = () => {
  const { shortId = '' } = useParams();
  const { token, setToken } = useAdminToken();
  const [localToken, setLocalToken] = useState(token ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [contentMd, setContentMd] = useState('');
  const { data, isLoading, isError } = useSpecDetail(shortId, 'md');
  const mutation = useUpdateSpec();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (data && !initialized) {
      setTitle(data.title);
      setSummary(data.summary ?? '');
      setCategory(data.category);
      setAuthor(data.author);
      setTagsInput(data.tags.join(', '));
      setContentMd(data.contentMd ?? '');
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSaveToken = () => {
    setToken(localToken || null);
    setMessage('Admin token saved.');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shortId) {
      setMessage('Missing shortId in route.');
      return;
    }
    if (!token) {
      setMessage('Please save your Admin-Token before updating.');
      return;
    }
    setMessage(null);
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    try {
      await mutation.mutateAsync({
        token,
        shortId,
        title,
        summary,
        category,
        tags,
        author,
        contentMd,
      });
      await queryClient.invalidateQueries({ queryKey: ['spec', shortId] });
      await queryClient.invalidateQueries({ queryKey: ['specs'] });
      setMessage('Spec updated successfully.');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.statusMsg);
      } else {
        setMessage((error as Error).message);
      }
    }
  };

  if (isLoading && !initialized) {
    return <p className="text-muted">Loading...</p>;
  }

  if (isError || !data) {
    return <p className="text-muted">Spec not found.</p>;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit Spec</h1>
            <p className="mt-1 text-sm text-muted">
              Update the metadata or markdown content for this spec. Changes require a valid Admin-Token.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Short ID:</span>
            <code className="rounded bg-muted/20 px-2 py-1 font-mono text-xs text-text">{shortId}</code>
            <Link
              to={`/specs/${shortId}`}
              className="rounded-lg border border-muted/30 px-3 py-1 text-xs font-semibold text-muted hover:bg-muted/20"
            >
              View Spec
            </Link>
          </div>
        </div>
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-lg border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="rounded-lg border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tags (comma separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="rounded-lg border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Author
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              className="rounded-lg border border-muted/30 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="rounded-lg border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Markdown content
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            rows={12}
            className="rounded-lg border border-muted/30 px-3 py-2 font-mono"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Updating...' : 'Update Spec'}
        </button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </form>
    </section>
  );
};
