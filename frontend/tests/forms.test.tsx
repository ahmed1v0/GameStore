import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthForm } from "@/features/auth/auth-form";
import { RequireAuth } from "@/features/auth/require-auth";
import { LoginForm } from "@/features/auth/login-form";
import { AccountPage } from "@/features/auth/account-page";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  requestEmail: vi.fn(),
  verify: vi.fn(),
  replace: vi.fn(),
  auth: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({
  signup: mocks.signup,
  requestEmail: mocks.requestEmail,
  verifyEmail: mocks.verify,
  getAuthConfiguration: mocks.config,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: mocks.auth }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({ email_verification_enabled: true });
});

async function fillSignup(confirm = "River!lantern-5839") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "customer");
  await user.type(screen.getByLabelText("Email"), "customer@example.com");
  await user.type(screen.getByLabelText("New password"), "River!lantern-5839");
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

it("validates password confirmation without sending a request", async () => {
  render(<AuthForm mode="signup" />);
  await fillSignup("different");
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  expect(mocks.signup).not.toHaveBeenCalled();
});

it("shows signup confirmation", async () => {
  mocks.signup.mockResolvedValue({
    detail: "Check your email to verify your account.",
    verification_required: true,
  });
  render(<AuthForm mode="signup" />);
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
  await fillSignup();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Check your email",
  );
  expect(
    screen.getByRole("link", { name: "Resend verification email" }),
  ).toBeInTheDocument();
});

it("shows server field errors accessibly", async () => {
  mocks.signup.mockRejectedValue(
    new ApiError("Email already in use.", 400, {
      email: ["Email already in use."],
    }),
  );
  render(<AuthForm mode="signup" />);
  await fillSignup();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Email already in use.",
  );
  expect(screen.getByLabelText("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("offers sign in without resend after signup when verification is disabled", async () => {
  mocks.signup.mockResolvedValue({
    detail: "Account created. You can now sign in.",
    verification_required: false,
  });
  render(<AuthForm mode="signup" />);
  await fillSignup();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "You can now sign in.",
  );
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

it.each(["verify", "resend"] as const)(
  "hides the %s form when verification is disabled",
  async (mode) => {
    mocks.config.mockResolvedValue({ email_verification_enabled: false });
    render(<AuthForm mode={mode} token="old-token" />);
    expect(
      await screen.findByText(/Email verification is turned off/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Resend verification email" }),
    ).not.toBeInTheDocument();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.requestEmail).not.toHaveBeenCalled();
  },
);

it("shows a service error without verification controls if configuration fails", async () => {
  mocks.config.mockRejectedValue(new Error("offline"));
  render(<AuthForm mode="resend" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Reload this page",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("hides account verification when disabled without claiming the email is verified", () => {
  mocks.auth.mockReturnValue({
    session: {
      user: {
        username: "customer",
        email: "customer@example.com",
        role: "user",
        email_verified: false,
        verification_required: false,
        email_verification_enabled: false,
      },
    },
  });
  render(<AccountPage />);
  expect(
    screen.getByText("Not verified — verification not required"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Verify email" }),
  ).not.toBeInTheDocument();
});

it("requires a deliberate click to consume a verification link", async () => {
  mocks.verify.mockResolvedValue({ detail: "Email verified." });
  render(<AuthForm mode="verify" token="example-token" />);
  expect(mocks.verify).not.toHaveBeenCalled();
  await userEvent.click(
    await screen.findByRole("button", { name: "Verify email" }),
  );
  expect(mocks.verify).toHaveBeenCalledWith("example-token");
  expect(await screen.findByRole("status")).toHaveTextContent("Email verified");
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
});

it("does not duplicate resend navigation on the resend form", async () => {
  render(<AuthForm mode="resend" />);
  expect(
    await screen.findByRole("button", { name: "Send verification link" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
});

it("shows resend for an expired verification link", async () => {
  mocks.verify.mockRejectedValue(
    new ApiError("Expired link", 400, { token: "This link has expired." }),
  );
  render(<AuthForm mode="verify" token="expired" />);
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    await screen.findByRole("button", { name: "Verify email" }),
  );
  expect(
    await screen.findByRole("link", { name: "Resend verification email" }),
  ).toBeInTheDocument();
});

it("shows resend only when valid login credentials are blocked by verification", async () => {
  const login = vi
    .fn()
    .mockRejectedValueOnce(
      new ApiError("Incorrect credentials", 401, {
        code: "authentication_failed",
      }),
    )
    .mockRejectedValueOnce(
      new ApiError("Verify your email before signing in.", 401, {
        code: "email_unverified",
      }),
    );
  mocks.auth.mockReturnValue({ isReady: true, session: null, login });
  render(<LoginForm />);
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Username"), "customer");
  await userEvent.type(screen.getByLabelText("Password"), "test-password");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Incorrect credentials",
  );
  expect(
    screen.queryByRole("link", { name: "Resend verification email" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByRole("link", { name: "Resend verification email" }),
  ).toBeInTheDocument();
});

it("offers a replacement for a missing reset token", () => {
  render(<AuthForm mode="reset" />);
  expect(screen.getByRole("alert")).toHaveTextContent("missing its token");
  expect(
    screen.getByRole("link", { name: "Request a new reset link" }),
  ).toHaveAttribute("href", "/forgot-password");
});

it("keeps recovery acknowledgments generic", async () => {
  mocks.requestEmail.mockResolvedValue({
    detail: "If this account is eligible, an email will arrive shortly.",
  });
  render(<AuthForm mode="forgot" />);
  await userEvent.type(screen.getByLabelText("Email"), "unknown@example.com");
  await userEvent.click(
    screen.getByRole("button", { name: "Send reset link" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If this account is eligible",
  );
});

it("redirects unauthenticated visitors without rendering protected content", () => {
  mocks.auth.mockReturnValue({
    isReady: true,
    session: null,
    startupError: null,
  });
  render(
    <RequireAuth>
      <div>Private receipt</div>
    </RequireAuth>,
  );
  expect(screen.queryByText("Private receipt")).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith("/login");
});

it("denies the admin page to ordinary users", () => {
  mocks.auth.mockReturnValue({
    isReady: true,
    session: { user: { role: "user" } },
    startupError: null,
  });
  render(
    <RequireAuth admin>
      <div>User controls</div>
    </RequireAuth>,
  );
  expect(screen.getByText("Access denied")).toBeInTheDocument();
  expect(screen.queryByText("User controls")).not.toBeInTheDocument();
});

it("lets admins reach the user manager", () => {
  mocks.auth.mockReturnValue({
    isReady: true,
    session: { user: { role: "admin" } },
    startupError: null,
  });
  render(
    <RequireAuth admin>
      <div>User controls</div>
    </RequireAuth>,
  );
  expect(screen.getByText("User controls")).toBeInTheDocument();
});
