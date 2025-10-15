import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AdminTokenContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const AdminTokenContext = createContext<AdminTokenContextValue | undefined>(undefined);

const STORAGE_KEY = 'spec-market-admin-token';

export const AdminTokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTokenState(stored);
    }
  }, []);

  const setToken = (value: string | null) => {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setTokenState(value);
  };

  const value = useMemo(() => ({ token, setToken }), [token]);

  return <AdminTokenContext.Provider value={value}>{children}</AdminTokenContext.Provider>;
};

export const useAdminToken = () => {
  const ctx = useContext(AdminTokenContext);
  if (!ctx) {
    throw new Error('useAdminToken must be used within AdminTokenProvider');
  }
  return ctx;
};
