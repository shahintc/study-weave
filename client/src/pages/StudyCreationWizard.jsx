import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const WIZARD_STEPS = [
  { id: 0, label: "Study details", helper: "Title, description, window" },
  { id: 1, label: "Artifacts", helper: "Pick or upload artifacts" },
  { id: 2, label: "Competency gate", helper: "Choose quiz + targeting" },
  { id: 3, label: "Launch", helper: "Review + send invites" },
];

const DEFAULT_CRITERIA = [];

const ASSESSMENTS = [
  { id: "asm-1", title: "Baseline Competency Check", completions: 12 },
  { id: "asm-2", title: "Mobile UX Diagnostic", completions: 5 },
];

const PARTICIPANT_SEGMENTS = [
  { id: "seg-1", label: "Senior Engineers • 5+ yrs" },
  { id: "seg-2", label: "Bootcamp graduates" },
  { id: "seg-3", label: "Design partners" },
];

const ARTIFACT_MODE_OPTIONS = [
  { value: "stage1", label: "Stage 1 – Participant bug labeling" },
  { value: "stage2", label: "Stage 2 – Reviewer bug comparison" },
  { value: "solid", label: "SOLID violations" },
  { value: "clone", label: "Patch clone detection" },
  { value: "snapshot", label: "Snapshot change vs failure" },
];

function StudyCreationWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("Comparison Study — Q4 drop");
  const [description, setDescription] = useState(
    "Participants compare human and AI generated artifacts and rate readiness.",
  );
  const [isBlinded, setIsBlinded] = useState(false);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCriterionText, setNewCriterionText] = useState("");
  const [newCriterionWeight, setNewCriterionWeight] = useState("10");
  const [participantTarget, setParticipantTarget] = useState("20");
  const [studyMode, setStudyMode] = useState(ARTIFACT_MODE_OPTIONS[0].value);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [selectedArtifacts, setSelectedArtifacts] = useState([]);
  const [requireAssessment, setRequireAssessment] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState("asm-1");
  const [selectedSegment, setSelectedSegment] = useState("seg-1");
  const [autoInvite, setAutoInvite] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participants, setParticipants] = useState([]);
  const [participantsError, setParticipantsError] = useState("");
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [expandedParticipants, setExpandedParticipants] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [artifactsError, setArtifactsError] = useState("");
  const [isArtifactsLoading, setIsArtifactsLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "researcher") {
        navigate("/login");
        return;
      }
      setUser(parsed);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const artifactOwnerId = useMemo(() => {
    if (user?.id) return user.id;
    if (user?.userId) return user.userId;
    return null;
  }, [user?.id]);

  useEffect(() => {
    if (!artifactOwnerId) {
      return;
    }

    const fetchArtifacts = async () => {
      setIsArtifactsLoading(true);
      setArtifactsError("");
      try {
        const { data } = await axios.get(`/api/artifacts/user/${artifactOwnerId}`);
        setArtifacts(data.artifacts || []);
      } catch (error) {
        const status = error.response?.status;
        if (status === 404) {
          setArtifacts([]);
          return;
        }
        console.error("Failed to load artifacts", error);
        const message = error.response?.data?.message || "Unable to load artifacts";
        setArtifactsError(message);
      } finally {
        setIsArtifactsLoading(false);
      }
    };
    fetchArtifacts();
  }, [artifactOwnerId]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const fetchParticipants = async () => {
      setIsParticipantsLoading(true);
      setParticipantsError("");
      try {
        const { data } = await axios.get("/api/competency/participants/overview", {
          params: { researcherId: user.id },
        });
        setParticipants(data.participants || []);
      } catch (error) {
        console.error("Failed to load competency participants", error);
        setParticipantsError(error.response?.data?.message || "Unable to load competency participants");
      } finally {
        setIsParticipantsLoading(false);
      }
    };

    fetchParticipants();
  }, [user]);

  const progressPercent = useMemo(() => {
    const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }, [currentStep]);

  const launchSummary = useMemo(() => {
    return {
      artifacts: selectedArtifacts.length,
      criteria: criteria.length,
      participants: selectedParticipants.length || participantTarget,
      schedule: windowStart && windowEnd ? `${windowStart} → ${windowEnd}` : "TBD",
      competencyGate: requireAssessment ? "Required" : "Optional",
    };
  }, [
    selectedArtifacts.length,
    criteria.length,
    selectedParticipants.length,
    participantTarget,
    windowStart,
    windowEnd,
    requireAssessment,
  ]);

  const toggleArtifact = (artifactId) => {
    setSelectedArtifacts((prev) =>
      prev.includes(artifactId) ? prev.filter((id) => id !== artifactId) : [...prev, artifactId],
    );
  };

  const handleSaveCriterion = () => {
    if (!newCriterionText.trim()) return;
    const weightNumber = Number(newCriterionWeight) || 10;
    setCriteria((prev) => [...prev, { label: newCriterionText.trim(), weight: weightNumber }]);
    setNewCriterionText("");
    setNewCriterionWeight("10");
    setIsDialogOpen(false);
  };

  const handleCreateStudy = async () => {
    setError(null);
    if (!user?.id) {
      setError("Please sign in as a researcher to create a study.");
      return;
    }
    const payload = {
      title,
      description,
      criteria,
      researcherId: user.id,
      isBlinded,
      timelineStart: windowStart || null,
      timelineEnd: windowEnd || null,
      defaultArtifactMode: studyMode,
      metadata: {
        participantTarget: Number(participantTarget) || 0,
        windowStart,
        windowEnd,
        notes,
        requireAssessment,
        selectedAssessment: requireAssessment ? selectedAssessment : null,
        selectedSegment: requireAssessment ? selectedSegment : null,
        autoInvite,
        selectedArtifacts,
        selectedParticipants,
        isBlinded,
        defaultArtifactMode: studyMode,
      },
    };

    try {
      const response = await axios.post("/api/studies", payload);
      const newStudy = response.data?.study || response.data;
      alert(`Study Created Successfully! (ID: ${newStudy?.id ?? "unknown"})`);
      navigate("/researcher/participants-list");
    } catch (err) {
      console.error("Failed to create study:", err);
      setError(err.response?.data?.message || "Failed to create study. Please try again.");
    }
  };

  const filteredParticipants = useMemo(() => {
    const list = Array.isArray(participants) ? participants : [];
    if (!participantSearch.trim()) {
      return list;
    }
    const term = participantSearch.toLowerCase();
    return list.filter((participant) => {
      const name = participant.name?.toLowerCase() || "";
      const email = participant.email?.toLowerCase() || "";
      const assignments = Array.isArray(participant.assignments) ? participant.assignments : [];
      const matchesAssignment = assignments.some((assignment) =>
        (assignment.assessmentTitle || "").toLowerCase().includes(term),
      );
      return name.includes(term) || email.includes(term) || matchesAssignment;
    });
  }, [participantSearch, participants]);

  const toggleParticipant = (participantId) => {
    setSelectedParticipants((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId],
    );
  };

  const selectAllParticipants = () => {
    const everyId = participants.map((participant) => participant.id);
    setSelectedParticipants(everyId);
  };

  const toggleParticipantDetails = (participantId) => {
    setExpandedParticipants((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId],
    );
  };

  const humanize = (value) => {
    if (!value) return "Unknown";
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const decisionLabel = (decision) => {
    if (!decision || decision === "undecided") {
      return "Awaiting decision";
    }
    return humanize(decision);
  };

  const statusToneClass = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "reviewed") return "bg-emerald-600 text-white";
    if (normalized === "submitted") return "bg-blue-600 text-white";
    if (normalized === "in_progress") return "bg-amber-500 text-white";
    if (normalized === "pending") return "bg-muted text-foreground";
    return "bg-muted text-foreground";
  };

  const decisionToneClass = (decision) => {
    const normalized = (decision || "").toLowerCase();
    if (normalized === "approved") return "bg-green-600 text-white";
    if (normalized === "rejected") return "bg-destructive text-destructive-foreground";
    return "bg-muted text-foreground";
  };

  const formatDateTime = (value, fallback = "—") => {
    if (!value) return fallback;
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

   const getTotalWeight = () => {
    return criteria.reduce((sum, c) => sum + Number(c.weight), 0);
  };

  const validateCriteriaBeforeNext = () => {
    if (criteria.length === 0) {
      setError("You must create at least one evaluation criterion before continuing.");
      return false;
    }
    const total = getTotalWeight();
    if (total !== 100) {
      setError(`Total weight must be exactly 100%. Current total: ${total}%.`);
      return false;
    }
    return true;
  };

  const goBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));
  const goNext = () => {
    setError(null);
    if (currentStep === 1) {
      if (!validateCriteriaBeforeNext()) return;
    }
    setCurrentStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1));
  };

  const primaryAction = currentStep === WIZARD_STEPS.length - 1 ? handleCreateStudy : goNext;
  const primaryLabel = currentStep === WIZARD_STEPS.length - 1 ? "Launch study" : "Continue";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Study creation wizard</CardTitle>
            <CardDescription>Design the study, gate participants, and schedule launch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Step {currentStep + 1} of {WIZARD_STEPS.length}
                </span>
                <span>{progressPercent}% complete</span>
              </div>
              <Progress className="mt-2" value={progressPercent} />
            </div>
            <div className="space-y-4">
              {WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`rounded-md border p-3 ${index === currentStep ? "border-primary bg-primary/5" : "border-muted"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.helper}</p>
                    </div>
                    {index < currentStep ? <Badge variant="outline">Done</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Launch readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase">Artifacts</p>
              <p className="text-base font-medium text-foreground">{launchSummary.artifacts} selected</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase">Participant target</p>
              <p className="text-base font-medium text-foreground">{launchSummary.participants} seats</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase">Window</p>
              <p className="text-base font-medium text-foreground">{launchSummary.schedule}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase">Competency gate</p>
              <p className="text-base font-medium text-foreground">{launchSummary.competencyGate}</p>
            </div>
            <Separator />
            <p>Need help configuring? Email researchers@studyweave.ai</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep].label}</CardTitle>
          <CardDescription>{WIZARD_STEPS[currentStep].helper}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {currentStep === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="study-title">Study title</Label>
                <Input
                  id="study-title"
                  placeholder="AI vs. Human Code Readability"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description for participants</Label>
                <Textarea
                  id="description"
                  placeholder="Participants will compare two artifacts..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="window-start">Window start</Label>
                  <Input
                    id="window-start"
                    type="date"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="window-end">Window end</Label>
                  <Input
                    id="window-end"
                    type="date"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="participant-target">Participant target</Label>
                <Input
                  id="participant-target"
                  type="number"
                  min="1"
                  placeholder="20"
                  value={participantTarget}
                  onChange={(event) => setParticipantTarget(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="study-mode">Default artifact task</Label>
                <Select value={studyMode} onValueChange={setStudyMode}>
                  <SelectTrigger id="study-mode">
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTIFACT_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Participants will see this assignment on their dashboard as soon as they are invited.
                </p>
              </div>
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="blinded" checked={isBlinded} onCheckedChange={setIsBlinded} />
                  <Label htmlFor="blinded" className="font-normal">
                    Blinded evaluation (hide artifact origin)
                  </Label>
                </div>
              </div>
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <div className="space-y-2">
                <Label>Artifact selection</Label>
                <p className="text-sm text-muted-foreground">
                  Choose the artifacts for this study. You can upload more from the artifacts page.
                </p>
                {artifactsError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {artifactsError}
                  </div>
                ) : null}
                {isArtifactsLoading ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">Loading artifacts...</div>
                ) : artifacts.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No artifacts found. Upload artifacts first from the Artifacts page.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className={`flex items-center justify-between rounded-md border p-3 ${selectedArtifacts.includes(artifact.id) ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-medium">{artifact.name || `Artifact ${artifact.id}`}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {artifact.type || "Unknown type"}
                          </p>
                          {artifact.tags && artifact.tags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {artifact.tags.map((tag) => (
                                <Badge key={tag.id || tag.name} variant="outline" className="text-[10px]">
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <Checkbox
                          checked={selectedArtifacts.includes(artifact.id)}
                          onCheckedChange={() => toggleArtifact(artifact.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Evaluation criteria</Label>
                  <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
                    Add new +
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  e.g., Readability, Correctness, Maintainability, Confidence…
                </p>
                <div className="space-y-2 rounded-md border p-4">
                  {criteria.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <Badge variant="outline">{item.weight}%</Badge>
                    </div>
                  ))}
                </div>

                {/* ADDED — validation error */}
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Select participants</Label>
                    <p className="text-xs text-muted-foreground">
                      {isParticipantsLoading
                        ? "Loading participants…"
                        : `${selectedParticipants.length} selected • showing everyone tied to your competency quizzes.`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllParticipants}
                    disabled={!participants.length}
                  >
                    Select all
                  </Button>
                </div>

                <Input
                  placeholder="Search by name or assessment"
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  disabled={!participants.length}
                />

                {participantsError ? <p className="text-xs text-destructive">{participantsError}</p> : null}

                <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-md border p-2">
                  {isParticipantsLoading ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Fetching participants…</p>
                  ) : filteredParticipants.length ? (
                    filteredParticipants.map((participant) => {
                            const assignments = Array.isArray(participant.assignments)
                              ? participant.assignments
                              : [];
                            const hasAssignments = assignments.length > 0;
                            const isExpanded = expandedParticipants.includes(participant.id);
                            return (
                              <div
                                key={participant.id}
                                className={`flex flex-col gap-3 rounded-md border p-3 text-sm ${
                                  selectedParticipants.includes(participant.id)
                                    ? "border-primary bg-primary/5"
                                    : "border-muted"
                                }`}
                              >
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {participant.name || "Participant"}
                                      <span className="text-muted-foreground"> • {participant.email}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {hasAssignments
                                        ? `${assignments.length} competency ${assignments.length === 1 ? "test" : "tests"} • Last update ${formatDateTime(participant.lastActivity, "—")}`
                                        : "No competency assignments yet"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={participant.hasApproved ? "default" : "outline"}
                                      className={participant.hasApproved ? "bg-emerald-600 text-white" : ""}
                                    >
                                      {participant.hasApproved ? "Has approved quiz" : "Awaiting approval"}
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="px-2"
                                      onClick={() => toggleParticipantDetails(participant.id)}
                                    >
                                      {isExpanded ? "Hide details" : "See details"}
                                    </Button>
                                    <Checkbox
                                      checked={selectedParticipants.includes(participant.id)}
                                      onCheckedChange={() => toggleParticipant(participant.id)}
                                    />
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <div className="space-y-2 rounded-md border bg-muted/40 p-2 text-xs">
                                    {hasAssignments ? (
                                      assignments.map((assignment) => (
                                        <div
                                          key={assignment.assignmentId}
                                          className="flex flex-col gap-2 rounded-md bg-background/70 p-2 md:flex-row md:items-center md:justify-between"
                                        >
                                          <div>
                                            <p className="font-medium text-foreground">{assignment.assessmentTitle}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                              Updated {formatDateTime(assignment.updatedAt || assignment.createdAt, "—")}
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <Badge className={statusToneClass(assignment.status)}>
                                              {humanize(assignment.status)}
                                            </Badge>
                                            <Badge className={decisionToneClass(assignment.decision)}>
                                              {decisionLabel(assignment.decision)}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-muted-foreground">
                                        This participant has not been added to a competency quiz yet.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No competency participants match this search.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="auto-invite" checked={autoInvite} onCheckedChange={setAutoInvite} />
                <Label htmlFor="auto-invite" className="font-normal">
                  Auto-invite participants who pass the quiz
                </Label>
              </div>
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <div className="space-y-2">
                <Label>Launch notes</Label>
                <Textarea
                  placeholder="Add instructions for the research ops team or your co-researcher."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <div className="space-y-2 rounded-md border p-4 text-sm">
                <p className="font-medium">Pre-launch checklist</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Review criteria weights and ensure they total 100%.</li>
                  <li>Confirm competency assessment is published.</li>
                  <li>Let participants know about the study in Slack.</li>
                </ul>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Need to pause? You can come back later — we auto-save everything locally.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={goBack} disabled={currentStep === 0}>
              Back
            </Button>
            <Button onClick={primaryAction}>{primaryLabel}</Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new evaluation criterion</DialogTitle>
            <DialogDescription>Participants will rate this dimension during the study.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="criterion-name" className="sr-only">
                Criterion name
              </Label>
              <Input
                id="criterion-name"
                placeholder="e.g., Cohesion, Effort to apply"
                value={newCriterionText}
                onChange={(event) => setNewCriterionText(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion-weight" className="sr-only">
                Weight
              </Label>
              <Input
                id="criterion-weight"
                type="number"
                min="5"
                max="100"
                placeholder="10"
                value={newCriterionWeight}
                onChange={(event) => setNewCriterionWeight(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCriterion}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudyCreationWizard;
