import React, { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Check, X, Eye } from "lucide-react";

export default function CompetencyEvaluationReview() {
  const [assessments, setAssessments] = useState([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const researcherId = user.id;

  // Fetch submitted competency evaluations
  useEffect(() => {
    const fetchAssignments = async () => {
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
    };

    if (researcherId) {
      fetchAssignments();
    }
  }, [researcherId]);

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
    setReviewerNotes("");
    setIsDialogOpen(true);
  };

  const handleApproveEvaluation = async () => {
    if (!selectedAssignment) return;

    try {
      setLoadingStates((prev) => ({
        ...prev,
        [selectedAssignment.id]: "approving",
      }));

      // TODO: Add endpoint to approve evaluation
      // await axios.post(`/api/competency/assignments/${selectedAssignment.id}/approve`, {
      //   reviewerNotes,
      // });

      alert("Participant approved for study assignment. (Mock - backend pending)");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error approving evaluation:", err);
      alert("Failed to approve evaluation");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [selectedAssignment.id]: undefined,
      }));
    }
  };

  const handleRejectEvaluation = async () => {
    if (!selectedAssignment) return;

    try {
      setLoadingStates((prev) => ({
        ...prev,
        [selectedAssignment.id]: "rejecting",
      }));

      // TODO: Add endpoint to reject evaluation
      // await axios.post(`/api/competency/assignments/${selectedAssignment.id}/reject`, {
      //   reviewerNotes,
      // });

      alert("Participant rejected from study assignment. (Mock - backend pending)");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error rejecting evaluation:", err);
      alert("Failed to reject evaluation");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [selectedAssignment.id]: undefined,
      }));
    }
  };

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

              {/* Responses */}
              <div className="space-y-4">
                <h3 className="font-semibold">Participant Responses</h3>
                {selectedAssignment.questions &&
                  selectedAssignment.questions.map((question, index) => {
                    const response = selectedAssignment.responses?.[question.id || index];
                    return (
                      <div
                        key={question.id || index}
                        className="p-4 border rounded-lg space-y-2"
                      >
                        <p className="font-medium text-sm">
                          Q{index + 1}: {question.title}
                        </p>
                        <div className="p-3 bg-muted rounded text-sm">
                          <p className="text-muted-foreground">
                            {response || "(No response provided)"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Reviewer Notes */}
              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-semibold">
                  Reviewer Notes (Optional)
                </label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this participant's evaluation, reasons for acceptance/rejection, or potential study fit..."
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
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
