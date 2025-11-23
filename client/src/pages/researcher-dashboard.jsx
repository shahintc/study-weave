import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";

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
  const [participantMatrix, setParticipantMatrix] = useState(null);
  const [participantError, setParticipantError] = useState("");
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [assignmentSaving, setAssignmentSaving] = useState({});
  const analyticsRef = useRef(null);

  const loadStudies = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setIsStudiesLoading(true);
    setStudiesError("");
    try {
      const { data } = await api.get("/api/researcher/studies", {
        params: { researcherId: user.id },
      });
      setStudies(data.studies || []);
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load studies";
      setStudiesError(message);
    } finally {
      setIsStudiesLoading(false);
    }
  }, [user?.id]);

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
    if (user?.role === "researcher") {
      loadStudies();
    }
  }, [user, loadStudies]);

  const selectedStudy = useMemo(() => {
    if (!monitoringStudyId) return null;
    return studies.find((study) => String(study.id) === String(monitoringStudyId)) || null;
  }, [studies, monitoringStudyId]);

  const dashboardHighlights = useMemo(() => {
    if (!studies.length) {
      return [
        { label: "Active studies", value: 0, helper: "Syncing data...", icon: Activity },
        { label: "Participants engaged", value: 0, helper: "Invite participants to begin", icon: Users },
        { label: "Avg artifact rating", value: "0.0", helper: "No submissions yet", icon: LineChartIcon },
      ];
    }

    const totalParticipants = studies.reduce((sum, study) => sum + (study.participants || 0), 0);
    const participantTargetTotal = studies.reduce(
      (sum, study) => sum + (study.participantTarget || 0),
      0,
    );
    const avgRating =
      studies.length > 0
        ? (
            studies.reduce((sum, study) => sum + Number(study.avgRating || 0), 0) / studies.length
          ).toFixed(1)
        : "0.0";

    return [
      { label: "Active studies", value: studies.length, helper: "+ new insights", icon: Activity },
      {
        label: "Participants engaged",
        value: totalParticipants,
        helper: `${Math.max(0, participantTargetTotal - totalParticipants)} seats open`,
        icon: Users,
      },
      { label: "Avg artifact rating", value: avgRating, helper: "Latest submissions", icon: LineChartIcon },
    ];
  }, [studies]);

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
        setAssignmentDrafts(
          Object.fromEntries(
            (data.participants || []).map((participant) => [
              participant.id,
              {
                mode: participant.nextAssignment?.mode || "",
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

  const openMonitor = (studyId) => {
    setMonitoringStudyId(studyId);
    setMonitorFilters(createDefaultFilters());
    setMonitorDialogOpen(true);
  };

  const handleFilterChange = (key, value) => {
    setMonitorFilters((prev) => ({ ...prev, [key]: value }));
  };

  const exportAsImage = useCallback(async () => {
    if (!analyticsRef.current || !selectedStudy) return;
    try {
      const dataUrl = await toPng(analyticsRef.current, { backgroundColor: "#ffffff", cacheBust: true });
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
      const dataUrl = await toPng(analyticsRef.current, { backgroundColor: "#ffffff", cacheBust: true });
      const pdf = new jsPDF("landscape", "pt", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, "PNG", 24, 24, pageWidth - 48, pageHeight - 48);
      pdf.save(`${slugify(selectedStudy.title)}-analytics.pdf`);
    } catch (error) {
      console.error("Failed to export analytics PDF", error);
    }
  }, [selectedStudy]);

  return (
    <div className="space-y-6">
      {/* Researcher Dashboard CTA */}
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
            
            {/* --- THIS IS THE ONLY UPDATED PART --- */}
            {/* We wrap the buttons in a div to keep them grouped */}
            <div className="flex gap-2">
              
              {/* This button now links to your new page */}
              <Button variant="outline" onClick={() => navigate("participants-list")}>
                Show Participants
              </Button>

              {/* This button now links to your wizard page (using relative path) */}
              <Button onClick={() => navigate("study-creation-wizard")}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Study
              </Button>
            </div>
            {/* --- END OF UPDATED PART --- */}

          </CardContent>
        </Card>
      </section>

      {/* Highlights */}
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

      {/* Active Studies */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">My Active Studies</h2>
            <p className="text-sm text-muted-foreground">Monitor participants, artifact quality, and readiness at a glance.</p>
          </div>
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
            ) : !studies.length ? (
              <p className="text-sm text-muted-foreground">No studies yet. Create one to get started.</p>
            ) : (
              studies.map((study) => (
                <div
                  key={study.id}
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
                    <Button variant="ghost" size="sm">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Edit setup
                    </Button>
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
              filters={monitorFilters}
              participantOptions={participantOptions}
              onFilterChange={handleFilterChange}
              isLoading={isAnalyticsLoading}
              error={analyticsError}
              onRefresh={() => fetchAnalytics(monitoringStudyId, monitorFilters)}
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
  filters,
  participantOptions = [],
  onFilterChange,
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
  const ratingsTrend = analytics?.charts?.ratingsTrend ?? [];
  const completionTrend = analytics?.charts?.completionTrend ?? [];
  const artifactAverages = analytics?.charts?.artifactAverages ?? [];
  const participants = analytics?.participants ?? [];
  const participantDetails = participantMatrix?.participants ?? [];
  const availableModes = participantMatrix?.artifactModes ?? [];
  const studyArtifacts = participantMatrix?.studyArtifacts ?? [];

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
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(event) => onFilterChange("from", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(event) => onFilterChange("to", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Participant</label>
            <Select value={filters.participantId ?? "all"} onValueChange={(value) => onFilterChange("participantId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All participants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All participants</SelectItem>
                {participantOptions.map((participant) => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
              Auto refresh • {lastRefreshAt ? `Updated ${formatTimeAgo(lastRefreshAt)}` : "waiting"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Analytics refresh every 30s or on demand.</span>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync now
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Participant progress</CardTitle>
          <CardDescription>Compare competency vs. artifact modes and queue the next assignment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {participantError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {participantError}
            </div>
          )}
          {isParticipantsLoading ? (
            <p className="text-sm text-muted-foreground">Loading participant data...</p>
          ) : participantDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants have joined this study yet.</p>
          ) : (
            participantDetails.map((participant) => {
              const draft = assignmentDrafts?.[participant.id] || { mode: '', studyArtifactId: '' };
              const inFlight = Boolean(assignmentSaving?.[participant.id]);
              const statusMeta = formatParticipationStatus(participant.participationStatus);
              const artifactSuffix = participant.nextAssignment?.artifactLabel
                ? ` • ${participant.nextAssignment.artifactLabel}`
                : '';
              const currentAssignmentLabel = participant.nextAssignment?.modeLabel
                ? `${participant.nextAssignment.modeLabel}${artifactSuffix}`
                : 'Not assigned';

              return (
                <div key={participant.id} className="space-y-3 rounded-md border px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{participant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.persona} • {participant.region}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusMeta.tone}>
                      {statusMeta.label}
                    </Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Competency</span>
                        <span>{participant.competency?.completionPercent ?? 0}%</span>
                      </div>
                      <Progress value={participant.competency?.completionPercent ?? 0} />
                      <p className="text-xs text-muted-foreground">
                        {participant.competency?.statusLabel || 'Not assigned'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Artifact modes</p>
                      {renderArtifactProgress(participant.artifactProgress)}
                      <p className="text-xs text-muted-foreground">
                        {participant.artifactProgress?.totals?.submitted || 0} submissions total
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Stage</label>
                        <Select
                          value={draft.mode || undefined}
                          onValueChange={(value) =>
                            onAssignmentDraftChange?.(participant.id, 'mode', value)
                          }
                          disabled={!availableModes.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModes.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Artifact (optional)</label>
                        <Select
                          value={draft.studyArtifactId || '__any'}
                          onValueChange={(value) =>
                            onAssignmentDraftChange?.(
                              participant.id,
                              'studyArtifactId',
                              value === '__any' ? '' : value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Any artifact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any">Any artifact</SelectItem>
                            {studyArtifacts.map((artifact) => (
                              <SelectItem key={artifact.id} value={artifact.id}>
                                {artifact.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onAssignmentSave?.(participant.id)}
                        disabled={!draft.mode || inFlight}
                      >
                        {inFlight ? 'Saving...' : 'Assign task'}
                      </Button>
                      <p className="text-xs text-muted-foreground">Current next task: {currentAssignmentLabel}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {!hasPayload && !isLoading && (
        <div className="flex min-h-[180px] items-center justify-center rounded-md border text-sm text-muted-foreground">
          Load analytics to visualize the study performance.
        </div>
      )}

      {hasPayload ? (
        <div ref={analyticsRef} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs uppercase text-muted-foreground">Average rating</p>
                <p className="text-3xl font-semibold">{summary?.averageRating ?? 0}</p>
                <p className="text-xs text-muted-foreground">{summary?.submissionsCount ?? 0} submissions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs uppercase text-muted-foreground">Completion</p>
                <p className="text-3xl font-semibold">{summary?.completionPercentage ?? 0}%</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.completedParticipants ?? 0}/{summary?.activeParticipants ?? 0} participants
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs uppercase text-muted-foreground">Auto refresh</p>
                <p className="text-3xl font-semibold">30s</p>
                <p className="text-xs text-muted-foreground">Last sync {formatTimeAgo(lastRefreshAt)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ratings trend</CardTitle>
                <CardDescription>Daily average rating across submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart data={ratingsTrend} xKey="date" yKey="value" height={220} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Completion trend</CardTitle>
                <CardDescription>Participants finishing the study.</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart data={completionTrend} xKey="date" yKey="value" height={220} colorClass="text-emerald-500" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Artifact ratings</CardTitle>
              <CardDescription>Average rating per artifact.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={artifactAverages}
                xKey="name"
                yKey="value"
                height={220}
                formatValue={(value) => value.toFixed(1)}
              />
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
  );
}
