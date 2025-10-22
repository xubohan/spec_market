import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSpecs } from '../lib/api';
import { GridSkeleton } from '../components/Skeletons';
import { SpecCard } from '../components/SpecCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';

export const HomePage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page') || '1');
  const filter = params.get('filter') || undefined;
  const search = params.get('q') || undefined;
  const author = params.get('author') || undefined;

  const queryParams = useMemo(
    () => ({ page, pageSize: 6, order: '-updatedAt', filter, q: search, author }),
    [page, filter, search, author]
  );
  const { data, isLoading } = useSpecs(queryParams);

  const specs = useMemo(() => data?.items ?? [], [data]);

  const handlePageChange = (next: number) => {
    const newParams = new URLSearchParams(params);
    newParams.set('page', String(next));
    navigate({ pathname: '/', search: newParams.toString() });
  };

  return (
    <section className="flex flex-col gap-6">
      {isLoading && <GridSkeleton count={6} />}
      {!isLoading && specs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {specs.map((spec) => (
            <SpecCard key={spec.shortId} spec={spec} />
          ))}
        </div>
      )}
      {!isLoading && specs.length === 0 && <EmptyState message="No specifications found." />}
      {data && data.total > data.pageSize && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={handlePageChange} />
      )}
    </section>
  );
};
