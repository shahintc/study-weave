import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/api/axios";

const noopDefaults = {
  filters: { study: "all", criteria: "", from: "", to: "" },
  layout: [],
};

export function useDashboardPreferences(userKey, defaults = noopDefaults, authToken = null) {
  const stableDefaults = useMemo(() => defaults || noopDefaults, [defaults]);
  const storageKey = useMemo(
    () => `dashboardPrefs:${userKey || "anon"}`,
    [userKey],
  );

  const [filters, setFilters] = useState(stableDefaults.filters);
  const [layout, setLayout] = useState(stableDefaults.layout);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");

  const persistLocal = useCallback(
    (state) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        console.warn("Unable to store dashboard preferences locally", error);
      }
    },
    [storageKey],
  );

  const loadFromLocal = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setFilters(stableDefaults.filters);
        setLayout(stableDefaults.layout);
        return;
      }
      const parsed = JSON.parse(raw);
      setFilters(parsed.filters || stableDefaults.filters);
      setLayout(parsed.layout || stableDefaults.layout);
    } catch (error) {
      console.warn("Failed to parse dashboard preferences", error);
      setFilters(stableDefaults.filters);
      setLayout(stableDefaults.layout);
    }
  }, [storageKey, stableDefaults.filters, stableDefaults.layout]);

  useEffect(() => {
    loadFromLocal();
  }, [loadFromLocal]);

  const saveToServer = useCallback(
    async (state) => {
      persistLocal(state);
      // Avoid hitting the server without credentials; local persistence still works.
      if (!authToken) {
        setLastSavedAt(new Date().toISOString());
        setSaveError("");
        return;
      }

      setSaving(true);
      setSaveError("");
      try {
        await api.post(
          "/user/preferences",
          { preferences: state },
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        setLastSavedAt(new Date().toISOString());
      } catch (error) {
        console.warn("Dashboard preference save failed", error?.response || error);
        // Swallow server save errors to keep UX silent; local save already applied.
        setSaveError("");
      } finally {
        setSaving(false);
      }
    },
    [authToken, persistLocal],
  );

  const updateFilters = useCallback(
    (updates) => {
      setFilters((prev) => {
        const nextFilters = { ...prev, ...updates };
        const nextState = { filters: nextFilters, layout };
        persistLocal(nextState);
        return nextFilters;
      });
    },
    [layout, persistLocal],
  );

  const updateLayout = useCallback(
    (nextLayout) => {
      setLayout(nextLayout);
      const nextState = { filters, layout: nextLayout };
      persistLocal(nextState);
    },
    [filters, persistLocal],
  );

  const resetPreferences = useCallback(() => {
    const baseline = {
      filters: { ...stableDefaults.filters },
      layout: [...stableDefaults.layout],
    };
    setFilters(baseline.filters);
    setLayout(baseline.layout);
    saveToServer(baseline);
  }, [saveToServer, stableDefaults.filters, stableDefaults.layout]);

  const savePreferences = useCallback(() => {
    const current = { filters, layout };
    return saveToServer(current);
  }, [filters, layout, saveToServer]);

  return {
    filters,
    layout,
    updateFilters,
    updateLayout,
    resetPreferences,
    savePreferences,
    savingPreferences: saving,
    lastSavedAt,
    saveError,
    storageKey,
  };
}
