export type AuthUser = {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: AuthUser | null;
};

export type AuthCredentials = {
  username: string;
  password: string;
};
