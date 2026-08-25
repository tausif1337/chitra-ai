import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/utils";
import { DemoAccountCard } from "./DemoAccountCard";

const ACCOUNT = { email: "demo@chitra.ai", password: "demo-password-123" };

describe("demo account card", () => {
  it("shows both credentials so they can be read off the screen", () => {
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={() => {}} />);
    expect(screen.getByText("demo@chitra.ai")).toBeInTheDocument();
    expect(screen.getByText("demo-password-123")).toBeInTheDocument();
  });

  it("warns that the account is shared", () => {
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={() => {}} />);
    expect(screen.getByText(/visible to every visitor/i)).toBeInTheDocument();
  });

  it("hands the account back when used", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={onUse} />);

    await user.click(screen.getByRole("button", { name: /use demo account/i }));
    expect(onUse).toHaveBeenCalledWith(ACCOUNT);
  });

  it("is disabled while a sign-in is in flight", () => {
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={() => {}} disabled />);
    expect(screen.getByRole("button", { name: /use demo account/i })).toBeDisabled();
  });

  it("copies a credential to the clipboard", async () => {
    // userEvent.setup() installs its own navigator.clipboard, so the stub has
    // to go in afterwards. Assignment throws (getter-only in jsdom), hence
    // defineProperty.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={() => {}} />);

    await user.click(screen.getByRole("button", { name: /copy demo email/i }));
    expect(writeText).toHaveBeenCalledWith("demo@chitra.ai");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("survives a blocked clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<DemoAccountCard account={ACCOUNT} onUse={() => {}} />);

    await user.click(screen.getByRole("button", { name: /copy demo password/i }));
    // No throw, and the value stays readable on screen.
    expect(screen.getByText("demo-password-123")).toBeInTheDocument();
  });
});
