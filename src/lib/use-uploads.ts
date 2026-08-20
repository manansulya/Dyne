"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export interface UploadedAttachment {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: string;
  url: string;
  scanStatus: string;
}

export interface UploadLimits {
  maxBytes: number;
  accept: string;
  types: Array<{ contentType: string; extension: string; kind: string; maxBytes: number }>;
}

export type UploadState = "uploading" | "done" | "error" | "canceled";

export interface UploadItem {
  /** Client-side id; stable across retries so the tray does not reorder. */
  localId: string;
  file: File;
  state: UploadState;
  /** 0-100, driven by real XHR upload progress events. */
  progress: number;
  error?: string;
  attachment?: UploadedAttachment;
}

interface UploadResponse {
  attachments?: UploadedAttachment[];
  error?: string;
}

/**
 * Uploads one file per request via XHR, because `fetch` cannot report upload
 * progress. The XHR is kept so the user can cancel an in-flight upload.
 */
function uploadFile(
  file: File,
  onProgress: (percent: number) => void
): { promise: Promise<UploadedAttachment>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadedAttachment>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", "/api/uploads");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      let body: UploadResponse = {};
      try {
        body = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        // fall through to the status-based error below
      }
      const attachment = body.attachments?.[0];
      if (xhr.status === 201 && attachment) {
        resolve(attachment);
      } else {
        reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export function useUploadLimits() {
  return useQuery<UploadLimits>({
    queryKey: ["upload-limits"],
    queryFn: async () => {
      const res = await fetch("/api/uploads");
      if (!res.ok) throw new Error("Could not load upload limits");
      return (await res.json()) as UploadLimits;
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Tracks a composer's pending uploads. Files are uploaded immediately and the
 * resulting attachment ids are handed to the message/post request, so a failed
 * send never loses the bytes and a failed upload never blocks the text.
 */
export function useUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const aborts = useRef(new Map<string, () => void>());
  const counter = useRef(0);

  const patch = useCallback((localId: string, next: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.localId === localId ? { ...i, ...next } : i)));
  }, []);

  const run = useCallback(
    async (localId: string, file: File) => {
      patch(localId, { state: "uploading", progress: 0, error: undefined });
      const { promise, abort } = uploadFile(file, (p) => patch(localId, { progress: p }));
      aborts.current.set(localId, abort);
      try {
        const attachment = await promise;
        patch(localId, { state: "done", progress: 100, attachment });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          patch(localId, { state: "canceled" });
        } else {
          patch(localId, {
            state: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      } finally {
        aborts.current.delete(localId);
      }
    },
    [patch]
  );

  const add = useCallback(
    (files: readonly File[]) => {
      for (const file of files) {
        counter.current += 1;
        const localId = `u${counter.current}`;
        setItems((prev) => [...prev, { localId, file, state: "uploading", progress: 0 }]);
        void run(localId, file);
      }
    },
    [run]
  );

  const cancel = useCallback((localId: string) => {
    aborts.current.get(localId)?.();
  }, []);

  const retry = useCallback(
    (localId: string) => {
      const item = items.find((i) => i.localId === localId);
      if (item) void run(localId, item.file);
    },
    [items, run]
  );

  /** Removes a tray entry; an already-stored attachment is deleted server-side. */
  const remove = useCallback((localId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item?.state === "uploading") aborts.current.get(localId)?.();
      if (item?.attachment) {
        void fetch(`/api/attachments/${item.attachment.id}`, { method: "DELETE" });
      }
      return prev.filter((i) => i.localId !== localId);
    });
  }, []);

  const clear = useCallback(() => {
    for (const abort of aborts.current.values()) abort();
    aborts.current.clear();
    setItems([]);
  }, []);

  useEffect(() => {
    const pending = aborts.current;
    return () => {
      for (const abort of pending.values()) abort();
    };
  }, []);

  const readyIds = items
    .filter((i) => i.state === "done" && i.attachment)
    .map((i) => i.attachment!.id);
  const isUploading = items.some((i) => i.state === "uploading");

  return { items, add, cancel, retry, remove, clear, readyIds, isUploading };
}
