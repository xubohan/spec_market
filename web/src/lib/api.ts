import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ApiResponse, Category, PaginatedSpecs, SpecDetail, Tag } from '../types/spec';

export class ApiRequestError extends Error {
  statusCode: number;
  statusMsg: string;

  constructor(statusCode: number, statusMsg: string) {
    super(statusMsg || `API error ${statusCode}`);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.statusMsg = statusMsg || `API error ${statusCode}`;
  }
}

/**
 * API base: defaults to '/specmarket/v1' for local dev with Vite proxy.
 * You can override via VITE_API_BASE (e.g., 'http://localhost:5000/specmarket/v1').
 */
export const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE || '/specmarket/v1';

/** Build URL with query params against API_BASE */
const buildUrl = (path: string, params?: Record<string, string | number | boolean | undefined | null>) => {
  const cleanPath = path.replace(/^\/+/, '');
  const url = new URL(`${API_BASE}/${cleanPath}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const extractApiData = async <T>(response: Response): Promise<T> => {
  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    if (!response.ok) {
      throw new ApiRequestError(response.status, `HTTP ${response.status}`);
    }
    throw new Error('Failed to parse API response');
  }

  if (!payload || typeof payload.status_code !== 'number') {
    throw new Error('Invalid API response payload');
  }

  const statusMsg = payload.status_msg ?? '';

  if (!response.ok) {
    throw new ApiRequestError(payload.status_code, statusMsg || `HTTP ${response.status}`);
  }

  if (payload.status_code !== 0) {
    throw new ApiRequestError(payload.status_code, statusMsg || `API error ${payload.status_code}`);
  }

  return payload.data;
};

/** Generic JSON fetcher that unwraps { status_code, status_msg, data } envelope */
async function fetchJson<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  const response = await fetch(buildUrl(path, params), { credentials: 'include' });
  return extractApiData<T>(response);
}

/** -------- Health & Ping (IMPORTANT: /healthz has NO /specmarket/v1 prefix) -------- */
const HEALTHZ_PATH = '/healthz';

/** GET /healthz (no API_BASE prefix) */
export async function healthz(): Promise<Record<string, unknown>> {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(HEALTHZ_PATH, base).toString();
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`healthz failed: ${r.status}`);
  // Some servers may return empty body; normalize to {}
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** GET /specmarket/v1/ping */
export async function ping(): Promise<Record<string, unknown>> {
  const r = await fetch(buildUrl('ping'), { credentials: 'include' });
  if (!r.ok) throw new Error(`ping failed: ${r.status}`);
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** -------------------- Queries -------------------- */

export type ListSpecParams = {
  page?: number;
  pageSize?: number;
  tag?: string;
  category?: string;
  order?: 'latest' | 'popular' | 'updated' | string;
  filter?: string;
  q?: string;
  updatedSince?: string;
};

/** List specs with pagination & filters */
export const useSpecs = (
  params: ListSpecParams,
  options?: UseQueryOptions<PaginatedSpecs>
) => {
  const queryKey = useMemo(() => ['specs', params], [params]);
  return useQuery({
    queryKey,
    queryFn: () => fetchJson<PaginatedSpecs>('listSpecs', params),
    ...options,
  });
};

/** Categories */
export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson<{ items: Category[] }>('listCategories'),
  });

/** Tags */
export const useTags = () =>
  useQuery({
    queryKey: ['tags'],
    queryFn: () => fetchJson<{ items: Tag[] }>('listTags'),
  });

/** Spec detail by shortId */
export const useSpecDetail = (shortId: string) =>
  useQuery({
    queryKey: ['spec', shortId],
    queryFn: () => fetchJson<SpecDetail>('getSpecDetail', { shortId }),
    enabled: Boolean(shortId),
  });

/** Specs by category */
export const useSpecsByCategory = (slug: string) =>
  useQuery({
    queryKey: ['category', slug],
    queryFn: () => fetchJson<PaginatedSpecs>('getCategorySpecs', { slug }),
    enabled: Boolean(slug),
  });

/** Specs by tag */
export const useSpecsByTag = (slug: string) =>
  useQuery({
    queryKey: ['tag', slug],
    queryFn: () => fetchJson<PaginatedSpecs>('getTagSpecs', { slug }),
    enabled: Boolean(slug),
  });

/** -------------------- Utilities -------------------- */

/** Download markdown as a file (opens new tab) */
export const downloadMarkdown = (shortId: string) => {
  window.open(buildUrl('downloadSpec', { shortId }), '_blank');
};

/** Copy raw markdown to clipboard */
export const copyMarkdown = async (shortId: string) => {
  const response = await fetch(buildUrl('getSpecRaw', { shortId }), { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch markdown');
  const text = await response.text();
  await navigator.clipboard.writeText(text);
  return text;
};

/** -------------------- Mutations -------------------- */

type UploadPayload = {
  token: string;          // Admin token (X-Admin-Token)
  formData: FormData;     // Must contain the file and metadata fields the backend expects
};

/** POST /specmarket/v1/uploadSpec */
export const useUploadSpec = () =>
  useMutation({
    mutationFn: async (payload: UploadPayload) => {
      const response = await fetch(buildUrl('uploadSpec'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Admin-Token': payload.token,
        },
        body: payload.formData,
      });
      return extractApiData<{ id: string; shortId: string }>(response);
    },
  });

type UpdateSpecPayload = {
  token: string;
  shortId: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  author: string;
  contentMd: string;
};

/** PUT /specmarket/v1/updateSpec */
export const useUpdateSpec = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateSpecPayload) => {
      const response = await fetch(buildUrl('updateSpec'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': payload.token,
        },
        body: JSON.stringify({
          shortId: payload.shortId,
          title: payload.title,
          summary: payload.summary,
          category: payload.category,
          tags: payload.tags,
          author: payload.author,
          contentMd: payload.contentMd,
        }),
      });
      return extractApiData<{ shortId: string; updatedAt: string }>(response);
    },
    onSuccess: (result, variables) => {
      const updatedAt = result.updatedAt;

      queryClient.setQueryData<SpecDetail>(['spec', variables.shortId], (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          title: variables.title,
          summary: variables.summary,
          category: variables.category,
          tags: variables.tags,
          author: variables.author,
          contentMd: variables.contentMd,
          updatedAt,
        };
      });

      queryClient.setQueriesData<PaginatedSpecs>({ queryKey: ['specs'] }, (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          items: previous.items.map((item) =>
            item.shortId === variables.shortId
              ? {
                  ...item,
                  title: variables.title,
                  summary: variables.summary,
                  category: variables.category,
                  tags: variables.tags,
                  author: variables.author,
                  updatedAt,
                }
              : item,
          ),
        };
      });

      queryClient.invalidateQueries({ queryKey: ['spec', variables.shortId] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    },
  });
};

/** Build app route (not API) for spec detail page */
export const buildSpecLink = (shortId: string) => `/specs/${shortId}`;

export type { Category, Tag, PaginatedSpecs, SpecDetail };
