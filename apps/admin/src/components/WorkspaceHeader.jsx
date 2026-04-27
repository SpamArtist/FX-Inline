import { Hammer, RotateCcw, Save } from "lucide-react";

export default function WorkspaceHeader({
  activeKey,
  isSaving,
  isBuilding,
  onCancel,
  onSave,
  onBuild,
}) {
  return (
    <header className="workspace-header">
      <div>
        <p>Domain</p>
        <h1>{activeKey}</h1>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onCancel} disabled={isSaving || isBuilding}>
          <RotateCcw size={16} />
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={isSaving || isBuilding}>
          <Save size={16} />
          Save
        </button>
        <button
          type="button"
          className="primary"
          onClick={onBuild}
          disabled={isSaving || isBuilding}
        >
          <Hammer size={16} />
          {isBuilding ? "Building" : "Build extension"}
        </button>
      </div>
    </header>
  );
}
