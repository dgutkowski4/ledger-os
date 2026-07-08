const { useState, useRef, useCallback } = React;

// ── Design tokens (mirrors styles.css — dark monotone) ───────────────────────
const T = {
  paper:    "#0a0b0d",
  paper2:   "#0f1113",
  paper3:   "#16191d",
  ink:      "#e6e8ea",
  ink2:     "#aeb4ba",
  ink3:     "#5a6068",
  line:     "#1e2227",
  line2:    "#2a2f36",
  accent:   "#e6e8ea",
  accentSoft:"#2a2f36",
  pos:      "#46a758",
  neg:      "#e5484d",
  sage:     "#0f1113",
  sageInk:  "#46a758",
  clay:     "#0f1113",
  clayInk:  "#aeb4ba",
  sky:      "#0f1113",
  skyInk:   "#8a9096",
  lilac:    "#0f1113",
  lilacInk: "#8a9096",
  cream:    "#0f1113",
  creamInk: "#8a9096",
  fDisp:    '"JetBrains Mono", ui-monospace, monospace',
  fBody:    '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fNum:     '"JetBrains Mono", ui-monospace, monospace',
};

// ── Categories ────────────────────────────────────────────────────────────────
const BUDGET_CATEGORIES = [
  "Rent", "Electricity", "Gas", "Internet", "Phone", "Apartment",
  "Student Loans", "Groceries", "Transportation",
  "Disc. Shopping", "Gym Membership", "Subscriptions", "Dining", "Gifts Fund",
];

// ── Merchant Memory ───────────────────────────────────────────────────────────
const MEMORY_KEY = "expense_merchant_memory_v1";
function loadMemory() { try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}"); } catch { return {}; } }
function saveMemory(m) { try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch {} }
function merchantKey(desc) {
  return desc.toLowerCase().replace(/\d{4,}/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim().slice(0,40);
}

const SEED_RULES = [
  { pattern: /spotify/i,                    category: "Subscriptions" },
  { pattern: /amazon prime/i,               category: "Subscriptions" },
  { pattern: /icloud/i,                     category: "Subscriptions" },
  { pattern: /claude\.ai|anthropic/i,       category: "Subscriptions" },
  { pattern: /n8n/i,                        category: "Subscriptions" },
  { pattern: /openai|github|notion|figma/i, category: "Subscriptions" },
  { pattern: /planet fitness|equinox/i,     category: "Gym Membership" },
  { pattern: /bilt|rent payment/i,          category: "Rent" },
  { pattern: /uber|lyft|mta|transit|metro|parking|ez.?pass/i, category: "Transportation" },
  { pattern: /wholefood|trader joe|shoprite|stop.?shop|costco|aldi|wegman|kroger/i, category: "Groceries" },
  { pattern: /verizon|t.mobile|at&t/i,      category: "Phone" },
  { pattern: /con.?ed|pseg|national grid/i, category: "Electricity" },
  { pattern: /optimum|xfinity|fios/i,       category: "Internet" },
  { pattern: /student loan|mohela|navient/i, category: "Student Loans" },
];

function matchTransaction(description, memory) {
  const seed = SEED_RULES.find(r => r.pattern.test(description));
  if (seed) return { category: seed.category, source: "rule" };
  const key = merchantKey(description);
  if (memory[key]) return { category: memory[key], source: "learned" };
  return null;
}

// ── CSV Parsing ───────────────────────────────────────────────────────────────
/* Proper CSV field splitter: handles quoted fields with embedded commas and
   escaped quotes ("") — the previous regex approach dropped empty fields. */
function parseCSVLine(line) {
  const out = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

function parseCSV(text) {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const findCol = (...names) => { for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i !== -1) return i; } return -1; };
  const dateCol = findCol("date","trans date","posted");
  const descCol = findCol("description","merchant","name","memo");
  const amtCol  = findCol("amount","debit","charge");
  return lines.slice(1).map((line, idx) => {
    const clean = parseCSVLine(line);
    const raw = parseFloat((clean[amtCol]||"0").replace(/[$,()]/g,"")) || 0;
    const description = clean[descCol] || `Transaction ${idx+1}`;
    return { id: `txn-${Date.now()}-${idx}`, date: clean[dateCol]||"", description, amount: Math.abs(raw) };
  }).filter(t => t.amount > 0);
}

