import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const COMPETENCY_ASSIGNMENTS = [
  {
    id: "asm-1",
    title: "Baseline Competency Check",
    studyTitle: "Comparison Study 1",
    participants: 12,
    submitted: 8,
    awaitingReview: 3,
    declined: 1,
    lastUpdated: "2h ago",
    status: "In review",
  },
  {
    id: "asm-2",
    title: "Mobile UX Diagnostic",
    studyTitle: "Prototype Quality Sprint",
    participants: 7,
    submitted: 5,
    awaitingReview: 2,
    declined: 0,
    lastUpdated: "Yesterday",
    status: "Needs review",
  },
];

const PARTICIPANT_PIPELINE = [
  {
    id: "pat-01",
    name: "Ava Mayer",
    segment: "Senior Engineer",
    assessment: "Baseline Competency Check",
    score: 82,
    status: "Approved",
    assignedStudy: "Comparison Study 1",
  },
  {
    id: "pat-02",
    name: "Noah Singh",
    segment: "Design Partner",
    assessment: "Baseline Competency Check",
    score: 64,
    status: "Needs review",
    assignedStudy: "Pending",
  },
  {
    id: "pat-03",
    name: "Mia Chen",
    segment: "Bootcamp Grad",
    assessment: "Mobile UX Diagnostic",
    score: 71,
    status: "Approved",
    assignedStudy: "Prototype Quality Sprint",
  },
  {
    id: "pat-04",
    name: "Leo Martins",
    segment: "Design Partner",
    assessment: "Mobile UX Diagnostic",
    score: 55,
    status: "Declined",
    assignedStudy: "—",
  },
];

export default function ResearcherAssignmentsOverview() {
  const totals = useMemo(() => {
    const totalAssigned = COMPETENCY_ASSIGNMENTS.reduce(
      (sum, assignment) => sum + assignment.participants,
      0,
    );
    const approved = PARTICIPANT_PIPELINE.filter((entry) => entry.status === "Approved").length;
    const awaitingReview = COMPETENCY_ASSIGNMENTS.reduce(
      (sum, entry) => sum + entry.awaitingReview,
      0,
    );
    return { totalAssigned, approved, awaitingReview };
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Competency assignments & study gating</h1>
          <p className="text-sm text-muted-foreground">
            Track every competency quiz, review submissions, and move qualified participants into studies.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">Create new competency quiz</Button>
          <Button>Create assignment</Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total participants assigned</CardDescription>
            <CardTitle className="text-3xl">{totals.totalAssigned}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Across {COMPETENCY_ASSIGNMENTS.length} active competency checks.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting researcher review</CardDescription>
            <CardTitle className="text-3xl">{totals.awaitingReview}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Complete reviews to unlock study invites.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved & study-ready</CardDescription>
            <CardTitle className="text-3xl">{totals.approved}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            These participants can be assigned immediately.
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Active competency assignments</CardTitle>
            <CardDescription>Monitor submissions and route qualified participants to studies.</CardDescription>
          </div>
          <Button variant="ghost" size="sm">
            Export summary
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {COMPETENCY_ASSIGNMENTS.map((assignment) => {
            const completionPercent = Math.round(
              (assignment.submitted / assignment.participants) * 100,
            );
            return (
              <div
                key={assignment.id}
                className="rounded-lg border p-4 md:flex md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium">{assignment.title}</p>
                    <Badge variant="outline">{assignment.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {assignment.participants} participants • {assignment.studyTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {assignment.lastUpdated}</p>
                </div>
                <div className="mt-4 flex flex-col gap-3 md:mt-0 md:w-1/2">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{assignment.submitted} submitted</span>
                      <span>{completionPercent}% complete</span>
                    </div>
                    <Progress value={completionPercent} className="mt-1" />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{assignment.awaitingReview} need review</Badge>
                    <Badge variant="secondary">{assignment.declined} declined</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      Review submissions
                    </Button>
                    <Button size="sm">Assign to study</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant pipeline</CardTitle>
          <CardDescription>See who has passed competency checks and where they’re headed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned study</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PARTICIPANT_PIPELINE.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">{participant.name}</TableCell>
                  <TableCell>{participant.segment}</TableCell>
                  <TableCell>{participant.assessment}</TableCell>
                  <TableCell>{participant.score}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        participant.status === "Approved"
                          ? "secondary"
                          : participant.status === "Declined"
                            ? "outline"
                            : "default"
                      }
                    >
                      {participant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{participant.assignedStudy}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Separator />
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Completed assessments appear here automatically. Connect Slack to notify approved participants.
          </p>
          <Button size="sm" variant="outline">
            View all participants
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
