type AppFooterProps = {
  onClearHistory: () => void;
  onOpenAbout: () => void;
  onOpenPreferences: () => void;
  onQuit: () => void;
};

export function AppFooter({
  onClearHistory,
  onOpenAbout,
  onOpenPreferences,
  onQuit,
}: AppFooterProps) {
  return (
    <footer className="app-footer">
      <button className="app-menu-item is-danger" onClick={onClearHistory} type="button">
        <span className="app-menu-label">清除历史</span>
        <span className="app-menu-hint">删除本地保存的记录</span>
      </button>

      <button className="app-menu-item" onClick={onOpenPreferences} type="button">
        <span className="app-menu-label">偏好设置</span>
        <span className="app-menu-hint">启动方式与历史条数</span>
      </button>

      <button className="app-menu-item" onClick={onOpenAbout} type="button">
        <span className="app-menu-label">关于 mclip</span>
        <span className="app-menu-hint">查看版本信息</span>
      </button>

      <button className="app-menu-item" onClick={onQuit} type="button">
        <span className="app-menu-label">退出</span>
        <span className="app-menu-hint">关闭托盘应用</span>
      </button>
    </footer>
  );
}
