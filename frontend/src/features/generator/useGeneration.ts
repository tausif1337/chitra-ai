/**
 * Generation state machine for the generator panel.
 *
 * Deliberate behaviours (PRD 9.6, 9.12):
 * - `status` gates the submit button, so a second click while a request is in
 *   flight cannot start a duplicate generation.
 * - The prompt and settings are owned by the caller and never cleared here, so
 *   a failure leaves the user's input exactly as they typed it.
 * - The previous result stays on screen while the next one generates, rather
 *   than blanking the panel.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../../lib/api";
import type { GeneratedImage, GenerationInput } from "../../lib/types";

export type GenerationStatus = "idle" | "generating" | "success" | "error";

export function useGeneration() {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
    };
  }, []);

  const generate = useCallback(async (input: GenerationInput) => {
    if (inFlight.current) return null;

    const controller = new AbortController();
    inFlight.current = controller;
    setStatus("generating");
    setError(null);

    try {
      const result = await api.generate(input, controller.signal);
      if (!mounted.current) return null;
      setImage(result);
      setStatus("success");
      return result;
    } catch (caught) {
      if (!mounted.current || controller.signal.aborted) return null;
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "error", "Could not generate the image. Please try again."),
      );
      setStatus("error");
      return null;
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? (image ? "success" : "idle") : current));
  }, [image]);

  const clear = useCallback(() => {
    setImage(null);
    setError(null);
    setStatus("idle");
  }, []);

  return {
    status,
    image,
    error,
    isGenerating: status === "generating",
    generate,
    dismissError,
    clear,
  };
}
