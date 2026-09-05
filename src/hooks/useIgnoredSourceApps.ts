import { useEffect, useRef, useState } from "react";

import { MAX_IGNORED_SOURCE_APP_COUNT } from "../constants";
import { pickIgnoredSourceApps, resolveIgnoredSourceApps } from "../services/ipc/commands";
import type { SourceApplicationOption } from "../types";
import { mergeIgnoredSourceAppIds } from "../utils/ignoredSourceApps";

export type ApplicationPickerError = "invalid" | "unavailable" | "limit" | "failed";

export function useIgnoredSourceApps(identifiers: string[], onChange: (ids: string[]) => void) {
  const [metadata, setMetadata] = useState<Record<string, SourceApplicationOption>>({});
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<ApplicationPickerError | null>(null);
  const mountedRef = useRef(false);
  const pickingRef = useRef(false);
  const identifiersRef = useRef(identifiers);
  identifiersRef.current = identifiers;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (identifiers.length) {
      void resolveIgnoredSourceApps(identifiers).then((apps) => {
        if (active) {
          setMetadata((current) => ({
            ...Object.fromEntries(apps.map((app) => [app.id, app])),
            ...current,
          }));
        }
      }).catch(() => { /* Existing identifiers remain removable when metadata is unavailable. */ });
    }
    return () => { active = false; };
  }, [identifiers]);

  const chooseApplications = async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setIsPicking(true);
    setError(null);
    try {
      const apps = await pickIgnoredSourceApps();
      if (!mountedRef.current || !apps.length) return;
      const merged = mergeIgnoredSourceAppIds(identifiersRef.current, apps.map((app) => app.id), MAX_IGNORED_SOURCE_APP_COUNT);
      if (!merged) { setError("limit"); return; }
      setMetadata((current) => ({ ...current, ...Object.fromEntries(apps.map((app) => [app.id, app])) }));
      if (merged.length !== identifiersRef.current.length) onChange(merged);
    } catch (cause: unknown) {
      if (mountedRef.current) {
        setError(cause === "applicationLimitReached" ? "limit"
          : cause === "applicationSelectionInvalid" || cause === "applicationIdentityUnavailable" ? "invalid"
            : cause === "applicationPickerUnavailable" ? "unavailable" : "failed");
      }
    } finally {
      pickingRef.current = false;
      if (mountedRef.current) setIsPicking(false);
    }
  };

  return {
    apps: identifiers.map((id) => metadata[id] ?? { id, displayName: id, iconDataUrl: null }),
    chooseApplications,
    clearError: () => setError(null),
    error,
    isPicking,
  };
}
