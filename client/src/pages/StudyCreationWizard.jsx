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

const WIZARD_STEPS = [
  { id: 0, label: "Study details", helper: "Title, description, window" },
  { id: 1, label: "Artifacts", helper: "Pick or upload artifacts" },
  { id: 2, label: "Competency gate", helper: "Choose quiz + targeting" },
  { id: 3, label: "Launch", helper: "Review + send invites" },
];

const DEFAULT_CRITERIA = [
  { label: "Readability", weight: 30 },
  { label: "Correctness", weight: 30 },
  { label: "Maintainability", weight: 20 },
  { label: "Confidence notes", weight: 20 },
];

const ARTIFACT_LIBRARY = [
  { id: "art-1", label: "Artifact A • Human writeup" },
  { id: "art-2", label: "Artifact B • AI summary" },
  { id: "art-3", label: "Prototype wireframes" },
];

const ASSESSMENTS = [
  { id: "asm-1", title: "Baseline Competency Check", completions: 12 },
  { id: "asm-2", title: "Mobile UX Diagnostic", completions: 5 },
];

const PARTICIPANT_SEGMENTS = [
  { id: "seg-1", label: "Senior Engineers • 5+ yrs" },
  { id: "seg-2", label: "Bootcamp graduates" },
  { id: "seg-3", label: "Design partners" },
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
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [selectedArtifacts, setSelectedArtifacts] = useState(["art-1", "art-2"]);
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

  useEffect(() => {
    const fetchParticipants = async () => {
      setIsParticipantsLoading(true);
      setParticipantsError("");
      try {
        const { data } = await axios.get("/api/auth/participants");
        setParticipants(data.users || []);
      } catch (error) {
        console.error("Failed to load participants", error);
        setParticipantsError(error.response?.data?.message || "Unable to load participants");
      } finally {
        setIsParticipantsLoading(false);
      }
    };
    fetchParticipants();
  }, []);

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
      },
    };

    try {
      const response = await axios.post("/api/studies", payload);
      const newStudy = response.data;
      alert(`Study Created Successfully! (ID: ${newStudy.id})`);
      navigate("/researcher/participants-list");
    } catch (err) {
      console.error("Failed to create study:", err);
      setError("Failed to create study. Please try again.");
    }
  };

  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) {
      return participants;
    }
    const term = participantSearch.toLowerCase();
    return participants.filter((participant) => {
      return (
        participant.name.toLowerCase().includes(term) ||
        participant.email.toLowerCase().includes(term)
      );
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

  const goBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));
  const goNext = () => setCurrentStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1));

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
                <div className="space-y-3">
                  {ARTIFACT_LIBRARY.map((artifact) => (
                    <div
                      key={artifact.id}
                      className={`flex items-center justify-between rounded-md border p-3 ${selectedArtifacts.includes(artifact.id) ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{artifact.label}</p>
                        <p className="text-xs text-muted-foreground">Last updated 2 days ago</p>
                      </div>
                      <Checkbox
                        checked={selectedArtifacts.includes(artifact.id)}
                        onCheckedChange={() => toggleArtifact(artifact.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Evaluation criteria</Label>
                  <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
                    Add new +
                  </Button>
                </div>
                <div className="space-y-2 rounded-md border p-4">
                  {criteria.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <Badge variant="outline">{item.weight}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require-assessment"
                    checked={requireAssessment}
                    onCheckedChange={setRequireAssessment}
                  />
                  <Label htmlFor="require-assessment" className="font-normal">
                    Require participants to pass a competency assessment
                  </Label>
                </div>
                {requireAssessment ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Choose assessment</Label>
                      <div className="space-y-2">
                        {ASSESSMENTS.map((assessment) => (
                          <div
                            key={assessment.id}
                            className={`flex items-center justify-between rounded-md border p-3 text-sm ${selectedAssessment === assessment.id ? "border-primary bg-primary/5" : ""}`}
                          >
                            <div>
                              <p className="font-medium">{assessment.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {assessment.completions} completions
                              </p>
                            </div>
                            <Checkbox
                              checked={selectedAssessment === assessment.id}
                              onCheckedChange={() => setSelectedAssessment(assessment.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Target participant segment</Label>
                      <div className="space-y-2">
                        {PARTICIPANT_SEGMENTS.map((segment) => (
                          <div
                            key={segment.id}
                            className={`flex items-center justify-between rounded-md border p-3 text-sm ${selectedSegment === segment.id ? "border-primary bg-primary/5" : ""}`}
                          >
                            <span>{segment.label}</span>
                            <Checkbox
                              checked={selectedSegment === segment.id}
                              onCheckedChange={() => setSelectedSegment(segment.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <Label>Select participants</Label>
                          <p className="text-xs text-muted-foreground">
                            {isParticipantsLoading
                              ? "Loading participants…"
                              : `${selectedParticipants.length} selected • these folks will receive the competency quiz.`}
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
                        placeholder="Search by name or email"
                        value={participantSearch}
                        onChange={(event) => setParticipantSearch(event.target.value)}
                        disabled={!participants.length}
                      />
                      {participantsError ? (
                        <p className="text-xs text-destructive">{participantsError}</p>
                      ) : null}
                      <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-md border p-2">
                        {isParticipantsLoading ? (
                          <p className="py-6 text-center text-xs text-muted-foreground">Fetching participants…</p>
                        ) : filteredParticipants.length ? (
                          filteredParticipants.map((participant) => (
                            <div
                              key={participant.id}
                              className={`flex flex-col gap-1 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between ${
                                selectedParticipants.includes(participant.id) ? "border-primary bg-primary/5" : "border-muted"
                              }`}
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {participant.name}
                                  <span className="text-muted-foreground"> • {participant.email}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {participant.role || "participant"} • Joined{" "}
                                  {participant.created_at
                                    ? new Date(participant.created_at).toLocaleDateString()
                                    : "—"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Eligible</Badge>
                                <Checkbox
                                  checked={selectedParticipants.includes(participant.id)}
                                  onCheckedChange={() => toggleParticipant(participant.id)}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="py-6 text-center text-xs text-muted-foreground">No participants match this search.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
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
