/**
 * The result area, which owns four of the states from PRD 9.10:
 * empty (9.5), loading (9.6), error (9.7), and success (FR-07).
 *
 * The panel reserves the aspect ratio of the requested size before the image
 * exists, so the layout does not jump when it arrives.
 */

import { useState } from "react";

import { Alert } from "../../components/ui/Alert";
import { Button, IconButton } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  DownloadIcon,
  ExpandIcon,
  ImageIcon,
  RefreshIcon,
} from "../../components/ui/Icons";
import { Spinner } from "../../components/ui/Spinner";
import { ApiError } from "../../lib/api";
import { downloadImage } from "../../lib/download";
import { formatBytes, formatDate, formatSize } from "../../lib/format";
import type { GeneratedImage, ImageSize } from "../../lib/types";
import { useToast } from "../../components/ui/Toast";
import type { GenerationStatus } from "./useGeneration";

interface ResultPanelProps {
  status: GenerationStatus;
  image: GeneratedImage | null;
  error: ApiError | null;
  /** Size currently selected, used to reserve space before a result exists. */
  pendingSize: ImageSize;
  onRetry: () => void;
  onDismissError: () => void;
  onPreview: (image: GeneratedImage) => void;
}

function aspectFor(size: string) {
  const [width, height] = size.split("x");
  return `${width} / ${height}`;
}

export function ResultPanel({
  status,
  image,
  error,
  pendingSize,
  onRetry,
  onDismissError,
  onPreview,
}: ResultPanelProps) {
  const { notify } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const aspect = aspectFor(image && status !== "generating" ? image.size : pendingSize);

  async function onDownload() {
    if (!image) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadImage(image.image_url, image.download_filename);
      notify("Image downloaded.");
    } catch {
      setDownloadError("Could not download the image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="result-heading" className="text-lg text-ink">
          Result
        </h2>
        {image && status === "success" && (
          <span className="text-sm text-ink-muted">{formatDate(image.created_at)}</span>
        )}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-line bg-inset"
        style={{ aspectRatio: aspect }}
        aria-live="polite"
        aria-busy={status === "generating"}
      >
        {status === "generating" && <GeneratingOverlay hasPrevious={Boolean(image)} />}

        {image ? (
          <>
            <img
              src={image.image_url}
              alt={`Generated image: ${image.prompt}`}
              width={image.width}
              height={image.height}
              className={[
                "h-full w-full object-contain transition-opacity duration-[360ms] ease-chitra",
                status === "generating" ? "opacity-25" : "opacity-100",
              ].join(" ")}
            />
            {status !== "generating" && (
              <div className="absolute right-3 top-3">
                <IconButton
                  label="View full size"
                  variant="secondary"
                  size="sm"
                  onClick={() => onPreview(image)}
                >
                  <ExpandIcon size={15} />
                </IconButton>
              </div>
            )}
          </>
        ) : status !== "generating" ? (
          <EmptyState
            className="h-full"
            icon={<ImageIcon size={20} />}
            title="Your generated image will appear here"
            description="Describe an image on the left, choose a size, and select Generate image."
          />
        ) : null}
      </div>

      {status === "error" && error && (
        <Alert
          tone="error"
          title="Could not generate the image."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={onRetry} icon={<RefreshIcon size={15} />}>
                Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismissError}>
                Dismiss
              </Button>
            </div>
          }
        >
          {error.message}
        </Alert>
      )}

      {image && status === "success" && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 sm:grid-cols-4">
            <Detail term="Size" value={formatSize(image.size)} />
            <Detail term="Quality" value={image.quality === "hd" ? "High detail" : "Standard"} />
            <Detail term="Model" value={image.model.split("/").pop() ?? image.model} />
            <Detail term="File" value={formatBytes(image.byte_size) || "PNG"} />
          </dl>

          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">Prompt </span>
            {image.prompt}
          </p>

          {downloadError && <Alert tone="error">{downloadError}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void onDownload()}
              loading={downloading}
              loadingLabel="Preparing..."
              icon={<DownloadIcon size={16} />}
            >
              Download
            </Button>
            <Button variant="ghost" onClick={onRetry} icon={<RefreshIcon size={16} />}>
              Regenerate
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-[0.04em] text-ink-muted">{term}</dt>
      <dd className="truncate text-sm text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function GeneratingOverlay({ hasPrevious }: { hasPrevious: boolean }) {
  return (
    <div
      className={[
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
        hasPrevious ? "bg-inset/75 backdrop-blur-[3px]" : "chitra-shimmer bg-inset",
      ].join(" ")}
    >
      <Spinner size={22} label={null} />
      <div className="text-center">
        <p className="text-base font-semibold text-ink">Generating image</p>
        <p className="mt-0.5 text-sm text-ink-secondary">
          Creating your visual. This usually takes a few seconds.
        </p>
      </div>
    </div>
  );
}
