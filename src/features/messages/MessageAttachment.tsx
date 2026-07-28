import {
  useEffect,
  useState,
} from "react";

import {
  downloadAttachment,
  getAttachmentSignedUrl,
} from "./attachmentService";

import type {
  ChatAttachment,
} from "./types";

type MessageAttachmentProps = {
  attachment: ChatAttachment;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function getAttachmentIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return "📄";
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes("document")
  ) {
    return "📝";
  }

  if (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet")
  ) {
    return "📊";
  }

  if (
    mimeType.includes("powerpoint") ||
    mimeType.includes("presentation")
  ) {
    return "📽️";
  }

  if (mimeType.includes("zip")) {
    return "🗜️";
  }

  if (mimeType.startsWith("text/")) {
    return "📃";
  }

  return "📎";
}

export default function MessageAttachment({
  attachment,
}: MessageAttachmentProps) {
  const [signedUrl, setSignedUrl] =
    useState<string | null>(null);

  const [isLoadingPreview, setIsLoadingPreview] =
    useState(false);

  const [isDownloading, setIsDownloading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const isImage =
    attachment.mime_type.startsWith("image/");

  useEffect(() => {
    if (!isImage) {
      return;
    }

    let isActive = true;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setError(null);

      try {
        const url =
          await getAttachmentSignedUrl(
            attachment.storage_path,
          );

        if (isActive) {
          setSignedUrl(url);
        }
      } catch (previewError) {
        console.error(
          "Errore anteprima allegato:",
          previewError,
        );

        if (isActive) {
          setError(
            "Anteprima non disponibile.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [
    attachment.storage_path,
    isImage,
  ]);

  async function handleDownload() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      await downloadAttachment(
        attachment.storage_path,
        attachment.original_name,
      );
    } catch (downloadError) {
      console.error(
        "Errore download allegato:",
        downloadError,
      );

      setError(
        "Download del file non riuscito.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  if (isImage) {
    return (
      <div className="message-attachment message-attachment--image">
        <button
          type="button"
          className="message-attachment__image-button"
          onClick={handleDownload}
          disabled={
            isDownloading ||
            isLoadingPreview ||
            !signedUrl
          }
          aria-label={`Scarica ${attachment.original_name}`}
          title={`Scarica ${attachment.original_name}`}
        >
          {signedUrl ? (
            <img
              className="message-attachment__image"
              src={signedUrl}
              alt={attachment.original_name}
              loading="lazy"
            />
          ) : (
            <div className="message-attachment__image-placeholder">
              {isLoadingPreview
                ? "Caricamento..."
                : "🖼️"}
            </div>
          )}

          {isDownloading && (
            <span className="message-attachment__overlay">
              Download...
            </span>
          )}
        </button>

        <div className="message-attachment__image-info">
          <span
            className="message-attachment__name"
            title={attachment.original_name}
          >
            {attachment.original_name}
          </span>

          <span className="message-attachment__size">
            {formatFileSize(
              attachment.file_size,
            )}
          </span>
        </div>

        {error && (
          <p className="message-attachment__error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="message-attachment message-attachment--file">
      <button
        type="button"
        className="message-attachment__file-button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Scarica ${attachment.original_name}`}
        title={`Scarica ${attachment.original_name}`}
      >
        <span
          className="message-attachment__file-icon"
          aria-hidden="true"
        >
          {getAttachmentIcon(
            attachment.mime_type,
          )}
        </span>

        <span className="message-attachment__file-info">
          <strong
            className="message-attachment__name"
            title={attachment.original_name}
          >
            {attachment.original_name}
          </strong>

          <span className="message-attachment__size">
            {formatFileSize(
              attachment.file_size,
            )}
          </span>
        </span>

        <span
          className="message-attachment__download"
          aria-hidden="true"
        >
          {isDownloading ? "…" : "↓"}
        </span>
      </button>

      {error && (
        <p className="message-attachment__error">
          {error}
        </p>
      )}
    </div>
  );
}