export type PreferenceFeedbackState = "idle" | "pending" | "saved" | "error";

export type PreferenceFeedbackMap = Record<string, PreferenceFeedbackState>;

export type PreferenceSaveControllerOptions<Settings> = {
  initialSettings: Settings;
  normalize: (settings: Settings) => Settings;
  onFeedback: (feedback: PreferenceFeedbackMap) => void;
  onSettings: (settings: Settings) => void;
  save: (settings: Settings) => Promise<Settings>;
};

export type PreferenceSaveController<Settings> = {
  apply: (
    settingId: string,
    updater: (settings: Settings) => Settings,
  ) => Promise<void>;
  flush: () => Promise<void>;
  getLatest: () => Settings;
  hasPending: () => boolean;
  syncExternal: (settings: Settings) => void;
};

export function createPreferenceSaveController<Settings>(
  options: PreferenceSaveControllerOptions<Settings>,
): PreferenceSaveController<Settings> {
  let latestSettings = options.normalize(options.initialSettings);
  let saveQueue = Promise.resolve();
  let revision = 0;
  let pendingCount = 0;
  let feedback: PreferenceFeedbackMap = {};
  const feedbackRevision = new Map<string, number>();

  const updateFeedback = (
    settingId: string,
    state: PreferenceFeedbackState,
  ) => {
    feedback = { ...feedback, [settingId]: state };
    options.onFeedback(feedback);
  };

  const apply = (
    settingId: string,
    updater: (settings: Settings) => Settings,
  ) => {
    const previousSettings = latestSettings;
    const nextSettings = options.normalize(updater(latestSettings));
    const saveRevision = revision + 1;

    revision = saveRevision;
    pendingCount += 1;
    feedbackRevision.set(settingId, saveRevision);
    latestSettings = nextSettings;
    options.onSettings(nextSettings);
    updateFeedback(settingId, "pending");

    const saveTask = saveQueue.then(async () => {
      try {
        const savedSettings = options.normalize(await options.save(nextSettings));

        if (revision === saveRevision) {
          latestSettings = savedSettings;
          options.onSettings(savedSettings);
        }
        if (feedbackRevision.get(settingId) === saveRevision) {
          updateFeedback(settingId, "saved");
        }
      } catch {
        if (revision === saveRevision) {
          latestSettings = previousSettings;
          options.onSettings(previousSettings);
        }
        if (feedbackRevision.get(settingId) === saveRevision) {
          updateFeedback(settingId, "error");
        }
      } finally {
        pendingCount = Math.max(0, pendingCount - 1);
      }
    });

    saveQueue = saveTask;
    return saveTask;
  };

  return {
    apply,
    flush: () => saveQueue,
    getLatest: () => latestSettings,
    hasPending: () => pendingCount > 0,
    syncExternal: (settings) => {
      if (pendingCount > 0) {
        return;
      }

      latestSettings = options.normalize(settings);
      options.onSettings(latestSettings);
    },
  };
}
