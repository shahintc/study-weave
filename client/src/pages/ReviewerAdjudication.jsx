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
import { AlertCircle, CheckCircle2, Eye, RefreshCcw, Timer } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const DECISION_OPTIONS = [
  { value: "participant_correct", label: "Participant correct" },
  { value: "llm_correct", label: "LLM correct" },
  { value: "inconclusive", label: "Inconclusive" },
  { value: "needs_followup", label: "Needs follow-up" },
];

export default function ReviewerAdjudication() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [adjudications, setAdjudications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "pending", studyId: "all" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decisionForm, setDecisionForm] = useState({
    status: "pending",
    decision: "",
    adjudicatedLabel: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

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
      decision: entry.review?.decision || "",
      adjudicatedLabel: entry.review?.adjudicatedLabel || "",
      notes: entry.review?.notes || "",
    });
    setFormError("");
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
          decision: decisionForm.decision || undefined,
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

              <Separator className="my-4" />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Participant answer</h3>
                <AnswerSummary answer={selected.participantAnswer} />
              </section>

              <Separator className="my-4" />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">LLM / ground truth</h3>
                <GroundTruthSummary groundTruth={selected.groundTruth} />
              </section>

              <Separator className="my-4" />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Reviewer decision</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Review status</label>
                    <Select value={decisionForm.status} onValueChange={(value) => handleDecisionChange("status", value)}>
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
                    <Select value={decisionForm.decision} onValueChange={(value) => handleDecisionChange("decision", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No decision</SelectItem>
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
                    placeholder="e.g., GUI regression"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Reviewer notes</label>
                  <Textarea
                    value={decisionForm.notes}
                    onChange={(event) => handleDecisionChange("notes", event.target.value)}
                    rows={4}
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
                <Button onClick={handleSaveDecision} disabled={savingDecision}>
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
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <DetailField label="Preference" value={answer.preference || "—"} />
        <DetailField label="Rating" value={answer.rating ?? "—"} />
      </div>
      <DetailField label="Summary" value={answer.summary || "—"} />
      <DetailField label="Notes" value={answer.notes || "—"} />
      {renderPayload(answer.payload, "Participant payload")}
      {answer.metrics && renderPayload(answer.metrics, "Metrics")}
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
