import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type AppSettings = {
  launchAtLogin: boolean;
  maxHistoryCount: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  maxHistoryCount: 50,
};

const MIN_MAX_HISTORY_COUNT = 10;
const MAX_MAX_HISTORY_COUNT = 200;

const clampHistoryCount = (value: number) =>
  Math.min(MAX_MAX_HISTORY_COUNT, Math.max(MIN_MAX_HISTORY_COUNT, value));

function App() {
  const [list, setList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const maxHistoryCountRef = useRef(DEFAULT_SETTINGS.maxHistoryCount);

  // 初始化应用：加载设置、加载历史记录并开启监听[cite: 1]
  useEffect(() => {
    const initApp = async () => {
      try {
        const [loadedSettings, initialHistory] = await Promise.all([
          invoke<AppSettings>("get_settings"),
          invoke<string[]>("get_history")
        ]);

        const normalizedSettings = {
          ...loadedSettings,
          maxHistoryCount: clampHistoryCount(loadedSettings.maxHistoryCount),
        };

        setSettings(normalizedSettings);
        setSettingsDraft(normalizedSettings);
        setList(initialHistory);
        maxHistoryCountRef.current = normalizedSettings.maxHistoryCount;
      } catch (err) {
        console.error("初始化应用失败:", err);
      }
    };

    const setupListeners = async () => {
      // 监听后端推送的全量更新事件[cite: 1]
      const unlisten = await listen<string[]>("history-updated", (event) => {
        setList(event.payload);
      });
      return unlisten;
    };

    void initApp();
    const unlistenPromise = setupListeners();

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);

  // 监听列表变化，自动调整窗口高度[cite: 1]
  useEffect(() => {
    const adjustHeight = async () => {
      try {
        await invoke("adjust_window_height", { itemCount: list.length });
      } catch (err) {
        console.error("调整窗口高度失败:", err);
      }
    };
    adjustHeight();
  }, [list.length]);

  const handleItemClick = async (text: string) => {
    try {
      await invoke("copy_to_clipboard", { content: text });
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("操作失败:", err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await invoke("clear_history");
      setList([]); // 手动清空前端列表以即时反馈[cite: 1]
    } catch (err) {
      console.error("清空历史失败:", err);
    }
  };

  const handleOpenPreferences = () => {
    setSettingsDraft(settings);
    setSettingsError("");
    setShowPreferences(true);
  };

  const handleClosePreferences = () => {
    if (!isSavingSettings) {
      setShowPreferences(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setIsSavingSettings(true);
      const sanitizedSettings = {
        ...settingsDraft,
        maxHistoryCount: clampHistoryCount(settingsDraft.maxHistoryCount),
      };
      const savedSettings = await invoke<AppSettings>("save_settings", {
        settings: sanitizedSettings,
      });
      setSettings(savedSettings);
      maxHistoryCountRef.current = savedSettings.maxHistoryCount;
      setShowPreferences(false);
    } catch (err) {
      setSettingsError("保存失败");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleHistoryCountChange = (value: number) => {
    setSettingsDraft((prev) => ({
      ...prev,
      maxHistoryCount: clampHistoryCount(value),
    }));
  };

  const handleExit = async () => {
    await invoke("quit_app");
  };

  return (
    <div className="app-frame">
      <div className="app-panel">
        <div className="app-header">
          <span className="app-kicker">mclip</span>
          <input
            type="text"
            className="app-search"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="app-body">
          <div className="app-section">
            <div className="app-history-group">
              {(() => {
                const filteredList = list.filter((item) =>
                  item.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                // 空状态处理[cite: 1]
                if (filteredList.length === 0) {
                  return (
                    <div className="app-empty">
                      {list.length === 0 ? "等待复制内容..." : "没有匹配的结果"}
                    </div>
                  );
                }

                return filteredList.map((item, index) => (
                  <button
                    key={`${index}-${item}`}
                    className="app-item"
                    onClick={() => handleItemClick(item)}
                    title={item}
                    type="button"
                  >
                    <span className="app-item-index">{list.indexOf(item) + 1}.</span>
                    <span className="app-item-text">{item}</span>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="app-footer">
          <button className="app-menu-item" onClick={handleClearHistory} type="button">
            <span className="app-menu-label">清除历史</span>
            <span className="app-menu-shortcut">⌫</span>
          </button>
          <button className="app-menu-item" onClick={handleOpenPreferences} type="button">
            <span className="app-menu-label">偏好设置</span>
          </button>
          <button className="app-menu-item" onClick={() => setShowAbout(true)} type="button">
            <span className="app-menu-label">关于mclip</span>
          </button>
          <button className="app-menu-item" onClick={handleExit} type="button">
            <span className="app-menu-label">退出</span>
            <span className="app-menu-shortcut">⌘Q</span>
          </button>
        </div>
      </div>

      {/* About Modal */}
      {showAbout && (
        <div className="app-modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-header">
              <span className="app-modal-title">关于mclip</span>
            </div>
            <div className="app-modal-content">
               <h2 className="app-modal-app-name">mclip</h2>
               <p className="app-modal-version">版本 0.1.0</p>
            </div>
            <div className="app-modal-footer">
              <button className="app-modal-btn" onClick={() => setShowAbout(false)}>确定</button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="app-modal-overlay" onClick={handleClosePreferences}>
          <div className="app-modal app-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-header">
              <span className="app-modal-title">偏好设置</span>
            </div>
            <div className="app-settings-content">
              <div className="app-settings-row">
                <div className="app-settings-copy">
                  <div className="app-settings-label">登录时打开</div>
                </div>
                <button
                  className={`app-switch ${settingsDraft.launchAtLogin ? "is-on" : ""}`}
                  onClick={() => setSettingsDraft(p => ({...p, launchAtLogin: !p.launchAtLogin}))}
                >
                  <span className="app-switch-thumb" />
                </button>
              </div>

              <div className="app-settings-row">
                <div className="app-settings-copy">
                  <div className="app-settings-label">最大记录条数</div>
                </div>
                <div className="app-stepper">
                  <button className="app-stepper-btn" onClick={() => handleHistoryCountChange(settingsDraft.maxHistoryCount - 1)}>-</button>
                  <input className="app-stepper-input" type="number" readOnly value={settingsDraft.maxHistoryCount} />
                  <button className="app-stepper-btn" onClick={() => handleHistoryCountChange(settingsDraft.maxHistoryCount + 1)}>+</button>
                </div>
              </div>
              {settingsError && <div className="app-settings-error">{settingsError}</div>}
            </div>
            <div className="app-modal-footer">
              <button className="app-modal-secondary-btn" onClick={handleClosePreferences}>取消</button>
              <button className="app-modal-btn" onClick={handleSavePreferences} disabled={isSavingSettings}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;