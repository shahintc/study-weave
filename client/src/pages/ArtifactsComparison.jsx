// ArtifactsComparison.jsx — React (.jsx)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTwoFilesPatch } from "diff";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import api from "@/api/axios";
import {
  buildStudyTimerKey,
  formatDuration,
  readStoredTimer,
  writeStoredTimer,
} from "@/lib/studyTimer";
import { Star } from "lucide-react";

/** Bug categories (Defects4J/GHRB taxonomy) */
const BUG_CATEGORIES = [
  "Configuration Issue",
  "Network Issue",
  "Database-Related Issue",
  "GUI-Related Issue",
  "Performance Issue",
  "Permission/Deprecation Issue",
  "Security Issue",
  "Functional Issue",
  "Test Code-Related Issue",
  "Other",
];

/** SOLID violation categories */
const SOLID_VIOLATIONS = [
  { id: "srp", label: "SRP – Single Responsibility Principle" },
  { id: "ocp", label: "OCP – Open/Closed Principle" },
  { id: "lsp", label: "LSP – Liskov Substitution Principle" },
  { id: "isp", label: "ISP – Interface Segregation Principle" },
  { id: "dip", label: "DIP – Dependency Inversion Principle" },
];

const COMPLEXITY_LEVELS = ["EASY", "MEDIUM", "HARD"];

/** Clone categories for patch mode */
const PATCH_CLONE_TYPES = [
  { id: "type1", label: "Type-1 – Exact (whitespace/comments only)" },
  { id: "type2", label: "Type-2 – Same structure, different identifiers" },
  { id: "type3", label: "Type-3 – Copied with added/removed/modified lines" },
  {
    id: "type4",
    label: "Type-4 – Semantically similar, different implementation",
  },
];

/** Snapshot study outcomes */
const SNAPSHOT_OUTCOMES = [
  { id: "failure", label: "Actual failure" },
  { id: "intended", label: "Intended UI change" },
  { id: "unclear", label: "Unclear / not sure" },
];

const SNAPSHOT_CHANGE_TYPES = [
  { id: "color", label: "Color / theme change" },
  { id: "layout", label: "Layout or spacing shift" },
  { id: "text", label: "Copy / text update" },
  { id: "icon", label: "Iconography or asset swap" },
  { id: "content", label: "Missing or extra content" },
  { id: "animation", label: "Animation / interaction regression" },
  { id: "other", label: "Other (describe)" },
];

const SERVER_MODE_TO_UI = {
  clone: "patch",
};

const SUPPORTED_UI_MODES = new Set(["stage1", "stage2", "solid", "patch", "snapshot"]);
const SYNC_SWAP_MODES = new Set(["stage2", "patch", "snapshot"]);

const MODE_LABELS = {
  stage1: "Stage 1: Participant Bug Labeling",
  stage2: "Stage 2: Reviewer Bug Label Comparison",
  solid: "SOLID Violations: Code & Complexity",
  patch: "Patch Mode: Code Diff / Clone Detection",
  snapshot: "Snapshot Study: UI Change vs Failure",
};

const normalizeModeValue = (raw) => {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const lowered = raw.toLowerCase();
  if (SERVER_MODE_TO_UI[lowered]) {
    return SERVER_MODE_TO_UI[lowered];
  }
  if (SUPPORTED_UI_MODES.has(lowered)) {
    return lowered;
  }
  return null;
};

/** Small helper for unique ids (used only for annotations etc.) */
const uid = () => Math.random().toString(36).slice(2, 9);

/** Helper: Convert file to Base64 (for storage) */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

/** Cache for blob URLs so we don't leak memory too much */
const blobUrlCache = new Map();

/** Helper: Convert Base64 back to Blob URL (for reliable PDF rendering) */
const base64ToBlobUrl = (base64) => {
  try {
    if (!base64) return null;
    if (blobUrlCache.has(base64)) return blobUrlCache.get(base64);

    const arr = base64.split(",");
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/pdf"; // fallback
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(base64, url);
    return url;
  } catch (e) {
    console.error("Failed to convert base64 to blob", e);
    return null;
  }
};

const parseDefectsMetadata = (parsed) => {
  const collection = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.bugs)
    ? parsed.bugs
    : Array.isArray(parsed.defects)
    ? parsed.defects
    : Array.isArray(parsed.items)
    ? parsed.items
    : null;

  if (!collection) return [];

  return collection
    .map((bug, idx) => {
      const url = bug?.report_url || bug?.url || bug?.link;
      if (!url) return null;

      const id =
        bug?.bug_id ||
        bug?.bugId ||
        bug?.issue_id ||
        bug?.issueId ||
        bug?.key ||
        bug?.id ||
        `bug-${idx + 1}`;
      const title = bug?.title || bug?.summary || bug?.name || `Bug ${idx + 1}`;
      const project = bug?.project || bug?.repo || bug?.component || "";

      return { id, title, project, url };
    })
    .filter(Boolean);
};

const normalizeSolidRecords = (parsed) => {
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.records)
    ? parsed.records
    : [];

  return arr
    .filter((item) => typeof item?.input === "string")
    .map((item, idx) => ({
      ...item,
      __id: item.id || item.slug || item.name || `record-${idx + 1}`,
    }));
};

// Ensure we have patch-like text for a side when in patch mode.
// If the text is already a diff -> return it unchanged.
// Otherwise, create a unified diff against the OTHER pane.
const ensurePatchText = (side, leftData, rightData) => {
  const isLeft = side === "left";
  const current = isLeft ? leftData : rightData;

  // Strip your artificial line numbers first
  const currentText = stripLineNumbers(current.text || "");

  // If it already looks like a diff, just use it
  if (isDiffLike(currentText)) return currentText;

  // Only generate a diff if the other side is also text
  const other = isLeft ? rightData : leftData;
  if (other.type !== "text") return currentText;

  const otherText = stripLineNumbers(other.text || "");

  // createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader)
  const patch = createTwoFilesPatch(
    current.name || (isLeft ? "A" : "B"),
    other.name || (isLeft ? "B" : "A"),
    currentText,
    otherText,
    "",
    ""
  );

  return patch;
};

/** Text helpers for line numbering */
const stripLineNumbers = (text) =>
  text ? text.replace(/^\s*\d+\.\s*/gm, "") : "";

const numberLines = (text) => {
  if (!text) return "";
  return stripLineNumbers(text)
    .split(/\r?\n/)
    .map((line, idx) => `${idx + 1}. ${line}`)
    .join("\n");
};

const formatBugReportText = (report) => {
  if (typeof report === "string") return report;
  if (!report || typeof report !== "object") {
    try {
      return JSON.stringify(report, null, 2);
    } catch {
      return String(report);
    }
  }

  const lines = [];
  const pushField = (label, value) => {
    if (!value) return;
    lines.push(`${label}: ${value}`);
  };

  pushField("Project", report.project || report.repo || report.component);
  pushField("Bug ID", report.bug_id || report.id || report.issue_id);
  pushField("Title", report.title || report.summary || report.name);
  pushField("Reporter", report.reporter || report.author);
  pushField("Severity", report.severity || report.priority);

  const description = report.description || report.body || report.details;
  if (description) {
    lines.push("", description.trim());
  }

  const steps = report.steps || report.steps_to_reproduce;
  if (steps) {
    lines.push("", "Steps to reproduce:");
    if (Array.isArray(steps)) {
      steps.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
    } else {
      lines.push(steps);
    }
  }

  const expected = report.expected || report.expected_result;
  const actual = report.actual || report.actual_result;
  if (expected || actual) {
    lines.push("", "Expected vs Actual:");
    pushField("Expected", expected);
    pushField("Actual", actual);
  }

  lines.push("", "---- RAW ARTIFACT ----");
  try {
    lines.push(JSON.stringify(report, null, 2));
  } catch {
    lines.push(String(report));
  }

  return lines.join("\n");
};

/**
 * Auto-detects if a text looks like a diff/patch file
 */
const isDiffLike = (text) => {
  if (!text) return false;
  if (/^diff --git /m.test(text)) return true;
  if (/^Index:/m.test(text)) return true;
  if (/^@@ /m.test(text)) return true;
  if (/^--- /m.test(text) || /^\+\+\+ /m.test(text)) return true;
  // many lines starting with + or - (but not +++, ---)
  const plusMinus = text.match(/^[+-](?![+-])/gm);
  return plusMinus && plusMinus.length > 3;
};

/**
 * Normalize content lines for similarity comparison (ignore diff markers & headers)
 */
const getNormalizedContentLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => {
      let l = line;
      if (/^diff --git /.test(l)) return null;
      if (/^Index:/.test(l)) return null;
      if (/^@@/.test(l)) return null;
      if (/^(\+\+\+|---)/.test(l)) return null;
      // remove leading + or - for diff content
      if (/^[+-](?![+-])/.test(l)) {
        l = l.slice(1);
      }
      return l.trim();
    })
    .filter((l) => l);
};

/**
 * Build diff line descriptors: { raw, type, inOther }
 */
const buildDiffLines = (text, otherSet) => {
  const lines = text ? text.split(/\r?\n/) : [];
  return lines.map((raw, idx) => {
    let type = "context";
    if (/^diff --git /.test(raw) || /^Index:/.test(raw) || /^(\+\+\+|---)/.test(raw)) {
      type = "header";
    } else if (/^@@/.test(raw)) {
      type = "hunk";
    } else if (/^\+(?!\+)/.test(raw)) {
      type = "add";
    } else if (/^-(?!-)/.test(raw)) {
      type = "del";
    }

    let normalized = raw.replace(/^[-+]/, "").trim();
    if (/^diff --git /.test(raw) || /^Index:/.test(raw) || /^(\+\+\+|---)/.test(raw) || /^@@/.test(raw)) {
      normalized = "";
    }
    const inOther = !!(otherSet && normalized && otherSet.has(normalized));

    return { id: idx, raw, type, inOther };
  });
};

const STORAGE_KEY = "artifacts-comparison-autosave-v9-bug-solid-patch";

