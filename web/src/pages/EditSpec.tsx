import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { ApiRequestError, useSpecDetail, useUpdateSpec } from '../lib/api';
import { useAuth } from '../lib/auth';

export const EditSpecPage = () => {
  const { shortId = '' } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [contentMd, setContentMd] = useState('');
  const { data, isLoading, isError } = useSpecDetail(shortId);
  const mutation = useUpdateSpec();
  const queryClient = useQueryClient();

  const redirectTarget = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: redirectTarget } });
    }
  }, [authLoading, user, navigate, redirectTarget]);

  useEffect(() => {
    if (data && !initialized) {
      setTitle(data.title);
      setSummary(data.summary ?? '');
      setCategory(data.category);
      setTagsInput(data.tags.join(', '));
      setContentMd(data.contentMd ?? '');
      setInitialized(true);
    }
  }, [data, initialized]);

  const isOwner = useMemo(() => {
    if (!user || !data) {
      return false;
    }
    if (data.ownerId) {
      return data.ownerId === user.id;
    }
    const normalizedAuthor = (data.author || '').replace(/^@/, '');
    return normalizedAuthor === user.username;
  }, [user, data]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shortId) {
      setMessage('Missing shortId in route.');
      return;
    }
    if (!user) {
      setMessage('Please sign in before updating.');
      return;
    }
    if (!isOwner) {
      setMessage('Only the author can update this spec.');
      return;
    }
    setMessage(null);
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    try {
      await mutation.mutateAsync({
        shortId,
        title,
        summary,
        category,
        tags,
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

  if (authLoading || (isLoading && !initialized)) {
    return <p className="text-muted">Loading…</p>;
  }

  if (isError || !data) {
    return <p className="text-muted">Spec not found.</p>;
  }

  if (!user) {
    return null;
  }

  const disableForm = mutation.isPending || !isOwner;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit Spec</h1>
            <p className="mt-1 text-sm text-muted">
              {isOwner
                ? 'Update the metadata or markdown content for this spec.'
                : 'You can view the spec content below. Only the author can apply changes.'}
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
        <div className="mt-3 rounded-xl border border-muted/20 bg-white/80 p-4 text-sm text-muted">
          <p>
            Author:{' '}
            <span className="font-semibold text-primary">{data.author}</span>
          </p>
        </div>
      </div>
      {!isOwner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You’re signed in as <span className="font-semibold">@{user.username}</span>, but only {data.author} can edit or delete this spec.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={disableForm}
              className="rounded-lg border border-muted/30 px-3 py-2 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              disabled={disableForm}
              className="rounded-lg border border-muted/30 px-3 py-2 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tags (comma separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={disableForm}
              className="rounded-lg border border-muted/30 px-3 py-2 disabled:opacity-50"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            disabled={disableForm}
            className="rounded-lg border border-muted/30 px-3 py-2 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Markdown content
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            rows={12}
            disabled={disableForm}
            className="rounded-lg border border-muted/30 px-3 py-2 font-mono disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={disableForm}
        >
          {mutation.isPending ? 'Updating…' : isOwner ? 'Update Spec' : 'Only the author can update'}
        </button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </form>
    </section>
  );
};
