import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "../../App";
import Login from "../Login";
import Register from "../Register";
import ForgotPassword from "../ForgotPassword";
import ResetPassword from "../ResetPassword";
import ResearcherLayout from "../ResearcherLayout";
import ParticipantLayout from "../ParticipantLayout";
import StudiesPage from "../StudiesPage";
import StudyCreationWizard from "../StudyCreationWizard";
import AdminRoleManagementPage from "../AdminRoleManagementPage";

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../api/axios", () => ({
  default: axiosMocks,
}));

vi.mock("@/api/axios", () => ({
  default: axiosMocks,
}));

const ResearcherHomeStub = () => (
  <div data-testid="researcher-home">Researcher overview dashboard</div>
);

const ParticipantDashboardStub = () => (
  <div data-testid="participant-dashboard-stub">Participant dashboard overview</div>
);

const ParticipantArtifactsStub = () => (
  <div data-testid="participant-artifacts-stub">Artifacts comparison workspace</div>
);

const ParticipantCompetencyStub = () => (
  <div data-testid="participant-competency-stub">Competency tracking board</div>
);

const AppRouteHarness = () => (
  <Routes>
    <Route path="/" element={<App />}>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/researcher" element={<ResearcherLayout />}>
        <Route index element={<ResearcherHomeStub />} />
        <Route path="studies" element={<StudiesPage archived={false} />} />
        <Route path="archived-studies" element={<StudiesPage archived />} />
        <Route path="study-creation-wizard" element={<StudyCreationWizard />} />
      </Route>
      <Route path="/participant" element={<ParticipantLayout />}>
        <Route index element={<ParticipantDashboardStub />} />
        <Route path="artifacts-comparison" element={<ParticipantArtifactsStub />} />
        <Route path="competency" element={<ParticipantCompetencyStub />} />
      </Route>
      <Route path="/admin-roles" element={<AdminRoleManagementPage />} />
    </Route>
  </Routes>
);

