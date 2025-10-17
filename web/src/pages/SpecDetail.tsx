import { useParams } from 'react-router-dom';
import { useSpecDetail } from '../lib/api';
import { MarkdownView } from '../components/MarkdownView';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { DownloadButton } from '../components/DownloadButton';
import { Toc } from '../components/Toc';

export const SpecDetailPage = () => {
  const { shortId = '' } = useParams();
  const { data, isLoading } = useSpecDetail(shortId);

  if (isLoading) {
    return <p className="text-muted">Loading...</p>;
  }

  if (!data) {
    return <p className="text-muted">Spec not found.</p>;
  }

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
        <MarkdownView markdown={data.contentMd} html={data.contentHtml} />
      </article>
      <aside className="space-y-6">
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted">Actions</h3>
          <div className="mt-4 flex flex-col gap-2">
            <CopyMarkdownButton shortId={data.shortId} />
            <DownloadButton shortId={data.shortId} />
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
        <Toc items={data.toc} />
      </aside>
    </section>
  );
};
