import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudyCreationWizard from "../StudyCreationWizard";
import axios from "../../api/axios";

vi.mock("../../api/axios", () => {
  const get = vi.fn();
  const post = vi.fn();
  return {
    default: {
      get,
      post,
    },
  };
});

const mockParticipants = [
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

const mockStudy = {
  id: "study-abc",
  title: "Artifact Review",
  isPublic: false,
};

const futureDate = (daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
};

const renderWizard = () =>
  render(
    <MemoryRouter>
      <StudyCreationWizard />
    </MemoryRouter>,
  );

const advanceToLaunchWithParticipants = async (participantNames) => {
  const startInput = await screen.findByLabelText(/window start/i);
  const endInput = screen.getByLabelText(/window end/i);

  fireEvent.change(startInput, { target: { value: futureDate(3) } });
  fireEvent.change(endInput, { target: { value: futureDate(6) } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  fireEvent.click(await screen.findByRole("button", { name: /add new/i }));

  fireEvent.change(await screen.findByLabelText(/criterion name/i), {
    target: { value: "Coverage" },
  });
  fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

  await waitFor(() => {
    expect(screen.getByText("Coverage")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  for (const name of participantNames) {
    const checkbox = await screen.findByRole("checkbox", { name: new RegExp(`select ${name}`, "i") });
    fireEvent.click(checkbox);
  }

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

describe("Study participant access integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify({ id: "researcher-22", role: "researcher" }));

    axios.get.mockImplementation((url) => {
      if (url.startsWith("/api/artifacts")) {
        return Promise.resolve({ data: { artifacts: [] } });
      }
      if (url.startsWith("/api/competency")) {
        return Promise.resolve({ data: { participants: mockParticipants } });
      }
      return Promise.resolve({ data: {} });
    });

    axios.post.mockResolvedValue({ data: { study: mockStudy } });
  });

  it("shows a confirmation banner after assigning participants", async () => {
    renderWizard();
    await advanceToLaunchWithParticipants(["Shahin Ibrahimli"]);

    const banner = await screen.findByTestId("participant-assignment-summary");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Participants assigned");
    expect(banner).toHaveTextContent("You assigned Shahin Ibrahimli");
  });

  it("sends only the assigned participants to the backend when launching the study", async () => {
    renderWizard();
    await advanceToLaunchWithParticipants(["Shahin Ibrahimli"]);

    fireEvent.click(screen.getByRole("button", { name: /launch study/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    const payload = axios.post.mock.calls[0][1];
    const assigned = payload.metadata.selectedParticipants;

    expect(assigned).toEqual(["participant-1"]);
    expect(assigned).not.toContain("participant-2");
  });
});
