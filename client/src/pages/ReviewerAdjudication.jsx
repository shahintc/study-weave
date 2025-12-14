import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Eye, RefreshCcw, Timer, Sparkles, Loader2, Zap, AlertCircle as AlertCircleIcon } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
];

const DECISION_OPTIONS = [
  { value: "participant_correct", label: "Participant correct" },
  { value: "llm_correct", label: "LLM correct" },
  { value: "inconclusive", label: "Inconclusive" },
  { value: "needs_followup", label: "Needs follow-up" },
];

const STAGE_LABELS = {
  stage1: "Stage 1: Bug labeling",
  stage2: "Stage 2: Adjudication",
  solid: "SOLID review",
  patch: "Patch/Clone check",
  snapshot: "Snapshot intent",
};

const getStageLabel = (mode) => STAGE_LABELS[mode] || mode;

const BUG_CATEGORIES = [
  "Configuration Issue",
  "Network Issue",
  "Authentication/Authorization Bug",
  "Data Inconsistency",
  "Performance Issue",
  "UI/UX Glitch",
  "Security Vulnerability",
  "Compatibility Issue",
  "Logic Error",
  "Integration Issue",
  "Typo/Content Error",
];

const PATCHES_ARE_CLONES = [
  "yes",
  "no"
]

const SOLID_VIOLATIONS = [
  { id: "srp", label: "SRP – Single Responsibility Principle" },
  { id: "ocp", label: "OCP – Open/Closed Principle" },
  { id: "lsp", label: "LSP – Liskov Substitution Principle" },
  { id: "isp", label: "ISP – Interface Segregation Principle" },
  { id: "dip", label: "DIP – Dependency Inversion Principle" },
];

const COMPLEXITY_LEVELS = ["EASY", "MEDIUM", "HARD"];

/** Clone categories for patch mode */
const PATCH_CLONE_TYPES = [
  { id: "type1", label: "Type-1 – Exact (whitespace/comments only)" },
  { id: "type2", label: "Type-2 – Same structure, different identifiers" },
  { id: "type3", label: "Type-3 – Copied with added/removed/modified lines" },
  { id: "type4", label: "Type-4 – Semantically similar, different implementation"},
];

/** Snapshot study outcomes */
const SNAPSHOT_OUTCOMES = [
  { id: "failure", label: "Actual failure" },
  { id: "intended", label: "Intended UI change" },
  { id: "unclear", label: "Unclear / not sure" },
];

const SNAPSHOT_CHANGE_TYPES = [
  { id: "color", label: "Color / theme change" },
  { id: "layout", label: "Layout or spacing shift" },
  { id: "text", label: "Copy / text update" },
  { id: "icon", label: "Iconography or asset swap" },
  { id: "content", label: "Missing or extra content" },
  { id: "animation", label: "Animation / interaction regression" },
  { id: "other", label: "Other (describe)" },
];

const normalizeCriteriaRatings = (payload) => {
  if (!payload || typeof payload !== "object") return [];
  const candidates = [
    payload.criteriaRatings,
    payload.criteria_scores,
    payload.criteriaScores,
    payload.criteria,
  ].find((arr) => Array.isArray(arr) && arr.length);

  if (candidates) {
    return candidates
      .map((item, idx) => {
        const label =
          item?.label ||
          item?.name ||
          item?.title ||
          item?.criterion ||
          item?.criteria ||
          `Criterion ${idx + 1}`;
        const weight =
          typeof item?.weight !== "undefined"
            ? item.weight
            : typeof item?.weightPercent !== "undefined"
              ? item.weightPercent
              : null;
        const rating =
          typeof item?.rating !== "undefined"
            ? item.rating
            : typeof item?.score !== "undefined"
              ? item.score
              : typeof item?.value !== "undefined"
                ? item.value
                : null;
        return { label, weight, rating };
      })
      .filter((item) => item.label);
  }

  // Support object-based maps from participant payload
  const starMap = payload.evaluationStarRatings && typeof payload.evaluationStarRatings === "object"
    ? payload.evaluationStarRatings
    : null;
  const weightedMap = payload.evaluationRatings && typeof payload.evaluationRatings === "object"
    ? payload.evaluationRatings
    : null;

  if (starMap) {
    return Object.entries(starMap).map(([label, rawRating]) => {
      const rating = Number(rawRating);
      let weight = null;
      if (weightedMap && weightedMap[label] != null && Number.isFinite(Number(weightedMap[label])) && Number.isFinite(rating) && rating !== 0) {
        const pct = Number(weightedMap[label]);
        // pct = weight% * rating / 5  => weight% = pct * 5 / rating
        weight = Number(((pct * 5) / rating).toFixed(2));
      }
      return { label, rating, weight };
    });
  }

  return [];
};

