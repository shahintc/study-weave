import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  LineChart as LineChartIcon,
  Settings2,
  Users,
  Activity,
  CalendarDays,
  Download,
  RefreshCcw,
  Share2,
  Copy, Check,
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import LineChart from "@/components/charts/LineChart";
import DonutChart from "@/components/charts/DonutChart";
import DashboardControls from "@/components/dashboard/DashboardControls";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";

const REFRESH_INTERVAL_MS = 30_000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const createDefaultFilters = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * DAY_IN_MS);
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
    participantId: "all",
  };
};

const isRangeValid = (from, to) => {
  if (!from || !to) {
    return true;
  }
  return from <= to;
};

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "study";

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
};

const formatDateInput = (date) => date.toISOString().slice(0, 10);

const formatDateLabel = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const normalizeStudyId = (study) => String(study?.id || study?.studyId || "");

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const matchesDateRange = (study, from, to) => {
  if (!from && !to) return true;
  const candidate =
    parseDateSafe(study?.updatedAt) ||
    parseDateSafe(study?.createdAt) ||
    parseDateSafe(study?.lastActivityAt) ||
    parseDateSafe(study?.submittedAt);
  if (!candidate) return true;
  const fromDate = from ? parseDateSafe(from) : null;
  const toDate = to ? parseDateSafe(to) : null;
  if (fromDate && candidate < fromDate) return false;
  if (toDate && candidate > toDate) return false;
  return true;
};

