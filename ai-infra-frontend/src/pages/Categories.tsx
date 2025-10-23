import { useCategories } from '../lib/api';
import { CategoryBadge } from '../components/CategoryBadge';
import { GridSkeleton } from '../components/Skeletons';
import { EmptyState } from '../components/EmptyState';

export const CategoriesPage = () => {
  const { data, isLoading } = useCategories();

  // ✅ 兼容两种情况：数组 或 { items: [...] }
  const list = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      {isLoading && <GridSkeleton count={4} />}
      {!isLoading && list.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((category) => (
            <CategoryBadge key={category.slug} category={category} />
          ))}
        </div>
      )}
      {!isLoading && list.length === 0 && <EmptyState message="No categories found." />}
    </section>
  );
};