const renderApp = (initialEntries = ["/login"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRouteHarness />
    </MemoryRouter>,
  );

const futureDate = (daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
};

const mockStudyLifecycle = {
  active: [
    {
      id: "101",
      title: "Security Review Sprint",
      description: "Benchmark AI explainer clarity.",
      window: "Jan 02 → Jan 12",
      participants: 18,
      participantTarget: 20,
      nextMilestone: "QA handoff",
      avgRating: 4.2,
      status: "Active",
      health: "healthy",
    },
    {
      id: "102",
      title: "Usability Sweep",
      description: "UI tweaks for dashboard launch.",
      window: "Feb 10 → Feb 20",
      participants: 10,
      participantTarget: 12,
      nextMilestone: "Compile notes",
      avgRating: 4.5,
      status: "Active",
      health: "attention",
    },
  ],
  archived: [
    {
      id: "201",
      title: "Legacy Benchmark Audit",
      description: "Post-mortem for finished cohort.",
      window: "Nov 01 → Nov 12",
      participants: 24,
      participantTarget: 24,
      nextMilestone: "Archive only",
      avgRating: 4.8,
      status: "Archived",
      health: "healthy",
    },
  ],
};

const mockWizardParticipants = [
  {
    id: "participant-1",
    name: "Shahin Ibrahimli",
    email: "shahin@example.com",
    assignments: [],
    hasApproved: true,
  },
  {
    id: "participant-2",
    name: "Lee Kramer",
    email: "lee@example.com",
    assignments: [],
    hasApproved: false,
  },
];

const completeWizardSetup = async () => {
  const startInput = await screen.findByLabelText(/window start/i);
  const endInput = screen.getByLabelText(/window end/i);

  fireEvent.change(startInput, { target: { value: futureDate(3) } });
  fireEvent.change(endInput, { target: { value: futureDate(6) } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  fireEvent.click(await screen.findByRole("button", { name: /add new/i }));

  fireEvent.change(await screen.findByLabelText(/criterion name/i), {
    target: { value: "Quality coverage" },
  });
  fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

  await waitFor(() => expect(screen.getByText("Quality coverage")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  const shahinsCheckbox = await screen.findByRole("checkbox", { name: /select shahin ibrahimli/i });
  fireEvent.click(shahinsCheckbox);

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

describe("Full application smoke coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("covers the authentication flows end-to-end", async () => {
    axiosMocks.post.mockImplementation((url, payload) => {
      if (url === "/api/auth/login") {
        if (payload.email === "researcher@example.com") {
          return Promise.reject({
            response: {
              data: {
                message: "Verify your email",
                requiresVerification: true,
                email: payload.email,
              },
            },
          });
        }
        return Promise.resolve({
          data: {
            token: "login-token",
            user: { id: "researcher-1", role: "researcher", name: "Dr Researcher" },
          },
        });
      }
      if (url === "/api/auth/verify-email") {
        const isResearcher = payload.email === "researcher@example.com";
        return Promise.resolve({
          data: {
            token: "verified-token",
            user: {
              id: isResearcher ? "researcher-1" : "participant-71",
              role: isResearcher ? "researcher" : "participant",
              name: isResearcher ? "Dr Researcher" : "Alex Participant",
            },
          },
        });
      }
      if (url === "/api/auth/resend-verification") {
        return Promise.resolve({ data: { message: "Code resent" } });
      }
      if (url === "/api/auth/register") {
        return Promise.resolve({ data: { message: "Verification email sent." } });
      }
      if (url === "/api/auth/request-password-reset") {
        return Promise.resolve({ data: { message: "Reset email issued." } });
      }
      if (url === "/api/auth/reset-password") {
        return Promise.resolve({ data: { message: "Password reset successful." } });
      }
      return Promise.resolve({ data: {} });
    });

    const loginView = renderApp(["/login"]);

    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: "researcher@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));
    await waitFor(() => expect(axiosMocks.post).toHaveBeenCalledWith(
      "/api/auth/resend-verification",
      expect.objectContaining({ email: "researcher@example.com" }),
    ));

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByTestId("researcher-home")).toBeInTheDocument();
    loginView.unmount();

    window.localStorage.clear();
    const registerView = renderApp(["/register"]);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Alex P" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "participant@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "Str0ngPass" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Str0ngPass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Register$/i }));

    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByText(/Study Weave \(Participant\)/i)).toBeInTheDocument();
    registerView.unmount();

    window.localStorage.clear();
    const forgotView = renderApp(["/forgot-password"]);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "participant@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/reset email issued/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/6-digit code/i), {
      target: { value: "111999" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("New password (6+ chars, 1 uppercase)"),
      {
        target: { value: "NewPass1" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), {
      target: { value: "NewPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    forgotView.unmount();

    const resetView = renderApp(["/reset-password/token-abc"]);

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "participant@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/6-digit code/i), {
      target: { value: "token-abc" },
    });
    fireEvent.change(screen.getByPlaceholderText(/New password/i), {
      target: { value: "ResetPass1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), {
      target: { value: "ResetPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    resetView.unmount();
  });

  it("exercises the researcher study lifecycle inside the routed application shell", async () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: "researcher-77", role: "researcher", name: "Dr Metrics" }),
    );
    window.localStorage.setItem("token", "token-xyz");
    window.localStorage.setItem(
      "researcherNotificationsList",
      JSON.stringify([{ id: "notif-1", type: "study_submission", message: "New study ready" }]),
    );
    window.localStorage.setItem("researcherNotificationsCount", "1");

    axiosMocks.get.mockImplementation((url, config) => {
      if (url === "/api/researcher/studies") {
        const isArchived = config?.params?.archived === "true";
        return Promise.resolve({
          data: {
            studies: isArchived ? mockStudyLifecycle.archived : mockStudyLifecycle.active,
          },
        });
      }
      if (url.startsWith("/api/artifacts")) {
        return Promise.resolve({ data: { artifacts: [] } });
      }
      if (url.startsWith("/api/competency")) {
        return Promise.resolve({ data: { participants: mockWizardParticipants } });
      }
      return Promise.resolve({ data: {} });
    });

    axiosMocks.patch.mockResolvedValue({ data: {} });
    axiosMocks.delete.mockResolvedValue({ data: {} });
    axiosMocks.post.mockImplementation((url) => {
      if (url === "/api/studies") {
        return Promise.resolve({
          data: {
            study: {
              id: "study-rocket",
              title: "Automation Endgame",
              isPublic: false,
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderApp(["/researcher/studies"]);

    expect(await screen.findByText("Security Review Sprint")).toBeInTheDocument();

    const archiveButtons = screen.getAllByRole("button", { name: /^Archive$/i });
    fireEvent.click(archiveButtons[0]);

    const archiveDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(archiveDialog).getByRole("button", { name: /^Archive$/i }));

    await waitFor(() =>
      expect(axiosMocks.patch).toHaveBeenCalledWith("/api/researcher/studies/101/archive"),
    );
    expect(
      await screen.findByText(/Study archived and moved to Archived Studies/i),
    ).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /^Delete$/i });
    fireEvent.click(deleteButtons[0]);

    const deleteDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /^Delete$/i }));

    await waitFor(() =>
      expect(axiosMocks.delete).toHaveBeenCalledWith("/api/researcher/studies/102"),
    );
    expect(await screen.findByText(/Study deleted permanently/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Study Wizard/i }));

    await completeWizardSetup();
    const launchButton = await screen.findByRole("button", { name: /launch study/i });
    fireEvent.click(launchButton);

    await waitFor(() => expect(axiosMocks.post).toHaveBeenCalledWith("/api/studies", expect.any(Object)));
    expect(await screen.findByText(/Study created successfully/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    fireEvent.click(screen.getByRole("link", { name: /^Archived$/i }));

    expect(await screen.findByText("Legacy Benchmark Audit")).toBeInTheDocument();
    const archivedDeleteButton = screen.getByRole("button", { name: /^Delete$/i });
    fireEvent.click(archivedDeleteButton);

    const archivedDeleteDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(archivedDeleteDialog).getByRole("button", { name: /^Delete$/i }));

    await waitFor(() =>
      expect(axiosMocks.delete).toHaveBeenCalledWith("/api/researcher/studies/201"),
    );
    expect(await screen.findByText(/Study deleted permanently/i)).toBeInTheDocument();
  });

  it("validates participant shell behaviors and admin role management", async () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: "participant-1", role: "participant", name: "Lena" }),
    );
    window.localStorage.setItem("token", "token-participant");
    window.localStorage.setItem(
      "participantNotificationsList",
      JSON.stringify([{ id: "notif-1", type: "assignment", message: "New study waiting" }]),
    );
    window.localStorage.setItem("participantNotificationsCount", "1");

    const participantView = renderApp(["/participant"]);

    expect(await screen.findByText(/Study Weave \(Participant\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("participant-dashboard-stub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Artifacts Comparison/i }));
    expect(await screen.findByTestId("participant-artifacts-stub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Competency/i }));
    expect(await screen.findByTestId("participant-competency-stub")).toBeInTheDocument();

    const userTrigger = screen.getByRole("button", { name: /Lena/i });
    fireEvent.pointerDown(userTrigger, { button: 0 });
    fireEvent.pointerUp(userTrigger, { button: 0 });
    fireEvent.click(userTrigger);
    const logoutMenuItem = await screen.findByText(/Logout/i);
    fireEvent.click(logoutMenuItem);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    participantView.unmount();

    window.localStorage.clear();
    axiosMocks.get.mockReset();

    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: "admin-9", role: "admin", name: "Admin Ava" }),
    );
    window.localStorage.setItem("token", "token-admin");

    const adminDirectoryResponses = [
      {
        users: [
          { id: "u-1", name: "Riley Researcher", email: "riley@example.com", role: "researcher" },
          { id: "u-2", name: "Piper Participant", email: "piper@example.com", role: "participant" },
        ],
        pagination: {
          total: 2,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          from: 1,
          to: 2,
        },
      },
      {
        users: [
          { id: "u-1", name: "Riley Researcher", email: "riley@example.com", role: "participant" },
          { id: "u-2", name: "Piper Participant", email: "piper@example.com", role: "participant" },
        ],
        pagination: {
          total: 2,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          from: 1,
          to: 2,
        },
      },
    ];

    axiosMocks.get.mockImplementation((url) => {
      if (url === "/api/auth/users") {
        const payload =
          adminDirectoryResponses.length > 1
            ? adminDirectoryResponses.shift()
            : adminDirectoryResponses[0];
        return Promise.resolve({ data: payload });
      }
      return Promise.resolve({ data: {} });
    });

    axiosMocks.put.mockImplementation((url) => {
      if (url === "/api/auth/update-role/u-1") {
        return Promise.resolve({
          data: {
            user: { id: "u-1", name: "Riley Researcher", email: "riley@example.com", role: "participant" },
          },
        });
      }
      return Promise.resolve({ data: { user: null } });
    });

    renderApp(["/admin-roles"]);

    expect(await screen.findByText("Riley Researcher")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Change Role/i })[0]);

    await waitFor(() =>
      expect(axiosMocks.put).toHaveBeenCalledWith("/api/auth/update-role/u-1"),
    );
    const updatedRow = (await screen.findByText("Riley Researcher")).closest("tr");
    expect(updatedRow).not.toBeNull();
    expect(within(updatedRow).getByText(/participant/i)).toBeInTheDocument();
  });
});
