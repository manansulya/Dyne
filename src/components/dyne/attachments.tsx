"use client";

import { useRef, useState } from "react";
import { Paperclip, X, RotateCcw, FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useUploadLimits, type UploadItem, type UploadedAttachment } from "@/lib/use-uploads";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** File picker button; the accepted types come from the server's allowlist. */
export function AttachButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: limits } = useUploadLimits();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={limits?.accept}
        className="hidden"
        data-testid="attachment-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label="Attach files"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
}

/** Wraps a composer so files can be dropped anywhere inside it. */
export function DropZone({
  onFiles,
  children,
  className,
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn(className, over && "ring-2 ring-primary/60 rounded-md")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(files);
      }}
    >
      {children}
    </div>
  );
}

/** Pending uploads with real progress, cancel and retry. */
export function UploadTray({
  items,
  onCancel,
  onRetry,
  onRemove,
}: {
  items: readonly UploadItem[];
  onCancel: (localId: string) => void;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 pb-2" data-testid="upload-tray">
      {items.map((item) => (
        <div
          key={item.localId}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate">{item.file.name}</span>
              <span className="text-muted-foreground shrink-0">
                {formatBytes(item.file.size)}
              </span>
            </div>
            {item.state === "uploading" && (
              <Progress value={item.progress} className="mt-1 h-1" />
            )}
            {item.state === "error" && (
              <span className="mt-0.5 flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3 w-3" />
                {item.error}
              </span>
            )}
            {item.state === "canceled" && (
              <span className="text-muted-foreground">Canceled</span>
            )}
          </div>
          {item.state === "uploading" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCancel(item.localId)}
            >
              Cancel
            </Button>
          )}
          {(item.state === "error" || item.state === "canceled") && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retry upload"
              onClick={() => onRetry(item.localId)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove attachment"
            onClick={() => onRemove(item.localId)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders stored attachments. Media is previewed from the authorized content
 * route; everything else is a download link, since the route forces
 * `Content-Disposition: attachment` for non-media types.
 */
export function AttachmentList({
  attachments,
}: {
  attachments: readonly UploadedAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5" data-testid="attachment-list">
      {attachments.map((a) => (
        <Attachment key={a.id} attachment={a} />
      ))}
    </div>
  );
}

function Attachment({ attachment }: { attachment: UploadedAttachment }) {
  const { kind, url, filename, byteSize } = attachment;
  if (kind === "IMAGE") {
    return (
      // Attachment dimensions are unknown until the bytes load, so a plain img
      // avoids next/image layout constraints on user content.
      <img src={url} alt={filename} className="max-h-72 rounded-md border border-border" />
    );
  }
  if (kind === "VIDEO") {
    return <video src={url} controls className="max-h-72 rounded-md border border-border" />;
  }
  if (kind === "AUDIO") {
    return <audio src={url} controls className="w-full max-w-sm" />;
  }
  return (
    <a
      href={`${url}?disposition=attachment`}
      className="flex w-fit items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs hover:bg-muted"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="truncate max-w-[16rem]">{filename}</span>
      <span className="text-muted-foreground">{formatBytes(byteSize)}</span>
    </a>
  );
}
