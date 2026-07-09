/* Shared UI chrome: icon set, styled confirm dialog, and toasts.
   Replaces native confirm()/alert() so system dialogs never break the theme. */

/* ── Icons — 12×12 stroke glyphs, consistent across platforms ── */
const ICONS = {
  x:        <path d="M3 3l6 6M9 3l-6 6" />,
  settings: <>
    <path d="M2 3.5h3.4M9.6 3.5H10M2 8.5h.4M6.6 8.5H10" />
    <circle cx="7.5" cy="3.5" r="1.6" />
    <circle cx="4.5" cy="8.5" r="1.6" />
  </>,
  archive:  <>
    <path d="M1.8 2.5h8.4v2H1.8z" />
    <path d="M2.8 4.5v4.8h6.4V4.5" />
    <path d="M4.8 6.8h2.4" />
  </>,
  restore:  <>
    <path d="M1.8 2.6v2.9h2.9" />
    <path d="M2.4 8a4 4 0 1 0 .5-4.3L1.8 5" />
  </>,
  undo:     <>
    <path d="M3.2 4.5h4.3a2.5 2.5 0 0 1 0 5H5.2" />
    <path d="M5.2 2.5l-2 2 2 2" />
  </>,
  redo:     <>
    <path d="M8.8 4.5H4.5a2.5 2.5 0 0 0 0 5h2.3" />
    <path d="M6.8 2.5l2 2-2 2" />
  </>,
  download: <>
    <path d="M6 1.8v5.4" />
    <path d="M3.6 5 6 7.4 8.4 5" />
    <path d="M2.4 9.8h7.2" />
  </>,
  chevron:  <path d="M3.4 4.8 6 7.4l2.6-2.6" />,
};

function Icon({ name, size = 12, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      {ICONS[name]}
    </svg>
  );
}

/* ── Imperative confirm + toast, backed by a self-mounted host component ── */
const uiListeners = { confirm: null, toast: null };

function appConfirm({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    if (uiListeners.confirm) uiListeners.confirm({ title, message, confirmLabel, danger, resolve });
    else resolve(window.confirm(message || title)); /* fallback if host failed to mount */
  });
}

function toast(message, tone = "neutral") {
  if (uiListeners.toast) uiListeners.toast({ id: uid("t"), message, tone });
}

function UiHost() {
  const [dialog, setDialog] = React.useState(null);
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    uiListeners.confirm = (d) => setDialog(d);
    uiListeners.toast = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    return () => { uiListeners.confirm = null; uiListeners.toast = null; };
  }, []);

  const close = (val) => { dialog?.resolve(val); setDialog(null); };

  /* Escape cancels. Enter is deliberately NOT bound globally — it only acts
     through the natively focused button, so a stray Enter (e.g. finishing an
     edit as the dialog opens) can never confirm a destructive action. */
  React.useEffect(() => {
    if (!dialog) return;
    const handler = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(false); } };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [dialog]);

  return (
    <>
      {dialog && (
        <div className="dlg-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="dlg" role="alertdialog" aria-modal="true">
            {dialog.title && <div className="dlg__title">{dialog.title}</div>}
            {dialog.message && <div className="dlg__msg">{dialog.message}</div>}
            <div className="dlg__row">
              {/* Danger dialogs focus Cancel so Enter defaults to the safe choice */}
              <button className="dlg__btn" autoFocus={dialog.danger} onClick={() => close(false)}>Cancel</button>
              <button className={`dlg__btn ${dialog.danger ? "dlg__btn--danger" : "dlg__btn--go"}`}
                autoFocus={!dialog.danger} onClick={() => close(true)}>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>{t.message}</div>
        ))}
      </div>
    </>
  );
}

const uiRootEl = document.createElement("div");
document.body.appendChild(uiRootEl);
ReactDOM.createRoot(uiRootEl).render(<UiHost />);

Object.assign(window, { Icon, appConfirm, toast });
