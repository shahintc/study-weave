const STORAGE_PREFIX = "study-timer";

export const buildStudyTimerKey = ({
  studyId,
  studyArtifactId,
  studyParticipantId,
}) => {
  if (!studyId || !studyArtifactId) return null;
  const participantPart = studyParticipantId
    ? String(studyParticipantId)
    : "anon";
  return `${STORAGE_PREFIX}:${studyId}:${studyArtifactId}:${participantPart}`;
};

export const readStoredTimer = (key) => {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      elapsedMs: Number(parsed.elapsedMs) || 0,
      running: Boolean(parsed.running),
      lastStart: typeof parsed.lastStart === "number" ? parsed.lastStart : null,
      submitted: Boolean(parsed.submitted),
    };
  } catch (error) {
    console.warn("Failed to parse stored study timer", error);
    return null;
  }
};

export const writeStoredTimer = (key, state) => {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        elapsedMs: Number(state.elapsedMs) || 0,
        running: Boolean(state.running),
        lastStart:
          typeof state.lastStart === "number" ? state.lastStart : null,
        submitted: Boolean(state.submitted),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Unable to persist study timer", error);
  }
};

export const readTimerSnapshot = (key) => {
  const saved = readStoredTimer(key);
  if (!saved) return null;

  const running = Boolean(saved.running) && !saved.submitted;
  const lastStart = typeof saved.lastStart === "number" ? saved.lastStart : null;
  const baseElapsed = Number(saved.elapsedMs) || 0;
  const delta = running && lastStart ? Math.max(0, Date.now() - lastStart) : 0;

  return {
    elapsedMs: Math.max(0, baseElapsed + delta),
    running,
    submitted: Boolean(saved.submitted),
  };
};

export const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};
