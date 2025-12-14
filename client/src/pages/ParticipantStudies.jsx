import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle } from "lucide-react";

const STATUS_LABELS = {
  pending: { label: "Pending", tone: "amber" },
  in_review: { label: "In review", tone: "blue" },
  resolved: { label: "Resolved", tone: "green" },
};

const DECISION_LABELS = {
  participant_correct: { label: "Participant correct", tone: "emerald" },
  llm_correct: { label: "LLM correct", tone: "blue" },
  inconclusive: { label: "Inconclusive", tone: "amber" },
  needs_followup: { label: "Needs follow-up", tone: "rose" },
};

export default function ParticipantStudies() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evaluations, setEvaluations] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!raw || !token) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "participant" && parsed.role !== "guest") {
        navigate("/researcher");
        return;
      }
      setUser(parsed);
      fetchEvaluations(token);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchEvaluations = async (token) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/participant/evaluations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvaluations(Array.isArray(data?.evaluations) ? data.evaluations : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load your study results right now.");
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    return evaluations.reduce((acc, entry) => {
      const studyId = entry.study?.id || entry.studyId || "unknown";
      if (!acc[studyId]) {
        acc[studyId] = { study: entry.study || {}, evaluations: [] };
      }
      acc[studyId].evaluations.push(entry);
      return acc;
    }, {});
  }, [evaluations]);

  const toneBadge = (tone = "slate", label) => {
    const map = {
      amber: "bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:bg-amber-400/15 dark:text-amber-100 dark:border-amber-400/40",
      blue: "bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:bg-blue-400/15 dark:text-blue-100 dark:border-blue-400/40",
      green: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-100 dark:border-emerald-400/40",
      emerald: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-100 dark:border-emerald-400/40",
      rose: "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:bg-rose-400/15 dark:text-rose-100 dark:border-rose-400/40",
      slate: "bg-muted text-foreground border border-border/70",
    };
    return <Badge className={map[tone] || map.slate}>{label}</Badge>;
  };

  const cards = Object.values(grouped);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Participant</p>
        <h1 className="text-2xl font-semibold">My study results</h1>
        <p className="text-sm text-muted-foreground">
          See decisions and notes from researchers for studies you’ve completed.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading your study results...
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No evaluations yet. Complete your assigned studies to see results here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ study, evaluations: evals }) => {
            const latest = evals[0] || {};
            const statusMeta = STATUS_LABELS[latest.review?.status] || STATUS_LABELS.pending;
            const decisionMeta = DECISION_LABELS[latest.review?.decision] || null;

            return (
              <Card key={study?.id || study?.title || Math.random()}>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">{study?.title || "Study"}</CardTitle>
                  <CardDescription>{study?.description || "No description provided."}</CardDescription>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {toneBadge(statusMeta.tone, statusMeta.label)}
                    {decisionMeta ? toneBadge(decisionMeta.tone, decisionMeta.label) : null}
                    {latest.review?.adjudicatedLabel ? (
                      <Badge variant="outline">{latest.review.adjudicatedLabel}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {latest.review?.notes ? <p>{latest.review.notes}</p> : null}
                  {Array.isArray(latest.review?.comments) && latest.review.comments.length ? (
                    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">Reviewer comments</p>
                      <div className="space-y-2">
                        {latest.review.comments.map((note) => (
                          <div key={note.id} className="rounded-md border border-border/50 bg-card p-2">
                            <p className="text-foreground">{note.comment || "—"}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{note.reviewer?.name || note.reviewer?.email || "Reviewer"}</span>
                              {note.rating ? <span>• {note.rating}/5</span> : null}
                              {note.createdAt ? (
                                <span>• {new Date(note.createdAt).toLocaleString()}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Your submission
                    </p>
                    <p>
                      Status: {latest.review?.status || "Pending"} • Submitted{" "}
                      {latest.submittedAt ? new Date(latest.submittedAt).toLocaleString() : "—"}
                    </p>
                    {latest.participantAnswer?.notes ? (
                      <p className="text-xs">
                        Your notes: {latest.participantAnswer.notes}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate("/participant")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
