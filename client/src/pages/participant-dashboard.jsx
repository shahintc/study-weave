import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import DashboardControls from "@/components/dashboard/DashboardControls";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";

const ARTIFACT_MODE_LABELS = {
  stage1: "Stage 1 bug labeling",
  stage2: "Stage 2 adjudication",
  solid: "SOLID review",
  clone: "Patch clone check",
  snapshot: "Snapshot intent",
};

const PARTICIPATION_STATUS_META = {
  not_started: {
    label: "Not started",
    className: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  in_progress: {
    label: "In progress",
    className: "border border-amber-200 bg-amber-50 text-amber-800",
  },
  completed: {
    label: "Completed",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

const deriveCardStatus = (study, visitedSet) => {
  const submitted = Number(study?.artifactProgress?.totals?.submitted || 0) > 0;
  const progress = clampPercent(study?.progressPercent || 0);
  if (submitted || progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  // If the participant has opened this study at least once, mark in progress
  if (visitedSet?.has(String(study.studyId)) || visitedSet?.has(String(study.id))) {
    return "in_progress";
  }
  return "not_started";
};

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
};

const getParticipationStatusMeta = (status) =>
  PARTICIPATION_STATUS_META[status] || {
    label: status ? status.replace(/_/g, " ") : "Unknown",
    className: "border border-slate-200 bg-slate-50 text-slate-700",
  };

const normalizeStudyId = (study) =>
  String(study?.studyId || study?.id || study?.studyParticipantId || "");

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const matchesDateRange = (study, from, to) => {
  if (!from && !to) return true;
  const candidate =
    parseDateSafe(study?.updatedAt) ||
    parseDateSafe(study?.createdAt) ||
    parseDateSafe(study?.assignedAt) ||
    parseDateSafe(study?.submittedAt);
  if (!candidate) return true;
  const fromDate = from ? parseDateSafe(from) : null;
  const toDate = to ? parseDateSafe(to) : null;
  if (fromDate && candidate < fromDate) return false;
  if (toDate && candidate > toDate) return false;
  return true;
};

export default function ParticipantDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [studies, setStudies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visitedStudies, setVisitedStudies] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const keys = Object.keys(window.localStorage);
      const visited = keys
        .filter((key) => key.startsWith("studyVisit:"))
        .map((key) => key.split(":")[1]);
      return new Set(visited);
    } catch {
      return new Set();
    }
  });
  const defaultPreferences = useMemo(
    () => ({
      filters: { study: "all", criteria: "", from: "", to: "" },
      layout: ["welcome", "quickActions", "assignments"],
    }),
    [],
  );
  const {
    filters,
    layout,
    updateFilters,
    updateLayout,
    resetPreferences,
    savePreferences,
    savingPreferences,
    lastSavedAt,
    saveError,
  } = useDashboardPreferences(
    user ? `participant:${user.id}` : "participant:guest",
    defaultPreferences,
    authToken,
  );

  useEffect(() => {
    const raw = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!raw || !token) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "participant") {
        navigate("/researcher");
        return;
      }
      setAuthToken(token);
      setUser(parsed);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchAssignments = useCallback(async () => {
    const token = authToken || localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get("/api/participant/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudies(data.studies || []);
      setNotifications(data.notifications || []);
      try {
        window.localStorage.setItem(
          "participantNotificationsCount",
          String((data.notifications || []).length),
        );
        window.localStorage.setItem(
          "participantNotificationsList",
          JSON.stringify(data.notifications || []),
        );
      } catch (e) {
        // ignore storage failures
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError(err.response?.data?.message || "Unable to load assignments right now.");
    } finally {
      setLoading(false);
    }
  }, [authToken, navigate]);

  useEffect(() => {
    if (!user || !authToken) {
      return;
    }
    fetchAssignments();
  }, [user, authToken, fetchAssignments]);

  const hasActiveFilters = useMemo(
    () =>
      (filters.study && filters.study !== "all") ||
      Boolean(filters.criteria?.trim()) ||
      Boolean(filters.from) ||
      Boolean(filters.to),
    [filters],
  );

  const matchesFilters = useCallback(
    (study) => {
      if (!study) return false;
      const normalizedId = normalizeStudyId(study);
      if (filters.study && filters.study !== "all" && normalizedId !== String(filters.study)) {
        return false;
      }
      if (filters.criteria && filters.criteria.trim()) {
        const haystack = [
          study.title,
          study.description,
          study.criteriaSummary,
          study.nextAssignment?.modeLabel,
          study.criteriaLabel,
          JSON.stringify(study.criteria || study.criteriaLabels || study.criteriaWeights || {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(filters.criteria.trim().toLowerCase())) {
          return false;
        }
      }
      if (!matchesDateRange(study, filters.from, filters.to)) {
        return false;
      }
      return true;
    },
    [filters],
  );

  const filteredStudies = useMemo(
    () => studies.filter((study) => matchesFilters(study)),
    [studies, matchesFilters],
  );

  const studyOptions = useMemo(
    () =>
      studies.map((study) => ({
        value: normalizeStudyId(study),
        label: study.title || `Study ${normalizeStudyId(study)}`,
      })),
    [studies],
  );

  const actionableStudies = useMemo(
    () =>
      filteredStudies.filter(
        (study) => study?.cta && study.cta.type !== "none" && !study.cta.disabled,
      ),
    [filteredStudies],
  );
  const quickActions = actionableStudies.slice(0, 3);
  const noStudiesAssigned = !loading && studies.length === 0;
  const noStudiesAfterFilter =
    !loading && filteredStudies.length === 0 && studies.length > 0;

  const handleOpenCta = useCallback(
    (study) => {
      const cta = study?.cta;
      if (!cta || cta.type === "none") {
        return;
      }
      if (cta.disabled) {
        setError(cta.reason || "This study is no longer available.");
        return;
      }
      if (cta.type === "competency") {
        navigate("/participant/competency", {
          state: {
            assignmentId: cta.assignmentId,
            studyParticipantId: cta.studyParticipantId
              ? Number(cta.studyParticipantId)
              : undefined,
            studyId: cta.studyId ? Number(cta.studyId) : undefined,
          },
        });
        return;
      }

      const params = new URLSearchParams();
      if (cta.studyId) params.set("studyId", cta.studyId);
      if (cta.studyParticipantId) params.set("studyParticipantId", cta.studyParticipantId);
      if (cta.studyArtifactId) params.set("studyArtifactId", cta.studyArtifactId);
      if (cta.mode) params.set("mode", cta.mode);
      const search = params.toString();
      const path = search ? `/participant/artifacts-comparison?${search}` : "/participant/artifacts-comparison";

      navigate(path, {
        state: {
          studyId: cta.studyId ? Number(cta.studyId) : undefined,
          studyParticipantId: cta.studyParticipantId ? Number(cta.studyParticipantId) : undefined,
          studyArtifactId: cta.studyArtifactId ? Number(cta.studyArtifactId) : undefined,
          participant: user ? { id: user.id, name: user.name } : undefined,
          study,
          assignedMode: cta.mode || study?.nextAssignment?.mode || null,
        },
      });
    },
    [navigate, user],
  );

  const handleRefresh = () => {
    if (!loading) {
      fetchAssignments();
    }
  };

  const clearFilters = useCallback(() => {
    updateFilters(defaultPreferences.filters);
  }, [defaultPreferences.filters, updateFilters]);

  const renderArtifactChips = (modeMap = {}) => {
    const entries = Object.entries(modeMap).filter(([, meta]) => meta.completed > 0);
    if (!entries.length) {
      return <p className="text-sm text-muted-foreground">No artifact submissions yet.</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, meta]) => (
          <Badge key={key} variant="outline">
            {meta.completed} × {ARTIFACT_MODE_LABELS[key] || key}
          </Badge>
        ))}
      </div>
    );
  };

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case "welcome":
        return (
          <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Welcome back, {user?.name || "Participant"}!</h2>
              <p className="text-sm text-muted-foreground">
                Track your competency assessments and artifact assignments in one place.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Refreshing
                </span>
              ) : (
                "Refresh"
              )}
            </Button>
          </section>
        );
      case "quickActions":
        return (
          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Jump back into your work</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {quickActions.length ? (
                  quickActions.map((study) => (
                    <Button
                      key={`${study.studyParticipantId || study.id}-${study.cta.type}`}
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      onClick={() => handleOpenCta(study)}
                    >
                      {study.cta.buttonLabel}
                      <span className="text-xs text-muted-foreground">· {study.title}</span>
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? "No actions match your filters."
                      : "No pending actions. Check back soon."}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        );
      case "assignments":
        return (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">My Assigned Studies</h2>
              {hasActiveFilters ? (
                <Badge variant="outline" className="text-xs">
                  Filters on
                </Badge>
              ) : null}
            </div>
            {loading ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading your assignments…</span>
                </CardContent>
              </Card>
            ) : noStudiesAssigned ? (
              <Card>
                <CardHeader>
                  <CardTitle>No studies assigned yet</CardTitle>
                  <CardDescription>We'll email you as soon as a researcher assigns you to a study.</CardDescription>
                </CardHeader>
              </Card>
            ) : noStudiesAfterFilter ? (
              <Card>
                <CardHeader>
                  <CardTitle>No studies match these filters</CardTitle>
                  <CardDescription>Adjust the study, criteria, or date range to see your work.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Reset filters
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              filteredStudies.map((study) => {
                const cardStatus = deriveCardStatus(study, visitedStudies);
                const statusMeta = getParticipationStatusMeta(cardStatus);
                const progressPercent = clampPercent(study.progressPercent);
                const competency = study.competency || {};
                const nextModeLabel = study.nextAssignment?.modeLabel || null;
                const artifactTotals = study.artifactProgress?.totals?.submitted || 0;
                const isClosed = Boolean(study.isPastDeadline);
                return (
                  <Card key={normalizeStudyId(study) || study.studyParticipantId}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle>{study.title}</CardTitle>
                            <Badge
                              variant="outline"
                              className={isClosed ? "border-destructive/60 text-destructive" : "border-emerald-300 text-emerald-700"}
                            >
                              {isClosed ? "Closed" : "Active"}
                            </Badge>
                          </div>
                          <CardDescription>
                            {study.studyWindow ? study.studyWindow : "Active study"}
                            {study.researcher?.name ? ` · ${study.researcher.name}` : ""}
                          </CardDescription>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Overall progress</span>
                          <span className="font-medium">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Competency assessment</p>
                          <p className="text-sm text-muted-foreground">{competency.statusLabel || "Not assigned"}</p>
                          <Progress value={clampPercent(competency.completionPercent)} className="h-2" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Artifact submissions</p>
                          <p className="text-sm text-muted-foreground">{artifactTotals} submitted</p>
                          {renderArtifactChips(study.artifactProgress?.modes)}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2 text-left md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {nextModeLabel ? `Next up: ${nextModeLabel}` : "All tasks completed."}
                      </div>
                      {study.cta?.type !== "none" && (
                        <div className="flex flex-col items-start gap-1 md:items-end">
                          <Button
                            size="sm"
                            onClick={() => handleOpenCta(study)}
                            disabled={study.cta?.disabled}
                            title={study.cta?.disabled ? study.cta.reason || "Deadline passed." : undefined}
                          >
                            {study.cta?.buttonLabel || "Open task"}
                          </Button>
                          {study.cta?.disabled ? (
                            <p className="text-xs text-destructive">
                              {study.cta.reason || "The deadline has passed. You cannot start this study."}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <DashboardControls
        filters={filters}
        onFiltersChange={updateFilters}
        studyOptions={studyOptions}
        layout={layout}
        onLayoutChange={updateLayout}
        widgetLabels={{
          welcome: "Welcome header",
          quickActions: "Quick actions",
          assignments: "Assigned studies",
        }}
        onReset={resetPreferences}
        onSave={savePreferences}
        saving={savingPreferences}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        criteriaPlaceholder="Search criteria, modes, or labels"
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {layout.map((widgetId) => (
        <React.Fragment key={widgetId}>{renderWidget(widgetId)}</React.Fragment>
      ))}
    </div>
  );
}
