import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudiesPage from "../StudiesPage";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/api/axios", () => ({
  default: {
    get: apiMocks.get,
    delete: apiMocks.delete,
  },
}));

const mockStudy = {
  id: "301",
  title: "Delete Workflow Spec",
  description: "Ensure deletion removes artifacts.",
  window: "Mar 01 → Mar 15",
  participants: 15,
  participantTarget: 18,
  nextMilestone: "Final report",
  avgRating: 4.6,
  status: "Active",
  health: "healthy",
};

describe("Study deletion integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem("user", JSON.stringify({ id: "researcher-77", role: "researcher" }));
    window.localStorage.setItem("token", "token-xyz");
    apiMocks.get.mockResolvedValue({ data: { studies: [mockStudy] } });
    apiMocks.delete.mockResolvedValue({ data: {} });
  });

  it("confirms deletion, calls the API, and removes the study row", async () => {
    render(
      <MemoryRouter>
        <StudiesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Delete Workflow Spec")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Delete$/i }));

    await waitFor(() =>
      expect(apiMocks.delete).toHaveBeenCalledWith("/api/researcher/studies/301"),
    );

    await waitFor(() =>
      expect(screen.queryByText("Delete Workflow Spec")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Study deleted permanently/i)).toBeInTheDocument();
  });
});
