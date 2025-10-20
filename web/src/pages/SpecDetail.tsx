import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError, useDeleteSpec, useSpecDetail } from '../lib/api';
import { MarkdownView } from '../components/MarkdownView';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { DownloadButton } from '../components/DownloadButton';
import { useAdminToken } from '../lib/auth';

export const SpecDetailPage = () => {
  const { shortId = '' } = useParams();
  const { data, isLoading } = useSpecDetail(shortId);
  const navigate = useNavigate();
  const { token } = useAdminToken();
  const deleteMutation = useDeleteSpec();
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage('Please save your Admin-Token before deleting this spec.');
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
        setMessage(error.statusMsg);
      } else {
        setMessage((error as Error).message);
      }
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">{data.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <MarkdownView markdown={data.contentMd} />
      </article>
      <aside className="space-y-6">
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted">Actions</h3>
          <div className="mt-4 flex flex-col gap-2">
            <CopyMarkdownButton shortId={data.shortId} />
            <DownloadButton shortId={data.shortId} />
            <Link
              to={`/specs/${data.shortId}/edit`}
              className="rounded-lg border border-primary px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Edit Spec
            </Link>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Spec'}
            </button>
            {message && <p className="text-xs text-red-600">{message}</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted">Meta</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Author</dt>
              <dd className="font-medium">{data.author}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Short ID</dt>
              <dd className="font-mono text-xs">{data.shortId}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Category</dt>
              <dd className="font-medium capitalize">{data.category}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tags</dt>
              <dd className="text-right text-muted">{data.tags.join(', ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Updated</dt>
              <dd>{new Date(data.updatedAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Created</dt>
              <dd>{new Date(data.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </section>
  );
};
