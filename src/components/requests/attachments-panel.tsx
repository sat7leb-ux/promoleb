'use client';

import { useRef, useState } from 'react';
import {
  Download,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  Video,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  uploadAttachmentAction,
  deleteAttachmentAction,
  getAttachmentUrlAction,
} from '@/lib/actions/attachments';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { AttachmentWithUser } from '@/lib/queries/details';

interface Props {
  attachments: AttachmentWithUser[];
  canUpload: boolean;
  canDelete: boolean;
  requestId: string;
  onError: (message: string) => void;
}

const ICONS = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  other: FileIcon,
};

export function AttachmentsPanel({
  attachments,
  canUpload,
  canDelete,
  requestId,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AttachmentWithUser | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadAttachmentAction(requestId, formData);

      if (result.ok) toast.success(`${result.data.name} uploaded`);
      else onError(result.error);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function download(attachment: AttachmentWithUser) {
    setDownloadingId(attachment.id);
    const result = await getAttachmentUrlAction(attachment.id);
    setDownloadingId(null);

    if (result.ok) {
      // Opens in a new tab and triggers the browser's download handling.
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } else {
      onError(result.error);
    }
  }

  /** Opens a signed URL in a new tab. Used for both image preview and download. */
  async function openPreviewUrl(attachment: AttachmentWithUser) {
    const result = await getAttachmentUrlAction(attachment.id);
    if (result.ok) window.open(result.data.url, '_blank', 'noopener,noreferrer');
    else onError(result.error);
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
          className="rounded-xl border-2 border-dashed bg-card p-6 text-center transition-colors hover:border-primary/50"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
            onChange={(e) => void handleFiles(e.target.files)}
            className="sr-only"
            id={`upload-${requestId}`}
          />
          <div className="flex flex-col items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {uploading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-5" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-sm font-medium">
                {uploading ? 'Uploading…' : 'Drag files here or browse'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Images, video, PDFs, documents and archives up to 25 MB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Choose files
            </Button>
          </div>
        </div>
      )}

      {attachments.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="size-6" />}
          title="No files attached"
          description={
            canUpload
              ? 'Upload promo images, graphics, scripts and reference documents.'
              : 'Nobody has uploaded files to this request.'
          }
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment, index) => {
            const Icon = ICONS[attachment.kind as keyof typeof ICONS] ?? FileIcon;
            const isImage = attachment.kind === 'image';

            return (
              <motion.li
                key={attachment.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                  {isImage ? (
                    <ImageIcon className="size-5" aria-hidden />
                  ) : (
                    <Icon className="size-5" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={attachment.file_name}>
                    {attachment.file_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatBytes(attachment.size_bytes)} · {attachment.user?.full_name ?? 'Unknown'}
                    {' · '}
                    {formatDateTime(attachment.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      isImage ? void openPreviewUrl(attachment) : void download(attachment)
                    }
                    aria-label={`${isImage ? 'Preview' : 'Download'} ${attachment.file_name}`}
                    disabled={downloadingId === attachment.id}
                  >
                    {downloadingId === attachment.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isImage ? (
                      <ImageIcon className="size-3.5" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                  </Button>

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingDelete(attachment)}
                      aria-label={`Delete ${attachment.file_name}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this file?"
        description={`${pendingDelete?.file_name ?? 'This file'} will be permanently removed from storage. This cannot be undone.`}
        confirmLabel="Delete file"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return { ok: false, error: 'Nothing selected' };
          const result = await deleteAttachmentAction(pendingDelete.id);
          setPendingDelete(null);
          return result;
        }}
      />
    </div>
  );
}