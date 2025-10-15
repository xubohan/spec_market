import clsx from 'clsx';

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

export const Pagination = ({ page, pageSize, total, onChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg px-3 py-2 text-sm text-muted disabled:opacity-50"
      >
        Prev
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={clsx(
              'h-8 w-8 rounded-lg text-sm font-semibold transition',
              p === page ? 'bg-primary text-white' : 'bg-card text-muted hover:bg-primary/10'
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-lg px-3 py-2 text-sm text-muted disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
};
