export type SpecSummary = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  tags: string[];
  updatedAt: string;
  version: number;
};

export type TocItem = {
  text: string;
  id: string;
  level: number;
};

export type SpecDetail = SpecSummary & {
  contentHtml?: string;
  contentMd?: string;
  toc?: TocItem[];
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
