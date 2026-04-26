/* Tweaks panel — accent color + density */

const ACCENTS = [
  { key: "terra",  c: "oklch(0.55 0.09 45)",  soft: "oklch(0.88 0.045 45)" },
  { key: "olive",  c: "oklch(0.5 0.08 110)",  soft: "oklch(0.88 0.04 110)" },
  { key: "indigo", c: "oklch(0.5 0.1 270)",   soft: "oklch(0.88 0.05 270)" },
  { key: "rose",   c: "oklch(0.58 0.13 10)",  soft: "oklch(0.88 0.05 10)"  },
];

function applyAccent(key) {
  const a = ACCENTS.find((x) => x.key === key) || ACCENTS[0];
  const r = document.documentElement;
  r.style.setProperty("--accent", a.c);
  r.style.setProperty("--accent-soft", a.soft);
}

function TweaksPanel({ accent, setAccent, density, setDensity, onClose }) {
  return (
    <div className="tweaks">
      <div className="tweaks__hd">
        <h3>Tweaks</h3>
        <button className="tweaks__close" onClick={onClose}>×</button>
      </div>
      <div className="tweaks__body">
        <div>
          <span className="tweaks__lbl">Accent</span>
          <div className="tweaks__sws">
            {ACCENTS.map((a) => (
              <button key={a.key}
                className={`tweaks__sw ${accent === a.key ? "is-on" : ""}`}
                style={{ "--c": a.c }}
                onClick={() => setAccent(a.key)}
                title={a.key} />
            ))}
          </div>
        </div>
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
          <button className="tweaks__opt" style={{ color: "oklch(0.55 0.15 25)" }}
            onClick={() => { if (confirm("Reset all data? This cannot be undone.")) { localStorage.clear(); window.location.reload(); } }}>
            Reset all data
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel, applyAccent, ACCENTS });
