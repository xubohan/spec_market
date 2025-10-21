export type SpecSummary = {
  id: string;
  title: string;
  shortId: string;
  summary: string;
  category: string;
  tags: string[];
  author: string;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type SpecHistoryItem = {
  shortId: string;
  version: number;
  title: string;
  summary: string;
  author: string;
  updatedAt: string;
};

export type SpecHistory = {
  latestVersion: number;
  items: SpecHistoryItem[];
  total: number;
};

export type SpecDetail = SpecSummary & {
  contentMd: string;
  isLatest: boolean;
  history: SpecHistory;
};

export type PaginatedSpecs = {
  total: number;
  page: number;
  pageSize: number;
  items: SpecSummary[];
};

export type Category = {
  name: string;
  slug: string;
  count: number;
};

export type Tag = Category;

export type ApiResponse<T> = {
  status_code: number;
  status_msg: string;
  data: T;
};

export type ApiError = {
  status_code: number;
  status_msg: string;
};
