/* Shared primitives: money formatter, Check, Progress, SoftLine chart. */

const uid = (prefix = "x") => prefix + Math.random().toString(36).slice(2, 9);

const fmt = (n, dec = 2) => {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (neg ? "-$" : "$") + s;
};
const fmt0 = (n) => fmt(n, 0);
const pct = (n) => `${n.toFixed(0)}%`;

function Section({ tone, eyebrow, title, titleKey, right, children, className = "" }) {
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
    <section className={`sec ${className}`}>
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
  const sum = data.reduce((s, d) => s + d.v, 0);
  const total = sum || 1; /* avoid divide-by-zero in arc math; label shows the real sum */
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
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" className="donut__v">{fmt0(sum)}</text>
    </svg>
  );
}

/* Sortable + resizable grid.
   - Drag the grip (top-left, visible on hover) to reorder sections iPhone-style:
     other sections slide in real time as you drag over them.
   - Drag the resize handle (appears at the shared edge between two half-width
     sections on hover) to adjust the column split — both sections resize together.
   Layout order and column ratio are persisted to localStorage keyed by id. */
function LayoutGrid({ id, children, cols = "1fr 1fr" }) {
  /* ── Persistent layout (order + full-width flag per section) ── */
  const [layout, setLayout] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`layout_${id}`)) || {}; }
    catch { return {}; }
  });
  const saveLayout = (next) => { setLayout(next); localStorage.setItem(`layout_${id}`, JSON.stringify(next)); };

  /* ── Column ratio (how the two columns share the row width) ── */
  const initRatio = (() => {
    try { const s = localStorage.getItem(`layout_cols_${id}`); if (s) return parseFloat(s); } catch {}
    const parts = cols.replace(/fr/g, "").trim().split(/\s+/).map(parseFloat);
    return parts.length === 2 ? parts[0] / (parts[0] + parts[1]) : 0.5;
  })();
  const [colRatio, _setColRatio] = React.useState(initRatio);
  const colRatioRef = React.useRef(colRatio);
  const setColRatio = (r) => { colRatioRef.current = r; _setColRatio(r); };
  const gridRef = React.useRef(null);

  /* ── Drag-to-reorder state ── */
  const [dragKey, setDragKey]           = React.useState(null);
  const [previewOrder, setPreviewOrder] = React.useState(null); // { key: displayIndex }

  /* ── Auto-scroll while dragging near viewport edges ── */
  const dragYRef  = React.useRef(null);
  const animRef   = React.useRef(null);

  const stopScroll = () => {
    dragYRef.current = null;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  };

  const scrollLoop = () => {
    const y = dragYRef.current;
    if (y === null) { animRef.current = null; return; }
    const zone = 100, speed = 14;
    if (y < zone)
      window.scrollBy(0, -speed * (1 - y / zone));
    else if (y > window.innerHeight - zone)
      window.scrollBy(0,  speed * (1 - (window.innerHeight - y) / zone));
    animRef.current = requestAnimationFrame(scrollLoop);
  };

  /* ── Build item list ── */
  const raw = React.Children.toArray(children);
  const baseItems = raw.map((child, i) => {
    const k = child.props?.titleKey || child.key || String(i);
    const initFull = !!(child.props?.className?.includes("grid__full"));
    const saved = layout[k];
    /* Always use JSX className as source of truth for full-width — ignore any stale saved value */
    return { key: k, child, order: saved?.order ?? i, full: initFull };
  });
  baseItems.sort((a, b) => a.order - b.order);

  /* During drag show preview order; on drop commit it */
  const displayItems = previewOrder
    ? baseItems.slice().sort((a, b) => (previewOrder[a.key] ?? 999) - (previewOrder[b.key] ?? 999))
    : baseItems;

  /* Assign column position: full-width items = null, half-width alternate 0/1 */
  let col = 0;
  const itemsWithCol = displayItems.map((item) => {
    if (item.full) { col = 0; return { ...item, colPos: null }; }
    const colPos = col % 2;
    col++;
    return { ...item, colPos };
  });

  /* ── DnD handlers ── */
  const onDragStart = (e, key) => {
    e.dataTransfer.effectAllowed = "move";
    setDragKey(key);
  };

  const onDragOver = (e, overKey) => {
    e.preventDefault();
    /* Update scroll position tracker and start loop if not running */
    dragYRef.current = e.clientY;
    if (!animRef.current) animRef.current = requestAnimationFrame(scrollLoop);
    if (!dragKey || dragKey === overKey) return;
    const keys = displayItems.map(i => i.key);
    const from = keys.indexOf(dragKey), to = keys.indexOf(overKey);
    const slid = [...keys];
    slid.splice(from, 1);
    slid.splice(to, 0, dragKey);
    const order = {};
    slid.forEach((k, i) => { order[k] = i; });
    setPreviewOrder(order);
  };

  const commitDrag = () => {
    stopScroll();
    if (previewOrder) {
      const next = { ...layout };
      Object.entries(previewOrder).forEach(([k, i]) => {
        next[k] = { ...(next[k] || {}), order: i };
      });
      saveLayout(next);
    }
    setDragKey(null);
    setPreviewOrder(null);
  };

  /* ── Icons ── */
  const GripIcon = () => (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ pointerEvents: "none" }}>
      {[2, 7, 12].flatMap(cy => [2, 8].map(cx =>
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />
      ))}
    </svg>
  );

  return (
    <div ref={gridRef} className="layout-grid" style={{ display: "grid", gridTemplateColumns: `${colRatio}fr ${1 - colRatio}fr`, gap: 28 }}>
      {itemsWithCol.map(({ key, child, full }) => (
        <div
          key={key}
          className={`layout-item${full ? " layout-item--full" : ""}`}
          style={{ opacity: dragKey === key ? 0.45 : 1, transition: "opacity 0.15s" }}
          onDragOver={(e) => onDragOver(e, key)}
          onDrop={(e) => { e.preventDefault(); commitDrag(); }}
        >
          {child}

          {/* Drag grip — top-right, appears on hover */}
          <div className="layout-controls">
            <div className="layout-grip" draggable
              onDragStart={(e) => onDragStart(e, key)}
              onDragEnd={commitDrag}
              title="Drag to reorder">
              <GripIcon />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { uid, fmt, fmt0, pct, Section, Check, Progress, SoftLine, Donut, LayoutGrid });
