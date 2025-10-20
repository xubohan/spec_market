import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError, useDeleteSpec, useSpecDetail } from '../lib/api';
import { MarkdownView } from '../components/MarkdownView';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { DownloadButton } from '../components/DownloadButton';
import { useAdminToken } from '../lib/auth';
import { Calendar, Clock3, Edit3, Folder, Hash, Tag, Trash2, User } from 'lucide-react';

export const SpecDetailPage = () => {
  const { shortId = '' } = useParams();
  const { data, isLoading } = useSpecDetail(shortId);
  const navigate = useNavigate();
  const { token, setToken } = useAdminToken();
  const deleteMutation = useDeleteSpec();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localToken, setLocalToken] = useState(() => token ?? '');

  useEffect(() => {
    setLocalToken(token ?? '');
  }, [token]);

  if (isLoading) {
    return <p className="text-muted">Loading...</p>;
  }

  if (!data) {
    return <p className="text-muted">Spec not found.</p>;
  }

  const handleDelete = async () => {
    if (!data) {
      return;
    }
    if (!token) {
      setMessage({ type: 'error', text: 'Please save your Admin-Token before deleting this spec.' });
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this spec? This action cannot be undone.');
    if (!confirmed) {
      return;
    }
    setMessage(null);
    try {
      await deleteMutation.mutateAsync({ token, shortId: data.shortId });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage({ type: 'error', text: error.statusMsg });
      } else {
        setMessage({ type: 'error', text: (error as Error).message });
      }
    }
  };

  const handleSaveToken = () => {
    setToken(localToken || null);
    setMessage({ type: 'success', text: 'Admin token saved.' });
  };

  const formattedUpdatedAt = new Date(data.updatedAt).toLocaleString();
  const formattedCreatedAt = new Date(data.createdAt).toLocaleString();

  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-6">
        <header className="rounded-3xl border border-muted/20 bg-white/90 p-8 shadow-lg">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-text">{data.title}</h1>
            <div className="flex flex-wrap gap-2">
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </header>
        <MarkdownView markdown={data.contentMd} />
      </article>
      <aside className="space-y-6">
        <div className="rounded-3xl border border-muted/20 bg-white/90 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Actions</h3>
            <div className="flex flex-wrap items-center gap-2">
              <CopyMarkdownButton shortId={data.shortId} />
              <DownloadButton shortId={data.shortId} />
              <Link
                to={`/specs/${data.shortId}/edit`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-muted/30 bg-white/80 text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Edit Spec"
                aria-label="Edit Spec"
              >
                <Edit3 className="h-4 w-4" />
              </Link>
              <button
                onClick={handleDelete}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-white/80 text-red-500 transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                title={deleteMutation.isPending ? 'Deleting Spec…' : 'Delete Spec'}
                aria-label={deleteMutation.isPending ? 'Deleting Spec…' : 'Delete Spec'}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="admin-token-input">
              Admin-Token
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="admin-token-input"
                value={localToken}
                onChange={(event) => setLocalToken(event.target.value)}
                placeholder="Enter Admin-Token"
                className="flex-1 rounded-lg border border-muted/30 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
              >
                Save Token
              </button>
            </div>
          </div>
          {message && (
            <p
              className={`mt-4 text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
            >
              {message.text}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-muted/20 bg-white/90 p-6 shadow-lg">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Meta</h3>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <User className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Author</dt>
              </div>
              <dd className="font-medium text-text">{data.author}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Hash className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Short ID</dt>
              </div>
              <dd className="font-mono text-xs text-text break-all">{data.shortId}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Folder className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Category</dt>
              </div>
              <dd className="font-medium capitalize text-text">{data.category}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Tag className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Tags</dt>
              </div>
              <dd className="flex flex-wrap gap-1 text-xs text-muted">
                {data.tags.length > 0 ? (
                  data.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-muted/10 px-2 py-0.5 text-[0.65rem] font-medium text-muted/70">
                    No tags
                  </span>
                )}
              </dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Clock3 className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Updated</dt>
              </div>
              <dd className="text-xs text-muted">{formattedUpdatedAt}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Calendar className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Created</dt>
              </div>
              <dd className="text-xs text-muted">{formattedCreatedAt}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </section>
  );
};