export default function ArtifactsComparison() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const assignedMode = useMemo(() => {
    const state = location.state || {};
    const studyState = state.study || {};
    const candidates = [
      searchParams.get("mode"),
      state.assignedMode,
      studyState?.defaultArtifactMode,
      studyState?.metadata?.defaultArtifactMode,
      studyState?.nextAssignment?.mode,
      studyState?.cta?.mode,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeModeValue(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }, [location.state, searchParams]);

  const parseNumeric = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const studyContext = useMemo(() => {
    const state = location.state || {};
    return {
      studyId: parseNumeric(searchParams.get("studyId") ?? state.studyId),
      studyArtifactId: parseNumeric(
        searchParams.get("studyArtifactId") ?? state.studyArtifactId
      ),
      studyParticipantId: parseNumeric(
        searchParams.get("studyParticipantId") ??
          state.studyParticipantId ??
          state.participationId
      ),
      sourceEvaluationId: parseNumeric(
        searchParams.get("sourceEvaluationId") ?? state.sourceEvaluationId
      ),
      comparisonId: parseNumeric(
        searchParams.get("comparisonId") ?? state.comparisonId
      ),
    };
  }, [location.state, searchParams]);

  const participantSummary = useMemo(() => {
    const state = location.state || {};
    return state.participant || state.studyParticipant || null;
  }, [location.state]);

  const handleCriteriaRating = useCallback((label, value) => {
    setCriteriaRatings((prev) => ({
      ...prev,
      [label]: value,
    }));
  }, []);

  const [authToken, setAuthToken] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("token");
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentSuccess, setAssessmentSuccess] = useState("");
  const [activeAssessmentId, setActiveAssessmentId] = useState(null);
  const [resolvedStudyParticipantId, setResolvedStudyParticipantId] = useState(
    studyContext.studyParticipantId || null
  );
  const [evaluationCriteria, setEvaluationCriteria] = useState([]);
  const [criteriaRatings, setCriteriaRatings] = useState({});
  const [criteriaHover, setCriteriaHover] = useState({});
  const pendingCriteriaScoresRef = useRef(null);
  const [assignmentMeta, setAssignmentMeta] = useState(null);
  const [assignmentLoadError, setAssignmentLoadError] = useState("");
  const [assignmentPanes, setAssignmentPanes] = useState(null);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [timerDisplayMs, setTimerDisplayMs] = useState(0);
  const [timerStatus, setTimerStatus] = useState("paused"); // running | paused | submitted
  const timerStartRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const timerBaseRef = useRef(0);
  const timerStatusRef = useRef("paused");

  const activeParticipantId =
    resolvedStudyParticipantId ||
    studyContext.studyParticipantId ||
    null;
  const missingStudyContext =
    !studyContext.studyId || !studyContext.studyArtifactId;
  const timerStorageKey = useMemo(
    () =>
      buildStudyTimerKey({
        studyId: studyContext.studyId,
        studyArtifactId: studyContext.studyArtifactId,
        studyParticipantId: activeParticipantId,
      }),
    [activeParticipantId, studyContext.studyArtifactId, studyContext.studyId]
  );

  useEffect(() => {
    timerStatusRef.current = timerStatus;
  }, [timerStatus]);

  const computeCriteriaScores = useCallback(
    (criteriaList = evaluationCriteria, starMap = criteriaRatings) => {
      const scores = {};
      criteriaList.forEach((criterion) => {
        const weight = Number(criterion.weight);
        if (Number.isNaN(weight)) return;
        const stars = Number(starMap[criterion.label] || 0);
        const pct = Number(((weight * stars) / 5).toFixed(2));
        scores[criterion.label] = pct;
      });
      return scores;
    },
    [criteriaRatings, evaluationCriteria],
  );

  const computeStarsFromScores = useCallback(
    (scores = {}, criteriaList = evaluationCriteria) => {
      const stars = {};
      criteriaList.forEach((criterion) => {
        const weight = Number(criterion.weight);
        if (!weight) return;
        const score = Number(scores[criterion.label]);
        if (Number.isNaN(score)) return;
        const derived = Math.round((score / weight) * 5);
        stars[criterion.label] = Math.min(5, Math.max(0, derived));
      });
      return stars;
    },
    [evaluationCriteria],
  );

  const persistTimerState = useCallback(
    (nextState) => {
      if (!timerStorageKey) return;
      writeStoredTimer(timerStorageKey, nextState);
    },
    [timerStorageKey],
  );

  const stopTimerInterval = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const updateTimerDisplay = useCallback(() => {
    const now = Date.now();
    const delta = timerStartRef.current ? Math.max(0, now - timerStartRef.current) : 0;
    setTimerDisplayMs(timerBaseRef.current + delta);
  }, []);

  const pauseTimer = useCallback(
    (markSubmitted = false) => {
      if (!timerStorageKey) return;
      const now = Date.now();
      const delta = timerStartRef.current ? Math.max(0, now - timerStartRef.current) : 0;
      const total = timerBaseRef.current + delta;
      timerBaseRef.current = total;
      timerStartRef.current = null;
      stopTimerInterval();
      setTimerDisplayMs(total);
      const finalSubmitted =
        markSubmitted || timerStatusRef.current === "submitted";
      setTimerStatus(finalSubmitted ? "submitted" : "paused");
      persistTimerState({
        elapsedMs: total,
        running: false,
        lastStart: null,
        submitted: finalSubmitted,
      });
    },
    [persistTimerState, stopTimerInterval, timerStorageKey],
  );

  const startTimer = useCallback(() => {
    if (!timerStorageKey || submissionLocked) return;
    const now = Date.now();
    timerStartRef.current = now;
    setTimerStatus("running");
    stopTimerInterval();
    updateTimerDisplay();
    persistTimerState({
      elapsedMs: timerBaseRef.current,
      running: true,
      lastStart: now,
      submitted: false,
    });
    timerIntervalRef.current = setInterval(updateTimerDisplay, 1000);
  }, [
    persistTimerState,
    stopTimerInterval,
    submissionLocked,
    timerStorageKey,
    updateTimerDisplay,
  ]);

  const hydrateTimerFromStorage = useCallback(() => {
    if (!timerStorageKey || missingStudyContext) return;
    const saved = readStoredTimer(timerStorageKey);
    const now = Date.now();
    let baseElapsed = Number(saved?.elapsedMs) || 0;
    const submittedFlag = Boolean(saved?.submitted || submissionLocked);
    if (!submittedFlag && saved?.running && saved?.lastStart) {
      baseElapsed += Math.max(0, now - Number(saved.lastStart));
    }

    timerBaseRef.current = baseElapsed;
    setTimerDisplayMs(baseElapsed);

    if (submittedFlag) {
      setTimerStatus("submitted");
      persistTimerState({
        elapsedMs: baseElapsed,
        running: false,
        lastStart: null,
        submitted: true,
      });
      stopTimerInterval();
      return;
    }

    startTimer();
  }, [
    missingStudyContext,
    persistTimerState,
    startTimer,
    submissionLocked,
    stopTimerInterval,
    timerStorageKey,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser = window.localStorage.getItem("user");
    const token = window.localStorage.getItem("token");
    if (!rawUser || !token) {
      navigate("/login");
      return;
    }
    try {
      setCurrentUser(JSON.parse(rawUser));
      setAuthToken(token);
    } catch (error) {
      console.error("Failed to parse user from storage", error);
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (studyContext.studyParticipantId) {
      setResolvedStudyParticipantId(studyContext.studyParticipantId);
    }
  }, [studyContext.studyParticipantId]);

  useEffect(() => {
    // Mark this study as visited so the dashboard can show "In progress"
    if (typeof window === "undefined") return;
    if (!studyContext.studyId) return;
    try {
      window.localStorage.setItem(
        `studyVisit:${studyContext.studyId}`,
        new Date().toISOString()
      );
    } catch (err) {
      console.warn("Unable to persist study visit flag", err);
    }
  }, [studyContext.studyId]);

  useEffect(() => {
    if (!timerStorageKey) return;
    hydrateTimerFromStorage();

    const onBeforeUnload = () => pauseTimer(false);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      pauseTimer(false);
    };
  }, [hydrateTimerFromStorage, pauseTimer, timerStorageKey]);

  useEffect(() => {
    if (submissionLocked) {
      pauseTimer(true);
    }
  }, [pauseTimer, submissionLocked]);

  // ===== GLOBAL MODES =====
  // stage1: participant labels a single bug report
  // stage2: reviewer compares two labels (participant vs participant/AI)
  // solid: participant labels SOLID violation + complexity for a code snippet
  // patch: compare two patches and classify clone type
  // snapshot: participant decides if screenshot case is failure vs intended UI change
  const [mode, setMode] = useState(assignedMode || "stage2");

  useEffect(() => {
    if (assignedMode) {
      setMode((prev) => (prev === assignedMode ? prev : assignedMode));
    }
  }, [assignedMode]);

  const [syncScroll, setSyncScroll] = useState(true);
  const [showBig, setShowBig] = useState(false);

  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);

  // Pane Data
  const [leftData, setLeftData] = useState({ type: "text", text: "" });
  const [rightData, setRightData] = useState({ type: "text", text: "" });

  // Annotations
  const [leftAnn, setLeftAnn] = useState([]);
  const [rightAnn, setRightAnn] = useState([]);

  // Edit Modes
  const [leftEditing, setLeftEditing] = useState(false);
  const [rightEditing, setRightEditing] = useState(false);

  // Draw Toggles
  const [leftDraw, setLeftDraw] = useState(false);
  const [rightDraw, setRightDraw] = useState(false);

  // Zoom
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);

  // Summaries
  const [leftSummary, setLeftSummary] = useState("");
  const [rightSummary, setRightSummary] = useState("");
  const [leftSummaryStatus, setLeftSummaryStatus] = useState("idle");
  const [rightSummaryStatus, setRightSummaryStatus] = useState("idle");

  // Labeling states for bug tasks
  const [leftCategory, setLeftCategory] = useState(""); // participant 1 or stage1 label
  const [rightCategory, setRightCategory] = useState(""); // participant 2 or AI label
  const [matchCorrectness, setMatchCorrectness] = useState(""); // "correct" | "incorrect" | ""
  const [finalCategory, setFinalCategory] = useState(""); // final choice in stage2
  const [finalOtherCategory, setFinalOtherCategory] = useState(""); // if reviewer chooses "other"
  const [bugCategoryOptions, setBugCategoryOptions] = useState(BUG_CATEGORIES);

  // SOLID mode classification
  const [solidViolation, setSolidViolation] = useState(""); // "srp" | "ocp" | ...
  const [solidComplexity, setSolidComplexity] = useState(""); // "EASY" | "MEDIUM" | "HARD"
  const [solidFixedCode, setSolidFixedCode] = useState(""); // optional refactored version
  const [solidRecords, setSolidRecords] = useState([]);
  const [solidRecordIndex, setSolidRecordIndex] = useState(0);
  const [solidDatasetName, setSolidDatasetName] = useState("");
  const [showSolidGroundTruth, setShowSolidGroundTruth] = useState(false);

  // Patch mode classification
  const [patchAreClones, setPatchAreClones] = useState(""); // "yes" | "no"
  const [patchCloneType, setPatchCloneType] = useState(""); // "type1".."type4"
  const [patchCloneComment, setPatchCloneComment] = useState(""); // reasoning
  const [patchPairLabel, setPatchPairLabel] = useState("");

  // Snapshot mode outcome
  const [snapshotOutcome, setSnapshotOutcome] = useState(""); // "failure" | "intended" | "unclear"
  const [snapshotChangeType, setSnapshotChangeType] = useState("");
  const [snapshotChangeTypeOther, setSnapshotChangeTypeOther] = useState("");
  const [snapshotAssets, setSnapshotAssets] = useState({
    reference: null,
    failure: null,
  });
  const [snapshotDiffData, setSnapshotDiffData] = useState(null);

  // Generic comment / notes
  const [assessmentComment, setAssessmentComment] = useState("");

  // Metadata-driven bug ingestion
  const [metadataEntries, setMetadataEntries] = useState([]);
  const [selectedMetadataId, setSelectedMetadataId] = useState("");
  const [metadataLoadingId, setMetadataLoadingId] = useState("");
  const [metadataPane, setMetadataPane] = useState("left");

  const paneHasContent = useCallback((pane) => {
    if (!pane) return false;
    if (pane.type === "text") {
      return Boolean(pane.text && pane.text.trim().length);
    }
    if (pane.type === "image" || pane.type === "pdf") {
      return Boolean(pane.url);
    }
    return false;
  }, []);

  const normalizeAssignmentPane = useCallback((pane, fallbackLabel) => {
    if (!pane || !pane.content) {
      return null;
    }
    const title =
      pane.label || pane.artifactName || pane.fileOriginalName || fallbackLabel || "Artifact";
    const metadata = {
      name: title,
      artifactId: pane.artifactId || null,
      artifactType: pane.artifactType || null,
      studyArtifactId: pane.studyArtifactId || null,
      mimeType: pane.mimeType || null,
      fileOriginalName: pane.fileOriginalName || null,
    };
    if (pane.encoding === "text" || !pane.encoding) {
      return { ...metadata, type: "text", text: numberLines(pane.content) };
    }
    if (pane.encoding === "data_url") {
      const isPdf = /pdf/i.test(pane.mimeType || "");
      return { ...metadata, type: isPdf ? "pdf" : "image", url: pane.content };
    }
    return null;
  }, []);

  // Pending Comment State (for annotations)
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [pendingComment, setPendingComment] = useState("");

  const autosaveTimerRef = useRef(null);
  const assignmentHydratedRef = useRef(false);

  // Refs
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const leftBigRef = useRef(null);
  const rightBigRef = useRef(null);
  const isSyncing = useRef(false);

  const leftEditRef = useRef(null);
  const rightEditRef = useRef(null);

  const leftDraftRef = useRef("");
  const rightDraftRef = useRef("");
  const snapshotDiffInputRef = useRef(null);
  const patchPairInputRef = useRef(null);

  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  const leftBigCanvasRef = useRef(null);
  const rightBigCanvasRef = useRef(null);

  const leftDrawingState = useRef({ drawing: false, x: 0, y: 0 });
  const rightDrawingState = useRef({ drawing: false, x: 0, y: 0 });

  const radioClass =
    "relative h-4 w-4 rounded-full border border-gray-400 data-[state=checked]:border-black data-[state=checked]:ring-2 data-[state=checked]:ring-black before:content-[''] before:absolute before:inset-1 before:rounded-full before:bg-black before:opacity-0 data-[state=checked]:before:opacity-100";

  useEffect(() => {
    assignmentHydratedRef.current = false;
    setAssignmentMeta(null);
    setAssignmentPanes(null);
    setAssignmentLoadError("");
    setHasLocalDraft(false);
    setSubmissionLocked(false);
    setActiveAssessmentId(null);
    setAssessmentError("");
    setAssessmentSuccess("");
  }, [studyContext.studyId, studyContext.studyArtifactId]);

  // 🔹 Initial Load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const matches =
            saved?.studyId === studyContext.studyId &&
            saved?.studyArtifactId === studyContext.studyArtifactId;

          if (!matches) {
            window.localStorage.removeItem(STORAGE_KEY);
          } else {
            if (saved.left) setLeftData((prev) => ({ ...prev, ...saved.left }));
            if (saved.right) setRightData((prev) => ({ ...prev, ...saved.right }));
            if (Array.isArray(saved.leftAnn)) setLeftAnn(saved.leftAnn);
            if (Array.isArray(saved.rightAnn)) setRightAnn(saved.rightAnn);
            if (typeof saved.syncScroll === "boolean")
              setSyncScroll(saved.syncScroll);
            if (saved.leftSummary) setLeftSummary(saved.leftSummary);
            if (saved.rightSummary) setRightSummary(saved.rightSummary);
            if (typeof saved.mode === "string") setMode(saved.mode);

            if (typeof saved.leftCategory === "string")
              setLeftCategory(saved.leftCategory);
            if (typeof saved.rightCategory === "string")
              setRightCategory(saved.rightCategory);
            if (typeof saved.matchCorrectness === "string")
              setMatchCorrectness(saved.matchCorrectness);
            if (typeof saved.finalCategory === "string")
              setFinalCategory(saved.finalCategory);
            if (typeof saved.finalOtherCategory === "string")
              setFinalOtherCategory(saved.finalOtherCategory);
            if (
              Array.isArray(saved.bugCategoryOptions) &&
              saved.bugCategoryOptions.length
            )
              setBugCategoryOptions(saved.bugCategoryOptions);

            if (typeof saved.solidViolation === "string")
              setSolidViolation(saved.solidViolation);
            if (typeof saved.solidComplexity === "string")
              setSolidComplexity(saved.solidComplexity);
            if (typeof saved.solidFixedCode === "string")
              setSolidFixedCode(saved.solidFixedCode);

            if (typeof saved.patchAreClones === "string")
              setPatchAreClones(saved.patchAreClones);
            if (typeof saved.patchCloneType === "string")
              setPatchCloneType(saved.patchCloneType);
            if (typeof saved.patchCloneComment === "string")
              setPatchCloneComment(saved.patchCloneComment);

            if (typeof saved.snapshotOutcome === "string")
              setSnapshotOutcome(saved.snapshotOutcome);
            if (typeof saved.snapshotChangeType === "string")
              setSnapshotChangeType(saved.snapshotChangeType);
            if (typeof saved.snapshotChangeTypeOther === "string")
              setSnapshotChangeTypeOther(saved.snapshotChangeTypeOther);

            if (typeof saved.assessmentComment === "string")
              setAssessmentComment(saved.assessmentComment);

            if (saved.evaluationRatings && typeof saved.evaluationRatings === "object") {
              pendingCriteriaScoresRef.current = saved.evaluationRatings;
            }
            if (saved.evaluationStarRatings && typeof saved.evaluationStarRatings === "object") {
              setCriteriaRatings(saved.evaluationStarRatings);
            }

            if (paneHasContent(saved.left) || paneHasContent(saved.right)) {
              setHasLocalDraft(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load state", err);
      }
    }

    return () => {
      blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
      blobUrlCache.clear();
    };
  }, [paneHasContent, studyContext.studyId, studyContext.studyArtifactId]);

  useEffect(() => {
    if (!authToken || !studyContext.studyId || !studyContext.studyArtifactId) {
      return;
    }

    let cancelled = false;
    setAssignmentLoadError("");
    setIsLoadingArtifacts(true);

    api
      .get("/api/participant/artifact-task", {
        params: {
          studyId: studyContext.studyId,
          studyArtifactId: studyContext.studyArtifactId,
          studyParticipantId:
            resolvedStudyParticipantId || studyContext.studyParticipantId || undefined,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      .then((response) => {
        if (cancelled) return;
        const assignment = response.data?.assignment;
        if (!assignment) {
          setAssignmentLoadError("No researcher assignment was found for this artifact.");
          return;
        }

        const { panes = null, ...metadata } = assignment;
        setAssignmentMeta(metadata);
        setAssignmentPanes(panes);
        if (Array.isArray(assignment.evaluationCriteria)) {
          setEvaluationCriteria(
            assignment.evaluationCriteria.map((c) => ({
              label: c.label,
              weight: Number(c.weight) || 0,
            })),
          );
          setCriteriaRatings((prev) => {
            let next = { ...prev };
            if (pendingCriteriaScoresRef.current) {
              next = computeStarsFromScores(pendingCriteriaScoresRef.current, assignment.evaluationCriteria);
              pendingCriteriaScoresRef.current = null;
            }
            assignment.evaluationCriteria.forEach((c) => {
              if (typeof next[c.label] !== "number") {
                next[c.label] = 0;
              }
            });
            Object.keys(next).forEach((key) => {
              const exists = assignment.evaluationCriteria.some((c) => c.label === key);
              if (!exists) delete next[key];
            });
            return next;
          });
        } else {
          setEvaluationCriteria([]);
          setCriteriaRatings({});
        }

        if (assignment.studyParticipantId && assignment.studyParticipantId !== resolvedStudyParticipantId) {
          setResolvedStudyParticipantId(assignment.studyParticipantId);
        }

        const serverMode = normalizeModeValue(assignment.mode);
        if (serverMode) {
          setMode((prev) => (prev === serverMode ? prev : serverMode));
        }

        if (panes) {
          const leftPane = normalizeAssignmentPane(panes.left, "Researcher artifact A");
          const rightPane = normalizeAssignmentPane(panes.right, "Researcher artifact B");

          const shouldHydrateLeft = !assignmentHydratedRef.current || !paneHasContent(leftData);
          const shouldHydrateRight = !assignmentHydratedRef.current || !paneHasContent(rightData);

          if (leftPane && shouldHydrateLeft) setLeftData(leftPane);
          if (rightPane && shouldHydrateRight) setRightData(rightPane);

          if (serverMode === "snapshot") {
            setSnapshotAssets((prev) => {
              const nextRef = leftPane || prev.reference;
              const nextFail = rightPane || prev.failure;
              // Avoid unnecessary state churn that would retrigger this effect
              const sameRef = prev.reference?.url === nextRef?.url && prev.reference?.text === nextRef?.text;
              const sameFail = prev.failure?.url === nextFail?.url && prev.failure?.text === nextFail?.text;
              if (sameRef && sameFail) return prev;
              return { reference: nextRef, failure: nextFail };
            });
          }

          assignmentHydratedRef.current = true;
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load assignment artifacts", error);
        setAssignmentLoadError(
          error.response?.data?.message ||
            "Unable to load the researcher-provided artifacts right now."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingArtifacts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authToken,
    studyContext.studyId,
    studyContext.studyArtifactId,
    studyContext.studyParticipantId,
    resolvedStudyParticipantId,
    hasLocalDraft,
    normalizeAssignmentPane,
  ]);

  // 🔹 Autosave
  const captureAssessmentState = useCallback(
    () => ({
      studyId: studyContext.studyId,
      studyArtifactId: studyContext.studyArtifactId,
      studyParticipantId: activeParticipantId,
      mode,
      left: leftData,
      right: rightData,
      leftAnn,
      rightAnn,
      syncScroll,
      leftSummary,
      rightSummary,
      leftCategory,
      rightCategory,
      matchCorrectness,
      finalCategory,
      finalOtherCategory,
      bugCategoryOptions,
      solidViolation,
      solidComplexity,
      solidFixedCode,
      patchAreClones,
      patchCloneType,
      patchCloneComment,
      snapshotOutcome,
      snapshotChangeType,
      snapshotChangeTypeOther,
      snapshotDiffData,
      assessmentComment,
      evaluationRatings: computeCriteriaScores(),
      evaluationStarRatings: criteriaRatings,
    }),
    [
      studyContext.studyId,
      studyContext.studyArtifactId,
      activeParticipantId,
      mode,
      leftData,
      rightData,
      leftAnn,
      rightAnn,
      syncScroll,
      leftSummary,
      rightSummary,
      leftCategory,
      rightCategory,
      matchCorrectness,
      finalCategory,
      finalOtherCategory,
      bugCategoryOptions,
      solidViolation,
      solidComplexity,
      solidFixedCode,
      patchAreClones,
      patchCloneType,
      patchCloneComment,
      snapshotOutcome,
      snapshotChangeType,
      snapshotChangeTypeOther,
      snapshotDiffData,
      assessmentComment,
      criteriaRatings,
      computeCriteriaScores,
    ]
  );

  const hydrateAssessmentPayload = useCallback(
    (payload = {}) => {
      if (!payload || typeof payload !== "object") return;
      if (payload.left) setLeftData(payload.left);
      if (payload.right) setRightData(payload.right);
    if (Array.isArray(payload.leftAnn)) setLeftAnn(payload.leftAnn);
    if (Array.isArray(payload.rightAnn)) setRightAnn(payload.rightAnn);
    if (typeof payload.syncScroll === "boolean") setSyncScroll(payload.syncScroll);
    if (payload.leftSummary) setLeftSummary(payload.leftSummary);
    if (payload.rightSummary) setRightSummary(payload.rightSummary);
      if (payload.mode && !assignedMode) setMode(payload.mode);
    if (typeof payload.leftCategory === "string") setLeftCategory(payload.leftCategory);
    if (typeof payload.rightCategory === "string") setRightCategory(payload.rightCategory);
    if (typeof payload.matchCorrectness === "string") setMatchCorrectness(payload.matchCorrectness);
    if (typeof payload.finalCategory === "string") setFinalCategory(payload.finalCategory);
    if (typeof payload.finalOtherCategory === "string") setFinalOtherCategory(payload.finalOtherCategory);
    if (Array.isArray(payload.bugCategoryOptions) && payload.bugCategoryOptions.length)
      setBugCategoryOptions(payload.bugCategoryOptions);
    if (typeof payload.solidViolation === "string") setSolidViolation(payload.solidViolation);
    if (typeof payload.solidComplexity === "string") setSolidComplexity(payload.solidComplexity);
    if (typeof payload.solidFixedCode === "string") setSolidFixedCode(payload.solidFixedCode);
    if (typeof payload.patchAreClones === "string") setPatchAreClones(payload.patchAreClones);
    if (typeof payload.patchCloneType === "string") setPatchCloneType(payload.patchCloneType);
    if (typeof payload.patchCloneComment === "string") setPatchCloneComment(payload.patchCloneComment);
    if (typeof payload.snapshotOutcome === "string") setSnapshotOutcome(payload.snapshotOutcome);
    if (typeof payload.snapshotChangeType === "string") setSnapshotChangeType(payload.snapshotChangeType);
    if (typeof payload.snapshotChangeTypeOther === "string")
      setSnapshotChangeTypeOther(payload.snapshotChangeTypeOther);
    if (payload.snapshotDiffData) setSnapshotDiffData(payload.snapshotDiffData);
    if (typeof payload.assessmentComment === "string") setAssessmentComment(payload.assessmentComment);
    if (payload.evaluationStarRatings && typeof payload.evaluationStarRatings === "object") {
      setCriteriaRatings(payload.evaluationStarRatings);
    } else if (payload.evaluationRatings && typeof payload.evaluationRatings === "object") {
      pendingCriteriaScoresRef.current = payload.evaluationRatings;
    }
    },
    [assignedMode],
  );

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(captureAssessmentState())
        );
      } catch (error) {
        console.warn("Autosave skipped (likely storage limit)", error);
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [captureAssessmentState]);

  useEffect(() => {
    if (!authToken || !studyContext.studyId || !studyContext.studyArtifactId) {
      return;
    }

    let cancelled = false;
    setAssessmentLoading(true);
    setAssessmentError("");

    api
      .get("/api/artifact-assessments", {
        params: {
          studyId: studyContext.studyId,
          studyArtifactId: studyContext.studyArtifactId,
          studyParticipantId:
            resolvedStudyParticipantId || studyContext.studyParticipantId || undefined,
          includeItems: false,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      .then((response) => {
        if (cancelled) return;
        const record = Array.isArray(response.data?.assessments)
          ? response.data.assessments[0]
          : null;
        if (record) {
          setActiveAssessmentId(record.id);
          if (record.studyParticipantId) {
            setResolvedStudyParticipantId(record.studyParticipantId);
          }
          hydrateAssessmentPayload(record.payload);
          setSubmissionLocked(record.status === "submitted");
        } else {
          setActiveAssessmentId(null);
          setSubmissionLocked(false);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }
        setAssessmentError(
          error.response?.data?.message ||
            "Unable to load existing artifact assessment."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setAssessmentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authToken,
    hydrateAssessmentPayload,
    navigate,
    studyContext.studyArtifactId,
    studyContext.studyId,
    studyContext.studyParticipantId,
    resolvedStudyParticipantId,
  ]);

  // ===== SYNC SCROLL =====
  useEffect(() => {
    if (!SYNC_SWAP_MODES.has(mode)) return;
    const lRef = showBig ? leftBigRef.current : leftRef.current;
    const rRef = showBig ? rightBigRef.current : rightRef.current;
    if (!lRef || !rRef) return;

    const sync = (source, target) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      const vertMaxSrc = source.scrollHeight - source.clientHeight;
      const vertMaxTgt = target.scrollHeight - target.clientHeight;
      const ratioY = vertMaxSrc > 0 ? source.scrollTop / vertMaxSrc : 0;
      target.scrollTop = ratioY * vertMaxTgt;

      const horizMaxSrc = source.scrollWidth - source.clientWidth;
      const horizMaxTgt = target.scrollWidth - target.clientWidth;
      const ratioX = horizMaxSrc > 0 ? source.scrollLeft / horizMaxSrc : 0;
      target.scrollLeft = ratioX * horizMaxTgt;

      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    };

    const onLeftScroll = () => sync(lRef, rRef);
    const onRightScroll = () => sync(rRef, lRef);

    if (syncScroll) {
      lRef.addEventListener("scroll", onLeftScroll, { passive: true });
      rRef.addEventListener("scroll", onRightScroll, { passive: true });
    }
    return () => {
      lRef.removeEventListener("scroll", onLeftScroll);
      rRef.removeEventListener("scroll", onRightScroll);
    };
  }, [syncScroll, showBig, mode]);

  // ===== EDIT TOGGLE =====
  const toggleEdit = (side) => {
    if (mode === "patch") return; // editing disabled in patch mode
    const isLeft = side === "left";
    const isEditing = isLeft ? leftEditing : rightEditing;
    const data = isLeft ? leftData : rightData;
    const setData = isLeft ? setLeftData : setRightData;
    const draftRef = isLeft ? leftDraftRef : rightDraftRef;
    const editRef = isLeft ? leftEditRef : rightEditRef;

    if (!isEditing) {
      draftRef.current = stripLineNumbers(data.text);
      if (isLeft) setLeftEditing(true);
      else setRightEditing(true);
    } else {
      const rawText = editRef.current?.innerText || draftRef.current;
      setData({ ...data, text: numberLines(rawText) });
      if (isLeft) setLeftEditing(false);
      else setRightEditing(false);
    }
  };

  // ===== FILE HANDLING =====
  const resetBugLabelingState = () => {
    setLeftCategory("");
    setRightCategory("");
    setMatchCorrectness("");
    setFinalCategory("");
    setFinalOtherCategory("");
    setAssessmentComment("");
  };

  const resetSolidInputs = () => {
    setSolidViolation("");
    setSolidComplexity("");
    setSolidFixedCode("");
    setAssessmentComment("");
  };

  const resetSnapshotDecisions = () => {
    setSnapshotOutcome("");
    setSnapshotChangeType("");
    setSnapshotChangeTypeOther("");
    setAssessmentComment("");
  };

  const handleMetadataSelection = async (bugId, paneOverride) => {
    setSelectedMetadataId(bugId);
    const entry = metadataEntries.find((bug) => bug.id === bugId);
    if (!entry) return;

    setMetadataLoadingId(bugId);
    try {
      const resp = await fetch(entry.url);
      if (!resp.ok) throw new Error("Unable to fetch bug report.");
      const text = await resp.text();
      const payload = {
        type: "text",
        text: numberLines(text),
        name: `${entry.project ? `${entry.project} • ` : ""}${entry.title}`,
      };
      const pane = paneOverride || metadataPane;
      const setter = pane === "right" ? setRightData : setLeftData;
      setter(payload);
      resetBugLabelingState();
    } catch (err) {
      console.error("Metadata fetch failed", err);
      alert("Unable to download the selected bug report. See console for details.");
    } finally {
      setMetadataLoadingId("");
    }
  };

  const handleSolidRecordChange = (index) => {
    if (!solidRecords[index]) return;
    setSolidRecordIndex(index);
    setLeftData({
      type: "text",
      text: numberLines(solidRecords[index].input || ""),
      name: `${solidDatasetName || "SOLID"} • ${solidRecords[index].__id}`,
    });
    resetSolidInputs();
  };

  const nudgeSolidRecord = (direction) => {
    if (!solidRecords.length) return;
    const next = (solidRecordIndex + direction + solidRecords.length) %
      solidRecords.length;
    handleSolidRecordChange(next);
  };

  const handleSnapshotDiffUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isImg = /\.(png|jpg|jpeg)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    if (!(isImg || isPdf)) {
      alert("Please upload the diff artifact in PNG, JPG, or PDF format.");
      return;
    }

    try {
      const base64Url = await fileToBase64(file);
      setSnapshotDiffData({
        type: isImg ? "image" : "pdf",
        url: base64Url,
        name: file.name,
      });
      resetSnapshotDecisions();
    } catch (err) {
      console.error("Snapshot diff upload failed", err);
      alert("Unable to read the diff artifact.");
    }
  };

  const handlePatchPairUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length < 2) {
      alert("Select two .patch or .diff files to populate Patch A and Patch B.");
      return;
    }

    try {
      const [first, second] = files;
      const [textA, textB] = await Promise.all([first.text(), second.text()]);
      setLeftData({ type: "text", text: numberLines(textA), name: first.name });
      setRightData({ type: "text", text: numberLines(textB), name: second.name });
      setLeftAnn([]);
      setRightAnn([]);
      setLeftZoom(1);
      setRightZoom(1);
      setPatchPairLabel(`${first.name} ↔ ${second.name}`);
    } catch (err) {
      console.error("Failed to load patch pair", err);
      alert("Unable to read one of the selected patch files.");
    }
  };

  const handleDownload = (side) => {
    const pane = side === "left" ? leftData : rightData;
    if (pane.type === "text") {
      const blob = new Blob([pane.text || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (pane.name || `artifact-${side}`) + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (pane.url) {
      const link = document.createElement("a");
      link.href = pane.url; // base64 data URL (browser will still download)
      link.download = pane.name || `artifact-${side}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ===== SELECTION (annotations) =====
  const selectionOffsets = (container) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    return {
      start: pre.toString().length,
      end: pre.toString().length + range.toString().length,
    };
  };

  const onSimpleHighlight = (side) => {
    if (mode === "patch") return; // no annotations in patch mode
    const ref = showBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const container = ref.current?.querySelector('[data-content-area="true"]');
    if (!container) return;
    const off = selectionOffsets(container);
    if (!off || off.start >= off.end) {
      alert("Please select text first.");
      return;
    }

    const ann = {
      id: uid(),
      start: off.start,
      end: off.end,
      color: "rgba(255, 235, 59, 0.5)",
      comment: "",
    };
    if (side === "left") setLeftAnn((p) => [...p, ann]);
    else setRightAnn((p) => [...p, ann]);
    window.getSelection().removeAllRanges();
  };

  const onAddComment = (side) => {
    if (mode === "patch") return; // no annotations in patch mode
    const ref = showBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const container = ref.current?.querySelector('[data-content-area="true"]');
    if (!container) return;

    const text = (side === "left" ? leftData.text : rightData.text) || "";
    const off = selectionOffsets(container);
    if (!off || off.start >= off.end) {
      alert("Please select text first.");
      return;
    }

    const snippet =
      text.slice(off.start, Math.min(off.end, off.start + 50)).trim() + "...";
    setPendingAnnotation({ side, start: off.start, end: off.end, snippet });
    window.getSelection().removeAllRanges();
  };

  const savePendingComment = () => {
    if (!pendingAnnotation) return;
    const ann = {
      id: uid(),
      start: pendingAnnotation.start,
      end: pendingAnnotation.end,
      color: "rgba(135, 206, 250, 0.5)",
      comment: pendingComment,
      snippet: pendingAnnotation.snippet,
    };
    if (pendingAnnotation.side === "left") setLeftAnn((p) => [...p, ann]);
    else setRightAnn((p) => [...p, ann]);
    setPendingAnnotation(null);
    setPendingComment("");
  };

  const onDeleteAnn = (side, id) => {
    if (side === "left") setLeftAnn((p) => p.filter((x) => x.id !== id));
    else setRightAnn((p) => p.filter((x) => x.id !== id));
  };

  const renderWithHighlights = (text, anns) => {
    if (!anns || !anns.length) return [text];
    const sorted = [...anns].sort((a, b) => a.start - b.start);
    const res = [];
    let last = 0;
    sorted.forEach((ann) => {
      if (ann.start > last) res.push(text.slice(last, ann.start));
      res.push(
        <mark
          key={ann.id}
          style={{ backgroundColor: ann.color }}
          title={ann.comment || "Highlight"}
          className="rounded px-0.5 cursor-pointer hover:opacity-80"
        >
          {text.slice(ann.start, ann.end)}
        </mark>
      );
      last = ann.end;
    });
    if (last < text.length) res.push(text.slice(last));
    return res;
  };

  // ===== DRAWING =====
  const refreshCanvas = (side, isBig = false) => {
    const canvasRef = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const wrapperRef = isBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const img = wrapperRef.current?.querySelector("img");
    const cvs = canvasRef.current;
    if (cvs && img) {
      const dpr = window.devicePixelRatio || 1;
      cvs.width = img.width * dpr;
      cvs.height = img.height * dpr;
      cvs.style.width = `${img.width}px`;
      cvs.style.height = `${img.height}px`;
      const ctx = cvs.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "red";
    }
  };

  const startDraw = (side, e, isBig) => {
    const ref = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    state.current = {
      drawing: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const moveDraw = (side, e, isBig) => {
    const ref = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!state.current?.drawing || !ref.current) return;
    const ctx = ref.current.getContext("2d");
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(state.current.x, state.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.current = { ...state.current, x, y };
  };

  const endDraw = (side) => {
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!state.current) return;
    state.current.drawing = false;
  };

  const clearCanvas = (side) => {
    [
      side === "left" ? leftCanvasRef : rightCanvasRef,
      side === "left" ? leftBigCanvasRef : rightBigCanvasRef,
    ].forEach((ref) => {
      if (ref.current)
        ref.current
          .getContext("2d")
          ?.clearRect(0, 0, ref.current.width, ref.current.height);
    });
  };

  const summarizeSide = async (side) => {
    const setter = side === "left" ? setLeftSummary : setRightSummary;
    const statusSetter =
      side === "left" ? setLeftSummaryStatus : setRightSummaryStatus;
    const paneData = side === "left" ? leftData : rightData;

    if (!paneData?.artifactId) {
      setter("AI summary is only available for researcher-provided artifacts.");
      return;
    }

    statusSetter("loading");
    try {
      const artifactLabel = paneData.name || "this artifact";
      const artifactKind =
        paneData.artifactType ||
        (paneData.type === "text"
          ? "text"
          : paneData.type === "pdf"
          ? "PDF"
          : paneData.type === "image"
          ? "image"
          : "artifact");
      const prompt = `Provide a concise summary (max 2 sentences) describing the ${artifactKind} titled "${artifactLabel}" and highlight what reviewers should pay attention to.`;
      const response = await api.post("/api/llm", {
        key: "ARTIFACT_SUMMARY",
        id: paneData.artifactId,
        prompt,
      });

      const raw = response?.data?.response;
      const summaryText = Array.isArray(raw)
        ? raw.join(" ").trim()
        : typeof raw === "string"
        ? raw.trim()
        : "";
      setter(
        summaryText ||
          "AI summary unavailable right now. Please try again in a moment."
      );
    } catch (error) {
      console.error("Failed to generate AI summary", error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Unknown error";
      setter(`AI summary failed: ${message}`);
    } finally {
      statusSetter("idle");
    }
  };

  // ===== SUB-COMPONENTS =====
  const AnnotationList = ({ side }) => {
    const anns = side === "left" ? leftAnn : rightAnn;
    if (anns.length === 0) return null;
    return (
      <div className="border-t bg-gray-50/50 p-3 max-h-48 overflow-y-auto">
        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
          Comments & Highlights ({anns.length})
        </h4>
        <div className="space-y-2">
          {anns.map((ann) => (
            <div
              key={ann.id}
              className="text-xs bg-white p-2 rounded border flex justify-between gap-2 items-start group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: ann.color }}
                  ></div>
                  {ann.snippet && (
                    <span className="font-mono text-gray-600 truncate max-w-[150px]">
                      {ann.comment ? "Comment on:" : "Highlight:"} "
                      {ann.snippet.replace(/\n/g, " ")}"
                    </span>
                  )}
                </div>
                <p className="text-gray-800 pl-5 leading-relaxed">
                  {ann.comment || (
                    <i className="text-gray-400">No specific comment added.</i>
                  )}
                </p>
              </div>
              <button
                onClick={() => onDeleteAnn(side, ann.id)}
                className="text-gray-400 hover:text-red-500 transition-colors self-start p-1"
                title="Delete Annotation"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PaneToolbar = ({ side, title }) => {
    const isLeft = side === "left";
    const data = isLeft ? leftData : rightData;
    const editing = isLeft ? leftEditing : rightEditing;
    const isDraw = isLeft ? leftDraw : rightDraw;
    const patchMode = mode === "patch";
    const canAnnotateImage = data.type === "image";

    return (
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white min-h-[46px]">
        <span className="font-semibold text-sm mr-2 truncate">{title}</span>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {data.type === "text" ? (
            patchMode ? (
              <span className="text-[11px] text-gray-500 px-2 py-1 bg-gray-100 rounded">
                Patch view (read-only)
              </span>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => toggleEdit(side)}
                >
                  {editing ? "Done" : "Edit"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
                  disabled={editing}
                  onClick={() => onSimpleHighlight(side)}
                >
                  Highlight
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
                  disabled={editing}
                  onClick={() => onAddComment(side)}
                >
                  Comment
                </Button>
              </>
            )
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  isLeft
                    ? setLeftZoom((z) => Math.max(0.1, z - 0.1))
                    : setRightZoom((z) => Math.max(0.1, z - 0.1))
                }
              >
                -
              </Button>
              <span className="text-xs w-8 text-center">
                {((isLeft ? leftZoom : rightZoom) * 100).toFixed(0)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  isLeft
                    ? setLeftZoom((z) => Math.min(3, z + 0.1))
                    : setRightZoom((z) => Math.min(3, z + 0.1))
                }
              >
                +
              </Button>
            </>
          )}
          {canAnnotateImage && (
            <>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <Button
                variant={isDraw ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  isLeft ? setLeftDraw(!leftDraw) : setRightDraw(!rightDraw)
                }
              >
                Draw
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => clearCanvas(side)}
              >
                Clear
              </Button>
            </>
          )}
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleDownload(side)}
            title="Download"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = (side, isBig = false, otherNormalizedSet = null) => {
    const isLeft = side === "left";
    const data = isLeft ? leftData : rightData;
    const zoom = isLeft ? leftZoom : rightZoom;
    const editing = isLeft ? leftEditing : rightEditing;
    const ref = isBig
      ? isLeft
        ? leftBigRef
        : rightBigRef
      : isLeft
      ? leftRef
      : rightRef;
    const editRef = isLeft ? leftEditRef : rightEditRef;
    const canvasRef = isBig
      ? isLeft
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : isLeft
      ? leftCanvasRef
      : rightCanvasRef;
    const isDraw = isLeft ? leftDraw : rightDraw;
    const anns = isLeft ? leftAnn : rightAnn;

    // Use blob URL for PDFs (from base64)
    let displayUrl = data.url;
    if (data.type === "pdf" && data.url && data.url.startsWith("data:")) {
      displayUrl = base64ToBlobUrl(data.url);
    }

    if (isLoadingArtifacts)
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400 animate-pulse">
          Loading...
        </div>
      );

    // PATCH MODE: unified diff visualization
    if (mode === "patch" && data.type === "text" && data.text) {
      // Always get a patch-like string (real patch or synthetic)
      const rawText = ensurePatchText(side, leftData, rightData);
      const diffLines = buildDiffLines(rawText, otherNormalizedSet);

      return (
        <div
          ref={ref}
          className="h-full w-full overflow-auto bg-slate-950 relative"
        >
          <div className="min-w-full text-xs font-mono text-slate-100">
            {diffLines.map((line) => {
              const isLeftSide = side === "left";
              let bg = "bg-slate-950";
              let symbol = " ";
              let tooltip = "Context line (unchanged)";

              if (isLeftSide) {
                // Original code pane: neutral background
                if (line.type === "header") {
                  tooltip = "File header / metadata";
                } else if (line.type === "hunk") {
                  tooltip = "Hunk header (line range)";
                } else if (line.type === "add") {
                  symbol = "+";
                  tooltip = "Added line";
                } else if (line.type === "del") {
                  symbol = "-";
                  tooltip = "Deleted line";
                } else {
                  tooltip = "Context line (unchanged)";
                }
              } else {
                // Comparison pane (Patch B): colors indicate relation to Patch A
                if (line.type === "header") {
                  bg = "bg-slate-800";
                  tooltip = "File header / metadata";
                } else if (line.type === "hunk") {
                  bg = "bg-slate-900";
                  tooltip = "Hunk header (line range)";
                } else if (line.type === "add") {
                  symbol = "+";
                  if (line.inOther) {
                    bg = "bg-emerald-900/60";
                    tooltip = "Added line (also in Patch A)";
                  } else {
                    bg = "bg-emerald-900/90";
                    tooltip = "Added line (only in Patch B)";
                  }
                } else if (line.type === "del") {
                  symbol = "-";
                  if (line.inOther) {
                    bg = "bg-rose-900/60";
                    tooltip = "Deleted line (also in Patch A)";
                  } else {
                    bg = "bg-rose-900/90";
                    tooltip = "Deleted line (only in Patch B)";
                  }
                } else if (line.type === "context") {
                  if (line.inOther) {
                    bg = "bg-sky-900/50";
                    tooltip = "Context line (shared with Patch A)";
                  } else {
                    bg = "bg-slate-950";
                    tooltip = "Context line (only in Patch B)";
                  }
                }
              }

              return (
                <div
                  key={line.id}
                  className={`flex items-start gap-2 px-3 py-0.5 border-b border-slate-900/60 ${bg}`}
                  title={tooltip}
                >
                  <span className="w-8 text-right text-slate-500 select-none">
                    {line.id + 1}
                  </span>
                  <span className="w-4 text-slate-400 select-none">
                    {symbol}
                  </span>
                  <pre className="whitespace-pre-wrap flex-1">
                    {line.raw}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Normal TEXT view (non-patch)
    if (data.type === "text") {
      return (
        <div
          ref={ref}
          className="h-full w-full overflow-auto bg-white relative p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed"
        >
          {editing ? (
            <div
              contentEditable
              ref={editRef}
              className="outline-none h-full"
              suppressContentEditableWarning
            >
              {(isLeft ? leftDraftRef.current : rightDraftRef.current) ||
                data.text}
            </div>
          ) : (
            <div data-content-area="true" className="h-full">
              {renderWithHighlights(data.text || "", anns)}
            </div>
          )}
        </div>
      );
    }

    // IMAGE / PDF view
    return (
      <div
        ref={ref}
        className="h-full w-full overflow-auto bg-gray-100 flex items-start justify-center p-8 relative"
      >
        <div
          className="relative shadow-lg bg-white transition-transform origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {data.type === "image" && (
            <img
              src={data.url}
              className="block max-w-none select-none"
              alt="Artifact"
              onLoad={() => refreshCanvas(side, isBig)}
            />
          )}

          {data.type === "pdf" && displayUrl && (
            <object
              data={displayUrl}
              type="application/pdf"
              className="block w-[800px] h-[1100px] border-none"
              style={{ pointerEvents: isDraw ? "none" : "auto" }}
            >
              <div className="p-4 text-center text-gray-500">
                Unable to display PDF.{" "}
                <a href={displayUrl} download className="underline">
                  Download
                </a>{" "}
                to view.
              </div>
            </object>
          )}

          <canvas
            ref={canvasRef}
            className={`absolute inset-0 z-10 ${
              isDraw
                ? "cursor-crosshair pointer-events-auto"
                : "pointer-events-none"
            }`}
            onMouseDown={(e) => isDraw && startDraw(side, e, isBig)}
            onMouseMove={(e) => isDraw && moveDraw(side, e, isBig)}
            onMouseUp={() => isDraw && endDraw(side)}
            onMouseLeave={() => isDraw && endDraw(side)}
          />
        </div>
      </div>
    );
  };

  const AISummary = ({ side }) => {
    const summary = side === "left" ? leftSummary : rightSummary;
    const status = side === "left" ? leftSummaryStatus : rightSummaryStatus;
    return (
      <div className="border-t p-3 bg-gray-50/50">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-gray-600">
            AI Summary
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => summarizeSide(side)}
            disabled={status === "loading"}
          >
            {status === "loading" ? "..." : "Generate"}
          </Button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          {summary || "No summary generated yet."}
        </p>
      </div>
    );
  };

  const labelsMatch =
    leftCategory && rightCategory && leftCategory === rightCategory;

  const currentSolidRecord =
    solidRecords.length > 0
      ? solidRecords[
          Math.min(solidRecordIndex, solidRecords.length - 1)
        ]
      : null;

  const assignmentMode =
    normalizeModeValue(assignmentMeta?.mode) || assignedMode || mode || null;
  const assignedTaskDisplay =
    assignmentMeta?.label?.trim() ||
    (assignmentMode ? MODE_LABELS[assignmentMode] || assignmentMode : "");
  const allowSyncAndSwap = SYNC_SWAP_MODES.has(mode);
  const studyProgressStatus = useMemo(() => {
    if (submissionLocked) return "completed";
    if (hasLocalDraft || activeAssessmentId || assignmentHydratedRef.current) {
      return "in_progress";
    }
    return "not_started";
  }, [submissionLocked, hasLocalDraft, activeAssessmentId]);
  const studyProgressLabel =
    studyProgressStatus === "completed"
      ? "Completed"
      : studyProgressStatus === "in_progress"
      ? "In progress"
      : "Not started";
  const timerStatusLabel =
    timerStatus === "submitted"
      ? "Submitted"
      : timerStatus === "running"
      ? "Running"
      : "Paused";
  const timerDurationLabel = formatDuration(timerDisplayMs);
  const timerBadgeClass =
    timerStatus === "submitted"
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : timerStatus === "running"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const timerDotClass =
    timerStatus === "submitted"
      ? "bg-slate-400"
      : timerStatus === "running"
      ? "bg-emerald-500 animate-pulse"
      : "bg-amber-500";

  const blockingReasons = [];
  if (missingStudyContext) {
    blockingReasons.push(
      "This page was opened without a study + artifact reference."
    );
  }
  if (!activeParticipantId) {
    blockingReasons.push(
      "We could not link your account to an active study participant record."
    );
  }
  if (assignmentLoadError) {
    blockingReasons.push(assignmentLoadError);
  }

  const hasAssignmentContext = blockingReasons.length === 0;

  // ===== PATCH SIMILARITY (heatmap bar) =====
  let leftNormSet = null;
  let rightNormSet = null;
  let patchSimilarity = null;

  if (
    mode === "patch" &&
    leftData.type === "text" &&
    rightData.type === "text"
  ) {
    const leftLines = getNormalizedContentLines(stripLineNumbers(leftData.text));
    const rightLines = getNormalizedContentLines(
      stripLineNumbers(rightData.text)
    );
    leftNormSet = new Set(leftLines);
    rightNormSet = new Set(rightLines);

    let intersection = 0;
    leftNormSet.forEach((v) => {
      if (rightNormSet.has(v)) intersection += 1;
    });
    const unionSize =
      leftNormSet.size + rightNormSet.size - intersection || 0;
    const ratio = unionSize ? Math.round((intersection / unionSize) * 100) : 0;
    patchSimilarity = ratio;
  }

  const validateBeforeSave = () => {
    if (mode === "stage1") {
      if (!leftCategory) {
        return "Please choose a category for the bug report before saving.";
      }
    } else if (mode === "stage2") {
      if (!leftCategory || !rightCategory) {
        return "Please record both participant labels first.";
      }
      if (labelsMatch) {
        if (!matchCorrectness) {
          return "Confirm whether the matching labels are correct.";
        }
        if (matchCorrectness === "incorrect" && !finalCategory) {
          return "Select the corrected bug category.";
        }
      } else if (!finalCategory) {
        return "Resolve the mismatch by selecting the final category.";
      } else if (finalCategory === "other" && !finalOtherCategory) {
        return "Choose which category should replace both labels.";
      }
    } else if (mode === "solid") {
      if (!solidViolation || !solidComplexity) {
        return "Select both a SOLID violation and a difficulty level.";
      }
    } else if (mode === "patch") {
      if (!patchAreClones) {
        return "Please decide whether the patches are clones.";
      }
      if (patchAreClones === "yes" && !patchCloneType) {
        return "Select a clone type before saving.";
      }
    } else if (mode === "snapshot") {
      if (!snapshotAssets.reference || !snapshotAssets.failure || !snapshotDiffData) {
        return "Upload the reference, failure, and diff artifacts before saving.";
      }
      if (!snapshotOutcome) {
        return "Choose whether this is an actual failure or an intended change.";
      }
      const classifiedChange =
        snapshotChangeType === "other"
          ? snapshotChangeTypeOther.trim()
          : snapshotChangeType;
      if (!classifiedChange) {
        return "Classify the type of UI change before saving.";
      }
    }
    return null;
  };

  const handleSaveAssessment = async () => {
    setAssessmentError("");
    setAssessmentSuccess("");

    if (submissionLocked) {
      setAssessmentError(
        "You've already submitted this task. Researchers are reviewing your work."
      );
      return;
    }

    const words = (assessmentComment || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      setAssessmentError("A comment is required to submit.");
      return;
    }
    if (words.length < 20) {
      setAssessmentError("Please provide at least 20 words in the comment.");
      return;
    }

    const validationMessage = validateBeforeSave();
    if (validationMessage) {
      setAssessmentError(validationMessage);
      return;
    }

    if (!hasAssignmentContext) {
      setAssessmentError(
        "Missing assignment context. Please relaunch this artifact task from your dashboard.",
      );
      return;
    }

    if (missingStudyContext) {
      setAssessmentError(
        "Missing study context. Please open this task from your study assignment."
      );
      return;
    }

    if (!authToken) {
      setAssessmentError("Please log in again to submit your assessment.");
      navigate("/login");
      return;
    }

    const assessmentType =
      mode === "solid"
        ? "solid"
        : mode === "patch"
        ? "clone"
        : mode === "snapshot"
        ? "snapshot"
        : "bug_stage";

    setAssessmentSaving(true);
    try {
      const response = await api.post(
        "/api/artifact-assessments",
        {
          studyId: studyContext.studyId,
          studyArtifactId: studyContext.studyArtifactId,
          studyParticipantId: activeParticipantId,
          assessmentType,
          status: "submitted",
          payload: captureAssessmentState(),
          sourceEvaluationId: studyContext.sourceEvaluationId || null,
          comparisonId:
            studyContext.comparisonId || assignmentMeta?.comparison?.id || null,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const saved = response.data?.assessment;
      if (saved) {
        setActiveAssessmentId(saved.id);
        if (saved.studyParticipantId) {
          setResolvedStudyParticipantId(saved.studyParticipantId);
        }
        if (saved.payload) {
          hydrateAssessmentPayload(saved.payload);
        }
        setSubmissionLocked(true);
        pauseTimer(true);
      }
      setAssessmentSuccess("Assessment submitted successfully.");
    } catch (error) {
      if (error.response?.status === 409) {
        const existing = error.response?.data?.assessment;
        if (existing) {
          setActiveAssessmentId(existing.id);
          if (existing.payload) {
            hydrateAssessmentPayload(existing.payload);
          }
          setSubmissionLocked(existing.status === "submitted");
        }
        setAssessmentError(
          error.response?.data?.message ||
            "This study task has already been submitted."
        );
        return;
      }
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }
      setAssessmentError(
        error.response?.data?.message ||
          "Unable to save this artifact assessment right now."
      );
    } finally {
      setAssessmentSaving(false);
    }
  };

  // ===== MAIN RENDER =====
  if (!hasAssignmentContext) {
    return (
      <div className="min-h-screen bg-white px-4 py-12 flex items-center justify-center">
        <Card className="w-full max-w-2xl border-dashed">
          <CardHeader>
            <CardTitle>No artifact assignment available</CardTitle>
            <CardDescription>
              Researchers need to send you a specific study stage before this workspace is unlocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              You landed on the artifact comparison tool without an active assignment. Return to your participant
              dashboard and open the task from the study card once a researcher assigns you a stage.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {blockingReasons.map((reason) => (
                <li key={reason} className="text-gray-700">
                  {reason}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button onClick={() => navigate("/participant")}>Participant dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 text-gray-900 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Assigned task
            </span>
            {assignedTaskDisplay ? (
              <h1 className="text-xl font-bold leading-tight">
                {assignedTaskDisplay}
              </h1>
            ) : (
              <h1 className="text-xl font-bold text-gray-400">
                Waiting for researcher instructions
              </h1>
            )}
            {!assignmentMeta?.label && assignmentMode && assignedTaskDisplay && (
              <p className="text-xs text-gray-500">
                {MODE_LABELS[assignmentMode] || assignmentMode}
              </p>
            )}
            {!assignedTaskDisplay && (
              <p className="text-xs text-gray-500">
                Launch this workspace from your study dashboard once a stage is assigned.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 items-start lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  studyProgressStatus === "completed"
                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                    : studyProgressStatus === "in_progress"
                    ? "border-amber-200 text-amber-700 bg-amber-50"
                    : "border-slate-200 text-slate-600 bg-slate-50"
                }`}
              >
                {studyProgressLabel}
              </span>
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1 ${timerBadgeClass}`}
                title="Tracks your time on this study task"
              >
                <span className={`h-2 w-2 rounded-full ${timerDotClass}`} />
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-semibold text-gray-700">
                    Time on task
                  </span>
                  <span className="text-[11px] text-gray-600">
                    {timerDurationLabel} • {timerStatusLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              {allowSyncAndSwap && (
                <>
                  <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-md border">
                    <Checkbox
                      id="sync-mode"
                      checked={syncScroll}
                      onCheckedChange={(checked) => setSyncScroll(!!checked)}
                    />
                    <label
                      htmlFor="sync-mode"
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      Sync Scroll
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tD = leftData;
                      setLeftData(rightData);
                      setRightData(tD);
                      const tA = leftAnn;
                      setLeftAnn(rightAnn);
                      setRightAnn(tA);
                      const tS = leftSummary;
                      setLeftSummary(rightSummary);
                      setRightSummary(tS);
                      const tC = leftCategory;
                      setLeftCategory(rightCategory);
                      setRightCategory(tC);
                    }}
                  >
                    Swap Sides
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowBig(true)}
                title="Full Screen"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {assignmentMeta?.instructions && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Researcher instructions
            </p>
            {assignmentMeta.label ? (
              <p className="font-semibold text-slate-900">{assignmentMeta.label}</p>
            ) : null}
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {assignmentMeta.instructions}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="border rounded-md px-4 py-3 bg-gray-50 text-xs text-gray-700 flex flex-wrap gap-4">
            <span>Study #{studyContext.studyId ?? "—"}</span>
            <span>Artifact link #{studyContext.studyArtifactId ?? "—"}</span>
            <span>Participant record #{activeParticipantId ?? "—"}</span>
            <span>
              Signed in as {currentUser?.name || currentUser?.email || "participant"}
            </span>
            {activeAssessmentId && (
              <span className="text-emerald-700 font-semibold">
                Last saved ID #{activeAssessmentId}
              </span>
            )}
          </div>
          {participantSummary && (
            <div className="border border-slate-200 bg-white rounded-md px-4 py-2 text-xs text-slate-600">
              Assigned participant:
              <span className="font-semibold text-slate-900 ml-1">
                {participantSummary.name || `User ${participantSummary.id}`}
              </span>
              {participantSummary.email ? ` • ${participantSummary.email}` : null}
            </div>
          )}
          {missingStudyContext && (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2 rounded">
              Open this task from your assigned study so the submission can be
              linked to the correct artifact.
            </div>
          )}
          {assessmentLoading && (
            <div className="border border-blue-200 bg-blue-50 text-blue-900 text-sm px-3 py-2 rounded">
              Loading your previous submission…
            </div>
          )}
          {assessmentSuccess && (
            <div className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm px-3 py-2 rounded">
              {assessmentSuccess}
            </div>
          )}
        </div>

        {/* Patch similarity heatmap bar */}
        {mode === "patch" && patchSimilarity !== null && (
          <div className="border rounded-md px-3 py-2 bg-gray-50 flex items-center gap-3 text-xs text-gray-700">
            <span className="font-medium">Patch similarity</span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${patchSimilarity}%` }}
              />
            </div>
            <span className="w-10 text-right font-semibold">
              {patchSimilarity}%
            </span>
          </div>
        )}

        {metadataEntries.length > 0 && (
          <div className="border rounded-md px-4 py-3 bg-blue-50 flex flex-wrap gap-3 items-center text-xs text-blue-900">
            <div>
              <p className="font-semibold">
                Defects4J metadata loaded ({metadataEntries.length} bugs)
              </p>
              <p className="text-[11px] text-blue-800">
                Switch between bug reports without re-uploading the file.
              </p>
            </div>
            <select
              value={selectedMetadataId}
              onChange={(e) => handleMetadataSelection(e.target.value)}
              className="border rounded px-2 py-1 bg-white text-gray-700"
            >
              {!selectedMetadataId && (
                <option value="" disabled>
                  Select bug…
                </option>
              )}
              {metadataEntries.map((bug) => (
                <option key={bug.id} value={bug.id}>
                  {bug.title} ({bug.project || "Unknown project"})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-[11px]">
              <span>Target pane:</span>
              <select
                value={metadataPane}
                onChange={(e) => {
                  const nextPane = e.target.value;
                  setMetadataPane(nextPane);
                  if (selectedMetadataId) {
                    handleMetadataSelection(selectedMetadataId, nextPane);
                  }
                }}
                className="border rounded px-2 py-1 bg-white text-gray-700"
              >
                <option value="left">Artifact A (left)</option>
                <option value="right">Artifact B (right)</option>
              </select>
            </div>
            {metadataLoadingId && (
              <span className="text-[11px] text-blue-700">
                Loading bug {metadataLoadingId}...
              </span>
            )}
          </div>
        )}

        {mode === "solid" && solidRecords.length > 0 && (
          <div className="border rounded-md px-4 py-3 bg-amber-50 flex flex-wrap items-center gap-3 text-xs text-amber-900">
            <span className="font-semibold">
              {solidDatasetName || "SOLID dataset"} – Record {" "}
              {solidRecordIndex + 1} / {solidRecords.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => nudgeSolidRecord(-1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => nudgeSolidRecord(1)}
              >
                Next
              </Button>
            </div>
            <select
              className="border rounded px-2 py-1 bg-white text-gray-700"
              value={solidRecordIndex}
              onChange={(e) => handleSolidRecordChange(Number(e.target.value))}
            >
              {solidRecords.map((record, idx) => (
                <option key={record.__id} value={idx}>
                  #{idx + 1} – {record.__id}
                </option>
              ))}
            </select>
            <Button
              variant="link"
              size="sm"
              className="text-amber-900"
              onClick={() => setShowSolidGroundTruth((prev) => !prev)}
            >
              {showSolidGroundTruth ? "Hide" : "Show"} ground truth
            </Button>
          </div>
        )}

        {/* MAIN VIEWER */}
        <div className="flex border rounded-lg h-[650px] shadow-sm overflow-hidden">
          {/* LEFT always visible */}
          <div
            className={`flex-1 flex flex-col min-w-0 border-r relative ${
              mode === "stage1" || mode === "solid" ? "w-full" : "w-1/2"
            }`}
          >
            <PaneToolbar
              side="left"
              title={
                mode === "patch"
                  ? "Patch A"
                  : mode === "stage1"
                  ? "Bug Report"
                  : mode === "solid"
                  ? "Violating Code (input)"
                  : mode === "snapshot"
                  ? "Reference / Failure / Diff (A)"
                  : "Bug Report / Artifact A"
              }
            />
            <div className="flex-1 relative overflow-hidden">
              {renderContent(
                "left",
                false,
                mode === "patch" ? rightNormSet : null
              )}
            </div>
            {mode !== "patch" && <AnnotationList side="left" />}
            <AISummary side="left" />
          </div>

          {/* RIGHT pane: Stage 2, Patch & Snapshot */}
          {(mode === "stage2" || mode === "patch" || mode === "snapshot") && (
            <div className="flex-1 w-1/2 flex flex-col min-w-0 relative">
              <PaneToolbar
                side="right"
                title={
                  mode === "patch"
                    ? "Patch B"
                    : mode === "snapshot"
                    ? "Reference / Failure / Diff (B)"
                    : "Participant 2 / AI Label Artifact"
                }
              />
              <div className="flex-1 relative overflow-hidden">
                {renderContent(
                  "right",
                  false,
                  mode === "patch" ? leftNormSet : null
                )}
              </div>
              {mode !== "patch" && <AnnotationList side="right" />}
              <AISummary side="right" />
            </div>
          )}
        </div>

        {mode === "snapshot" && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Diff artifact
                </h3>
                <p className="text-[11px] text-gray-500">
                  Upload the diff.png image (or PDF) that highlights pixel
                  differences between the reference and failure snapshots.
                </p>
              </div>
              <div>
                <input
                  ref={snapshotDiffInputRef}
                  type="file"
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleSnapshotDiffUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => snapshotDiffInputRef.current?.click()}
                >
                  {snapshotDiffData ? "Replace diff" : "Upload diff"}
                </Button>
              </div>
            </div>
            {snapshotDiffData ? (
              snapshotDiffData.type === "image" ? (
                <img
                  src={snapshotDiffData.url}
                  alt="Diff artifact"
                  className="border rounded-md max-h-[420px] object-contain mx-auto"
                />
              ) : (
                <object
                  data={
                    snapshotDiffData.url.startsWith("data:")
                      ? base64ToBlobUrl(snapshotDiffData.url)
                      : snapshotDiffData.url
                  }
                  type="application/pdf"
                  className="w-full h-[420px]"
                >
                  <div className="text-xs text-gray-500 text-center">
                    Unable to display PDF diff. Download to view.
                  </div>
                </object>
              )
            ) : (
              <div className="text-xs text-gray-500 border border-dashed rounded-md p-6 text-center">
                No diff artifact uploaded yet.
              </div>
            )}
          </div>
        )}

        {/* ASSESSMENT CARD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === "stage1"
                ? "Stage 1: Participant Bug Label"
                : mode === "stage2"
                ? "Stage 2: Reviewer Bug Label Comparison"
                : mode === "solid"
                ? "SOLID Violations: Code & Complexity Labeling"
                : mode === "snapshot"
                ? "Snapshot Study: Failure vs Intended UI Change"
                : "Patch Mode: Code Clone Assessment"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {mode === "patch" ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={patchPairInputRef}
                    type="file"
                    multiple
                    accept=".patch,.diff,.txt"
                    className="hidden"
                    onChange={handlePatchPairUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => patchPairInputRef.current?.click()}
                  >
                    Load patch pair (.diff/.patch)
                  </Button>
                  {patchPairLabel && (
                    <span className="text-[11px] text-gray-500">
                      Loaded: {patchPairLabel}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Are these two patches code clones?</Label>
                  <RadioGroup
                    value={patchAreClones}
                    onValueChange={(v) => {
                      setPatchAreClones(v);
                      if (v === "no") {
                        setPatchCloneType("");
                      }
                    }}
                    className="flex flex-wrap gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="yes"
                        id="patch-clone-yes"
                        className={radioClass}
                      />
                      <Label htmlFor="patch-clone-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="no"
                        id="patch-clone-no"
                        className={radioClass}
                      />
                      <Label htmlFor="patch-clone-no">No</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-[11px] text-gray-400">
                    A “clone” means the patches represent essentially the same
                    change.
                  </p>
                </div>

                {patchAreClones === "yes" && (
                  <div className="space-y-2">
                    <Label>Select clone type</Label>
                    <select
                      value={patchCloneType}
                      onChange={(e) => setPatchCloneType(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-full bg-white"
                    >
                      <option value="">Choose clone type...</option>
                      {PATCH_CLONE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400">
                      Use Type-1 for almost identical patches, up to Type-4 for
                      very different implementations with the same effect.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="patch-comment">
                    Notes (why did you decide this?)
                  </Label>
                  <Textarea
                    id="patch-comment"
                    value={patchCloneComment}
                    onChange={(e) => setPatchCloneComment(e.target.value)}
                    rows={3}
                    placeholder="E.g., 'Both patches change the same API call and condition, only variable names differ, so Type-2.'"
                  />
                </div>
              </>
            ) : mode === "stage1" ? (
              <>
                <div className="space-y-2">
                  <Label>Select bug category for this report</Label>
                  <select
                    value={leftCategory}
                    onChange={(e) => setLeftCategory(e.target.value)}
                    className="border rounded px-2 py-1 text-sm w-full bg-white"
                  >
                    <option value="">Choose category...</option>
                    {bugCategoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Participant labels the bug report using the provided
                    taxonomy.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overall-comment-stage1">
                    Optional comment (why did you choose this category?)
                  </Label>
                  <Textarea
                    id="overall-comment-stage1"
                    value={assessmentComment}
                    onChange={(e) => setAssessmentComment(e.target.value)}
                    rows={3}
                    placeholder="E.g., 'The description mentions UI layout breaking after resize, so I chose GUI.'"
                  />
                  {assessmentError && (
                    <p className="text-xs text-destructive">{assessmentError}</p>
                  )}
                </div>
              </>
            ) : mode === "solid" ? (
              <>
                <div className="space-y-2">
                  <Label>Select SOLID violation for this code</Label>
                  <select
                    value={solidViolation}
                    onChange={(e) => setSolidViolation(e.target.value)}
                    className="border rounded px-2 py-1 text-sm w-full bg-white"
                  >
                    <option value="">Choose violation...</option>
                    {SOLID_VIOLATIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Participants see only the violating code (input) and choose
                    which SOLID principle is being broken.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Complexity level of this violation</Label>
                  <RadioGroup
                    value={solidComplexity}
                    onValueChange={setSolidComplexity}
                    className="flex flex-wrap gap-4 mt-1"
                  >
                    {COMPLEXITY_LEVELS.map((lvl) => (
                      <div
                        key={lvl}
                        className="flex items-center space-x-2 min-w-[90px]"
                      >
                        <RadioGroupItem
                          value={lvl}
                          id={`solid-level-${lvl.toLowerCase()}`}
                          className={radioClass}
                        />
                        <Label htmlFor={`solid-level-${lvl.toLowerCase()}`}>
                          {lvl}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-[11px] text-gray-400">
                    EASY: obvious and local; HARD: subtle, spread across
                    classes or methods.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solid-fixed-code">
                    Optional: non-violating version of the code
                  </Label>
                  <Textarea
                    id="solid-fixed-code"
                    value={solidFixedCode}
                    onChange={(e) => setSolidFixedCode(e.target.value)}
                    rows={6}
                    placeholder="Paste or write a refactored version that no longer violates the chosen principle (optional)."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overall-comment-solid">
                    Explanation (why this violation and level?)
                  </Label>
                <Textarea
                  id="overall-comment-solid"
                  value={assessmentComment}
                  onChange={(e) => setAssessmentComment(e.target.value)}
                  rows={3}
                  placeholder="E.g., 'Class handles both persistence and business logic, so SRP is violated; refactoring requires splitting responsibilities, so I marked it MEDIUM.'"
                />
                {assessmentError && (
                  <p className="text-xs text-destructive">{assessmentError}</p>
                )}
              </div>

              {showSolidGroundTruth && currentSolidRecord && (
                <div className="border rounded-md bg-amber-100/60 p-3 text-xs text-amber-900 space-y-2">
                    <p className="font-semibold text-amber-900">
                      Ground truth (for reviewers only)
                    </p>
                    <p>
                      <span className="font-semibold">Violation:</span>{" "}
                      {currentSolidRecord.violation || "n/a"}
                    </p>
                    <p>
                      <span className="font-semibold">Difficulty:</span>{" "}
                      {currentSolidRecord.level || "n/a"}
                    </p>
                    {currentSolidRecord.output && (
                      <div>
                        <p className="font-semibold mb-1">LLM suggestion:</p>
                        <pre className="bg-white border rounded-md p-2 text-[11px] text-gray-800 whitespace-pre-wrap">
                          {currentSolidRecord.output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : mode === "snapshot" ? (
              <>
                <div className="space-y-2">
                  <Label>
                    Based on the reference, failure, and diff images, what is
                    your decision?
                  </Label>
                  <RadioGroup
                    value={snapshotOutcome}
                    onValueChange={setSnapshotOutcome}
                    className="flex flex-wrap gap-4 mt-1"
                  >
                    {SNAPSHOT_OUTCOMES.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center space-x-2 min-w-[140px]"
                      >
                        <RadioGroupItem
                          value={o.id}
                          id={`snapshot-${o.id}`}
                          className={radioClass}
                        />
                        <Label htmlFor={`snapshot-${o.id}`}>{o.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-[11px] text-gray-400">
                    Participants review the reference, failure, and diff
                    snapshots and decide whether the case is an actual failure
                    or an intended UI change.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    Which UI change best explains the highlighted diff?
                  </Label>
                  <select
                    value={snapshotChangeType}
                    onChange={(e) => setSnapshotChangeType(e.target.value)}
                    className="border rounded px-2 py-1 text-sm w-full bg-white"
                  >
                    <option value="">Choose change type...</option>
                    {SNAPSHOT_CHANGE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {snapshotChangeType === "other" && (
                    <input
                      value={snapshotChangeTypeOther}
                      onChange={(e) => setSnapshotChangeTypeOther(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-full"
                      placeholder="Describe the UI change"
                    />
                  )}
                  <p className="text-[11px] text-gray-400">
                    These tags help reviewers see whether participants agreed
                    on the type of visual change (color shift, layout, missing
                    content, etc.).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snapshot-comment">
                    Notes (brief explanation of your choice)
                  </Label>
                <Textarea
                  id="snapshot-comment"
                  value={assessmentComment}
                  onChange={(e) => setAssessmentComment(e.target.value)}
                  rows={3}
                  placeholder="E.g., 'Layout change matches updated design specs, text and icons align with new style guide, so this is an intended UI change.'"
                />
                {assessmentError && (
                  <p className="text-xs text-destructive">{assessmentError}</p>
                )}
              </div>
              </>
            ) : (
              <>
                {/* Stage 2: Reviewer sees two labels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Participant 1 Label (Artifact A)</Label>
                    <select
                      value={leftCategory}
                      onChange={(e) => setLeftCategory(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-full bg-white"
                    >
                      <option value="">Select...</option>
                      {bugCategoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Participant 2 / AI Label (Artifact B)</Label>
                    <select
                      value={rightCategory}
                      onChange={(e) => setRightCategory(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-full bg-white"
                    >
                      <option value="">Select...</option>
                      {bugCategoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {leftCategory && rightCategory && (
                  <>
                    {labelsMatch ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>
                            The two labels match ({leftCategory}). Is this
                            category correct?
                          </Label>
                          <RadioGroup
                            value={matchCorrectness}
                            onValueChange={(v) => {
                              setMatchCorrectness(v);
                              if (v === "correct") {
                                setFinalCategory(leftCategory);
                                setFinalOtherCategory("");
                              } else {
                                setFinalCategory("");
                                setFinalOtherCategory("");
                              }
                            }}
                            className="flex gap-4 mt-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="correct"
                                id="match-correct"
                                className={radioClass}
                              />
                              <Label htmlFor="match-correct">Correct</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="incorrect"
                                id="match-incorrect"
                                className={radioClass}
                              />
                              <Label htmlFor="match-incorrect">
                                Incorrect
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {matchCorrectness === "incorrect" && (
                          <div className="space-y-2">
                            <Label>Select the correct category</Label>
                            <select
                              value={finalCategory}
                              onChange={(e) => {
                                setFinalCategory(e.target.value);
                                setFinalOtherCategory("");
                              }}
                              className="border rounded px-2 py-1 text-sm w-full bg-white"
                            >
                              <option value="">Choose category...</option>
                              {bugCategoryOptions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label>
                          The labels differ ({leftCategory} vs {rightCategory}).
                          Choose a final category:
                        </Label>
                        <select
                          value={finalCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFinalCategory(val);
                            if (val !== "other") {
                              setFinalOtherCategory("");
                            }
                          }}
                          className="border rounded px-2 py-1 text-sm w-full bg-white"
                        >
                          <option value="">Select...</option>
                          <option value={leftCategory}>
                            Accept Participant 1: {leftCategory}
                          </option>
                          <option value={rightCategory}>
                            Accept Participant 2 / AI: {rightCategory}
                          </option>
                          <option value="other">
                            Neither – choose another category
                          </option>
                        </select>

                        {finalCategory === "other" && (
                          <div className="space-y-2">
                            <Label>Choose alternative category</Label>
                            <select
                              value={finalOtherCategory}
                              onChange={(e) =>
                                setFinalOtherCategory(e.target.value)
                              }
                              className="border rounded px-2 py-1 text-sm w-full bg-white"
                            >
                              <option value="">Select...</option>
                              {bugCategoryOptions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="overall-comment-stage2">
                    Reviewer notes (brief explanation of your decision)
                  </Label>
                  <Textarea
                    id="overall-comment-stage2"
                    value={assessmentComment}
                    onChange={(e) => setAssessmentComment(e.target.value)}
                    rows={3}
                    placeholder="E.g., 'Although both labeled it as Performance, the description mentions incorrect configuration of environment variables, so I chose Configuration.'"
                  />
                  {assessmentError && (
                    <p className="text-xs text-destructive">{assessmentError}</p>
                  )}
                </div>
              </>
            )}

            {evaluationCriteria.length > 0 && (
              <div className="space-y-3 border-t border-dashed pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Evaluation criteria</p>
                  <p className="text-xs text-muted-foreground">Rate each (1–5 stars)</p>
                </div>
                <div className="space-y-2">
                  {evaluationCriteria.map((criterion) => {
                    const currentValue =
                      criteriaHover[criterion.label] ??
                      criteriaRatings[criterion.label] ??
                      0;
                    return (
                      <div
                        key={criterion.label}
                        className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{criterion.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Weight: {criterion.weight}% (5 stars = full weight)
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              type="button"
                              className="p-1"
                              onMouseEnter={() =>
                                setCriteriaHover((prev) => ({
                                  ...prev,
                                  [criterion.label]: value,
                                }))
                              }
                              onMouseLeave={() =>
                                setCriteriaHover((prev) => {
                                  const next = { ...prev };
                                  delete next[criterion.label];
                                  return next;
                                })
                              }
                              onClick={() => handleCriteriaRating(criterion.label, value)}
                            >
                              <Star
                                className={
                                  value <= currentValue
                                    ? "h-5 w-5 fill-amber-400 text-amber-400"
                                    : "h-5 w-5 text-gray-300"
                                }
                              />
                            </button>
                          ))}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {currentValue || 0}/5
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                Auto-save is on
              </span>
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800"
                onClick={handleSaveAssessment}
                disabled={
                  assessmentSaving || submissionLocked || !hasAssignmentContext
                }
              >
                {submissionLocked
                  ? "Already submitted"
                  : assessmentSaving
                  ? "Saving..."
                  : "Submit assessment"}
              </Button>
            </div>
            {submissionLocked && (
              <p className="text-xs text-emerald-700 text-right">
                Submitted! Researchers can now review your decision.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending comment modal */}
        {pendingAnnotation && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => setPendingAnnotation(null)}
          >
            <div
              className="bg-white p-6 rounded-lg shadow-xl w-[400px]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold mb-2">Add Comment</h3>
              <div className="text-xs text-gray-500 italic border-l-2 pl-2 mb-4 bg-gray-50 p-2 rounded">
                "{pendingAnnotation.snippet}"
              </div>
              <Textarea
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
                placeholder="Enter your comment here..."
                className="mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingAnnotation(null)}
                >
                  Cancel
                </Button>
                <Button onClick={savePendingComment}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen mode */}
        {showBig && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
            <div className="border-b p-4 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-lg">Full Screen View</h2>
              <Button variant="outline" onClick={() => setShowBig(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div
                className={`flex-1 flex flex-col min-w-0 border-r relative ${
                  mode === "stage1" || mode === "solid" ? "w-full" : "w-1/2"
                }`}
              >
                <PaneToolbar
                  side="left"
                  title={
                    mode === "patch"
                      ? "Patch A"
                      : mode === "stage1"
                      ? "Bug Report"
                      : mode === "solid"
                      ? "Violating Code (input)"
                      : mode === "snapshot"
                      ? "Reference / Failure / Diff (A)"
                      : "Bug Report / Artifact A"
                  }
                />
                <div className="flex-1 relative overflow-hidden">
                  {renderContent(
                    "left",
                    true,
                    mode === "patch" ? rightNormSet : null
                  )}
                </div>
                {mode !== "patch" && <AnnotationList side="left" />}
                <AISummary side="left" />
              </div>
              {(mode === "stage2" || mode === "patch" || mode === "snapshot") && (
                <div className="flex-1 w-1/2 flex flex-col min-w-0 relative">
                  <PaneToolbar
                    side="right"
                    title={
                      mode === "patch"
                        ? "Patch B"
                        : mode === "snapshot"
                        ? "Reference / Failure / Diff (B)"
                        : "Participant 2 / AI Artifact"
                    }
                  />
                  <div className="flex-1 relative overflow-hidden">
                    {renderContent(
                      "right",
                      true,
                      mode === "patch" ? leftNormSet : null
                    )}
                  </div>
                  {mode !== "patch" && <AnnotationList side="right" />}
                  <AISummary side="right" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
