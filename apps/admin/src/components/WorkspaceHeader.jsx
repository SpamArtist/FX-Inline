import { RotateCcw, Save } from "lucide-react";

export default function WorkspaceHeader({
  activeKey,
  isSaving,
  onCancel,
  onSave,
}) {
  return (
    <header className="workspace-header">
      <div>
        <p>Domain</p>
        <h1>{activeKey}</h1>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onCancel} disabled={isSaving}>
          <RotateCcw size={16} />
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={isSaving}>
          <Save size={16} />
          Save
        </button>
      </div>
    </header>
  );
}
