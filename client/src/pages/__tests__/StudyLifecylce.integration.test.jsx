import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudiesPage from "../StudiesPage";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/api/axios", () => ({
  default: apiMocks,
}));

const { get: mockGet, patch: mockPatch, delete: mockDelete } = apiMocks;

const activeStudies = [
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
];

const archivedStudies = [
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
];

const seedLocalStorage = () => {
  window.localStorage.setItem("user", JSON.stringify({ id: "researcher-77", role: "researcher" }));
  window.localStorage.setItem("token", "token-123");
};

const renderActiveTab = () =>
  render(
    <MemoryRouter>
      <StudiesPage />
    </MemoryRouter>,
  );

const renderArchivedTab = () =>
  render(
    <MemoryRouter>
      <StudiesPage archived />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  seedLocalStorage();
  mockGet.mockImplementation((_url, config) => {
    const isArchived = config?.params?.archived === "true";
    return Promise.resolve({ data: { studies: isArchived ? archivedStudies : activeStudies } });
  });
  mockPatch.mockResolvedValue({ data: {} });
  mockDelete.mockResolvedValue({ data: {} });
});

describe("Study lifecycle management integration", () => {
  it("shows the study list with archive and delete controls for active studies", async () => {
    renderActiveTab();

    expect(await screen.findByText("Security Review Sprint")).toBeInTheDocument();
    expect(screen.getByText("Usability Sweep")).toBeInTheDocument();

    const archiveButtons = screen.getAllByRole("button", { name: /^Archive$/i });
    const deleteButtons = screen.getAllByRole("button", { name: /^Delete$/i });

    expect(archiveButtons.length).toBeGreaterThan(0);
    expect(deleteButtons.length).toBeGreaterThan(0);

    expect(mockGet).toHaveBeenCalledWith(
      "/api/researcher/studies",
      expect.objectContaining({ params: expect.objectContaining({ archived: "false" }) }),
    );
  });

  it("archives a study and the archived tab lists it as read-only content", async () => {
    const { unmount } = renderActiveTab();

    const firstArchiveButton = await screen.findAllByRole("button", { name: /^Archive$/i });
    fireEvent.click(firstArchiveButton[0]);

    const archiveDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(archiveDialog).getByRole("button", { name: /^Archive$/i }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/api/researcher/studies/101/archive"),
    );

    await waitFor(() =>
      expect(screen.queryByText("Security Review Sprint")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Study archived and moved to Archived Studies/i)).toBeInTheDocument();

    unmount();
    renderArchivedTab();

    expect(await screen.findByText("Legacy Benchmark Audit")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      "/api/researcher/studies",
      expect.objectContaining({ params: expect.objectContaining({ archived: "true" }) }),
    );
    expect(screen.queryByRole("button", { name: /^Archive$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Delete$/i })).toBeInTheDocument();
  });

  it("permanently deletes a study after confirmation", async () => {
    renderActiveTab();

    const deleteButtons = await screen.findAllByRole("button", { name: /^Delete$/i });
    fireEvent.click(deleteButtons[0]);

    const deleteDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /^Delete$/i }));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith("/api/researcher/studies/101"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Security Review Sprint")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Study deleted permanently/i)).toBeInTheDocument();
  });
});
