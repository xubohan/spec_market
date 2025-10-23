import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const SearchBar = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  useEffect(() => {
    const author = params.get('author');
    if (author) {
      setValue(`@${author}`);
      return;
    }
    setValue(params.get('q') || '');
  }, [params]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const trimmed = value.trim();
    const isAuthorQuery = trimmed.startsWith('@');

    next.delete('author');

    if (trimmed) {
      if (isAuthorQuery) {
        const authorValue = trimmed.replace(/^@+/, '');
        if (authorValue) {
          next.set('author', authorValue);
          next.delete('q');
        } else {
          next.delete('q');
        }
      } else {
        next.set('q', trimmed);
      }
    } else {
      next.delete('q');
    }
    navigate({ pathname: '/', search: next.toString() });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <input
        className="w-full rounded-2xl border border-muted/20 bg-card px-6 py-4 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Search title, tags, or @author"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search specifications"
      />
    </form>
  );
};
