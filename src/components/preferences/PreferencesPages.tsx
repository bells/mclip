import type { ReactNode } from "react";

import type { PreferencesDestinationId } from "./preferencesNavigation";

type PreferencesPagesProps = {
  activeDestinationId: PreferencesDestinationId;
  pages: Record<PreferencesDestinationId, ReactNode>;
};

export function PreferencesPages({
  activeDestinationId,
  pages,
}: PreferencesPagesProps) {
  return pages[activeDestinationId];
}
