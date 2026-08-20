"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && (data.error || data.message)) || "Something went wrong. Please try again."
    );
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};

export function useApiMutation<TArgs, TRes>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  opts: {
    invalidate?: string[];
    successMessage?: string;
    errorMessage?: string;
    onMutate?: (args: TArgs) => void | Promise<void>;
    onSuccess?: (res: TRes, args: TArgs) => void;
    onError?: (err: Error, args: TArgs) => void;
  } = {}
) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TArgs>({
    mutationFn: async (args: TArgs) => {
      if (method === "POST") return api.post<TRes>(url, args as unknown);
      if (method === "PATCH") return api.patch<TRes>(url, args as unknown);
      return api.delete<TRes>(url);
    },
    onMutate: opts.onMutate as any,
    onSuccess: (res, args) => {
      if (opts.successMessage) toast.success(opts.successMessage);
      for (const key of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: [key] });
      opts.onSuccess?.(res, args);
    },
    onError: (err, args) => {
      toast.error(opts.errorMessage ?? err.message ?? "Something went wrong");
      opts.onError?.(err, args);
    },
  });
}

export function useApiQuery<T>(key: string[] | string, url: string | null) {
  return useQuery<T>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => api.get<T>(url as string),
    enabled: Boolean(url),
  });
}

export { useQuery, useMutation, useQueryClient };
