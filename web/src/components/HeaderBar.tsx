import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import clsx from 'clsx';

const filters = [
  { label: 'Today', value: 'today' },
  { label: 'Latest', value: 'latest' },
];

export const HeaderBar = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const active = params.get('filter') || 'latest';

  const handleFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'latest') {
      next.delete('filter');
    } else {
      next.set('filter', value);
    }
    navigate({ pathname: '/', search: next.toString() });
  };

  const showFilters = location.pathname === '/';

  return (
    <div className="flex flex-col items-center gap-4">
      <SearchBar />
      {showFilters && (
        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleFilter(filter.value)}
              className={clsx(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                active === filter.value
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-card text-muted shadow-sm hover:bg-primary/10'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
