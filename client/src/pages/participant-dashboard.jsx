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
import {
  buildStudyTimerKey,
  formatDuration,
  readTimerSnapshot,
} from "@/lib/studyTimer";

const ARTIFACT_MODE_LABELS = {
  stage1: "Stage 1 bug labeling",
  solid: "SOLID review",
  clone: "Patch clone check",
  snapshot: "Snapshot intent",
  custom: "Custom stage",
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

const deriveProgressPercent = (status) => {
  if (status === "completed") return 100;
  if (status === "in_progress") return 50;
  return 0;
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

const buildAssignmentNotificationsFromStudies = (studies = []) => {
  if (!Array.isArray(studies) || !studies.length) return [];
  return studies
    .filter((study) => study && (study.studyParticipantId || study.id))
    .map((study) => {
      const studyParticipantId = study.studyParticipantId || study.id || null;
      const studyId = study.studyId || study.id || null;
      return {
        id: `${studyParticipantId}-assigned`,
        type: "assignment",
        message: `You were assigned to ${study.title || "a study"}.`,
        studyId: studyId ? String(studyId) : null,
        studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
        cta: study.cta || null,
        createdAt: study.timelineStart || study.lastUpdatedAt || new Date().toISOString(),
      };
    });
};

const dedupeNotifications = (list = []) => {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    if (!item || !item.id || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    result.push(item);
  });
  return result;
};

const normalizeTimerSnapshot = (timer) => {
  if (!timer) return null;
  return {
    elapsedMs: Math.max(0, Number(timer.elapsedMs) || 0),
    running: Boolean(timer.running),
    submitted: Boolean(timer.submitted),
  };
};

const buildTimerKeyForStudy = (study, artifactId) => {
  if (artifactId) {
    return buildStudyTimerKey({
      studyId: study.studyId,
      studyArtifactId: artifactId,
      studyParticipantId: study.studyParticipantId,
    });
  }
  return study.studyId
    ? `study:${study.studyId}:${study.studyParticipantId || "self"}`
    : null;
};

export default function ParticipantDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [studies, setStudies] = useState([]);
  const [publicStudies, setPublicStudies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicError, setPublicError] = useState("");
  const [joiningStudyId, setJoiningStudyId] = useState(null);
  const [studyScope, setStudyScope] = useState("all"); // all | public | private
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const joinedStudyIds = useMemo(() => {
    const ids = studies
      .map((study) => Number(study?.studyId || study?.id))
      .filter((value) => Number.isFinite(value));
    return new Set(ids);
  }, [studies]);
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
  const [timerSnapshots, setTimerSnapshots] = useState({});
  const defaultPreferences = useMemo(
    () => ({
      filters: { study: "all", criteria: "", from: "", to: "" },
      layout:
        user?.role === "guest"
          ? ["public", "assignments"]
          : ["quickActions", "assignments", "public"],
    }),
    [user?.role],
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
      if (parsed.role !== "participant" && parsed.role !== "guest") {
        navigate("/researcher");
        return;
      }
      setAuthToken(token);
      setUser(parsed);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchPublicStudies = useCallback(async () => {
    const token = authToken || localStorage.getItem("token");
    if (!token) return;
    setPublicLoading(true);
    setPublicError("");
    try {
      const { data } = await axios.get("/api/studies/public", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPublicStudies(data.studies || []);
    } catch (err) {
      setPublicError(err.response?.data?.message || "Unable to load public studies right now.");
    } finally {
      setPublicLoading(false);
    }
  }, [authToken]);

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
      const rawNotifications = Array.isArray(data.notifications) ? data.notifications : [];
      const fallbackNotifications = buildAssignmentNotificationsFromStudies(data.studies);
      const mergedNotifications = dedupeNotifications([...rawNotifications, ...fallbackNotifications]);
      let filteredNotifications = mergedNotifications;
      try {
        const readRaw = window.localStorage.getItem("participantNotificationsReadIds");
        const readIds = new Set(JSON.parse(readRaw || "[]"));
        filteredNotifications = mergedNotifications.filter((item) => !readIds.has(item.id));
      } catch {
        filteredNotifications = mergedNotifications;
      }

      setStudies(data.studies || []);
      setNotifications(filteredNotifications);
      try {
        window.localStorage.setItem(
          "participantNotificationsCount",
          String(filteredNotifications.length),
        );
        window.localStorage.setItem(
          "participantNotificationsList",
          JSON.stringify(filteredNotifications),
        );
        window.dispatchEvent(new Event("storage"));
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

  const refreshTimerSnapshots = useCallback(async () => {
    if (!studies.length) {
      setTimerSnapshots({});
      return;
    }
    const token =
      authToken ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("token")
        : null);
    const next = {};
    await Promise.all(
      studies.map(async (study) => {
        const checkpointTimer = normalizeTimerSnapshot(study.lastCheckpoint?.timer);
        const fallbackStudyArtifactId =
          study.nextAssignment?.studyArtifactId ||
          study.cta?.studyArtifactId ||
          study.lastCheckpoint?.timer?.studyArtifactId ||
          null;

        const timerKey = buildTimerKeyForStudy(study, fallbackStudyArtifactId);
        if (!timerKey) return;

        const fallbackSnapshot =
          typeof window !== "undefined" ? readTimerSnapshot(timerKey) : null;
        const studyArtifactId = fallbackStudyArtifactId;
        if (!study.studyId || !studyArtifactId || !token) {
          if (checkpointTimer) {
            next[timerKey] = checkpointTimer;
          } else if (fallbackSnapshot) {
            next[timerKey] = fallbackSnapshot;
          }
          return;
        }
        try {
          const { data } = await axios.get("/api/participant/timer", {
            params: {
              studyId: study.studyId,
              studyArtifactId,
              studyParticipantId: study.studyParticipantId || undefined,
            },
            headers: { Authorization: `Bearer ${token}` },
          });
          const serverTimer = normalizeTimerSnapshot(data?.timer);
          if (serverTimer) {
            next[timerKey] = serverTimer;
            return;
          }
        } catch (err) {
          if (err?.response?.status !== 404) {
            console.warn("Timer refresh failed", err);
          }
        }
        if (checkpointTimer) {
          next[timerKey] = checkpointTimer;
        } else if (fallbackSnapshot) {
          next[timerKey] = fallbackSnapshot;
        }
      }),
    );
    setTimerSnapshots(next);
  }, [authToken, studies]);

  useEffect(() => {
    if (!user || !authToken) {
      return;
    }
    fetchAssignments();
    fetchPublicStudies();
  }, [user, authToken, fetchAssignments, fetchPublicStudies]);

  useEffect(() => {
    refreshTimerSnapshots();
    const tick = () => {
      refreshTimerSnapshots();
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [refreshTimerSnapshots]);

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
      filteredStudies
        .filter((study) => {
          if (studyScope === "public") return study.isPublic;
          if (studyScope === "private") return !study.isPublic;
          return true;
        })
        .filter((study) => study?.cta && study.cta.type !== "none" && !study.cta.disabled),
    [filteredStudies, studyScope],
  );
  const quickActions = actionableStudies.slice(0, 3);
  const scopedStudies = useMemo(
    () =>
      filteredStudies.filter((study) => {
        if (studyScope === "public") return study.isPublic;
        if (studyScope === "private") return !study.isPublic;
        return true;
      }),
    [filteredStudies, studyScope],
  );
  const visibleAssignments = useMemo(
    () => (showAllAssignments ? scopedStudies : scopedStudies.slice(0, 6)),
    [scopedStudies, showAllAssignments],
  );

  const noStudiesAssigned = !loading && studies.length === 0;
  const noStudiesAfterFilter = !loading && scopedStudies.length === 0 && studies.length > 0;
  const isGuest = user?.role === "guest";
  const layoutWithoutWelcome = useMemo(() => layout.filter((id) => id !== "welcome"), [layout]);
  const shouldPairPublicWithAssignments =
    !isGuest && layoutWithoutWelcome.includes("assignments") && layoutWithoutWelcome.includes("public");

  useEffect(() => {
    setShowAllAssignments(false);
  }, [studyScope, filters.study, filters.criteria, filters.from, filters.to]);

  const handleJoinPublicStudy = async (studyId) => {
    const token = authToken || localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setJoiningStudyId(studyId);
    setError("");
    try {
      await axios.post(
        "/api/participant/join-public",
        { studyId },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      await Promise.all([fetchAssignments(), fetchPublicStudies()]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to join this study right now.");
    } finally {
      setJoiningStudyId(null);
    }
  };

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
      fetchPublicStudies();
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
      case "public":
        return (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Available public studies</h2>
                <p className="text-xs text-muted-foreground">
                  Public studies are open to everyone. {isGuest ? "Join as a guest now." : "Enroll without waiting for an invite."}
                </p>
              </div>
            </div>
            {publicError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {publicError}
              </div>
            ) : null}
            {publicLoading ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading public studies…</span>
                </CardContent>
              </Card>
            ) : publicStudies.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No public studies available</CardTitle>
                  <CardDescription>Check back later for open guest studies.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              publicStudies.map((study) => (
                <Card key={study.id}>
                  <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{study.title}</CardTitle>
                      <Badge variant="outline">Public</Badge>
                    </div>
                    <CardDescription>{study.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-muted-foreground">
                    {study.researcher?.name ? <p>Researcher: {study.researcher.name}</p> : null}
                    {study.artifactCount ? <p>{study.artifactCount} artifacts</p> : <p>No artifacts yet</p>}
                    {study.timelineEnd ? (
                      <p className="text-xs text-muted-foreground/80">
                        Ends {new Date(study.timelineEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      {isGuest
                        ? "Guest session expires in 4 hours from login."
                        : "Self-serve enrollment — no invite needed."}
                    </div>
                    {(() => {
                      const alreadyJoined = joinedStudyIds.has(Number(study.id));
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleJoinPublicStudy(study.id)}
                          disabled={joiningStudyId === study.id || alreadyJoined}
                          variant={alreadyJoined ? "outline" : "default"}
                        >
                          {alreadyJoined
                            ? "Already joined"
                            : joiningStudyId === study.id
                            ? "Joining..."
                            : "Join study"}
                        </Button>
                      );
                    })()}
                  </CardFooter>
                </Card>
              ))
            )}
          </section>
        );
      case "assignments":
        return (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {isGuest ? "My guest enrollments" : "My Assigned Studies"}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-2 rounded-full border bg-muted/40 p-1 text-xs">
                  {[
                    { key: "all", label: "All" },
                    { key: "public", label: "Public" },
                    { key: "private", label: "Invited" },
                  ].map((option) => (
                    <Button
                      key={option.key}
                      size="sm"
                      variant={studyScope === option.key ? "secondary" : "ghost"}
                      className="h-8 rounded-full px-3"
                      onClick={() => setStudyScope(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {hasActiveFilters ? (
                  <Badge variant="outline" className="text-xs">
                    Filters on
                  </Badge>
                ) : null}
              </div>
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
                  <CardDescription>
                    {isGuest
                      ? "Join a public study to get started."
                      : "We'll email you as soon as a researcher assigns you to a study."}
                  </CardDescription>
                </CardHeader>
                {isGuest ? (
                  <CardFooter>
                    <Button variant="secondary" size="sm" onClick={() => fetchPublicStudies()}>
                      Browse public studies
                    </Button>
                  </CardFooter>
                ) : null}
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
              <>
              {visibleAssignments.map((study) => {
                const cardStatus = deriveCardStatus(study, visitedStudies);
                const competency = study.competency || {};
                const nextModeLabel = study.nextAssignment?.modeLabel || null;
                const artifactTotals = study.artifactProgress?.totals?.submitted || 0;
                const isClosed = Boolean(study.isPastDeadline);
                const timerKey = buildTimerKeyForStudy(
                  study,
                  study.nextAssignment?.studyArtifactId ||
                    study.cta?.studyArtifactId ||
                    study.lastCheckpoint?.timer?.studyArtifactId ||
                    null,
                );
                const fallbackTimerSnapshot = normalizeTimerSnapshot(
                  study.lastCheckpoint?.timer,
                );
                const timerSnapshot = timerKey
                  ? timerSnapshots[timerKey] || fallbackTimerSnapshot
                  : fallbackTimerSnapshot;
                const timerNotStarted =
                  !timerSnapshot ||
                  (!timerSnapshot.running &&
                    !timerSnapshot.submitted &&
                    (!timerSnapshot.elapsedMs || timerSnapshot.elapsedMs === 0));
                const effectiveCardStatus = timerNotStarted
                  ? "not_started"
                  : cardStatus;
                const statusMeta = getParticipationStatusMeta(effectiveCardStatus);
                const progressPercent = deriveProgressPercent(effectiveCardStatus);
                const timerIndicatorClass = timerSnapshot?.submitted
                  ? "bg-slate-400"
                  : timerSnapshot?.running
                  ? "bg-emerald-500 animate-pulse"
                  : timerSnapshot
                  ? "bg-amber-500"
                  : "bg-slate-300";
                const timerStatusText = timerSnapshot?.submitted
                  ? "submitted"
                  : timerSnapshot?.running
                  ? "running"
                  : timerSnapshot
                  ? "paused"
                  : null;
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

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Artifact submissions</p>
                          <p className="text-sm text-muted-foreground">{artifactTotals} submitted</p>
                          {renderArtifactChips(study.artifactProgress?.modes)}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Time on artifact task</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={`h-2.5 w-2.5 rounded-full ${timerIndicatorClass}`} />
                            <span>
                              {timerSnapshot
                                ? `${formatDuration(timerSnapshot.elapsedMs)}${timerStatusText ? ` (${timerStatusText})` : ""}`
                                : "Not started yet"}
                            </span>
                          </div>
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
              })}
              {scopedStudies.length > 6 ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllAssignments((prev) => !prev)}
                  >
                    {showAllAssignments ? "Show less" : `See all (${scopedStudies.length})`}
                  </Button>
                </div>
              ) : null}
              </>
            )}
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
          <h2 className="text-xl font-semibold">
            Welcome back, {user?.name || (isGuest ? "Guest Participant" : "Participant")}!
          </h2>
          <p className="text-sm text-muted-foreground">
            {isGuest
              ? "You can browse and join public studies during this guest session."
              : "Track your competency assessments and artifact assignments in one place."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading || publicLoading}>
            {loading || publicLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Refreshing
              </span>
            ) : (
              "Refresh"
            )}
          </Button>
          {isGuest ? (
            <Badge variant="outline" className="text-xs">
              Guest session
            </Badge>
          ) : null}
        </div>
      </section>

      <DashboardControls
        filters={filters}
        onFiltersChange={updateFilters}
        studyOptions={studyOptions}
        layout={layoutWithoutWelcome}
        onLayoutChange={updateLayout}
        widgetLabels={{
          quickActions: "Quick actions",
          public: "Public studies",
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

      {(() => {
        if (!shouldPairPublicWithAssignments) {
          return layoutWithoutWelcome.map((widgetId) => (
            <React.Fragment key={widgetId}>{renderWidget(widgetId)}</React.Fragment>
          ));
        }
        const rendered = [];
        let pairedRendered = false;
        layoutWithoutWelcome.forEach((widgetId) => {
          if (!pairedRendered && (widgetId === "assignments" || widgetId === "public")) {
            pairedRendered = true;
            rendered.push(
              <div
                key="assignments-public-grid"
                className="grid gap-6 lg:grid-cols-[1.6fr_1fr] xl:grid-cols-[1.8fr_1fr]"
              >
                <div className="min-w-0">{renderWidget("assignments")}</div>
                <div className="min-w-0">{renderWidget("public")}</div>
              </div>,
            );
          } else if (widgetId !== "assignments" && widgetId !== "public") {
            rendered.push(<React.Fragment key={widgetId}>{renderWidget(widgetId)}</React.Fragment>);
          }
        });
        return rendered;
      })()}
    </div>
  );
}
