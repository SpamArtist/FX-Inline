export default function ToastMessage({ toast }) {
  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className={toast.tone === "error" ? "toast error" : "toast"}
      role="status"
    >
      <span>{toast.message}</span>
      <span className="toast-countdown" />
    </div>
  );
}
