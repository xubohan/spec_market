import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError, useDeleteSpec, useSpecDetail } from '../lib/api';
import { MarkdownView } from '../components/MarkdownView';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { DownloadButton } from '../components/DownloadButton';
import { useAuth } from '../lib/auth';
import { Calendar, Clock3, Edit3, Folder, Hash, Tag, Trash2, User } from 'lucide-react';

export const SpecDetailPage = () => {
  const { shortId = '' } = useParams();
  const { data, isLoading } = useSpecDetail(shortId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const deleteMutation = useDeleteSpec();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const redirectTarget = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );
  const normalizedAuthor = useMemo(
    () => (data?.author ?? '').replace(/^@/, ''),
    [data?.author],
  );
  const isOwner = useMemo(() => {
    if (!user || !data) {
      return false;
    }
    if (data.ownerId) {
      return data.ownerId === user.id;
    }
    return normalizedAuthor === user.username;
  }, [user, data, normalizedAuthor]);

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
    if (!user) {
      navigate('/login', { state: { from: redirectTarget } });
      return;
    }
    if (!isOwner) {
      setMessage({ type: 'error', text: 'Only the author can delete this spec.' });
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this spec? This action cannot be undone.');
    if (!confirmed) {
      return;
    }
    setMessage(null);
    try {
      await deleteMutation.mutateAsync({ shortId: data.shortId });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage({ type: 'error', text: error.statusMsg });
      } else {
        setMessage({ type: 'error', text: (error as Error).message });
      }
    }
  };

  const formattedUpdatedAt = new Date(data.updatedAt).toLocaleString();
  const formattedCreatedAt = new Date(data.createdAt).toLocaleString();
  const editPath = `/specs/${data.shortId}/edit`;
  const canEdit = !!user && isOwner;
  const canDelete = !!user && isOwner;
  const editTitle = !user ? 'Sign in to edit' : canEdit ? 'Edit Spec' : 'Only the author can edit';
  const deleteTitle = deleteMutation.isPending
    ? 'Deleting Spec…'
    : !user
    ? 'Sign in to delete'
    : canDelete
    ? 'Delete Spec'
    : 'Only the author can delete';

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
                to={editPath}
                onClick={(event) => {
                  if (!user) {
                    event.preventDefault();
                    navigate('/login', { state: { from: editPath } });
                    return;
                  }
                  if (!canEdit) {
                    event.preventDefault();
                    setMessage({ type: 'error', text: 'Only the author can edit this spec.' });
                  }
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-muted/30 bg-white/80 text-muted transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  !user || canEdit
                    ? 'hover:border-primary/40 hover:text-primary'
                    : 'cursor-not-allowed opacity-50'
                }`}
                title={editTitle}
                aria-label={editTitle}
                tabIndex={!user || canEdit ? 0 : -1}
                aria-disabled={user ? !canEdit : false}
              >
                <Edit3 className="h-4 w-4" />
              </Link>
              <button
                onClick={handleDelete}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-white/80 text-red-500 transition focus:outline-none focus:ring-2 focus:ring-red-200 ${
                  canDelete
                    ? 'hover:border-red-400 hover:bg-red-50'
                    : !user
                    ? 'hover:border-red-400 hover:bg-red-50'
                    : 'cursor-not-allowed opacity-50'
                }`}
                title={deleteTitle}
                aria-label={deleteTitle}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
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
        {/* {(!user || !isOwner) && (
          <div className="rounded-3xl border border-muted/20 bg-white/90 p-6 shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Access</h3>
            <p className="mt-3 text-sm text-muted">
              {!user
                ? 'Sign in to edit or delete this spec.'
                : `Only ${data.author} can edit or delete this spec.`}
            </p>
            {!user && (
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: redirectTarget } })}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Go to login
              </button>
            )}
          </div>
        )} */}
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
