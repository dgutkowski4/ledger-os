/* Tweaks panel — density + data reset */

function TweaksPanel({ density, setDensity, onClose }) {
  const fileRef = React.useRef(null);
  return (
    <div className="tweaks">
      <div className="tweaks__hd">
        <h3>Tweaks</h3>
        <button className="tweaks__close" onClick={onClose}>×</button>
      </div>
      <div className="tweaks__body">
        <div>
          <span className="tweaks__lbl">Density</span>
          <div className="tweaks__row">
            {["relaxed", "cozy"].map((d) => (
              <button key={d}
                className={`tweaks__opt ${density === d ? "is-on" : ""}`}
                onClick={() => setDensity(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <p className="tweaks__tip">Click any expense or savings figure to edit it inline.</p>
        </div>
        <div style={{ paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--ink), transparent 88%)" }}>
          <span className="tweaks__lbl">Data</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="tweaks__opt" onClick={() => window.ledgerBackup && ledgerBackup()}>
              Back up data (.json)
            </button>
            <button className="tweaks__opt" onClick={() => fileRef.current?.click()}>
              Restore from backup…
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && window.ledgerRestore &&
                    confirm("Replace ALL current data (local and cloud) with this backup? This cannot be undone.")) {
                  ledgerRestore(f);
                }
                e.target.value = "";
              }} />
            <button className="tweaks__opt" style={{ color: "var(--neg)" }}
              onClick={() => {
                if (!confirm("Reset all data? This deletes your cloud copy too and cannot be undone.")) return;
                if (window.ledgerReset) window.ledgerReset();
                else { localStorage.clear(); window.location.reload(); }
              }}>
              Reset all data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel });
