import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, getAccessToken } from "../../lib/api";
import { makeUser, renderWithProviders } from "../../test/utils";
import { LoginPage } from "./LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { RegisterPage } from "./RegisterPage";

beforeEach(() => {
  vi.spyOn(api, "restoreSession").mockResolvedValue(null);
});

describe("sign in", () => {
  it("keeps the button disabled until both fields are filled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const submit = screen.getByRole("button", { name: /^sign in$/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/email/i), "painter@example.com");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    expect(submit).toBeEnabled();
  });

  it("stores the access token in memory on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockResolvedValue({ access: "token-abc", user: makeUser() });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "painter@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(getAccessToken()).toBe("token-abc"));
    expect(window.localStorage.getItem("access")).toBeNull();
  });

  it("does not reveal which field was wrong", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(401, "unauthenticated", "No active account found with the given credentials"),
    );
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "painter@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/email and password do not match/i);
  });

  it("keeps the typed email after a failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(new ApiError(401, "unauthenticated", "nope"));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "painter@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/email/i)).toHaveValue("painter@example.com");
  });
});

describe("register", () => {
  it("requires a password of at least eight characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "short");

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/i);
  });

  it("submits the trimmed email and display name", async () => {
    const user = userEvent.setup();
    const register = vi
      .spyOn(api, "register")
      .mockResolvedValue({ access: "token-abc", user: makeUser() });
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/name/i), " Painter ");
    await user.type(screen.getByLabelText(/email/i), " new@example.com ");
    await user.type(screen.getByLabelText(/password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "correct-horse-battery",
        display_name: "Painter",
      }),
    );
  });

  it("shows a field error returned by the server", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "register").mockRejectedValue(
      new ApiError(400, "invalid", "An account with this email already exists.", {
        email: ["An account with this email already exists."],
      }),
    );
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  });
});

describe("protected routes", () => {
  it("waits for session restoration instead of flashing the sign-in screen", async () => {
    vi.spyOn(api, "restoreSession").mockImplementation(() => new Promise(() => {}));
    renderWithProviders(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>,
    );

    expect(screen.getByRole("status", { name: /restoring your session/i })).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("renders the page once a session is restored", async () => {
    vi.spyOn(api, "restoreSession").mockResolvedValue({
      access: "token-abc",
      user: makeUser(),
    });
    renderWithProviders(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>,
    );

    expect(await screen.findByText("Secret content")).toBeInTheDocument();
  });

  it("redirects an anonymous visitor away from the page", async () => {
    renderWithProviders(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>,
    );

    await waitFor(() =>
      expect(screen.queryByText("Secret content")).not.toBeInTheDocument(),
    );
  });
});
