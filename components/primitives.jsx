/* Shared primitives: money formatter, Check, Progress, SoftLine chart. */

const fmt = (n, dec = 2) => {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (neg ? "-$" : "$") + s;
};
const fmt0 = (n) => fmt(n, 0);
const pct = (n) => `${n.toFixed(0)}%`;

function Section({ tone = "neutral", eyebrow, title, titleKey, right, children, className = "" }) {
  const [label, setLabel] = React.useState(() =>
    titleKey ? (localStorage.getItem(`sec_title_${titleKey}`) || title) : title
  );
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = (v) => {
    const val = v.trim() || title;
    setLabel(val);
    if (titleKey) localStorage.setItem(`sec_title_${titleKey}`, val);
    setEditing(false);
  };

  return (
    <section className={`sec sec--${tone} ${className}`}>
      <header className="sec__hd">
        <div className="sec__ltitle">
          {eyebrow && <span className="sec__eyebrow">{eyebrow}</span>}
          {titleKey && editing ? (
            <input ref={inputRef} className="sec__title-input" defaultValue={label}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); if (e.key === "Escape") setEditing(false); }} />
          ) : (
            <div className="sec__title-wrap">
              <h2 className="sec__title">{label}</h2>
              {titleKey && (
                <button className="sec__edit-btn" onClick={() => setEditing(true)} title="Rename section">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 1.5 L10.5 3.5 L4 10 L1.5 10.5 L2 8 Z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {right && <div className="sec__right">{right}</div>}
      </header>
      <div className="sec__body">{children}</div>
    </section>
  );
}

function Check({ on, onChange, size = 18 }) {
  return (
    <button
      type="button"
      className={`check ${on ? "is-on" : ""}`}
      style={{ width: size, height: size }}
      onClick={() => onChange?.(!on)}
      aria-pressed={on}
    >
      {on && (
        <svg viewBox="0 0 16 16" width={size - 6} height={size - 6}>
          <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Progress({ value, max, tone = "accent" }) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="prog">
      <div className={`prog__fill prog__fill--${tone}`} style={{ width: `${p * 100}%` }} />
    </div>
  );
}

/* Soft line chart — smooth bezier, hover crosshair & tooltip */
function SoftLine({ data, height = 120 }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(560);
  const [hover, setHover] = React.useState(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(280, Math.floor(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 36, r: 12, t: 8, b: 22 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const lo = Math.floor(min / 2000) * 2000, hi = Math.ceil(max / 2000) * 2000;
  const rng = hi - lo || 1;
  const x = (i) => data.length === 1 ? pad.l + iw / 2 : pad.l + (i / (data.length - 1)) * iw;
  const y = (v) => pad.t + ih - ((v - lo) / rng) * ih;

  const path = data.reduce((acc, d, i) => {
    const X = x(i), Y = y(d.v);
    if (i === 0) return `M ${X},${Y}`;
    const pX = x(i - 1), pY = y(data[i - 1].v);
    const cx = (pX + X) / 2;
    return `${acc} C ${cx},${pY} ${cx},${Y} ${X},${Y}`;
  }, "");
  const area = `${path} L ${x(data.length - 1)},${pad.t + ih} L ${x(0)},${pad.t + ih} Z`;

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const t = (mx - pad.l) / iw;
    if (t < 0 || t > 1) return setHover(null);
    setHover(Math.round(t * (data.length - 1)));
  };

  const ticks = [lo, lo + rng / 2, hi];

  return (
    <div className="sl" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="sl__grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="sl__ylab">${(t / 1000).toFixed(0)}k</text>
          </g>
        ))}
        <path d={area} className="sl__area" />
        <path d={path} className="sl__line" />
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="sl__xlab">{d.m}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="sl__cross" />
            <circle cx={x(hover)} cy={y(data[hover].v)} r={4} className="sl__dot" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="sl__tip" style={{ left: x(hover), top: y(data[hover].v) - 12 }}>
          <span className="sl__tipm">{data[hover].m}</span>
          <span className="sl__tipv">${data[hover].v.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

/* Donut chart — shared by expenses + dashboard */
function Donut({ data, size = 160, stroke = 22, label = "Spent" }) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="color-mix(in oklch, var(--ink), transparent 92%)" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = d.v / total;
        const dash = frac * c;
        const off = c * 0.25 - acc;
        acc += dash;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={`var(--don-${i % 6})`} strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={off} />
        );
      })}
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut__t">{label}</text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" className="donut__v">{fmt0(total)}</text>
    </svg>
  );
}

/* 8-bit gold coin — 8×8 pixel grid, P=4 → 32×32px
   k=dark outline  g=mid gold  l=light gold  s=shine  d=shadow */
function PixelSprite() {
  const P = 4;
  const COIN = [
    "..kkkk..",
    ".kllggk.",
    "klssgggk",
    "klsgggdk",
    "kgggggdk",
    "kggddddk",
    ".kgdddk.",
    "..kkkk..",
  ];

  const COLOR = {
    k: 'oklch(0.28 0.08 55)',
    g: 'oklch(0.70 0.16 80)',
    l: 'oklch(0.84 0.14 82)',
    s: 'oklch(0.95 0.07 88)',
    d: 'oklch(0.46 0.14 62)',
  };

  const rects = [];
  COIN.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      rects.push(<rect key={`${x}-${y}`} x={x * P} y={y * P} width={P} height={P} fill={COLOR[ch]} />);
    }
  });

  return (
    <svg className="px-sprite" width={8 * P} height={8 * P}
      style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'pixelated', flexShrink: 0 }}>
      {rects}
    </svg>
  );
}

Object.assign(window, { fmt, fmt0, pct, Section, Check, Progress, SoftLine, Donut, PixelSprite });
