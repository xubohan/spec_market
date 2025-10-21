import { FormEvent, useState } from 'react';
import clsx from 'clsx';

import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

type Mode = 'login' | 'register';

type AuthCardProps = {
  title?: string;
  description?: string;
  className?: string;
};

export const AuthCard: React.FC<AuthCardProps> = ({
  title = 'Account Access',
  description = 'Sign in or create an account to manage specs.',
  className,
}) => {
  const { user, isLoading, login, register, logout } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const normalizedUsername = username.trim();
      if (!normalizedUsername) {
        setError('Username is required.');
        setPending(false);
        return;
      }
      if (mode === 'login') {
        await login({ username: normalizedUsername, password });
      } else {
        await register({ username: normalizedUsername, password });
      }
      setUsername('');
      setPassword('');
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError(cause.statusMsg);
      } else {
        setError((cause as Error).message);
      }
    } finally {
      setPending(false);
    }
  };

  const actionLabel = mode === 'login' ? 'Sign In' : 'Create Account';

  return (
    <section className={clsx('rounded-2xl bg-card p-5 shadow-sm', className)}>
      <header className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted">Checking session…</p>
      ) : user ? (
        <div className="flex flex-col gap-3 rounded-xl border border-muted/20 bg-white/80 p-4">
          <div>
            <p className="text-sm font-medium text-text">Logged in as</p>
            <p className="font-semibold text-primary">{user.username}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={clsx(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                mode === 'login'
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-muted/30 bg-white text-muted hover:border-primary/40 hover:text-text',
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={clsx(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                mode === 'register'
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-muted/30 bg-white text-muted hover:border-primary/40 hover:text-text',
              )}
            >
              Register
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete={mode === 'login' ? 'username' : 'new-username'}
                required
                minLength={3}
                className="rounded-lg border border-muted/30 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                className="rounded-lg border border-muted/30 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? `${actionLabel}…` : actionLabel}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-muted">
              Password must be at least 8 characters. Usernames are case-sensitive.
            </p>
          </form>
        </div>
      )}
    </section>
  );
};