// ── AI Categorization ─────────────────────────────────────────────────────────
async function categorizeWithAI(uncertain) {
  if (!uncertain.length) return [];
  const prompt = `You are a personal finance assistant. Categorize each transaction into exactly one of these categories:\n${BUDGET_CATEGORIES.join(", ")}\n\nOnly use categories from the list. If unsure, mark confidence "low".\n\nTransactions:\n${JSON.stringify(uncertain.map(t => ({ id: t.id, description: t.description, amount: t.amount, card: t.card })))}\n\nRespond ONLY with a JSON array:\n[{"id":"txn-xxx","category":"Dining","confidence":"high"},...]\n\nconfidence: "high" = auto-approve | "medium"/"low" = send to review`;
  try {
    const res = await fetch("/api/anthropic", {
      method: "POST",
      headers: await (window.apiHeaders ? apiHeaders() : { "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const raw = (data.content?.[0]?.text || "[]").replace(/```json|```/g,"").trim();
    /* Extract the JSON array even if the model wrapped it in prose */
    const start = raw.indexOf("["), end = raw.lastIndexOf("]");
    const parsed = JSON.parse(start !== -1 && end > start ? raw.slice(start, end + 1) : raw);
    if (!Array.isArray(parsed)) return [];
    const CONFIDENCES = new Set(["high", "medium", "low"]);
    return parsed
      .filter(r => r && typeof r.id === "string" && BUDGET_CATEGORIES.includes(r.category))
      .map(r => ({ id: r.id, category: r.category, confidence: CONFIDENCES.has(r.confidence) ? r.confidence : "low" }));
  } catch (e) { console.error("AI categorization failed:", e); return []; }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const pill = (bg, color) => ({
  display: "inline-flex", alignItems: "center",
  padding: "2px 9px", borderRadius: 2,
  background: bg, color,
  fontSize: 11, fontFamily: T.fNum, fontWeight: 500,
  textTransform: "uppercase", letterSpacing: "0.06em",
});

// ── Sub-components ────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  const map = {
    rule:          pill(`color-mix(in oklch, ${T.sageInk}, transparent 82%)`,  T.sageInk),
    learned:       pill(`color-mix(in oklch, ${T.lilacInk}, transparent 82%)`, T.lilacInk),
    ai:            pill(`color-mix(in oklch, ${T.skyInk}, transparent 82%)`,   T.skyInk),
    confirmed:     pill(`color-mix(in oklch, ${T.skyInk}, transparent 82%)`,   T.skyInk),
    uncategorized: pill(`color-mix(in oklch, ${T.ink3}, transparent 82%)`,     T.ink3),
  };
  const labels = { rule: "rule", learned: "learned", ai: "ai", confirmed: "confirmed", uncategorized: "uncategorized" };
  return <span style={map[source] || map.uncategorized}>{labels[source] || source}</span>;
}

function ConfidencePill({ confidence }) {
  const map = {
    high:   pill(`color-mix(in oklch, ${T.sageInk}, transparent 82%)`,  T.sageInk),
    medium: pill(`color-mix(in oklch, ${T.creamInk}, transparent 78%)`, T.creamInk),
    low:    pill(`color-mix(in oklch, ${T.neg}, transparent 82%)`,       T.neg),
  };
  return <span style={map[confidence] || map.medium}>{confidence}</span>;
}

function CategorySelect({ value, onChange, customCategories = [], onAddCategory }) {
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const allCategories = [...BUDGET_CATEGORIES, ...customCategories];
  const selectStyle = {
    background: T.paper2, color: T.ink, border: `1px dashed ${T.line2}`,
    borderRadius: 2, padding: "4px 8px", fontSize: 12,
    fontFamily: T.fBody, cursor: "pointer", width: "100%",
  };
  const handleChange = e => { if (e.target.value === "__add__") { setAdding(true); return; } onChange(e.target.value); };
  const commitNew = () => {
    const trimmed = newCat.trim();
    if (!trimmed) { setAdding(false); return; }
    onAddCategory?.(trimmed); onChange(trimmed); setAdding(false); setNewCat("");
  };
  if (adding) return (
    <div style={{ display: "flex", gap: 4 }}>
      <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") setAdding(false); }}
        placeholder="new category..."
        style={{ flex: 1, ...selectStyle, border: `1px solid ${T.accent}`, outline: "none", minWidth: 0, background: "#fff" }} />
      <button onClick={commitNew} style={{ background: T.accent, color: T.paper, border: "none", borderRadius: 2, padding: "4px 10px", fontFamily: T.fBody, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>add</button>
      <button onClick={() => setAdding(false)} style={{ background: "transparent", color: T.ink3, border: `1px solid ${T.line}`, borderRadius: 2, padding: "4px 8px", fontFamily: T.fBody, fontSize: 12, cursor: "pointer" }}>cancel</button>
    </div>
  );
  return (
    <select value={value || ""} onChange={handleChange} style={selectStyle}>
      <option value="">-- select --</option>
      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
      <option value="__add__">+ add new category...</option>
    </select>
  );
}

// ── Upload Phase ──────────────────────────────────────────────
function UploadPhase({ onFilesReady }) {
  const [uploads, setUploads] = useState({});
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFiles = useCallback((fileList) => {
    Array.from(fileList).forEach((file, idx) => {
      const ext = file.name.split(".").pop().toLowerCase();
      const key = `file-${Date.now()}-${idx}`;
      const reader = new FileReader();
      if (ext === "csv") {
        reader.onload = e => setUploads(prev => ({ ...prev, [key]: { file, text: e.target.result, fileType: "csv" } }));
        reader.readAsText(file);
      } else {
        reader.onload = e => {
          const base64 = e.target.result.split(",")[1];
          const mediaType = ext === "pdf" ? "application/pdf" : "image/png";
          setUploads(prev => ({ ...prev, [key]: { file, base64, mediaType, fileType: ext } }));
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const removeFile = key => setUploads(prev => { const next = { ...prev }; delete next[key]; return next; });
  const setCard = (key, card) => setUploads(prev => ({ ...prev, [key]: { ...prev[key], card } }));
  const uploadedList = Object.entries(uploads);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <p style={{ color: T.ink3, fontSize: 13, fontFamily: T.fBody, marginBottom: 20, lineHeight: 1.6 }}>
        Upload one or more statements. Known merchants and anything confirmed before are auto-approved.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `1.5px dashed ${dragging ? T.accent : T.line2}`,
          borderRadius: 2, padding: "36px 24px", textAlign: "center", cursor: "pointer",
          background: dragging ? `color-mix(in oklch, ${T.accent}, transparent 94%)` : T.paper2,
          transition: "all 0.15s",
        }}>
        <div style={{ fontFamily: T.fDisp, fontSize: 20, color: T.ink, marginBottom: 6 }}>
          Drop files here
        </div>
        <div style={{ fontSize: 12, color: T.ink3, fontFamily: T.fBody }}>
          or click to browse &middot; CSV, PDF, or PNG &middot; multiple files supported
        </div>
        <input ref={inputRef} type="file" accept=".csv,.pdf,.png" multiple style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)} />
      </div>

      {uploadedList.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {uploadedList.map(([key, upload]) => (
            <div key={key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", rowGap: 6,
              padding: "8px 12px", borderRadius: 2,
              border: `1px solid color-mix(in oklch, ${T.sageInk}, transparent 70%)`,
              background: `color-mix(in oklch, ${T.sageInk}, transparent 92%)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: T.fNum, fontSize: 10, color: T.sageInk, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {upload.fileType}
                </span>
                <span style={{ fontSize: 13, color: T.ink, fontFamily: T.fBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{upload.file.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <input value={upload.card || ""} onChange={e => setCard(key, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="card / account"
                  style={{
                    background: T.paper, color: T.ink, width: 130,
                    border: `1px dashed ${T.line2}`, borderRadius: 2,
                    padding: "3px 6px", fontSize: 11.5, fontFamily: T.fBody, outline: "none",
                  }} />
                <button onClick={e => { e.stopPropagation(); removeFile(key); }} style={{
                  background: "none", border: "none", color: T.ink3, cursor: "pointer",
                  fontSize: 18, lineHeight: 1, padding: "0 2px",
                }}>&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: T.ink3, fontSize: 12, fontFamily: T.fBody }}>
          {uploadedList.length} file{uploadedList.length !== 1 ? "s" : ""} selected
        </span>
        <button disabled={uploadedList.length === 0} onClick={() => onFilesReady(uploads)} style={{
          background: uploadedList.length > 0 ? T.accent : T.paper3,
          color: uploadedList.length > 0 ? T.paper : T.ink3,
          border: "none", borderRadius: 2, padding: "9px 22px",
          fontFamily: T.fBody, fontWeight: 500, fontSize: 13,
          cursor: uploadedList.length > 0 ? "pointer" : "not-allowed", transition: "all 0.15s",
        }}>
          Process {uploadedList.length > 0 ? `${uploadedList.length} file${uploadedList.length !== 1 ? "s" : ""}` : "files"} →
        </button>
      </div>
    </div>
  );
}

// ── Processing Phase ──────────────────────────────────────────────────────────
function ProcessingPhase({ stage }) {
  const stages = [
    { id: "parse",  label: "Parsing files" },
    { id: "rules",  label: "Applying seed rules & learned memory" },
    { id: "ai",     label: "AI categorizing uncertain transactions" },
    { id: "done",   label: "Finalizing" },
  ];
  const current = stages.findIndex(s => s.id === stage);
  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      {stages.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, opacity: i > current ? 0.3 : 1, transition: "opacity 0.3s" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: i < current ? T.sageInk : i === current ? T.accent : T.paper3,
            fontSize: 11, fontFamily: T.fNum, fontWeight: 500,
            color: i < current || i === current ? T.paper : T.ink3,
            border: `1px solid ${i < current ? T.sageInk : i === current ? T.accent : T.line2}`,
          }}>
            {i < current ? "\u2713" : i + 1}
          </div>
          <span style={{ fontSize: 13, fontFamily: T.fBody, color: i === current ? T.ink : i < current ? T.sageInk : T.ink3 }}>
            {s.label}{i === current ? "\u2026" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Review Phase ──────────────────────────────────────────────────────────────
function ReviewPhase({ transactions, onUpdate, onConfirmAll, onSave, onLearn, dupesSkipped = 0, currentMonth }) {
  const [customCategories, setCustomCategories] = useState([]);
  const needsReview  = transactions.filter(t => t.status === "needs-review" || t.status === "uncategorized");
  const approved     = transactions.filter(t => t.status === "auto" || t.status === "confirmed");
  const total        = transactions.reduce((s, t) => s + t.amount, 0);
  const learnedCount = transactions.filter(t => t.source === "learned").length;
  const hasAISuggestions = needsReview.some(t => t.aiSuggestion);

  const addCategory = cat => {
    if (!customCategories.includes(cat) && !BUDGET_CATEGORIES.includes(cat))
      setCustomCategories(prev => [...prev, cat]);
  };
  const confirm = (id, category) => {
    onLearn(id, category);
    onUpdate(transactions.map(t => t.id === id ? { ...t, confirmedCategory: category, status: "confirmed", needsReview: false } : t));
  };
  const allCategories = [...BUDGET_CATEGORIES, ...customCategories];
  const byCategory = allCategories.reduce((acc, cat) => {
    const sum = approved.filter(t => t.confirmedCategory === cat).reduce((s, t) => s + t.amount, 0);
    if (sum > 0) acc[cat] = sum;
    return acc;
  }, {});

  const statCard = (label, value, color) => (
    <div key={label} style={{ background: T.paper2, border: `1px solid ${T.line}`, borderRadius: 2, padding: "14px 16px" }}>
      <div style={{ color, fontFamily: T.fNum, fontSize: 20, fontWeight: 500 }}>{value}</div>
      <div style={{ color: T.ink3, fontSize: 10.5, marginTop: 4, fontFamily: T.fBody, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );

  const sectionHd = (label, color) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.line}` }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontFamily: T.fBody, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: T.ink3 }}>{label}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* Stats */}
      <div className="catz-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: dupesSkipped > 0 ? 12 : 28 }}>
        {statCard("Total spend",   `$${total.toFixed(2)}`, T.ink)}
        {statCard("Auto-approved", approved.length,         T.sageInk)}
        {statCard("Needs review",  needsReview.length,      T.clayInk)}
        {statCard("From memory",   learnedCount,            T.lilacInk)}
      </div>
      {dupesSkipped > 0 && (
        <div style={{ marginBottom: 24, padding: "8px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, fontSize: 12, color: T.ink2, fontFamily: T.fBody }}>
          {dupesSkipped} duplicate transaction{dupesSkipped !== 1 ? "s" : ""} skipped — already imported.
        </div>
      )}

      {/* Needs review */}
      {needsReview.length > 0 && (
        <div style={{ background: T.paper2, border: `1px solid ${T.line}`, borderRadius: 2, padding: "20px 22px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: T.clayInk, display: "inline-block" }} />
              <span style={{ fontFamily: T.fBody, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: T.ink3 }}>
                needs review ({needsReview.length})
              </span>
            </div>
            <button onClick={onConfirmAll} disabled={!hasAISuggestions} style={{
              background: "transparent",
              border: `1px solid ${hasAISuggestions ? T.line2 : T.line}`,
              color: hasAISuggestions ? T.ink2 : T.ink3,
              borderRadius: 999, padding: "3px 12px",
              fontFamily: T.fBody, fontSize: 11.5,
              cursor: hasAISuggestions ? "pointer" : "not-allowed",
            }}>
              confirm all with AI suggestions
              {needsReview.filter(t => !t.aiSuggestion).length > 0 &&
                <span style={{ color: T.ink3, marginLeft: 6, fontSize: 11 }}>
                  ({needsReview.filter(t => !t.aiSuggestion).length} still need manual input)
                </span>}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {needsReview.map((t, i) => (
              <div key={t.id} className="catz-row" style={{
                display: "grid", gridTemplateColumns: "1fr auto 190px 90px",
                gap: 12, alignItems: "center", padding: "9px 4px",
                borderBottom: i < needsReview.length - 1 ? `1px dashed color-mix(in oklch, ${T.ink}, transparent 90%)` : "none",
              }}>
                <div>
                  <div style={{ fontSize: 13, color: T.ink, fontFamily: T.fBody, fontWeight: 500 }}>{t.description}</div>
                  <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2, fontFamily: T.fBody, display: "flex", alignItems: "center", gap: 6 }}>
                    {t.date} &middot; {t.card}
                    {t.aiSuggestion && <><span style={{ color: T.ink3 }}>&middot;</span> <span style={{ color: T.clayInk }}>AI: {t.aiSuggestion}</span></>}
                    {t.confidence && <ConfidencePill confidence={t.confidence} />}
                  </div>
                </div>
                <span style={{ fontFamily: T.fNum, fontSize: 13, color: T.ink, whiteSpace: "nowrap" }}>
                  ${t.amount.toFixed(2)}
                </span>
                <CategorySelect value={t.aiSuggestion || ""} onChange={cat => confirm(t.id, cat)} customCategories={customCategories} onAddCategory={addCategory} />
                <button onClick={() => t.aiSuggestion && confirm(t.id, t.aiSuggestion)} disabled={!t.aiSuggestion} style={{
                  background: t.aiSuggestion ? T.accent : T.paper3,
                  color: t.aiSuggestion ? T.paper : T.ink3,
                  border: "none", borderRadius: 2, padding: "6px 10px",
                  fontFamily: T.fBody, fontSize: 12, fontWeight: 500,
                  cursor: t.aiSuggestion ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                }}>
                  confirm
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <div style={{ background: T.paper2, border: `1px solid ${T.line}`, borderRadius: 2, padding: "20px 22px", marginBottom: 20 }}>
          {sectionHd(`approved (${approved.length})`, T.sageInk)}
          <div>
            {approved.map((t, i) => (
              <div key={t.id} className="catz-row" style={{
                display: "grid", gridTemplateColumns: "1fr auto 190px auto",
                gap: 12, alignItems: "center", padding: "8px 4px",
                borderBottom: i < approved.length - 1 ? `1px dashed color-mix(in oklch, ${T.ink}, transparent 90%)` : "none",
              }}>
                <div>
                  <span style={{ fontSize: 13, color: T.ink, fontFamily: T.fBody }}>{t.description}</span>
                  <span style={{ fontSize: 11, color: T.ink3, marginLeft: 8, fontFamily: T.fNum }}>{t.date}</span>
                </div>
                <span style={{ fontFamily: T.fNum, fontSize: 13, color: T.ink2 }}>${t.amount.toFixed(2)}</span>
                <CategorySelect
                  value={t.confirmedCategory || ""}
                  onChange={cat => {
                    onLearn(t.id, cat);
                    onUpdate(transactions.map(tx => tx.id === t.id ? { ...tx, confirmedCategory: cat, status: "confirmed" } : tx));
                  }}
                  customCategories={customCategories}
                  onAddCategory={addCategory}
                />
                <SourceBadge source={t.source === "learned" ? "learned" : t.source === "uncategorized" ? "uncategorized" : t.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category summary */}
      {Object.keys(byCategory).length > 0 && (
        <div style={{ background: T.paper2, border: `1px solid ${T.line}`, borderRadius: 2, padding: "20px 22px", marginBottom: 28 }}>
          {sectionHd("category summary", T.ink3)}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
            {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
              <div key={cat} style={{ background: T.paper3, border: `1px solid ${T.line}`, borderRadius: 2, padding: "10px 12px" }}>
                <div style={{ fontFamily: T.fNum, fontSize: 16, color: T.ink, fontWeight: 500 }}>${amt.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: T.ink3, marginTop: 3, fontFamily: T.fBody }}>{cat}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {transactions.length > 0 && (() => {
          const monthCounts = {};
          transactions.forEach((t) => {
            const k = (typeof parseTxnMonthKey === "function" && parseTxnMonthKey(t.date)) || currentMonth || "current month";
            monthCounts[k] = (monthCounts[k] || 0) + 1;
          });
          return (
            <span style={{ fontSize: 11.5, color: T.ink3, fontFamily: T.fNum }}>
              saving to: {Object.entries(monthCounts).map(([k, c]) => `${k} ×${c}`).join(" · ")}
            </span>
          );
        })()}
        <button onClick={() => onSave(transactions)} disabled={needsReview.length > 0} style={{
          background: needsReview.length === 0 ? T.accent : T.paper3,
          color: needsReview.length === 0 ? T.paper : T.ink3,
          border: "none", borderRadius: 2, padding: "11px 28px",
          fontFamily: T.fBody, fontWeight: 500, fontSize: 14,
          cursor: needsReview.length === 0 ? "pointer" : "not-allowed",
        }}>
          {needsReview.length > 0 ? `resolve ${needsReview.length} remaining to save` : "save to budget tracker \u2192"}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function ExpenseCategorizer({ onSave, existingFps, currentMonth }) {
  const [phase, setPhase]               = useState("upload");
  const [processingStage, setStage]     = useState("parse");
  const [transactions, setTransactions] = useState([]);
  const [dupesSkipped, setDupesSkipped] = useState(0);
  const [memory, setMemory]             = useState(loadMemory);

  const handleLearn = useCallback((txnId, category) => {
    setTransactions(prev => {
      const txn = prev.find(t => t.id === txnId);
      if (!txn) return prev;
      const key = merchantKey(txn.description);
      setMemory(m => { const updated = { ...m, [key]: category }; saveMemory(updated); return updated; });
      return prev;
    });
  }, []);

  const handleFilesReady = useCallback(async (uploads) => {
    setPhase("processing");
    const currentMemory = loadMemory();
    setStage("parse");
    await new Promise(r => setTimeout(r, 400));
    let txns = [];
    for (const upload of Object.values(uploads)) {
      let parsed = [];
      if (upload.fileType === "csv") {
        parsed = parseCSV(upload.text);
      } else {
        try {
          const contentBlock = upload.fileType === "pdf"
            ? { type: "document", source: { type: "base64", media_type: upload.mediaType, data: upload.base64 } }
            : { type: "image",    source: { type: "base64", media_type: upload.mediaType, data: upload.base64 } };
          const res = await fetch("/api/anthropic", {
            method: "POST",
            headers: await (window.apiHeaders ? apiHeaders() : { "Content-Type": "application/json" }),
            body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 4000, thinking: { type: "disabled" }, messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Extract all transactions from this credit card statement.\nRespond with ONLY CSV rows (no headers, no markdown) in format: date,description,amount\nPositive numbers for charges only. Skip payments and credits.\nExample: 2026-04-01,SPOTIFY USA,9.99` }] }] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
          const csvText = data.content?.[0]?.text || "";
          parsed = parseCSV("date,description,amount\n" + csvText.trim());
        } catch (e) { console.error(`Failed to extract from ${upload.file.name}:`, e); }
      }
      const card = upload.card || upload.file.name;
      txns = [...txns, ...parsed.map(t => ({ ...t, card }))];
    }
    /* Skip anything already imported (and in-batch repeats) instead of double-counting */
    const seenFps = new Set(existingFps || []);
    let dupes = 0;
    txns = txns.filter(t => {
      const fp = txnFingerprint(t.date, t.description, t.amount);
      if (seenFps.has(fp)) { dupes++; return false; }
      seenFps.add(fp);
      return true;
    });
    setDupesSkipped(dupes);
    setStage("rules");
    await new Promise(r => setTimeout(r, 500));
    txns = txns.map(t => {
      const match = matchTransaction(t.description, currentMemory);
      if (match) return { ...t, confirmedCategory: match.category, source: match.source, status: "auto", needsReview: false };
      return { ...t, source: "uncategorized", status: "uncategorized", needsReview: true };
    });
    setStage("ai");
    const uncertain = txns.filter(t => t.needsReview);
    const aiResults = await categorizeWithAI(uncertain);
    txns = txns.map(t => {
      if (!t.needsReview) return t;
      const result = aiResults.find(r => r.id === t.id);
      if (!result) return t;
      const autoApprove = result.confidence === "high";
      return { ...t, aiSuggestion: result.category, confidence: result.confidence, confirmedCategory: autoApprove ? result.category : null, source: autoApprove ? "ai" : "uncategorized", status: autoApprove ? "auto" : "needs-review", needsReview: !autoApprove };
    });
    setStage("done");
    await new Promise(r => setTimeout(r, 300));
    setTransactions(txns);
    setPhase("review");
  }, [existingFps]);

  const confirmAll = useCallback(() => {
    const updated = { ...memory };
    let changed = false;
    setTransactions(prev => {
      const next = prev.map(t => {
        if ((t.status === "needs-review" || t.status === "uncategorized") && t.aiSuggestion) {
          updated[merchantKey(t.description)] = t.aiSuggestion;
          changed = true;
          return { ...t, confirmedCategory: t.aiSuggestion, status: "confirmed", needsReview: false };
        }
        return t;
      });
      return next;
    });
    if (changed) { setMemory(updated); saveMemory(updated); }
  }, [memory]);

  const phases = ["upload", "processing", "review"];
  const phaseLabel = { upload: "upload statements", processing: "categorizing\u2026", review: "review & confirm" };

  return (
    <div className="catz-page" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.fBody, padding: "48px 32px 80px" }}>
      {/* Header */}
      <div style={{ maxWidth: 860, margin: "0 auto 36px", borderBottom: `1px solid ${T.line}`, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: T.ink3, fontFamily: T.fBody, marginBottom: 4 }}>
              Ledger
            </div>
            <h1 style={{ fontFamily: T.fDisp, fontWeight: 500, fontSize: 17, margin: 0, letterSpacing: "0.2em", textTransform: "uppercase", color: T.ink }}>
              Expense Categorizer
            </h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {/* Phase dots */}
            <div style={{ display: "flex", gap: 6 }}>
              {phases.map((p, i) => (
                <div key={p} style={{
                  width: 30, height: 3, borderRadius: 2,
                  background: phase === p ? T.accent : i < phases.indexOf(phase) ? T.sageInk : T.line2,
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: T.ink3, fontFamily: T.fBody }}>{phaseLabel[phase]}</span>
            {Object.keys(memory).length > 0 && (
              <span style={{ fontSize: 11, color: T.lilacInk, fontFamily: T.fBody }}>
                {Object.keys(memory).length} merchants in memory
              </span>
            )}
          </div>
        </div>
      </div>

      {phase === "upload"     && <UploadPhase onFilesReady={handleFilesReady} />}
      {phase === "processing" && <ProcessingPhase stage={processingStage} />}
      {phase === "review"     && (
        <ReviewPhase
          transactions={transactions}
          onUpdate={setTransactions}
          onConfirmAll={confirmAll}
          onSave={txns => onSave?.(txns)}
          onLearn={handleLearn}
          dupesSkipped={dupesSkipped}
          currentMonth={currentMonth}
        />
      )}
    </div>
  );
}

Object.assign(window, { ExpenseCategorizer });
