import React, { useEffect, useState, useCallback } from "react";
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
import { AlertCircle, Check, X, Eye, Download, Percent } from "lucide-react";

export default function CompetencyEvaluationReview() {
  const [assessments, setAssessments] = useState([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const researcherId = user.id;
  // New state for all assessments
  const [allAssessments, setAllAssessments] = useState([]);
  // State for reviewer notes is now managed inside the dialog
  const [dialogReviewerNotes, setDialogReviewerNotes] = useState("");

  const loadAssignments = useCallback(async () => {
    if (!researcherId) {
      return;
    }
    try {
      setLoading(true);
      const [submittedRes, statusRes, allAssessmentsRes] = await Promise.all([
        axios.get("/api/competency/assignments/submitted", {
          params: { researcherId },
        }),
        axios.get("/api/competency/assignments/researcher", {
          params: { researcherId },
        }),
        axios.get("/api/competency/assessments/researcher", {
          params: { researcherId },
        }),
      ]);

      const submittedAssignments = submittedRes.data.assignments || [];
      const grouped = groupByAssessment(submittedAssignments);
      setAssessments(grouped);

      const statusAssignments = statusRes.data.assignments || [];
      setAssignmentStatuses(statusAssignments);

      const allAssessmentsData = allAssessmentsRes.data.assessments || [];
      setAllAssessments(allAssessmentsData);

      setError(null);
    } catch (err) {
      console.error("Error loading competency assignments:", err);
      setError("Failed to load competency assignments. Please try again.");
      setAssessments([]);
      setAssignmentStatuses([]);
      setAllAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [researcherId]);

  // Fetch submitted competency evaluations
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const groupByAssessment = (assignments) => {
    const fullySubmitted = assignments.filter((assignment) => {
      const hasResponses = assignment.responses && Object.keys(assignment.responses).length > 0;
      const status = (assignment.status || '').toLowerCase();
      return status === 'submitted' && hasResponses;
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
      alert(
        decision === "approved"
          ? "Participant approved. Decision stored."
          : "Participant rejected. Decision stored."
      );
    } catch (err) {
      console.error("Error recording decision:", err);
      const fallbackMessage =
        err.response?.data?.message || "Failed to record decision. Please try again.";
      alert(fallbackMessage);
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
  const hasSubmittedAssessments = assessments.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-semibold">Competency Evaluations</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Track every competency quiz you have shared and review submissions as they arrive.
        </p>
      </div>

      {/* NEW SECTION: All Competency Assessments */}
      <Card>
        <CardHeader>
          <CardTitle>Competency Assessments</CardTitle>
          <CardDescription>
            Manage and generate performance reports for all competency quizzes you have created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not created any competency assessments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {allAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">{assessment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Created on {formatDateTime(assessment.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(assessment.id, "csv")}
                    >
                      <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Button size="sm" onClick={() => handleExport(assessment.id, "pdf")}>
                      <Download className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Assignment status overview</CardTitle>
          <CardDescription>Monitor every participant invited to a competency quiz.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Invite participants to a competency quiz and their status will appear here.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentStatuses.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.participantName || "Participant"}
                        <p className="text-xs text-muted-foreground">{assignment.participantEmail}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignment.title || "Assessment"}
                      </TableCell>
                      <TableCell>{getAssignmentStatusBadge(assignment.status)}</TableCell>
                      <TableCell className="text-sm">{formatDecisionLabel(assignment.decision)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(resolveLastUpdate(assignment))}
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

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Submitted evaluations</h2>
          <p className="text-sm text-muted-foreground">
            Only participants who completed their competency quiz appear below for review.
          </p>
        </div>

        {!hasSubmittedAssessments ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No submitted evaluations yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Evaluations will appear here once participants submit their competency quizzes.
              </p>
            </CardContent>
          </Card>
        ) : (
          assessments.map((assessment) => (
            <div key={assessment.assessmentId} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{assessment.title}</h3>
                <Badge variant="secondary">
                  {assessment.submissions.length}{" "}
                  {assessment.submissions.length === 1 ? "submission" : "submissions"}
                </Badge>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MC Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessment.submissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.participantName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {submission.participantEmail}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(submission.submittedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>{getStatusBadge(submission)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              {calculatePerformance(submission).percentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewEvaluation(submission)}
                            disabled={loadingStates[submission.id]}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator className="mt-8" />
            </div>
          ))
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
              const performance = calculatePerformance(selectedAssignment);
              const mcQuestions = selectedAssignment.questions.filter(q => q.type === 'multiple_choice');
              const saQuestions = selectedAssignment.questions.filter(q => q.type === 'short_answer');

              return (
                <div className="space-y-6">
                  {/* Participant Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
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
                  </div>

                  {/* Multiple Choice Responses */}
                  {mcQuestions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Multiple Choice Responses</h3>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
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
                        const isCorrect = response === correctOption?.text;
                        return (
                          <div key={question.id || index} className="p-4 border rounded-lg space-y-2">
                            <p className="font-medium text-sm">Q{index + 1}: {question.title}</p>
                            <div className={`p-3 rounded text-sm ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
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
                          <div key={question.id || index} className="p-4 border rounded-lg space-y-2">
                            <p className="font-medium text-sm">Q{index + 1}: {question.title}</p>
                            <div className="p-3 bg-muted rounded text-sm">
                              <p className="text-muted-foreground whitespace-pre-wrap">{response || "(No response provided)"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
