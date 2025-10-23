export const SpecCardSkeleton = () => (
  <div className="animate-pulse rounded-2xl bg-card p-5 shadow-sm">
    <div className="h-6 w-3/4 rounded bg-muted/20" />
    <div className="mt-3 h-4 w-full rounded bg-muted/10" />
    <div className="mt-3 flex gap-2">
      <div className="h-6 w-16 rounded-full bg-muted/20" />
      <div className="h-6 w-16 rounded-full bg-muted/20" />
    </div>
  </div>
);

export const GridSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-6 md:grid-cols-2">
    {Array.from({ length: count }).map((_, idx) => (
      <SpecCardSkeleton key={idx} />
    ))}
  </div>
);
