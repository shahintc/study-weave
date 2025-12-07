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

const mockStudy = {
  id: "study-123",
  title: "Quality Review Sprint",
  isPublic: true,
};

const mockParticipants = [
  {
    id: "participant-1",
    name: "Shahin Ibrahimli",
    email: "shahinibrahimli23@gmail.com",
    assignments: [],
    hasApproved: true,
  },
];

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

const advanceWizardToLaunch = async () => {
  const startInput = await screen.findByLabelText(/window start/i);
  const endInput = screen.getByLabelText(/window end/i);

  fireEvent.change(startInput, { target: { value: futureDate(3) } });
  fireEvent.change(endInput, { target: { value: futureDate(6) } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  fireEvent.click(await screen.findByRole("button", { name: /add new/i }));

  fireEvent.change(await screen.findByLabelText(/criterion name/i), {
    target: { value: "Research readiness" },
  });
  fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

  await waitFor(() => {
    expect(screen.getByText("Research readiness")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  const participantCheckbox = await screen.findByRole("checkbox", { name: /select shahin ibrahimli/i });
  fireEvent.click(participantCheckbox);

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  return screen.findByRole("button", { name: /launch study/i });
};

describe("StudyCreationWizard integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify({ id: "researcher-1", role: "researcher" }));

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

  it("validates study window dates before continuing", async () => {
    renderWizard();

    const startInput = await screen.findByLabelText(/window start/i);
    const endInput = screen.getByLabelText(/window end/i);
    fireEvent.change(startInput, { target: { value: futureDate(5) } });
    fireEvent.change(endInput, { target: { value: futureDate(2) } });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText(/window end cannot be before the start date\./i),
    ).toBeInTheDocument();
  });

  it("shows a launch call-to-action to create the study after prerequisites are met", async () => {
    renderWizard();
    const launchButton = await advanceWizardToLaunch();
    expect(launchButton).toBeInTheDocument();
  });

  it("shows a participant assignment confirmation banner after selecting users", async () => {
    renderWizard();
    await advanceWizardToLaunch();

    expect(await screen.findByTestId("participant-assignment-summary")).toBeInTheDocument();
    expect(screen.getByText(/You assigned Shahin Ibrahimli/i)).toBeInTheDocument();
  });

  it("confirms successful study creation once the launch succeeds", async () => {
    renderWizard();
    const launchButton = await advanceWizardToLaunch();

    fireEvent.click(launchButton);

    await waitFor(() => expect(axios.post).toHaveBeenCalled());

    expect(await screen.findByText(/study created successfully/i)).toBeInTheDocument();
    expect(await screen.findByText(/Quality Review Sprint/i)).toBeInTheDocument();
  });
});
