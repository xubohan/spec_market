import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError, useDeleteSpec, useSpecDetail, useSpecVersion } from '../lib/api';
import { MarkdownView } from '../components/MarkdownView';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { DownloadButton } from '../components/DownloadButton';
import { useAuth } from '../lib/auth';
import { Calendar, Clock3, Edit3, Folder, Hash, History, Tag, Trash2, User } from 'lucide-react';

export const SpecDetailPage = () => {
  const { shortId = '' } = useParams();
  const { data, isLoading } = useSpecDetail(shortId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const deleteMutation = useDeleteSpec();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const redirectTarget = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );
  useEffect(() => {
    setActiveVersion(null);
  }, [shortId]);

  const targetVersion = useMemo(() => {
    if (!data || activeVersion === null) {
      return null;
    }
    if (activeVersion === data.version) {
      return null;
    }
    return activeVersion;
  }, [activeVersion, data]);

  const { data: versionData, isLoading: isVersionLoading } = useSpecVersion(shortId, targetVersion);
  const spec = versionData ?? data;
  const history = spec?.history ?? data?.history;
  const historyItems = history?.items ?? [];
  const latestVersion = history?.latestVersion ?? spec?.version ?? null;
  const archivedHistoryItems = useMemo(() => {
    if (!historyItems.length) {
      return [];
    }
    if (latestVersion === null) {
      return historyItems;
    }
    return historyItems.filter((item) => item.version !== latestVersion);
  }, [historyItems, latestVersion]);
  const totalHistoryCount = history?.total ?? historyItems.length;
  const normalizedAuthor = useMemo(
    () => (spec?.author ?? '').replace(/^@/, ''),
    [spec?.author],
  );
  const isOwner = useMemo(() => {
    if (!user || !spec) {
      return false;
    }
    if (spec.ownerId) {
      return spec.ownerId === user.id;
    }
    return normalizedAuthor === user.username;
  }, [user, spec, normalizedAuthor]);
  const isViewingHistory = Boolean(versionData && data && spec && spec.version !== data.version);
  const isVersionLoadingState = Boolean(targetVersion && isVersionLoading);

  if (isLoading) {
    return <p className="text-muted">Loading...</p>;
  }

  if (!data) {
    return <p className="text-muted">Spec not found.</p>;
  }

  const handleDelete = async () => {
    if (!spec) {
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
      await deleteMutation.mutateAsync({ shortId: spec.shortId });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage({ type: 'error', text: error.statusMsg });
      } else {
        setMessage({ type: 'error', text: (error as Error).message });
      }
    }
  };

  if (!spec) {
    return <p className="text-muted">Spec not found.</p>;
  }

  const formattedUpdatedAt = new Date(spec.updatedAt).toLocaleString();
  const formattedCreatedAt = new Date(spec.createdAt).toLocaleString();
  const editPath = `/specs/${spec.shortId}/edit`;
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
  const handleCopyShortId = async () => {
    if (!spec) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(spec.shortId);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = spec.shortId;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setMessage({ type: 'success', text: 'Short ID copied to clipboard.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy short ID.' });
    }
  };
  const handleSelectVersion = (version: number) => {
    if (latestVersion !== null && version === latestVersion) {
      setActiveVersion(null);
      return;
    }
    setActiveVersion(version);
  };
  const handleViewLatest = () => {
    setActiveVersion(null);
  };
  const activeHistoryVersion = isViewingHistory ? spec.version : activeVersion;

  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-6">
        <header className="rounded-3xl border border-muted/20 bg-white/90 p-8 shadow-lg">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-text">{spec.title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/10 px-3 py-1 text-[0.65rem] font-medium text-muted">
                <History className="h-3 w-3 text-primary" aria-hidden /> Version {spec.version}
              </span>
              <div className="flex items-center gap-2">
                {latestVersion ? (
                  <button
                    type="button"
                    onClick={handleViewLatest}
                    disabled={!isViewingHistory}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.65rem] font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      isViewingHistory
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'cursor-default bg-muted/10 text-muted'
                    }`}
                    aria-label={
                      isViewingHistory
                        ? `View latest version ${latestVersion}`
                        : `Latest version ${latestVersion}`
                    }
                  >
                    LATEST VERSION {latestVersion}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <MarkdownView markdown={spec.contentMd} />
      </article>
      <aside className="space-y-6">
        <div className="rounded-3xl border border-muted/20 bg-white/90 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Actions</h3>
            <div className="flex flex-wrap items-center gap-2">
              <CopyMarkdownButton shortId={spec.shortId} />
              <DownloadButton shortId={spec.shortId} />
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
                : `Only ${spec.author} can edit or delete this spec.`}
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
              <dd className="font-medium text-text">{spec.author}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Hash className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Short ID</dt>
              </div>
              <dd>
                <button
                  type="button"
                  onClick={handleCopyShortId}
                  className="w-full break-all rounded-xl px-2 py-1 text-left font-mono text-xs text-text transition hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {spec.shortId}
                </button>
              </dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Folder className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Category</dt>
              </div>
              <dd className="font-medium capitalize text-text">{spec.category}</dd>
            </div>
            <div className="flex h-full flex-col gap-1 rounded-2xl border border-muted/10 bg-white/70 p-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted">
                <Tag className="h-4 w-4 text-primary" aria-hidden />
                <dt className="text-xs font-semibold uppercase tracking-wide">Tags</dt>
              </div>
              <dd className="flex flex-wrap gap-1 text-xs text-muted">
                {spec.tags.length > 0 ? (
                  spec.tags.map((tag) => (
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
        {historyItems.length > 0 ? (
          <div className="rounded-3xl border border-muted/20 bg-white/90 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">History</h3>
              {totalHistoryCount > 0 ? (
                <span className="rounded-full bg-muted/10 px-2 py-0.5 text-[0.65rem] font-medium text-muted">
                  {totalHistoryCount} {totalHistoryCount === 1 ? 'version' : 'versions'}
                </span>
              ) : null}
            </div>
            {archivedHistoryItems.length > 0 ? (
              <ul className="mt-4 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '9.5rem' }}>
                {archivedHistoryItems.map((item) => {
                  const isActive = activeHistoryVersion === item.version;
                  return (
                    <li
                      key={item.version}
                      className={`rounded-2xl border bg-white/80 p-3 shadow-sm transition ${
                        isActive ? 'border-primary/40 bg-primary/5 text-primary' : 'border-muted/20 text-muted'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectVersion(item.version)}
                        className="flex w-full flex-col items-start gap-1 text-left"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-text">
                          Version {item.version}
                          {latestVersion !== null && item.version === latestVersion ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                              Latest
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[0.65rem] text-muted">{new Date(item.updatedAt).toLocaleString()}</span>
                        <span className="text-[0.65rem] text-muted/80">{item.summary || 'No summary'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-muted">No previous versions yet.</p>
            )}
          </div>
        ) : null}
      </aside>
    </section>
  );
};