const summarizeCriteriaRatings = (criteria = []) => {
  if (!criteria.length) {
    return { weighted: null, weightTotal: 0, items: [] };
  }
  const weightSum = criteria.reduce(
    (sum, c) => sum + (Number(c.weight) || 0),
    0,
  );
  let weightedScore = 0;
  criteria.forEach((c) => {
    const rating = Number(c.rating);
    if (!Number.isFinite(rating)) return;
    const weight = Number(c.weight) || 0;
    if (weightSum > 0) {
      weightedScore += rating * (weight / 100);
    }
  });
  return {
    weighted: weightSum > 0 ? Number(weightedScore.toFixed(2)) : null,
    weightTotal: weightSum,
    items: criteria,
  };
};

export default function ReviewerAdjudication() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [adjudications, setAdjudications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "all", studyId: "all" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decisionForm, setDecisionForm] = useState({
    status: "pending",
    decision: "__none",
    adjudicatedLabel: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [aiEvaluationLoading, setAiEvaluationLoading] = useState(false);
  const [aiEvaluationResult, setAiEvaluationResult] = useState(null); // Placeholder for AI evaluation result
  const [aiEvaluationError, setAiEvaluationError] = useState("");
  const [artifactSummaries, setArtifactSummaries] = useState({
    primary: { text: "", loading: false, error: "" },
    secondary: { text: "", loading: false, error: "" },
  });

  const buildReviewSummaryPrompt = useCallback((entry) => {
    if (!entry) return "";

    const describePane = (pane, label) => {
      if (!pane) return `${label}: missing.`;
      const kind = (pane.type || "").toLowerCase();
      const name = pane.name || label;
      if (kind === "text") {
        const text = pane.text || "";
        const trimmed = text.length > 1200 ? `${text.slice(0, 1200)}... [truncated]` : text;
        return `${label} (${name}, text):\n${trimmed}`;
      }
      if (kind === "image" || kind === "pdf") {
        return `${label} (${name}, ${kind}) was uploaded.`;
      }
      return `${label} (${name}, ${kind || "unknown"}).`;
    };

    const lines = [];
    lines.push(
      `Study: ${entry.study?.title || "Study"} (id: ${entry.study?.id || "n/a"})`,
    );
    lines.push(
      `Participant: ${entry.participant?.name || "Participant"} (${entry.participant?.email || "n/a"}); submitted at ${formatDateTime(entry.submittedAt)}.`,
    );
    lines.push(
      `Review status: ${entry.review?.status || "pending"}; decision: ${entry.review?.decision || "none"}; adjudicated label: ${entry.review?.adjudicatedLabel || "n/a"}.`,
    );
    if (entry.comparison) {
      lines.push(
        `Artifacts compared: Primary ${entry.comparison.primary?.artifactName || entry.comparison.primary?.label || "N/A"} vs Secondary ${entry.comparison.secondary?.artifactName || entry.comparison.secondary?.label || "N/A"}. Prompt: ${entry.comparison.prompt || "none"}.`,
      );
    }
    const answer = entry.participantAnswer || {};
    const payload = answer.payload || {};
    const mode = payload.mode || answer.mode || null;
    const metrics = answer.metrics || {};
    const preference = answer.preference || payload.preference || "n/a";
    const rating = (answer.rating ?? payload.rating ?? "n/a");
    const summary = answer.summary || payload.summary || "";
    const notes = answer.notes || payload.notes || payload.assessmentComment || "";
    const snapshotDiff = payload.snapshotDiffData
      ? `Diff artifact provided (${payload.snapshotDiffData.name || payload.snapshotDiffData.type || "diff"}).`
      : "";
    lines.push(
      `Participant preference: ${preference}; rating: ${rating}. Summary: ${summary || "—"}. Notes: ${notes || "—"}. ${snapshotDiff}`,
    );
    lines.push(`Stage: ${getStageLabel(mode)}`);
    // Include stage-specific answers
    if (mode === "stage1") {
      lines.push(`Bug category: ${payload.leftCategory || "—"}`);
      if (payload.assessmentComment) lines.push(`Notes: ${payload.assessmentComment}`);
    } else if (mode === "stage2") {
      lines.push(`Participant A label: ${payload.leftCategory || "—"}`);
      lines.push(`Participant B/AI label: ${payload.rightCategory || "—"}`);
      lines.push(`Labels match? ${payload.matchCorrectness || "—"}`);
      const finalCat =
        payload.finalCategory === "other"
          ? payload.finalOtherCategory || "Other (unspecified)"
          : payload.finalCategory || "—";
      lines.push(`Final category: ${finalCat}`);
      if (payload.assessmentComment) lines.push(`Notes: ${payload.assessmentComment}`);
    } else if (mode === "solid") {
      lines.push(`Violation: ${payload.solidViolation || payload.solid_violation || "—"}`);
      lines.push(`Complexity: ${payload.solidComplexity || payload.solid_complexity || "—"}`);
      lines.push(`Refactor: ${payload.solidFixedCode || payload.solid_fixed_code || "—"}`);
      if (payload.assessmentComment) lines.push(`Notes: ${payload.assessmentComment}`);
    } else if (mode === "patch") {
      lines.push(`Are patches clones? ${payload.patchAreClones || "—"}`);
      if (payload.patchAreClones === "yes") {
        lines.push(`Clone type: ${payload.patchCloneType || "—"}`);
      }
      if (payload.patchCloneComment) lines.push(`Notes: ${payload.patchCloneComment}`);
    } else if (mode === "snapshot") {
      lines.push(`Outcome: ${payload.snapshotOutcome || "—"}`);
      const changeType =
        payload.snapshotChangeType === "other"
          ? payload.snapshotChangeTypeOther || "Other (unspecified)"
          : payload.snapshotChangeType || "—";
      lines.push(`Change type: ${changeType}`);
      if (payload.assessmentComment) lines.push(`Notes: ${payload.assessmentComment}`);
    }
    // Include participant-provided panes for LLM context
    lines.push(describePane(payload.left, "Artifact A (pane)"));
    lines.push(describePane(payload.right, "Artifact B (pane)"));
    if (Object.keys(metrics).length) {
      lines.push(`Metrics: ${JSON.stringify(metrics)}`);
    }
    lines.push(`Raw payload keys: ${Object.keys(payload).join(", ") || "none"}`);
    lines.push("Produce 2-3 crisp bullets covering submission quality, risks, and next steps.");
    return lines.join("\n");
  }, []);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!rawUser || !token) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(rawUser);
      if (parsed.role !== "researcher" && parsed.role !== "admin") {
        navigate("/participant");
        return;
      }
      setUser(parsed);
      setAuthToken(token);
    } catch (err) {
      console.error("Failed to parse user", err);
      navigate("/login");
    }
  }, [navigate]);

  const fetchAdjudications = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.status) {
        params.append("status", filters.status);
      }
      if (filters.studyId && filters.studyId !== "all") {
        params.append("studyId", filters.studyId);
      }
      const query = params.toString();
      const endpoint = query ? `/api/reviewer/adjudications?${query}` : "/api/reviewer/adjudications";
      const { data } = await api.get(endpoint, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setAdjudications(data?.adjudications || []);
    } catch (err) {
      console.error("Failed to load adjudications", err);
      const message = err.response?.data?.message || "Unable to load reviewer queue right now.";
      setError(message);
      setAdjudications([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, filters]);

  useEffect(() => {
    fetchAdjudications();
  }, [fetchAdjudications]);

  const studyOptions = useMemo(() => {
    const uniq = new Map();
    adjudications.forEach((entry) => {
      if (entry.study) {
        uniq.set(entry.study.id, entry.study.title || `Study ${entry.study.id}`);
      }
    });
    return Array.from(uniq.entries()).map(([id, title]) => ({ id, title }));
  }, [adjudications]);

  const statusCounts = useMemo(() => {
    return adjudications.reduce(
      (acc, entry) => {
        const status = entry.review?.status || "pending";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { pending: 0, in_review: 0, resolved: 0 }
    );
  }, [adjudications]);

  const openDialog = (entry) => {
    setSelected(entry);
    setDecisionForm({
      status: entry.review?.status || "pending",
      decision: entry.review?.decision || "__none",
      adjudicatedLabel: entry.review?.adjudicatedLabel || "",
      notes: entry.review?.notes || "",
    });
    setFormError("");
    setAiSummary("");
    setAiSummaryError("");
    setAiSummaryLoading(false);
    setArtifactSummaries({
      primary: { text: "", loading: false, error: "" },
      secondary: { text: "", loading: false, error: "" },
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelected(null);
    setFormError("");
  };

  const handleDecisionChange = (field, value) => {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateAiSummary = async () => {
    if (!selected) {
      return;
    }
    setAiSummaryLoading(true);
    setAiSummaryError("");
    try {
      const prompt = buildReviewSummaryPrompt(selected);
      const { data } = await api.post("/api/llm", {
        key: "REVIEW_SUMMARY",
        prompt,
        id: selected.id, // pass evaluation id so backend can attach artifacts
      });
      setAiSummary(data?.response || "No summary returned.");
    } catch (err) {
      console.error("AI summary error", err);
      const message = err.response?.data?.error || "Unable to generate AI summary right now.";
      setAiSummaryError(message);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleArtifactSummary = async (key, artifactMeta) => {
    if (!selected) return;
    if (!artifactMeta?.artifactId) {
      setArtifactSummaries((prev) => ({
        ...prev,
        [key]: { ...prev[key], error: "Artifact id missing for summary." },
      }));
      return;
    }
    setArtifactSummaries((prev) => ({
      ...prev,
      [key]: { ...prev[key], loading: true, error: "" },
    }));

    const participantMode =
      selected.participantAnswer?.payload?.mode || selected.participantAnswer?.mode || null;
    const stageLabel = getStageLabel(participantMode);
    const artifactLabel = artifactMeta.artifactName || artifactMeta.label || `Artifact ${key}`;

    try {
      const prompt = [
        `Summarize the attached artifact "${artifactLabel}" for study review.`,
        `Stage: ${stageLabel}.`,
        "Provide 2-3 crisp bullets describing what the artifact contains and any notable issues or risks.",
      ].join(" ");

      const { data } = await api.post("/api/llm", {
        key: "ARTIFACT_SUMMARY",
        prompt,
        id: artifactMeta.artifactId,
      });

      setArtifactSummaries((prev) => ({
        ...prev,
        [key]: { text: data?.response || "No summary returned.", loading: false, error: "" },
      }));
    } catch (err) {
      console.error("Artifact summary error", err);
      const message = err.response?.data?.error || "Unable to summarize this artifact right now.";
      setArtifactSummaries((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: message },
      }));
    }
  };

  const handleGenerateAiEvaluation = async () => {
    if (!selected) {
      return;
    }
    setAiEvaluationLoading(true);
    setAiEvaluationError("");
    setAiEvaluationResult(null);

    // Placeholder for actual AI evaluation API call
    try {
      const mode = selected.participantAnswer.payload.mode;
      let prompt = "";

      switch (mode) {
        case "stage1":
          console.log("Generating AI evaluation for bug adjudication:", selected.id);
          prompt = "QUESTION 1: Select bug category\n";
          BUG_CATEGORIES.forEach((category, index) => {
            prompt += `${index + 1}) ${category}\n`;
          });
          break;
        case "solid":
          console.log("Generating AI evaluation for SOLID adjudication:", selected.id);
          prompt = "QUESTION 1: Select SOLID violation present\n";
          SOLID_VIOLATIONS.forEach((category, index) => {
            prompt += `${index + 1}) ${category.label}\n`;
          });

          prompt += "QUESTION 2: Select complexity level\n";
          COMPLEXITY_LEVELS.forEach((level, index) => {
            prompt += `${index + 1}) ${level}\n`;
          });

          prompt += "QUESTION 3 (Open ended): Give fixed version of the code\n";
          break;
        case "patch":
          prompt = "QUESTION 1: Are the given artifacts clones/similar?\n"
          prompt += "1) Yes\n";
          prompt += "2) No\n";

          prompt += "QUESTION 2: How do the artifacts relate?\n"
          PATCH_CLONE_TYPES.forEach((type, index) => {
            prompt += `${index + 1}) ${type.label}\n`;
          });
          break;
        case "snapshot":
          prompt += "QUESTION 1: Given the before/after, what is the outcome of the change?\n";
          SNAPSHOT_OUTCOMES.forEach((type, index) => {
            prompt += `${index + 1}) ${type.label}\n`;
          });
          prompt += "QUESTION 2: What has been changed?\n";
          SNAPSHOT_CHANGE_TYPES.forEach((type, index) => {
            prompt += `${index + 1}) ${type.label}\n`;
          });
          break;
        case "custom":
          break;
      }
      prompt += "\nCRITERIA:\n";
      const criteria = normalizeCriteriaRatings(selected.participantAnswer.payload);
      criteria.forEach((criterion, index) => {
        prompt += `${index + 1}) ${criterion.label}\n`;
      });

      const { data } = await api.post("/api/llm", {
        key: "STUDY_ANALYSIS",
        prompt: prompt,
        id: selected.id,
      });

      console.log(data?.response);
      setAiEvaluationResult(data); // Store the entire data object
    } catch (err) {
      console.error("AI evaluation error", err);
      const message = err.response?.data?.error || "Failed to generate AI evaluation.";
      setAiEvaluationError(message);
    } finally {
      setAiEvaluationLoading(false);
    }
  };

  const handleSaveDecision = async () => {
    if (!selected || !authToken) {
      return;
    }
    setSavingDecision(true);
    setFormError("");
    try {
      await api.patch(
        `/api/reviewer/adjudications/${selected.id}`,
        {
          reviewStatus: decisionForm.status,
          decision: decisionForm.decision === "__none" ? undefined : decisionForm.decision,
          adjudicatedLabel: decisionForm.adjudicatedLabel || null,
          notes: decisionForm.notes || "",
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      await fetchAdjudications();
      closeDialog();
    } catch (err) {
      console.error("Failed to save adjudication", err);
      const message = err.response?.data?.message || "Unable to save decision right now.";
      setFormError(message);
    } finally {
      setSavingDecision(false);
    }
  };

  const handleRefresh = () => fetchAdjudications();

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <p className="text-muted-foreground text-sm">Loading reviewer queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/80 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasRows = adjudications.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Reviewer adjudication</h1>
        <p className="text-sm text-muted-foreground">
          Compare participant submissions against LLM ground truth and record the final decision for each evaluation.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Queue status</CardTitle>
            <CardDescription>Monitor how many evaluations await adjudication.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatusTile icon={Timer} label="Pending" value={statusCounts.pending} tone="amber" />
            <StatusTile icon={Eye} label="In review" value={statusCounts.in_review} tone="blue" />
            <StatusTile icon={CheckCircle2} label="Resolved" value={statusCounts.resolved} tone="green" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow the queue to the study or status you care about.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-2 w-full md:w-1/3">
            <label className="text-sm font-medium">Review status</label>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-1/3">
            <label className="text-sm font-medium">Study</label>
            <Select
              value={filters.studyId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, studyId: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All studies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All studies</SelectItem>
                {studyOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!hasRows ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No evaluations found for the selected filters. Assign artifact comparisons to participants and their submissions will appear here once ready.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Evaluations</CardTitle>
            <CardDescription>Review each submission and finalize the adjudication.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Study</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Review status</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjudications.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.participant?.name || "Participant"}
                      <p className="text-xs text-muted-foreground">{entry.participant?.email || ""}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.study?.title || "Study"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(entry.submittedAt)}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.review?.status)}</TableCell>
                    <TableCell>{getDecisionBadge(entry.review?.decision)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openDialog(entry)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          {selected && (
            <>
              {selected.review?.status === "resolved" && (
                <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  This review is already completed. Edits are disabled.
                </div>
              )}

              <DialogHeader>
                <DialogTitle>Adjudicate evaluation</DialogTitle>
                <DialogDescription>
                  {selected.participant?.name || "Participant"} • {selected.study?.title || "Study"}
                </DialogDescription>
              </DialogHeader>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Comparison overview</h3>
                <ComparisonSummary comparison={selected.comparison} />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Artifact AI summaries</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <ArtifactSummaryCard
                    title="Primary artifact"
                    artifact={selected.comparison?.primary}
                    summary={artifactSummaries.primary}
                    onGenerate={() => handleArtifactSummary("primary", selected.comparison?.primary)}
                  />
                  <ArtifactSummaryCard
                    title="Secondary artifact"
                    artifact={selected.comparison?.secondary}
                    summary={artifactSummaries.secondary}
                    onGenerate={() => handleArtifactSummary("secondary", selected.comparison?.secondary)}
                  />
                </div>
              </section>

              <Separator className="my-4" />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Participant answer</h3>
                <AnswerSummary answer={selected.participantAnswer} />
              </section>

              <Separator className="my-4" />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">AI summary</h3>
                    <p className="text-xs text-muted-foreground">
                      Generate a concise summary of this submission for quick review notes.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAiSummary}
                    disabled={aiSummaryLoading}
                  >
                    {aiSummaryLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {aiSummaryLoading ? "Generating..." : "Generate AI summary"}
                  </Button>
                </div>
                {aiSummaryError && (
                  <p className="text-xs text-red-600">{aiSummaryError}</p>
                )}
                {aiSummary ? (
                  <div className="rounded-md border p-3 bg-muted/40 text-sm whitespace-pre-wrap">
                    {aiSummary}
                  </div>
                ) : !aiSummaryLoading ? (
                  <p className="text-xs text-muted-foreground">No AI summary yet.</p>
                ) : null}

              </section>

              <Separator className="my-4" />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">AI evaluation</h3>
                    <p className="text-xs text-muted-foreground">
                      Generate an AI evaluation for this adjudication.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAiEvaluation}
                    disabled={aiEvaluationLoading || !selected}
                  >
                    {aiEvaluationLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    {aiEvaluationLoading ? "Generating..." : "Generate AI evaluation"}
                  </Button>
                </div>
                {aiEvaluationResult && (
                  <div className="grid gap-3 md:grid-cols-2 mt-4">
                    {/* Participant's Card */}
                    <div className="rounded-lg border p-4 bg-sky-50">
                      <h4 className="font-semibold text-sm mb-2">Participant's Evaluation</h4>
                      {selected.participantAnswer?.payload?.mode === "stage1" && (
                        <div className="text-sm mt-2 space-y-1">
                          <p>Bug category: {selected.participantAnswer?.payload?.leftCategory || selected.participantAnswer?.payload?.finalCategory || "—"}</p>
                        </div>
                      )}
                      {selected.participantAnswer?.payload?.mode === "solid" && (
                        <div className="text-sm mt-2 space-y-1">
                          <p>Violation: {selected.participantAnswer?.payload?.solidViolation || selected.participantAnswer?.payload?.solid_violation || "—"}</p>
                          <p>Complexity: {selected.participantAnswer?.payload?.solidComplexity || selected.participantAnswer?.payload?.solid_complexity || "—"}</p>
                          <p>Refactor:</p>
                          <Textarea
                            id="generated-artifact"
                            readOnly={true}
                            value={selected.participantAnswer?.payload?.solidFixedCode || selected.participantAnswer?.payload?.solid_fixed_code || "No refactor response."}
                            className="min-h-[150px]"
                          />
                        </div>
                      )}
                      {selected.participantAnswer?.payload?.mode === "patch" && (
                        <div className="text-sm mt-2 space-y-1">
                          <p>Are patches clones? {selected.participantAnswer?.payload?.patchAreClones || "—"}</p>
                          <p>Clone type: {selected.participantAnswer?.payload?.patchCloneType || "—"}</p>
                        </div>
                      )}
                      {selected.participantAnswer?.payload?.mode === "snapshot" && (
                        <div className="text-sm mt-2 space-y-1">
                          <p>Outcome: {selected.participantAnswer?.payload?.snapshotOutcome || "—"}</p>
                          <p>Change type: {selected.participantAnswer?.payload?.snapshotChangeType || "—"}</p>
                        </div>
                      )}
                      <Separator className="my-3" />
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Criteria Scores:</p>
                      <div className="space-y-1">
                        {normalizeCriteriaRatings(selected.participantAnswer.payload).map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-sm">
                            <span>{item.label}:</span>
                            <StarRow value={item.rating} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI's Card */}
                    <div className="rounded-lg border p-4 bg-muted/40 bg-violet-50">
                      <h4 className="font-semibold text-sm mb-2">AI Evaluation</h4>
                        {selected.participantAnswer?.payload?.mode === "stage1" && (
                          <div className="text-sm mt-2 space-y-1">
                            <p className="flex items-center gap-2">Bug category: {BUG_CATEGORIES[aiEvaluationResult.response.options[0]] || "—"}
                              {BUG_CATEGORIES[aiEvaluationResult.response.options[0]] !==
                                (selected.participantAnswer?.payload?.leftCategory || selected.participantAnswer?.payload?.finalCategory) && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}</p>
                          </div>
                        )}
                        {selected.participantAnswer?.payload?.mode === "solid" && (
                          <div className="text-sm mt-2 space-y-1">
                            <p className="flex items-center gap-2">
                              Violation: {SOLID_VIOLATIONS[aiEvaluationResult.response?.options[0]].id || "—"}
                              {(SOLID_VIOLATIONS[aiEvaluationResult.response?.options[0]].id || "") !==
                                (selected.participantAnswer?.payload?.solidViolation || selected.participantAnswer?.payload?.solid_violation || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              Complexity: {COMPLEXITY_LEVELS[aiEvaluationResult.response?.options[1]] || "—"}
                              {(COMPLEXITY_LEVELS[aiEvaluationResult.response?.options[1]] || "") !==
                                (selected.participantAnswer?.payload?.solidComplexity || selected.participantAnswer?.payload?.solid_complexity || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              Refactor:
                            </p>
                            <Textarea
                              id="generated-artifact"
                              readOnly={true}
                              value={aiEvaluationResult.response?.options[2] || "No refactor response."}
                              className="min-h-[150px]"
                            />
                          </div>
                        )}
                        {selected.participantAnswer?.payload?.mode === "patch" && (
                          <div className="text-sm mt-2 space-y-1">
                            <p className="flex items-center gap-2">
                              Are patches clones?: {PATCHES_ARE_CLONES[aiEvaluationResult.response?.options[0]] || "—"}
                              {(PATCHES_ARE_CLONES[aiEvaluationResult.response?.options[0]] || "") !==
                                (selected.participantAnswer?.payload?.patchAreClones || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              Clone type: {PATCH_CLONE_TYPES[aiEvaluationResult.response?.options[1]].id || "—"}
                              {(PATCH_CLONE_TYPES[aiEvaluationResult.response?.options[1]].id || "") !==
                                (selected.participantAnswer?.payload?.patchCloneType || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                          </div>
                        )}
                        {selected.participantAnswer?.payload?.mode === "snapshot" && (
                          <div className="text-sm mt-2 space-y-1">
                            <p className="flex items-center gap-2">
                              Outcome: {SNAPSHOT_OUTCOMES[aiEvaluationResult.response?.options[0]].id || "—"}
                              {(SNAPSHOT_OUTCOMES[aiEvaluationResult.response?.options[0]].id || "") !==
                                (selected.participantAnswer?.payload?.snapshotOutcome || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              Change type: {SNAPSHOT_CHANGE_TYPES[aiEvaluationResult.response?.options[1]].id || "—"}
                              {(SNAPSHOT_CHANGE_TYPES[aiEvaluationResult.response?.options[1]].id || "") !==
                                (selected.participantAnswer?.payload?.snapshotChangeType || "") && (
                                <AlertCircleIcon className="h-4 w-4 text-orange-500" />
                              )}
                            </p>
                          </div>
                        )}
                      <Separator className="my-3" />
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Criteria Scores:</p>
                      <div className="space-y-1">
                        {normalizeCriteriaRatings(selected.participantAnswer.payload).map((participantCriterion, index) => {
                          const aiScore = aiEvaluationResult.response?.criteria?.[index] ?? 0;
                          const participantScore = participantCriterion.rating ?? 0;
                          const isDifferent = aiScore !== participantScore;

                          return participantCriterion ? (
                            <div key={participantCriterion.label} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span>{participantCriterion.label}:</span>
                                {isDifferent && <AlertCircleIcon className="h-4 w-4 text-orange-500" />}
                              </div>
                              <StarRow value={aiScore} />
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {aiEvaluationError && (
                  <p className="text-sm text-red-500 mt-2">{aiEvaluationError}</p>
                )}
              </section>

              <Separator className="my-4" />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Reviewer decision</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Review status</label>
                    <Select
                      value={decisionForm.status}
                      onValueChange={(value) => handleDecisionChange("status", value)}
                      disabled={selected.review?.status === "resolved"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter((opt) => opt.value !== "all").map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Decision</label>
                    <Select
                      value={decisionForm.decision}
                      onValueChange={(value) => handleDecisionChange("decision", value)}
                      disabled={selected.review?.status === "resolved"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No decision</SelectItem>
                        {DECISION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Adjudicated label</label>
                  <Input
                    value={decisionForm.adjudicatedLabel}
                    onChange={(event) => handleDecisionChange("adjudicatedLabel", event.target.value)}
                    disabled={selected.review?.status === "resolved"}
                    placeholder="e.g., GUI regression"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Reviewer notes</label>
                  <Textarea
                    value={decisionForm.notes}
                    onChange={(event) => handleDecisionChange("notes", event.target.value)}
                    rows={4}
                    disabled={selected.review?.status === "resolved"}
                    placeholder="Explain why you sided with the participant or LLM."
                  />
                </div>
                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}
              </section>

              <DialogFooter>
                <Button variant="ghost" onClick={closeDialog} disabled={savingDecision}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveDecision}
                  disabled={savingDecision || selected.review?.status === "resolved"}
                >
                  {savingDecision ? "Saving..." : "Save decision"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusTile({ icon, label, value, tone }) {
  const IconComponent = icon;
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${toneClass}`}>
      <IconComponent className="h-6 w-6" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function getStatusBadge(status) {
  const normalized = status || "pending";
  const map = {
    pending: { label: "Pending", variant: "outline" },
    in_review: { label: "In review", variant: "secondary" },
    resolved: { label: "Resolved", variant: "default" },
  };
  const meta = map[normalized] || map.pending;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function getDecisionBadge(decision) {
  if (!decision) {
    return <Badge variant="outline">Awaiting decision</Badge>;
  }
  const label = DECISION_OPTIONS.find((option) => option.value === decision)?.label || decision;
  return <Badge className="bg-slate-900">{label}</Badge>;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ComparisonSummary({ comparison }) {
  if (!comparison) {
    return <p className="text-sm text-muted-foreground">No comparison metadata.</p>;
  }
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Prompt</p>
      <p className="text-sm">{comparison.prompt || "—"}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <ArtifactCard title="Primary" artifact={comparison.primary} />
        <ArtifactCard title="Secondary" artifact={comparison.secondary} />
      </div>
    </div>
  );
}

function ArtifactCard({ title, artifact }) {
  if (!artifact) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-sm">Not linked</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="text-sm font-semibold">{artifact.artifactName || artifact.label}</p>
      <p className="text-xs text-muted-foreground capitalize">{artifact.artifactType || "—"}</p>
    </div>
  );
}

function AnswerSummary({ answer }) {
  if (!answer) {
    return <p className="text-sm text-muted-foreground">No submission data.</p>;
  }

  const payload = answer.payload || {};
  const mode = payload.mode || answer.mode || null;
  const solidViolation = payload.solidViolation || payload.solid_violation;
  const solidComplexity = payload.solidComplexity || payload.solid_complexity;
  const solidFixedCode = payload.solidFixedCode || payload.solid_fixed_code;
  const solidComment = payload.assessmentComment || payload.assessment_comment;
  const leftData = payload.left || null;
  const rightData = payload.right || null;
  const snapshotDiff = payload.snapshotDiffData || payload.snapshot_diff_data || null;
  const criteriaRatings = normalizeCriteriaRatings(payload);
  const criteriaSummary = summarizeCriteriaRatings(criteriaRatings);

  const qa = [];
  if (mode === "stage1") {
    qa.push({ q: "Bug category", a: payload.leftCategory || "—" });
    if (payload.assessmentComment) qa.push({ q: "Notes", a: payload.assessmentComment });
  } else if (mode === "stage2") {
    qa.push({ q: "Participant A label", a: payload.leftCategory || "—" });
    qa.push({ q: "Participant B/AI label", a: payload.rightCategory || "—" });
    qa.push({ q: "Labels match?", a: payload.matchCorrectness || "—" });
    qa.push({
      q: "Final category",
      a:
        payload.finalCategory === "other"
          ? payload.finalOtherCategory || "Other (unspecified)"
          : payload.finalCategory || "—",
    });
    if (payload.assessmentComment) qa.push({ q: "Notes", a: payload.assessmentComment });
  } else if (mode === "solid") {
    qa.push({ q: "Violation", a: solidViolation || "—" });
    qa.push({ q: "Complexity", a: solidComplexity || "—" });
    qa.push({ q: "Refactor", a: solidFixedCode || "—" });
    if (solidComment) qa.push({ q: "Notes", a: solidComment });
  } else if (mode === "patch") {
    qa.push({ q: "Are patches clones?", a: payload.patchAreClones || "—" });
    if (payload.patchAreClones === "yes") {
      qa.push({ q: "Clone type", a: payload.patchCloneType || "—" });
    }
    if (payload.patchCloneComment) qa.push({ q: "Notes", a: payload.patchCloneComment });
  } else if (mode === "snapshot") {
    qa.push({ q: "Outcome", a: payload.snapshotOutcome || "—" });
    qa.push({
      q: "Change type",
      a:
        payload.snapshotChangeType === "other"
          ? payload.snapshotChangeTypeOther || "Other (unspecified)"
          : payload.snapshotChangeType || "—",
    });
    if (payload.assessmentComment) qa.push({ q: "Notes", a: payload.assessmentComment });
  } else {
    if (payload.assessmentComment) qa.push({ q: "Notes", a: payload.assessmentComment });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <DetailField label="Preference" value={answer.preference || "—"} />
        <DetailField label="Rating" value={answer.rating ?? "—"} />
      </div>
      <DetailField label="Summary" value={answer.summary || "—"} />
      <DetailField label="Notes" value={answer.notes || "—"} />
      <DetailField label="Stage" value={getStageLabel(mode)} />
      {qa.length > 0 && (
        <div className="rounded-md border p-3 bg-muted/40 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Participant responses</p>
          <div className="space-y-1">
            {qa.map((item, idx) => (
              <div key={`${item.q}-${idx}`} className="flex justify-between text-sm gap-2">
                <span className="text-muted-foreground">{item.q}</span>
                <span className="text-right font-medium">{item.a || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {criteriaRatings.length > 0 && (
        <div className="rounded-md border p-3 bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Criteria ratings</p>
            {criteriaSummary.weighted !== null && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Weighted score</span>
                <StarRow value={criteriaSummary.weighted} />
                <span className="text-muted-foreground">
                  {criteriaSummary.weighted.toFixed(2)} / 5
                  {criteriaSummary.weightTotal ? ` (weights total ${criteriaSummary.weightTotal}%)` : ""}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {criteriaRatings.map((item, idx) => (
              <div key={`${item.label}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  {item.weight != null && (
                    <span className="text-xs text-muted-foreground">Weight: {item.weight}%</span>
                  )}
                </div>
                <StarRow value={item.rating} />
              </div>
            ))}
          </div>
        </div>
      )}
      {solidViolation && (
        <div className="rounded-md border p-3 bg-muted/40 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">SOLID violation details</p>
          <DetailField label="Violation" value={solidViolation} />
          <DetailField label="Complexity" value={solidComplexity || "—"} />
          <DetailField label="Fixed code" value={solidFixedCode || "—"} />
          <DetailField label="Explanation" value={solidComment || "—"} />
        </div>
      )}

      {(leftData || rightData) && (
        <div className="grid gap-3 md:grid-cols-2">
          <PanePreview title="Artifact A" pane={leftData} />
          <PanePreview title="Artifact B" pane={rightData} />
        </div>
      )}

      {snapshotDiff && (
        <div className="grid gap-3">
          <PanePreview title="Participant diff upload" pane={snapshotDiff} />
        </div>
      )}

      {answer.metrics && renderPayload(answer.metrics, "Metrics")}
    </div>
  );
}

function ArtifactSummaryCard({ title, artifact, summary, onGenerate }) {
  const name = artifact?.artifactName || artifact?.label || title;
  const type = artifact?.artifactType || "—";
  const hasId = Boolean(artifact?.artifactId);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground capitalize">Type: {type}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={!hasId || summary.loading}>
          {summary.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {summary.loading ? "Summarizing..." : "AI summary"}
        </Button>
      </div>
      {summary.error && <p className="text-xs text-red-600">{summary.error}</p>}
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
        {summary.text || "No summary yet."}
      </p>
      {!hasId && <p className="text-[11px] text-amber-700">Artifact id missing; cannot summarize.</p>}
    </div>
  );
}

function PanePreview({ pane, title }) {
  if (!pane) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Not provided</p>
      </div>
    );
  }

  const kind = (pane.type || "").toLowerCase();
  const label = pane.name || title;

  if (kind === "image") {
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-sm font-medium">{label}</p>
        <img src={pane.url} alt={label} className="max-h-80 w-full object-contain border rounded" />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-sm font-medium">{label}</p>
        <object data={pane.url} type="application/pdf" className="w-full h-80 border rounded">
          <a href={pane.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
            Open PDF
          </a>
        </object>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="text-sm font-medium">{label}</p>
      <pre className="whitespace-pre-wrap rounded bg-white p-2 text-xs border max-h-80 overflow-auto">
        {pane.text || "—"}
      </pre>
    </div>
  );
}

function GroundTruthSummary({ groundTruth }) {
  if (!groundTruth) {
    return <p className="text-sm text-muted-foreground">No ground truth metadata available.</p>;
  }
  return (
    <div className="space-y-3 rounded-lg border p-4">
      {renderPayload(groundTruth, "Ground truth details")}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm">{String(value)}</p>
    </div>
  );
}

function renderPayload(payload, title) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="mt-2 grid gap-2 rounded-md border p-3 text-sm bg-muted/30">
        {Object.entries(payload).map(([key, value]) => (
          <div key={key} className="flex items-start justify-between text-xs">
            <span className="font-medium capitalize text-muted-foreground">{key}</span>
            <span className="ml-4 text-right break-all">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function StarRow({ value }) {
  const rating = Number(value);
  const safe = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= safe ? "text-amber-500" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}