export default function ResearcherDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false);
  const [monitoringStudyId, setMonitoringStudyId] = useState(null);
  const [monitorFilters, setMonitorFilters] = useState(() => createDefaultFilters());
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [studies, setStudies] = useState([]);
  const [isStudiesLoading, setIsStudiesLoading] = useState(false);
  const [studiesError, setStudiesError] = useState("");
  const [, setNotifications] = useState([]);
  const [participantMatrix, setParticipantMatrix] = useState(null);
  const [participantError, setParticipantError] = useState("");
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  // --- Start: Rewritten Copy Logic ---
  const [copyStatus, setCopyStatus] = useState({ studyId: null, state: 'idle' }); // 'idle', 'copied', 'error'
  const [assignmentSaving, setAssignmentSaving] = useState({});
  const analyticsRef = useRef(null);
  const defaultPreferences = useMemo(
    () => ({
      filters: { study: "all", criteria: "", from: "", to: "" },
      layout: ["cta", "highlights", "activeStudies"],
    }),
    [],
  );
  const {
    filters: dashboardFilters,
    layout,
    updateFilters,
    updateLayout,
    resetPreferences,
    savePreferences,
    savingPreferences,
    lastSavedAt,
    saveError,
  } = useDashboardPreferences(
    user ? `researcher:${user.id}` : "researcher:guest",
    defaultPreferences,
    authToken,
  );

  const loadStudies = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setIsStudiesLoading(true);
    setStudiesError("");
    try {
      const { data } = await api.get("/api/researcher/studies", {
        params: { researcherId: user.id, archived: "false" },
      });
      setStudies(data.studies || []);
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load studies";
      setStudiesError(message);
    } finally {
      setIsStudiesLoading(false);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!authToken) {
      return;
    }
    try {
      const { data } = await api.get("/api/researcher/notifications", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const list = data.notifications || [];
      let filtered = list;
      try {
        const rawRead = window.localStorage.getItem("researcherNotificationsReadIds");
        const readIds = new Set(JSON.parse(rawRead || "[]"));
        filtered = list.filter((item) => !readIds.has(item.id));
      } catch (parseError) {
        filtered = list;
      }
      setNotifications(filtered);
      try {
        window.localStorage.setItem("researcherNotificationsCount", String(filtered.length));
        window.localStorage.setItem("researcherNotificationsList", JSON.stringify(filtered));
        window.dispatchEvent(new Event("storage"));
      } catch (storageError) {
        // Ignore storage write errors
      }
    } catch (error) {
      console.error("Researcher notifications fetch failed", error);
    }
  }, [authToken]);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!rawUser || !token) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(rawUser);
      setUser(parsed);
      setAuthToken(token);
      if (parsed.role !== "researcher") {
        navigate("/participant-dashboard");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (user?.role === "researcher" && authToken) {
      loadStudies();
      fetchNotifications();
    }
  }, [user, authToken, loadStudies, fetchNotifications]);

  const selectedStudy = useMemo(() => {
    if (!monitoringStudyId) return null;
    return studies.find((study) => String(study.id) === String(monitoringStudyId)) || null;
  }, [studies, monitoringStudyId]);

  const hasActiveDashboardFilters = useMemo(
    () =>
      (dashboardFilters.study && dashboardFilters.study !== "all") ||
      Boolean(dashboardFilters.criteria?.trim()) ||
      Boolean(dashboardFilters.from) ||
      Boolean(dashboardFilters.to),
    [dashboardFilters],
  );

  const matchesDashboardFilters = useCallback(
    (study) => {
      if (!study) return false;
      const normalizedId = normalizeStudyId(study);
      if (
        dashboardFilters.study &&
        dashboardFilters.study !== "all" &&
        normalizedId !== String(dashboardFilters.study)
      ) {
        return false;
      }
      if (dashboardFilters.criteria && dashboardFilters.criteria.trim()) {
        const haystack = [
          study.title,
          study.description,
          study.criteriaSummary,
          study.nextMilestone,
          JSON.stringify(study.criteria || study.criteriaWeights || {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(dashboardFilters.criteria.trim().toLowerCase())) {
          return false;
        }
      }
      if (!matchesDateRange(study, dashboardFilters.from, dashboardFilters.to)) {
        return false;
      }
      return true;
    },
    [dashboardFilters],
  );

  const filteredStudies = useMemo(
    () => studies.filter((study) => matchesDashboardFilters(study)),
    [studies, matchesDashboardFilters],
  );

  const studyFilterOptions = useMemo(
    () =>
      studies.map((study) => ({
        value: normalizeStudyId(study),
        label: study.title || `Study ${normalizeStudyId(study)}`,
      })),
    [studies],
  );

  const noStudiesAfterFilter =
    !isStudiesLoading && filteredStudies.length === 0 && studies.length > 0;
  const noStudiesAtAll = !isStudiesLoading && studies.length === 0;

  const dashboardHighlights = useMemo(() => {
    if (!filteredStudies.length) {
      return [
        { label: "Active studies", value: 0, helper: "Syncing data...", icon: Activity },
        { label: "Participants engaged", value: 0, helper: "Invite participants to begin", icon: Users },
        { label: "Avg artifact rating", value: "0.0", helper: "No submissions yet", icon: LineChartIcon },
      ];
    }

    const totalParticipants = filteredStudies.reduce((sum, study) => sum + (study.participants || 0), 0);
    const participantTargetTotal = filteredStudies.reduce(
      (sum, study) => sum + (study.participantTarget || 0),
      0,
    );
    const avgRating =
      filteredStudies.length > 0
        ? (
            filteredStudies.reduce((sum, study) => sum + Number(study.avgRating || 0), 0) /
            filteredStudies.length
          ).toFixed(1)
        : "0.0";

    return [
      { label: "Active studies", value: filteredStudies.length, helper: "+ new insights", icon: Activity },
      {
        label: "Participants engaged",
        value: totalParticipants,
        helper: `${Math.max(0, participantTargetTotal - totalParticipants)} seats open`,
        icon: Users,
      },
      { label: "Avg artifact rating", value: avgRating, helper: "Latest submissions", icon: LineChartIcon },
    ];
  }, [filteredStudies]);

  const participantOptions = useMemo(() => {
    if (analytics?.participantFilters?.length) {
      return analytics.participantFilters;
    }
    return selectedStudy?.participantsList ?? [];
  }, [analytics?.participantFilters, selectedStudy]);

  const fetchAnalytics = useCallback(
    async (studyId, filterOverride) => {
      if (!studyId) return;
      const filtersToUse = filterOverride || monitorFilters;
      if (!isRangeValid(filtersToUse.from, filtersToUse.to)) {
        setAnalyticsError("Choose a valid date range to load analytics");
        return;
      }

      setAnalyticsError("");
      setIsAnalyticsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filtersToUse.from) params.append("from", filtersToUse.from);
        if (filtersToUse.to) params.append("to", filtersToUse.to);
        if (filtersToUse.participantId && filtersToUse.participantId !== "all") {
          params.append("participantId", filtersToUse.participantId);
        }
        const query = params.toString();
        const endpoint = query
          ? `/api/analytics/study/${studyId}?${query}`
          : `/api/analytics/study/${studyId}`;
        const { data } = await api.get(endpoint);
        setAnalytics(data);
        setLastRefreshAt(new Date().toISOString());
      } catch (error) {
        console.error("Analytics fetch failed", error);
        const message = error.response?.data?.message || "Unable to load analytics";
        setAnalyticsError(message);
      } finally {
        setIsAnalyticsLoading(false);
      }
    },
    [monitorFilters],
  );

  const fetchParticipantMatrix = useCallback(
    async (studyId) => {
      if (!studyId || !authToken) {
        return;
      }
      setIsParticipantsLoading(true);
      setParticipantError("");
      try {
        const { data } = await api.get(`/api/researcher/studies/${studyId}/participants`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        setParticipantMatrix(data);
        const defaultMode = data.defaultArtifactMode || "";
        setAssignmentDrafts(
          Object.fromEntries(
            (data.participants || []).map((participant) => [
              participant.id,
              {
                mode: participant.nextAssignment?.mode || defaultMode || "",
                studyArtifactId: participant.nextAssignment?.studyArtifactId || "",
              },
            ]),
          ),
        );
      } catch (error) {
        console.error("Participant matrix fetch failed", error);
        const message =
          error.response?.data?.message || "Unable to load participant details";
        setParticipantError(message);
      } finally {
        setIsParticipantsLoading(false);
      }
    },
    [authToken],
  );
  const handleMonitorRefresh = useCallback(() => {
    if (!monitoringStudyId) return;
    fetchAnalytics(monitoringStudyId, monitorFilters);
    fetchParticipantMatrix(monitoringStudyId);
  }, [fetchAnalytics, fetchParticipantMatrix, monitorFilters, monitoringStudyId]);

  const handleAssignmentDraftChange = useCallback((participantId, field, value) => {
    setAssignmentDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...prev[participantId],
        [field]: value,
      },
    }));
  }, []);

  const handleAssignmentSave = useCallback(
    async (participantId) => {
      if (!monitoringStudyId || !authToken) {
        return;
      }
      const draft = assignmentDrafts[participantId];
      if (!draft || !draft.mode) {
        setParticipantError("Select a stage before assigning.");
        return;
      }
      setAssignmentSaving((prev) => ({ ...prev, [participantId]: true }));
      try {
        await api.patch(
          `/api/researcher/studies/${monitoringStudyId}/participants/${participantId}/next-assignment`,
          {
            mode: draft.mode,
            studyArtifactId: draft.studyArtifactId || null,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );
        await fetchParticipantMatrix(monitoringStudyId);
      } catch (error) {
        console.error("Participant assignment save failed", error);
        const message =
          error.response?.data?.message || "Unable to update the assignment right now";
        setParticipantError(message);
      } finally {
        setAssignmentSaving((prev) => ({ ...prev, [participantId]: false }));
      }
    },
    [assignmentDrafts, authToken, fetchParticipantMatrix, monitoringStudyId],
  );

  useEffect(() => {
    if (!monitorDialogOpen || !monitoringStudyId) {
      return undefined;
    }
    fetchAnalytics(monitoringStudyId);
    const intervalId = setInterval(() => fetchAnalytics(monitoringStudyId), REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [monitorDialogOpen, monitoringStudyId, fetchAnalytics]);

  useEffect(() => {
    if (!monitorDialogOpen || !monitoringStudyId) {
      return;
    }
    fetchParticipantMatrix(monitoringStudyId);
  }, [monitorDialogOpen, monitoringStudyId, fetchParticipantMatrix]);

  useEffect(() => {
    if (!monitorDialogOpen) {
      setMonitoringStudyId(null);
      setAnalytics(null);
      setMonitorFilters(createDefaultFilters());
      setAnalyticsError("");
      setLastRefreshAt(null);
      setParticipantMatrix(null);
      setAssignmentDrafts({});
      setParticipantError("");
      setIsParticipantsLoading(false);
      setAssignmentSaving({});
    }
  }, [monitorDialogOpen]);

  const handleCopyLink = (studyId) => {
    const publicUrl = `${window.location.origin}/study/public/${studyId}`;

    // navigator.clipboard is only available in secure contexts (https:// or localhost)
    if (!navigator.clipboard?.writeText) {
      setCopyStatus({ studyId, state: 'error' });
      setTimeout(() => setCopyStatus({ studyId: null, state: 'idle' }), 3000);
      return;
    }

    navigator.clipboard.writeText(publicUrl).then(
      () => { // Success
        setCopyStatus({ studyId, state: 'copied' });
        setTimeout(() => setCopyStatus({ studyId: null, state: 'idle' }), 2000);
      },
      () => { // Failure
        setCopyStatus({ studyId, state: 'error' });
        setTimeout(() => setCopyStatus({ studyId: null, state: 'idle' }), 3000);
      }
    );
  };

  const openMonitor = (studyId) => {
    setMonitoringStudyId(studyId);
    setMonitorFilters(createDefaultFilters());
    setMonitorDialogOpen(true);
  };

  const exportAsImage = useCallback(async () => {
    if (!analyticsRef.current || !selectedStudy) return;
    try {
      const node = analyticsRef.current;
      const width = Math.max(node.scrollWidth, node.getBoundingClientRect().width);
      const height = Math.max(node.scrollHeight, node.getBoundingClientRect().height);
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
      });
      const link = document.createElement("a");
      link.download = `${slugify(selectedStudy.title)}-analytics.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export analytics image", error);
    }
  }, [selectedStudy]);

  const exportAsPdf = useCallback(async () => {
    if (!analyticsRef.current || !selectedStudy) return;
    try {
      const node = analyticsRef.current;
      const width = Math.max(node.scrollWidth, node.getBoundingClientRect().width);
      const height = Math.max(node.scrollHeight, node.getBoundingClientRect().height);
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
      });
      const pdf = new jsPDF("landscape", "pt", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
      const renderWidth = width * scale;
      const renderHeight = height * scale;
      pdf.addImage(dataUrl, "PNG", margin, margin, renderWidth, renderHeight);
      pdf.save(`${slugify(selectedStudy.title)}-analytics.pdf`);
    } catch (error) {
      console.error("Failed to export analytics PDF", error);
    }
  }, [selectedStudy]);

  const clearDashboardFilters = useCallback(() => {
    updateFilters(defaultPreferences.filters);
  }, [defaultPreferences.filters, updateFilters]);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case "cta":
        return (
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Researcher Dashboard</CardTitle>
                <CardDescription>
                  Welcome, {user?.name || "Researcher"} • {user?.email || ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Start a new participant study</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("participants-list")}>
                    Show Participants
                  </Button>
                  <Button onClick={() => navigate("study-creation-wizard")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Study
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        );
      case "highlights":
        return (
          <section className="grid gap-4 md:grid-cols-3">
            {dashboardHighlights.map((tile) => {
              const Icon = tile.icon;
              return (
                <Card key={tile.label}>
                  <CardContent className="flex items-center justify-between gap-4 p-6">
                    <div>
                      <p className="text-sm text-muted-foreground">{tile.label}</p>
                      <p className="text-2xl font-semibold">{tile.value}</p>
                      <p className="text-xs text-muted-foreground">{tile.helper}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        );
      case "activeStudies":
        return (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">My Active Studies</h2>
                <p className="text-sm text-muted-foreground">
                  Monitor participants, artifact quality, and readiness at a glance.
                </p>
              </div>
              {hasActiveDashboardFilters ? (
                <Badge variant="outline" className="text-xs">
                  Filters on
                </Badge>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active pipelines</CardTitle>
                <CardDescription>Progress, quality, and handoffs per study.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isStudiesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading studies...</p>
                ) : studiesError ? (
                  <p className="text-sm text-destructive">{studiesError}</p>
                ) : noStudiesAtAll ? (
                  <p className="text-sm text-muted-foreground">No studies yet. Create one to get started.</p>
                ) : noStudiesAfterFilter ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <span>No studies match these filters.</span>
                    <Button variant="outline" size="sm" onClick={clearDashboardFilters}>
                      Reset filters
                    </Button>
                  </div>
                ) : (
                  filteredStudies.map((study) => (
                    <div
                      key={normalizeStudyId(study)}
                      className="grid gap-4 border-b pb-6 last:border-none last:pb-0 lg:grid-cols-[2fr,1.2fr,1fr,auto]"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{study.title}</h3>
                          <Badge
                            variant="outline"
                            className={
                              study.health === "attention"
                                ? "border-amber-200 text-amber-600"
                                : "border-emerald-200 text-emerald-600"
                            }
                          >
                            {study.status}
                          </Badge>
                          {study.isPublic && (
                            <Badge className={badgeVariants({ variant: "default" }) + " bg-blue-600 text-white"}>
                              Public
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{study.description}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {study.window}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {study.participants}/{study.participantTarget} participants
                          </span>
                          <span>{study.nextMilestone}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-semibold">{study.progress}%</span>
                          <Badge
                            variant="outline"
                            className={
                              study.progressDelta >= 0
                                ? "border-emerald-200 text-emerald-600"
                                : "border-rose-200 text-rose-600"
                            }
                          >
                            {study.progressDelta > 0 ? `+${study.progressDelta}%` : `${study.progressDelta}%`}
                          </Badge>
                        </div>
                        <Progress value={study.progress} className="mt-2" />
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Quality signal</p>
                        <p className="text-2xl font-semibold">{Number(study.avgRating ?? 0).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Avg participant rating</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {study.isPublic && (() => {
                            const isCurrent = copyStatus.studyId === study.id;
                            const isCopied = isCurrent && copyStatus.state === 'copied';
                            const isError = isCurrent && copyStatus.state === 'error';
                            return (
                              <Button variant="outline" size="sm" onClick={() => handleCopyLink(study.id)} disabled={isCopied}>
                                {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                {isCopied ? "Copied!" : isError ? "Copy Failed" : "Copy Invite Link"}
                              </Button>
                            );
                          })()}
                        <Button size="sm" onClick={() => openMonitor(study.id)}>
                          <LineChartIcon className="mr-2 h-4 w-4" />
                          Monitor
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <DashboardControls
        filters={dashboardFilters}
        onFiltersChange={updateFilters}
        studyOptions={studyFilterOptions}
        layout={layout}
        onLayoutChange={updateLayout}
        widgetLabels={{
          cta: "Hero actions",
          highlights: "Highlights",
          activeStudies: "Active studies",
        }}
        onReset={resetPreferences}
        onSave={savePreferences}
        saving={savingPreferences}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        criteriaPlaceholder="Search description, milestones, or criteria"
      />

      {layout.map((widgetId) => (
        <React.Fragment key={widgetId}>{renderWidget(widgetId)}</React.Fragment>
      ))}

      <Dialog open={monitorDialogOpen} onOpenChange={setMonitorDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Study monitor</DialogTitle>
            <DialogDescription>Live analytics refresh automatically every 30 seconds.</DialogDescription>
          </DialogHeader>
          {selectedStudy ? (
            <StudyMonitorPanel
              study={selectedStudy}
              analytics={analytics}
              participantOptions={participantOptions}
              isLoading={isAnalyticsLoading}
              error={analyticsError}
              onRefresh={handleMonitorRefresh}
              onExportImage={exportAsImage}
              onExportPdf={exportAsPdf}
              analyticsRef={analyticsRef}
              lastRefreshAt={lastRefreshAt}
              participantMatrix={participantMatrix}
              participantError={participantError}
              isParticipantsLoading={isParticipantsLoading}
              assignmentDrafts={assignmentDrafts}
              onAssignmentDraftChange={handleAssignmentDraftChange}
              onAssignmentSave={handleAssignmentSave}
              assignmentSaving={assignmentSaving}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Choose a study to open the monitor.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudyMonitorPanel({
  study,
  analytics,
  participantOptions = [],
  isLoading,
  error,
  onRefresh,
  onExportImage,
  onExportPdf,
  analyticsRef,
  lastRefreshAt,
  participantMatrix,
  participantError,
  isParticipantsLoading,
  assignmentDrafts,
  onAssignmentDraftChange,
  onAssignmentSave,
  assignmentSaving,
}) {
  const summary = analytics?.summary;
  const hasPayload = Boolean(summary);
  const participants = analytics?.participants ?? [];
  const participantDetails = participantMatrix?.participants ?? [];
  const studyCriteria = participantMatrix?.study?.evaluationCriteria ?? [];
  const availableModes = participantMatrix?.artifactModes ?? [];
  const studyDefaultMode = participantMatrix?.defaultArtifactMode || null;
  const defaultModeMeta = availableModes.find((entry) => entry.value === studyDefaultMode);
  const studyArtifacts = participantMatrix?.studyArtifacts ?? [];
  const completionBreakdown = useMemo(() => {
    const total = participantDetails.length;
    const completed = participantDetails.filter((participant) => {
      const statusValue =
        typeof participant.participationStatus === "string"
          ? participant.participationStatus.trim().toLowerCase()
          : "";
      const statusDone = statusValue === "completed";
      const progressDone = Number(participant.progressPercent || 0) >= 100;
      const hasCompletedAt = Boolean(participant.completedAt);
      return statusDone || progressDone || hasCompletedAt;
    }).length;
    const open = Math.max(total - completed, 0);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, open, percent };
  }, [participantDetails]);

  const completionSegments = useMemo(
    () => [
      { label: "Completed", value: completionBreakdown.completed, color: "#10b981" },
      { label: "Outstanding", value: completionBreakdown.open, color: "#d1d5db" },
    ],
    [completionBreakdown],
  );
  const timeToCompleteSeries = useMemo(
    () =>
      participantDetails
        .map((participant) => {
          const seconds = Number(participant.timeOnTaskSeconds);
          if (!Number.isFinite(seconds) || seconds <= 0) {
            return null;
          }
          return { id: participant.id, name: participant.name, seconds };
        })
        .filter(Boolean)
        .sort((a, b) => b.seconds - a.seconds),
    [participantDetails],
  );
  const criteriaSegments = useMemo(() => {
    const totalWeight = studyCriteria.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
    return studyCriteria.map((entry, index) => {
      const palette = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#f59e0b"];
      return {
        label: entry.label || `Criteria ${index + 1}`,
        value: Number(entry.weight || 0),
        color: palette[index % palette.length],
        percent: totalWeight ? Math.round((Number(entry.weight || 0) / totalWeight) * 100) : 0,
      };
    });
  }, [studyCriteria]);

  const criteriaAxis = useMemo(() => {
    const labels = [];
    const seen = new Set();
    studyCriteria.forEach((criterion) => {
      const label = (criterion.label || criterion.name || criterion.title || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      labels.push({ key, label });
    });

    participantDetails.forEach((participant) => {
      (participant.artifactAssessments || []).forEach((assessment) => {
        const stars = assessment?.payload?.evaluationStarRatings;
        if (!stars || typeof stars !== 'object') {
          return;
        }
        Object.keys(stars).forEach((rawKey) => {
          const label = String(rawKey || '').trim();
          if (!label) return;
          const key = label.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          labels.push({ key, label });
        });
      });
    });

    return labels;
  }, [participantDetails, studyCriteria]);

  const criteriaSeries = useMemo(() => {
    if (!criteriaAxis.length) {
      return [];
    }
    return participantDetails
      .map((participant) => {
        const ratings = new Map();
        (participant.artifactAssessments || []).forEach((assessment) => {
          if (assessment.status !== 'submitted') return;
          const stars = assessment?.payload?.evaluationStarRatings;
          if (!stars || typeof stars !== 'object') {
            return;
          }
          Object.entries(stars).forEach(([rawKey, rawValue]) => {
            const key = String(rawKey || '').trim().toLowerCase();
            if (!key) return;
            const numeric = Number(rawValue);
            if (!Number.isFinite(numeric)) return;
            const bucket = ratings.get(key) || [];
            bucket.push(numeric);
            ratings.set(key, bucket);
          });
        });

        const points = criteriaAxis.map((axis) => {
          const values = ratings.get(axis.key);
          if (!values || !values.length) {
            return { label: axis.label, key: axis.key, value: null };
          }
          const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
          return { label: axis.label, key: axis.key, value: Number(avg.toFixed(2)) };
        });

        return {
          id: participant.id,
          name: participant.name,
          points,
        };
      })
      .filter((entry) => entry.points.some((point) => point.value !== null));
  }, [criteriaAxis, participantDetails]);

  const formatParticipationStatus = (status) => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', tone: 'border-emerald-200 text-emerald-600' };
      case 'in_progress':
        return { label: 'In progress', tone: 'border-slate-200 text-slate-600' };
      default:
        return { label: 'Not started', tone: 'border-slate-200 text-slate-600' };
    }
  };

  const renderArtifactProgress = (progress) => {
    if (!progress?.modes) {
      return <p className="text-xs text-muted-foreground">No artifact submissions yet.</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {availableModes.map((mode) => {
          const entry = progress.modes[mode.value] || { completed: 0 };
          const count = entry.completed || 0;
          return (
            <Badge
              key={mode.value}
              variant={count ? 'default' : 'outline'}
              className="text-xs"
            >
              {mode.label.split(' – ')[0]} • {count}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{study.title}</h3>
          <p className="text-sm text-muted-foreground">{study.window} • {study.nextMilestone}</p>
          {defaultModeMeta && (
            <p className="mt-1 text-xs text-muted-foreground">
              Default artifact task · <span className="font-medium">{defaultModeMeta.label}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExportImage} disabled={!hasPayload}>
            <Download className="mr-2 h-4 w-4" />
            Export PNG
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPdf} disabled={!hasPayload}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
        <span>Live analytics refresh every 30s or on demand.</span>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Sync now
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div ref={analyticsRef} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Live participation status</CardTitle>
          <CardDescription>Monitor completions and evaluation criteria at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <DonutChart
              segments={completionSegments}
              centerLabel={`${completionBreakdown.percent}%`}
              centerSubtext={`${completionBreakdown.completed}/${completionBreakdown.total || 0} finished`}
              emptyLabel="No participants assigned"
            />
            <p className="text-xs text-muted-foreground text-center md:text-left">
              {completionBreakdown.total
                ? `Assignments sent to ${completionBreakdown.total} participant${
                    completionBreakdown.total === 1 ? "" : "s"
                  }.`
                : "Invite participants to start this study."}
            </p>
          </div>
          <div className="space-y-3">
            <DonutChart
              segments={criteriaSegments}
              centerLabel={
                criteriaSegments.length
                  ? `${criteriaSegments.reduce((sum, seg) => sum + (seg.percent || 0), 0)}%`
                  : "0%"
              }
              centerSubtext={criteriaSegments.length ? "Criteria weight" : "No criteria defined"}
              emptyLabel="No criteria defined"
            />
            <p className="text-xs text-muted-foreground text-center md:text-left">
              {criteriaSegments.length
                ? "Researcher-defined evaluation criteria (weight by percentage)."
                : "Add evaluation criteria to the study to see weights here."}
            </p>
          </div>
        </CardContent>
      </Card>

      

      {!hasPayload && !isLoading && (
        <div className="flex min-h-[180px] items-center justify-center rounded-md border text-sm text-muted-foreground">
          Load analytics to visualize the study performance.
        </div>
      )}

      {hasPayload ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time to complete (seconds)</CardTitle>
              <CardDescription>Per-participant duration captured from their artifact timer.</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeToCompleteChart series={timeToCompleteSeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Criteria ratings by participant</CardTitle>
              <CardDescription>Per-criterion star ratings (averaged when multiple submissions exist).</CardDescription>
            </CardHeader>
            <CardContent>
              <CriteriaRatingsChart criteriaAxis={criteriaAxis} series={criteriaSeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participant signal</CardTitle>
              <CardDescription>Sorted by completion and recency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No participants match this filter yet.</p>
              ) : (
                participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{participant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.region} • {participant.persona || "Participant"}
                      </p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">{participant.progress}%</span>
                      <span className="ml-1 text-muted-foreground">progress</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last submission {formatDateLabel(participant.lastSubmissionAt)}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        participant.completionStatus === "completed"
                          ? "border-emerald-200 text-emerald-600"
                          : "border-slate-200 text-slate-600"
                      }
                    >
                      {participant.completionStatus === "completed" ? "Completed" : "In progress"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function TimeToCompleteChart({ series = [] }) {
  const data = Array.isArray(series) ? series.filter((entry) => Number.isFinite(entry?.seconds)) : [];
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No timing data available yet.</p>;
  }

  const width = 720;
  const height = 320;
  const padding = 56;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const maxSeconds = Math.max(...data.map((entry) => entry.seconds), 1);
  const step = Math.max(5, Math.ceil(maxSeconds / 5));
  const yTicks = Array.from({ length: 6 }, (_, idx) => idx * step);
  const yMax = yTicks[yTicks.length - 1] || maxSeconds || 1;
  const slot = innerWidth / data.length;
  const barWidth = Math.min(60, Math.max(18, slot * 0.6));
  const resolveX = (index) => padding + index * slot + (slot - barWidth) / 2;
  const resolveY = (seconds) => {
    const clamped = Math.max(0, Math.min(seconds, yMax));
    const barHeight = (clamped / yMax) * innerHeight;
    return height - padding - barHeight;
  };

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Participant time to complete">
        {/* Y axis grid and labels */}
        {yTicks.map((tick) => {
          const y = resolveY(tick);
          return (
            <g key={`y-${tick}`}>
              <line x1={padding - 6} x2={width - padding + 6} y1={y} y2={y} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.2" strokeWidth="1" />
              <text x={padding - 10} y={y + 4} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="end">
                {tick}s
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((entry, idx) => {
          const x = resolveX(idx);
          const y = resolveY(entry.seconds);
          const barHeight = height - padding - y;
          return (
            <g key={entry.id || entry.name || idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                fill="#0ea5e9"
                opacity="0.9"
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                fontSize="10"
                fill="hsl(var(--foreground))"
                textAnchor="middle"
              >
                {entry.seconds}s
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {data.map((entry, idx) => {
          const x = resolveX(idx) + barWidth / 2;
          return (
            <text
              key={`label-${entry.id || entry.name || idx}`}
              x={x}
              y={height - padding + 16}
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              textAnchor="middle"
            >
              {entry.name}
            </text>
          );
        })}

        {/* Axis titles */}
        <text x={padding} y={padding - 20} fontSize="11" fill="hsl(var(--muted-foreground))">
          Seconds to finish
        </text>
        <text
          x={width / 2}
          y={height - padding + 32}
          fontSize="11"
          fill="hsl(var(--muted-foreground))"
          textAnchor="middle"
        >
          Participants
        </text>
      </svg>
    </div>
  );
}

function CriteriaRatingsChart({ criteriaAxis = [], series = [] }) {
  const visibleSeries = Array.isArray(series)
    ? series.filter((entry) => entry?.points?.some((point) => point.value !== null))
    : [];

  if (!criteriaAxis.length || visibleSeries.length === 0) {
    return <p className="text-sm text-muted-foreground">No criteria ratings available yet.</p>;
  }

  const width = 720;
  const height = 320;
  const padding = 56;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const maxValue = Math.max(
    5,
    ...visibleSeries.flatMap((entry) =>
      entry.points.map((point) => (Number.isFinite(point.value) ? point.value : 0)),
    ),
  );
  const yTicks = Array.from({ length: Math.max(5, Math.ceil(maxValue)) + 1 }, (_, idx) => idx);
  const colorPalette = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#0ea5e9', '#7c3aed', '#ea580c', '#14b8a6'];

  const resolveX = (index) => {
    if (criteriaAxis.length === 1) {
      return innerWidth / 2 + padding;
    }
    return (index / (criteriaAxis.length - 1)) * innerWidth + padding;
  };

  const resolveY = (value) => {
    const numeric = Number(value) || 0;
    return innerHeight - (numeric / maxValue) * innerHeight + padding;
  };

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Criteria ratings">
        {/* Y grid lines and labels */}
        {yTicks.map((tick) => {
          const y = resolveY(tick);
          return (
            <g key={`y-${tick}`}>
              <line x1={padding - 6} x2={width - padding + 6} y1={y} y2={y} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.25" strokeWidth="1" />
              <text x={padding - 10} y={y + 4} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {criteriaAxis.map((axis, index) => {
          const x = resolveX(index);
          return (
            <g key={axis.key}>
              <line x1={x} x2={x} y1={padding} y2={height - padding} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.15" strokeWidth="1" />
              <text x={x} y={height - padding + 18} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="middle">
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {visibleSeries.map((entry, idx) => {
          const color = colorPalette[idx % colorPalette.length];
          const pointCoords = entry.points
            .map((point, pointIndex) => {
              if (!Number.isFinite(point.value)) {
                return null;
              }
              return `${resolveX(pointIndex)},${resolveY(point.value)}`;
            })
            .filter(Boolean);

          return (
            <g key={entry.id || entry.name || idx}>
              {pointCoords.length ? (
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointCoords.join(' ')}
                />
              ) : null}
              {entry.points.map((point, pointIndex) => {
                if (!Number.isFinite(point.value)) {
                  return null;
                }
                const cx = resolveX(pointIndex);
                const cy = resolveY(point.value);
                return (
                  <g key={`${entry.id || idx}-${point.key}`}>
                    <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={color} strokeWidth="2" />
                    <title>
                      {entry.name}: {point.label} – {point.value.toFixed(2)}
                    </title>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={padding} y={padding - 20} fontSize="11" fill="hsl(var(--muted-foreground))">
          Rating (stars)
        </text>
      </svg>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {visibleSeries.map((entry, idx) => {
          const color = colorPalette[idx % colorPalette.length];
          return (
            <span key={entry.id || entry.name || idx} className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{entry.name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
