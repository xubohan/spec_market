import { useTags } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeletons';
import { Link } from 'react-router-dom';

export const TagsPage = () => {
  const { data, isLoading } = useTags();

  // ✅ 兼容数组与对象形式
  const list = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tags</h1>
      {isLoading && <GridSkeleton count={4} />}
      {!isLoading && list.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {list.map((tag) => (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-primary/10"
            >
              #{tag.name} ({tag.count})
            </Link>
          ))}
        </div>
      )}
      {!isLoading && list.length === 0 && <EmptyState message="No tags available." />}
    </section>
  );
};
