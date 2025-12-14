import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, X, Eye, Download, Percent, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const parseEstimatedSeconds = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    // Heuristic: values already in seconds are usually > 5 minutes (300s).
    // Treat larger numbers as seconds to avoid multiplying twice.
    return numeric > 300 ? Math.round(numeric) : Math.round(numeric * 60);
  }
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? Math.round(minutes * 60) : null;
};

const resolveEstimatedSeconds = (assignment) => {
  const explicit = Number(assignment?.estimatedTimeSeconds);
  if (Number.isFinite(explicit)) return explicit;
  return parseEstimatedSeconds(assignment?.estimatedTime);
};

export default function CompetencyEvaluationReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [error, setError] = useState(null);
  const [submissionFilter, setSubmissionFilter] = useState("all");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const researcherId = user.id;
  // State for reviewer notes is now managed inside the dialog
  const [dialogReviewerNotes, setDialogReviewerNotes] = useState("");
  const [pendingAssignmentId, setPendingAssignmentId] = useState(() => {
    const stateId = location.state?.openAssignmentId;
    return stateId ? String(stateId) : null;
  });
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

  useEffect(() => {
    if (location.state?.openAssignmentId) {
      setPendingAssignmentId(String(location.state.openAssignmentId));
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.openAssignmentId, location.pathname, navigate]);

  const loadAssignments = useCallback(async () => {
    if (!researcherId) {
      return;
    }
    try {
      setLoading(true);
      const [submittedRes, statusRes] = await Promise.all([
        axios.get("/api/competency/assignments/submitted", {
          params: { researcherId },
        }),
        axios.get("/api/competency/assignments/researcher", {
          params: { researcherId },
        }),
      ]);

      const submittedAssignments = submittedRes.data.assignments || [];
      const grouped = groupByAssessment(submittedAssignments);
      setAssessments(grouped);

      const statusAssignments = statusRes.data.assignments || [];
      setAssignmentStatuses(statusAssignments);

      setError(null);
    } catch (err) {
      console.error("Error loading competency assignments:", err);
      setError("Failed to load competency assignments. Please try again.");
      setAssessments([]);
      setAssignmentStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [researcherId]);

  // Fetch submitted competency evaluations
useEffect(() => {
  loadAssignments();
}, [loadAssignments]);

  useEffect(() => {
    if (!pendingAssignmentId || !assessments.length) {
      return;
    }
    const match = assessments
      .flatMap((assessment) => assessment.submissions || [])
      .find((submission) => String(submission.id) === String(pendingAssignmentId));
    if (match) {
      handleViewEvaluation(match);
      setPendingAssignmentId(null);
    }
  }, [pendingAssignmentId, assessments]);

  const groupByAssessment = (assignments) => {
    const enriched = assignments.map((assignment) => {
      const estimated = resolveEstimatedSeconds(assignment);
      const threshold = estimated ? estimated * 0.3 : null;
      const flagged =
        threshold && Number.isFinite(assignment.timeTakenSeconds) && assignment.timeTakenSeconds > 0
          ? assignment.timeTakenSeconds < threshold
          : false;
      return {
        ...assignment,
        estimatedTimeSeconds: estimated,
        isFlaggedFast: flagged,
      };
    });

    const fullySubmitted = enriched.filter((assignment) => {
      const hasResponses = assignment.responses && Object.keys(assignment.responses).length > 0;
      const status = (assignment.status || "").toLowerCase();
      const hasDecision = Boolean(assignment.decision && assignment.decision !== "undecided");
      const isSubmittedState = ["submitted", "reviewed", "approved", "rejected"].includes(status);
      return hasResponses && (isSubmittedState || hasDecision);
    });

    const grouped = {};
    fullySubmitted.forEach((assignment) => {
      if (!grouped[assignment.assessmentId]) {
        grouped[assignment.assessmentId] = {
          assessmentId: assignment.assessmentId,
          title: assignment.title,
          submissions: [],
        };
      }
      grouped[assignment.assessmentId].submissions.push(assignment);
    });
    return Object.values(grouped);
  };

  const handleViewEvaluation = (assignment) => {
    setSelectedAssignment(assignment);
    setDialogReviewerNotes(assignment.reviewerNotes || "");
    setIsDialogOpen(true);
  };

  const recordDecision = async (decision) => {
    if (!selectedAssignment) {
      return;
    }
    const assignmentId = selectedAssignment.id;

    try {
      setLoadingStates((prev) => ({
        ...prev,
        [assignmentId]: decision,
      }));

      await axios.patch(`/api/competency/assignments/${assignmentId}/decision`, {
        decision,
        reviewerNotes: dialogReviewerNotes,
      });

      await loadAssignments();
      setIsDialogOpen(false);
      toast({
        title: decision === "approved" ? "Participant approved" : "Participant rejected",
        description: "Decision stored successfully.",
      });
    } catch (err) {
      console.error("Error recording decision:", err);
      const fallbackMessage =
        err.response?.data?.message || "Failed to record decision. Please try again.";
      toast({
        title: "Unable to record decision",
        description: fallbackMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [assignmentId]: undefined,
      }));
    }
  };

  const calculatePerformance = (assignment) => {
    if (!assignment?.questions || !assignment?.responses) {
      return { score: 0, total: 0, percentage: 0 };
    }

    const mcQuestions = assignment.questions.filter(
      (q) => q.type === "multiple_choice" && q.options?.length > 0
    );

    if (mcQuestions.length === 0) {
      return { score: 0, total: 0, percentage: 0 };
    }

    let correctAnswers = 0;
    mcQuestions.forEach((question) => {
      const correctOption = question.options.find((opt) => opt.isCorrect);
      const participantResponse = assignment.responses[question.id];
      if (correctOption && participantResponse === correctOption.text) {
        correctAnswers++;
      }
    });

    return {
      score: correctAnswers,
      total: mcQuestions.length,
      percentage: Math.round((correctAnswers / mcQuestions.length) * 100),
    };
  };

  const handleExport = (assessmentId, format) => {
    // Construct an absolute URL to the backend server.
    // This avoids the browser trying to fetch from the frontend dev server's address.
    const backendPort = import.meta.env.VITE_API_PORT || 5200;
    const backendUrl = `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
    const reportUrl = `${backendUrl}/api/competency/assessments/${assessmentId}/report?format=${format}`;
    // Open in a new tab to trigger download without leaving the page
    window.open(reportUrl, "_blank");
  };

  const handleApproveEvaluation = () => recordDecision("approved");

  const handleRejectEvaluation = () => recordDecision("rejected");

  const getStatusBadge = (submission) => {
    if (submission.decision === "approved") {
      return <Badge className="bg-green-600">Approved</Badge>;
    }
    if (submission.decision === "rejected") {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="outline">Awaiting Review</Badge>;
  };

  const humanize = (value) => {
    if (!value) return "Unknown";
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getAssignmentStatusBadge = (status) => {
    const normalized = (status || "").toLowerCase();
    const label = humanize(status) || "Unknown";

    if (normalized === "submitted") {
      return <Badge className="bg-blue-600 text-white">{label}</Badge>;
    }
    if (normalized === "in_progress") {
      return <Badge className="bg-amber-500 text-white">{label}</Badge>;
    }
    if (normalized === "pending") {
      return <Badge variant="outline">{label}</Badge>;
    }
    if (normalized === "reviewed") {
      return <Badge className="bg-emerald-600 text-white">{label}</Badge>;
    }
    return <Badge variant="secondary">{label}</Badge>;
  };

  const formatDecisionLabel = (decision) => {
    if (!decision || decision === "undecided") {
      return "Awaiting decision";
    }
    return humanize(decision);
  };

  const resolveLastUpdate = (assignment) =>
    assignment.submittedAt || assignment.updatedAt || assignment.createdAt;

  const formatDateTime = (value) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeTaken = (seconds) => {
    if (seconds === null || seconds === undefined) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const analytics = useMemo(() => {
    const selected = assessments.find((a) => String(a.assessmentId) === String(selectedAssessmentId));
    const submissions = selected ? (selected.submissions || []) : [];
    const total = submissions.length;
    const approved = submissions.filter((s) => s.decision === "approved").length;
    const acceptanceRate = total ? Math.round((approved / total) * 100) : 0;
    const scopedAssignments = assignmentStatuses.filter(
      (a) => String(a.assessmentId) === String(selectedAssessmentId)
    );
    const completionRate = scopedAssignments.length
      ? Math.round((submissions.length / scopedAssignments.length) * 100)
      : null;

    const times = submissions
      .map((s) => Number(s.timeTakenSeconds))
      .filter((v) => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);
    const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
    const medianTime = times.length ? times[Math.floor((times.length - 1) / 2)] : null;

    const scores = submissions
      .map((s) => calculatePerformance(s).percentage)
      .filter((v) => Number.isFinite(v));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const fastFlags = submissions.filter((s) => s.isFlaggedFast).length;
    const fastFlagPercent = total ? Math.round((fastFlags / total) * 100) : 0;

    const byDay = {};
    submissions.forEach((s) => {
      if (!s.submittedAt) return;
      const day = new Date(s.submittedAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const recentDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    const submissionTrend = recentDays.map((day) => ({ day, count: byDay[day] || 0 }));
    const acceptanceByDay = {};
    submissions.forEach((s) => {
      if (!s.submittedAt) return;
      const day = new Date(s.submittedAt).toISOString().slice(0, 10);
      const accepted = s.decision === "approved" ? 1 : 0;
      acceptanceByDay[day] = acceptanceByDay[day] || { accepted: 0, total: 0 };
      acceptanceByDay[day].accepted += accepted;
      acceptanceByDay[day].total += 1;
    });
    const acceptanceTrend = recentDays.map((day) => {
      const entry = acceptanceByDay[day];
      const rate = entry && entry.total ? Math.round((entry.accepted / entry.total) * 100) : 0;
      return { day, rate };
    });

    const scoreBuckets = [0, 50, 60, 70, 80, 90, 100].map((start, idx, arr) => {
      const end = arr[idx + 1] ?? 101;
      const count = scores.filter((s) => s >= start && s < end).length;
      return { label: `${start}-${end - 1}%`, count };
    });

    const timeBuckets = (() => {
      if (!times.length) return [];
      const bucketSize = 120; // 2 minutes
      const grouped = {};
      times.forEach((t) => {
        const bucket = Math.floor(t / bucketSize);
        grouped[bucket] = (grouped[bucket] || 0) + 1;
      });
      const maxBucket = Math.max(...Object.keys(grouped).map(Number));
      const result = [];
      for (let i = 0; i <= maxBucket; i++) {
        const start = i * bucketSize;
        const end = start + bucketSize;
        result.push({ label: `${Math.round(start / 60)}-${Math.round(end / 60)}m`, count: grouped[i] || 0 });
      }
      return result;
    })();

    const perQuestion = (() => {
      const stats = new Map();
      submissions.forEach((s) => {
        (s.questions || []).forEach((q) => {
          if (q.type !== "multiple_choice") return;
          const key = q.id || q.title || q.text || `q-${stats.size}`;
          const entry = stats.get(key) || { title: q.title || q.text || "Question", correct: 0, total: 0 };
          entry.total += 1;
          const response = s.responses?.[q.id];
          const correctOption = (q.options || []).find((opt) => opt.isCorrect);
          if (correctOption && response === correctOption.text) {
            entry.correct += 1;
          }
          stats.set(key, entry);
        });
      });
      return Array.from(stats.values()).map((q, idx) => ({
        label: q.title || `Q${idx + 1}`,
        rate: q.total ? Math.round((q.correct / q.total) * 100) : 0,
      }));
    })();

    return {
      total,
      accepted: approved,
      acceptanceRate,
      completionRate,
      avgTime,
      medianTime,
      avgScore,
      fastFlags,
      fastFlagPercent,
      submissionTrend,
      scoreBuckets,
      timeBuckets,
      perQuestion,
      normalCount: total - fastFlags,
      acceptanceTrend,
    };
  }, [assessments, assignmentStatuses, selectedAssessmentId]);

const submissionMax = useMemo(
  () => (analytics.submissionTrend.length ? Math.max(...analytics.submissionTrend.map((b) => b.count || 0), 1) : 1),
  [analytics.submissionTrend]
);
  const scoreMax = useMemo(
    () => (analytics.scoreBuckets.length ? Math.max(...analytics.scoreBuckets.map((b) => b.count || 0), 1) : 1),
    [analytics.scoreBuckets]
  );
  const timeMax = useMemo(
    () => (analytics.timeBuckets.length ? Math.max(...analytics.timeBuckets.map((b) => b.count || 0), 1) : 1),
    [analytics.timeBuckets]
  );

  const pendingCountByAssessment = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      const pending = (a.submissions || []).filter((s) => !s.decision || s.decision === "undecided").length;
      map.set(String(a.assessmentId), pending);
    });
    return map;
  }, [assessments]);

  const allCompetencies = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      map.set(String(a.assessmentId), {
        assessmentId: a.assessmentId,
        title: a.title,
        submissions: a.submissions || [],
      });
    });
    assignmentStatuses.forEach((s) => {
      const key = String(s.assessmentId);
      if (!map.has(key)) {
        map.set(key, {
          assessmentId: s.assessmentId,
          title: s.title || "Competency",
          submissions: [],
        });
      }
      const entry = map.get(key);
      const normalizedId = s.id || s.assignmentId || s.assignment_id;
      const alreadyAdded = (entry.submissions || []).some(
        (sub) => String(sub.id || sub.assignmentId || sub.assignment_id) === String(normalizedId),
      );
      if (!alreadyAdded) {
        entry.submissions = [...(entry.submissions || []), { ...s, id: normalizedId }];
      }
    });
    return Array.from(map.values()).sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }, [assessments, assignmentStatuses]);

  useEffect(() => {
    if (!selectedAssessmentId && allCompetencies.length) {
      setSelectedAssessmentId(allCompetencies[0].assessmentId);
    }
  }, [allCompetencies, selectedAssessmentId]);

  const selectedCompetency =
    allCompetencies.find((a) => String(a.assessmentId) === String(selectedAssessmentId)) ||
    allCompetencies[0] ||
    { assessmentId: null, title: "No competencies", submissions: [] };
  const selectedSubmissions = selectedCompetency?.submissions || [];
  const filteredSubmissions = useMemo(() => {
    if (!selectedSubmissions.length) return [];
    if (submissionFilter === "pending") {
      return selectedSubmissions.filter((s) => {
        const decision = (s.decision || "").toLowerCase();
        return !decision || decision === "undecided";
      });
    }
    if (submissionFilter === "reviewed") {
      return selectedSubmissions.filter((s) => {
        const decision = (s.decision || "").toLowerCase();
        return decision && decision !== "undecided";
      });
    }
    return selectedSubmissions;
  }, [selectedSubmissions, submissionFilter]);

  const getTimeTakenDisplay = (submission) => {
    const timeTaken = submission.timeTakenSeconds;
    const estimatedTime = submission.estimatedTimeSeconds;
    if (timeTaken === null || timeTaken === undefined) {
      return <span>{formatTimeTaken(timeTaken)}</span>;
    }
    let colorClass = '';
    if (estimatedTime) {
        colorClass = timeTaken > estimatedTime ? 'text-red-600' : 'text-green-600';
    }

    return <span className={colorClass}>{formatTimeTaken(timeTaken)}</span>;
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading evaluations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  if (!allCompetencies.length) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="text-3xl font-semibold">Competency Evaluations</h1>
        <p className="text-sm text-muted-foreground mt-2">No competencies found yet.</p>
      </div>
    );
  }
  const hasSubmittedAssessments = assessments.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-semibold">Competency Evaluations</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Track every competency quiz you have shared and review submissions as they arrive.
        </p>
      </div>

      <div className="bg-background rounded-lg border p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Competencies</h2>
            <p className="text-sm text-muted-foreground">Select one to view analytics and submissions.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedAssessmentId ? (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport(selectedAssessmentId, "csv")}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button size="sm" onClick={() => handleExport(selectedAssessmentId, "pdf")}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-3 max-h-64 overflow-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allCompetencies.map((comp) => {
              const isActive = String(comp.assessmentId) === String(selectedAssessmentId);
              const pending = pendingCountByAssessment.get(String(comp.assessmentId)) || 0;
              const submissionCount = comp.submissions?.length || 0;
              return (
                <button
                  key={comp.assessmentId}
                  className={`text-left rounded-lg border p-4 transition hover:border-primary hover:shadow ${
                    isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background"
                  }`}
                  onClick={() => setSelectedAssessmentId(comp.assessmentId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold line-clamp-1">{comp.title}</p>
                    <Badge variant={pending ? "destructive" : "secondary"} className="text-[11px]">
                      {pending ? `${pending} pending` : "No pending"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {submissionCount} submission{submissionCount === 1 ? "" : "s"}
                  </p>
                  {!submissionCount ? (
                    <p className="text-[11px] text-muted-foreground mt-1">No submissions yet</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Submissions & Status</CardTitle>
              <CardDescription>Monitor participants for this competency and review pending items.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase text-muted-foreground">Filter:</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSubmissionFilter("all")}
                className={submissionFilter === "all" ? "bg-primary/10 border-primary" : ""}
              >
                All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSubmissionFilter("pending")}
                className={submissionFilter === "pending" ? "bg-primary/10 border-primary" : ""}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSubmissionFilter("reviewed")}
                className={submissionFilter === "reviewed" ? "bg-primary/10 border-primary" : ""}
              >
                Reviewed
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedSubmissions.length ? (
            <p className="text-sm text-muted-foreground">No submissions yet for this competency.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Assignment Status</TableHead>
                    <TableHead>Review Status</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead>MC Score</TableHead>
                    <TableHead>Time Taken</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">{submission.participantName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {submission.participantEmail}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(submission.submittedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getAssignmentStatusBadge(submission.status || "submitted")}
                      </TableCell>
                      <TableCell>{getStatusBadge(submission)}</TableCell>
                      <TableCell>
                        {submission.isFlaggedFast ? (
                          <Badge variant="destructive" className="text-xs">Fast</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {calculatePerformance(submission).percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {getTimeTakenDisplay(submission)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const decision = (submission.decision || "").toLowerCase();
                          const isReviewed = decision && decision !== "undecided";
                          const status = (submission.status || "").toLowerCase();
                          const isInProgress = status === "in_progress" || status === "in-progress";
                          const isReviewable = !isReviewed && !isInProgress;
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewEvaluation(submission)}
                              disabled={!isReviewable || loadingStates[submission.id]}
                              title={
                                isReviewed
                                  ? "Already reviewed"
                                  : isInProgress
                                  ? "Participant still in progress"
                                  : undefined
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {isReviewed ? "Reviewed" : isInProgress ? "In progress" : "Review"}
                            </Button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Analytics & Charts</h2>
            <p className="text-sm text-muted-foreground">Trends across submissions for this competency (last 14 days).</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAnalytics((prev) => !prev)}>
            {showAnalytics ? "Hide analytics" : "Show analytics"}
          </Button>
        </div>

        {showAnalytics ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Acceptance rate</CardTitle>
                <CardDescription>Approved vs rejected submissions.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <div
                  className="h-32 w-32 rounded-full"
                  style={{
                    background: `conic-gradient(#16A34A ${analytics.acceptanceRate}%, #ef4444 0)`,
                  }}
                />
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-600"></span>
                    <span className="text-muted-foreground">Accepted</span>
                    <span className="font-medium">{analytics.accepted}/{analytics.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
                    <span className="text-muted-foreground">Rejected</span>
                    <span className="font-medium">{analytics.total - analytics.accepted}</span>
                  </div>
                  <p className="text-sm font-semibold">{analytics.acceptanceRate}%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acceptance over time</CardTitle>
                <CardDescription>Daily acceptance rate progression.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.acceptanceTrend.length ? (
                  analytics.acceptanceTrend.map((bucket) => (
                    <div key={bucket.day} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">{bucket.day}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(bucket.rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{bucket.rate}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submissions per day (14d)</CardTitle>
                <CardDescription>Volume of submissions each day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.submissionTrend.length ? (
                  analytics.submissionTrend.map((bucket) => (
                    <div key={bucket.day} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">{bucket.day}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min((bucket.count / submissionMax) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{bucket.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score distribution</CardTitle>
                <CardDescription>MC scores grouped by band.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.scoreBuckets.length ? (
                  analytics.scoreBuckets.map((bucket) => (
                    <div key={bucket.label} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">{bucket.label}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.min((bucket.count / scoreMax) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{bucket.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No score data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time to complete</CardTitle>
                <CardDescription>Histogram in 2-minute buckets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.timeBuckets.length ? (
                  analytics.timeBuckets.map((bucket) => (
                    <div key={bucket.label} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">{bucket.label}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-amber-500"
                          style={{
                            width: `${Math.min((bucket.count / timeMax) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{bucket.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No timing data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fast flags vs normal</CardTitle>
                <CardDescription>Breakdown of flagged vs normal submissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Fast flagged</span>
                  <Badge variant="destructive">{analytics.fastFlags}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Normal</span>
                  <Badge variant="outline">{analytics.normalCount}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-destructive"
                    style={{
                      width: `${analytics.total ? Math.min((analytics.fastFlags / analytics.total) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Per-question solve rate</CardTitle>
                <CardDescription>Multiple-choice questions only.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.perQuestion.length ? (
                  analytics.perQuestion.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-muted-foreground truncate">{item.label}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-sky-500"
                          style={{ width: `${Math.min(item.rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{item.rate}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No question-level data available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Analytics hidden</CardTitle>
              <CardDescription>Charts are hidden by default. Click “Show analytics” to view.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      {/* Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Competency Evaluation</DialogTitle>
            <DialogDescription>
              Review {selectedAssignment?.participantName}'s responses to determine if they should
              join the study.
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            (() => {
              const questions = Array.isArray(selectedAssignment.questions)
                ? selectedAssignment.questions
                : [];
              const assignmentSafe = { ...selectedAssignment, questions };
              const performance = calculatePerformance(assignmentSafe);
              const mcQuestions = questions.filter((q) => q.type === "multiple_choice");
              const saQuestions = questions.filter((q) => q.type === "short_answer");

              return (
                <div className="space-y-6">
                  {/* Participant Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-card">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Participant</p>
                      <p className="text-base font-medium">{selectedAssignment.participantName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Email</p>
                      <p className="text-base">{selectedAssignment.participantEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Submitted</p>
                      <p className="text-base">
                        {new Date(selectedAssignment.submittedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Status</p>
                      {getStatusBadge(selectedAssignment)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Time Taken</p>
                      <p className="text-base">
                        {formatTimeTaken(selectedAssignment.timeTakenSeconds)} / {formatTimeTaken(selectedAssignment.estimatedTimeSeconds)}
                      </p>
                      {selectedAssignment.isFlaggedFast ? (
                        <Badge variant="destructive" className="mt-1 text-xs">Flagged: unusually fast</Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Multiple Choice Responses */}
                  {mcQuestions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Multiple Choice Responses</h3>
                        <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
                          <p className="text-sm font-semibold text-muted-foreground">Performance</p>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-medium">{performance.percentage}%</p>
                            <span className="text-xs text-muted-foreground">
                              ({performance.score}/{performance.total} correct)
                            </span>
                          </div>
                        </div>
                      </div>
                      {mcQuestions.map((question, index) => {
                        const response = selectedAssignment.responses?.[question.id || index];
                        const correctOption = question.options.find(opt => opt.isCorrect);
                        const multiCorrectCount = (question.options || []).filter(opt => opt.isCorrect).length;
                        const typeLabel = multiCorrectCount > 1 ? "Multiple select" : "Single choice";
                        const isCorrect = response === correctOption?.text;
                        return (
                          <div key={question.id || index} className="p-4 space-y-2 rounded-lg border border-border bg-card">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">Q{index + 1}: {question.title}</p>
                              <Badge variant="outline" className="text-[11px]">{typeLabel}</Badge>
                            </div>
                            <div
                              className={`p-3 rounded text-sm border ${
                                isCorrect
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                                  : "bg-destructive/10 border-destructive/30 text-foreground"
                              }`}
                            >
                              <p className="font-semibold">{response || "(No response provided)"}</p>
                              {!isCorrect && correctOption && (
                                <p className="text-xs mt-1">Correct answer: <span className="font-semibold">{correctOption.text}</span></p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer Responses */}
                  {saQuestions.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Short Answer Responses</h3>
                      {saQuestions.map((question, index) => {
                        const response = selectedAssignment.responses?.[question.id || index];
                        return (
                          <div key={question.id || index} className="p-4 space-y-2 rounded-lg border border-border bg-card">
                            <p className="font-medium text-sm">Q{index + 1}: {question.title}</p>
                            <div className="p-3 rounded text-sm border border-border bg-muted/60">
                              <p className="text-muted-foreground whitespace-pre-wrap">{response || "(No response provided)"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reviewer Notes */}
                  <div className="space-y-2 pt-4">
                    <label htmlFor="notes" className="text-sm font-semibold">
                      Reviewer Notes (Optional)
                    </label>
                    <Textarea
                      id="notes"
                      placeholder="Add notes about this participant's evaluation, reasons for acceptance/rejection, or potential study fit..."
                      value={dialogReviewerNotes}
                      onChange={(e) => setDialogReviewerNotes(e.target.value)}
                      className="text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              );
            })()
          )}

          <DialogFooter className="flex gap-3 justify-end pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={loadingStates[selectedAssignment?.id]}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectEvaluation}
              disabled={loadingStates[selectedAssignment?.id]}
            >
              <X className="h-4 w-4 mr-2" />
              Deny
            </Button>
            <Button
              onClick={handleApproveEvaluation}
              disabled={loadingStates[selectedAssignment?.id]}
            >
              <Check className="h-4 w-4 mr-2" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
