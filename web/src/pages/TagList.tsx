import { useParams } from 'react-router-dom';
import { useSpecsByTag } from '../lib/api';
import { GridSkeleton } from '../components/Skeletons';
import { SpecCard } from '../components/SpecCard';
import { EmptyState } from '../components/EmptyState';

export const TagListPage = () => {
  const { slug = '' } = useParams();
  const { data, isLoading } = useSpecsByTag(slug);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold capitalize">#{slug}</h1>
        <p className="text-sm text-muted">{data?.total ?? 0} specs</p>
      </div>
      {isLoading && <GridSkeleton count={4} />}
      {!isLoading && data?.items?.length && (
        <div className="grid gap-6 md:grid-cols-2">
          {data.items.map((spec) => (
            <SpecCard key={spec.id} spec={spec} />
          ))}
        </div>
      )}
      {!isLoading && !data?.items?.length && <EmptyState message="No specs tagged here." />}
    </section>
  );
};
