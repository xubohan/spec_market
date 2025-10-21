import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../lib/auth';

export const LoginPage = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTarget = useMemo(() => {
    const state = location.state as { from?: string } | null;
    const target = state?.from && state.from !== '/login' ? state.from : '/';
    return target;
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isLoading, user, navigate, redirectTarget]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Account access</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in or create an account to upload, edit, and delete your specs.
        </p>
      </div>
      <AuthCard className="shadow-sm" />
    </div>
  );
};
