import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../lib/auth';

export const AppTopBar = () => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const redirectTarget = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-end">
        <span className="text-sm text-muted">Checking session…</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3 rounded-full border border-muted/30 bg-white/80 px-4 py-2 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Signed in</span>
          <span className="text-sm font-semibold text-primary">@{user.username}</span>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end">
      <Link
        to="/login"
        state={{ from: redirectTarget }}
        className="rounded-lg border border-primary/40 bg-white/80 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-white"
      >
        Sign in
      </Link>
    </div>
  );
};
