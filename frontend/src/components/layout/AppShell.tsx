/**
 * PRD 9.3 layout shell: Header / Main / (route content).
 */

import type { ReactNode } from "react";

import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a href="#main" className="chitra-skip-link">
        Skip to main content
      </a>
      <Header />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[var(--chitra-shell-max)] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
      >
        {children}
      </main>
      <footer className="border-t border-line px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[var(--chitra-shell-max)] flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span>Chitra AI - images generated from your prompts.</span>
          <span>Generated images are stored in your private history.</span>
        </div>
      </footer>
    </div>
  );
}
