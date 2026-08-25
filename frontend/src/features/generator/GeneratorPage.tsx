/**
 * PRD 9.4 generator flow:
 *   Prompt -> Generation settings -> Generate -> Generation state -> Result
 *            -> Download / Regenerate
 *
 * On desktop the form and the result sit side by side so the result is visible
 * the moment it arrives. On mobile they stack, form first.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Alert } from "../../components/ui/Alert";
import { SparkIcon } from "../../components/ui/Icons";
import { TextArea } from "../../components/ui/TextArea";
import { api } from "../../lib/api";
import { formatSize } from "../../lib/format";
import type {
  GeneratedImage,
  GenerationOptions,
  ImageQuality,
  ImageSize,
} from "../../lib/types";
import { ImagePreviewDialog } from "../history/ImagePreviewDialog";
import { PromptGuide } from "./PromptGuide";
import { ResultPanel } from "./ResultPanel";
import { useGeneration } from "./useGeneration";

const MAX_PROMPT = 1000;
const MIN_PROMPT = 3;

const FALLBACK_OPTIONS: GenerationOptions = {
  sizes: [
    { value: "1024x1024", label: "Square", aspect: "1024 / 1024" },
    { value: "1024x1536", label: "Portrait", aspect: "1024 / 1536" },
    { value: "1536x1024", label: "Landscape", aspect: "1536 / 1024" },
  ],
  qualities: [
    { value: "standard", label: "Standard" },
    { value: "hd", label: "High detail" },
  ],
  provider: null,
  model: null,
};

/** "Square" reads better than the raw label the API sends for a size. */
const SIZE_LABELS: Record<ImageSize, string> = {
  "1024x1024": "Square",
  "1024x1536": "Portrait",
  "1536x1024": "Landscape",
};

interface RegenerateState {
  prompt?: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

export function GeneratorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // "Generate again" from the history gallery hands the prompt over in
  // router state rather than a query string, so the prompt never lands in a
  // URL or a browser history entry.
  const handoff = (location.state ?? null) as RegenerateState | null;

  const [prompt, setPrompt] = useState(handoff?.prompt ?? "");
  const [size, setSize] = useState<ImageSize>(handoff?.size ?? "1024x1024");
  const [quality, setQuality] = useState<ImageQuality>(handoff?.quality ?? "standard");
  const [options, setOptions] = useState<GenerationOptions>(FALLBACK_OPTIONS);
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [touched, setTouched] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { status, image, error, isGenerating, generate, dismissError } = useGeneration();

  useEffect(() => {
    if (!handoff?.prompt) return;
    // Consume the handoff so a refresh or a back-navigation does not re-apply
    // a prompt the user has since edited.
    navigate(location.pathname, { replace: true, state: null });
    promptRef.current?.focus();
  }, [handoff?.prompt, navigate, location.pathname]);

  useEffect(() => {
    let cancelled = false;
    api
      .options()
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch(() => {
        // The controls are still usable from the fallback list; the server
        // rejects anything it does not support, so nothing can go out of sync
        // silently.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = prompt.trim();
  const tooShort = touched && trimmed.length > 0 && trimmed.length < MIN_PROMPT;
  const empty = touched && trimmed.length === 0;
  const overLimit = prompt.length > MAX_PROMPT;

  const promptError = empty
    ? "Describe the image you want to generate."
    : tooShort
      ? `Add a little more detail (at least ${MIN_PROMPT} characters).`
      : overLimit
        ? `Prompts are limited to ${MAX_PROMPT} characters.`
        : (error?.fieldError("prompt") ?? null);

  const canSubmit = trimmed.length >= MIN_PROMPT && !overLimit && !isGenerating;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    await generate({ prompt: trimmed, size, quality });
  }, [canSubmit, generate, trimmed, size, quality]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) {
      promptRef.current?.focus();
      return;
    }
    void submit();
  }

  // Cmd/Ctrl + Enter submits from inside the textarea.
  function onPromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      setTouched(true);
      void submit();
    }
  }

  const counterTone =
    prompt.length > MAX_PROMPT
      ? "text-danger"
      : prompt.length > MAX_PROMPT * 0.9
        ? "text-warning"
        : "text-ink-muted";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl text-ink">Generate an image</h1>
        <p className="mt-1.5 text-base text-ink-secondary">
          Describe what you want to see. Chitra AI turns the description into an image.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-8">
        <Card tone="raised" className="h-fit">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <Field
              label="Describe your image"
              required
              error={promptError}
              hint="Be specific about subject, setting, lighting, and style."
              adornment={
                <span className={`text-xs tabular-nums ${counterTone}`}>
                  {prompt.length} / {MAX_PROMPT}
                </span>
              }
            >
              {({ id, describedBy, invalid }) => (
                <TextArea
                  id={id}
                  ref={promptRef}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  name="prompt"
                  value={prompt}
                  maxLength={MAX_PROMPT + 100}
                  placeholder="A futuristic city at sunset, seen from a rooftop, warm haze, cinematic wide shot"
                  onChange={(event) => setPrompt(event.target.value)}
                  onBlur={() => setTouched(true)}
                  onKeyDown={onPromptKeyDown}
                />
              )}
            </Field>

            <PromptGuide
              onUseExample={(example) => {
                setPrompt(example);
                promptRef.current?.focus();
              }}
            />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Image size</span>
                <SegmentedControl<ImageSize>
                  legend="Image size"
                  value={size}
                  onChange={setSize}
                  disabled={isGenerating}
                  options={options.sizes.map((option) => ({
                    value: option.value,
                    label: SIZE_LABELS[option.value] ?? option.label,
                    detail: formatSize(option.value),
                  }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Quality</span>
                <SegmentedControl<ImageQuality>
                  legend="Quality"
                  value={quality}
                  onChange={setQuality}
                  disabled={isGenerating}
                  options={options.qualities.map((option) => ({
                    value: option.value,
                    label: option.label,
                    detail: option.value === "hd" ? "Slower" : "Faster",
                  }))}
                />
              </div>
            </div>

            {error && error.status === 429 && (
              <Alert tone="warning" title="Slow down a moment">
                {error.message}
              </Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isGenerating}
              loadingLabel="Generating..."
              disabled={!canSubmit}
              icon={<SparkIcon size={17} />}
            >
              Generate image
            </Button>

            <p className="text-center text-xs text-ink-muted">
              Press <kbd className="font-mono">Ctrl</kbd> +{" "}
              <kbd className="font-mono">Enter</kbd> to generate
            </p>
          </form>
        </Card>

        <ResultPanel
          status={status}
          image={image}
          error={error && error.status !== 429 ? error : null}
          pendingSize={size}
          onRetry={() => void submit()}
          onDismissError={dismissError}
          onPreview={setPreview}
        />
      </div>

      <ImagePreviewDialog image={preview} onClose={() => setPreview(null)} />
    </>
  );
}
