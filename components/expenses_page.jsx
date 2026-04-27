/* Expenses page — per-month ledger, driven by lifted state from App. */

const CAT_TONE = {
  "Rent":          "rent",
  "Electricity":   "util",
  "Utilities":     "util",
  "Gas":           "util",
  "Internet":      "util",
  "Phone":         "util",
  "Tools":         "util",
  "Apartment":     "util",
  "Student Loans": "loan",
  "Groceries":     "groc",
  "Transportation":"transit",
  "Disc. Shopping":"shop",
  "Gym Membership":"health",
  "Subscriptions": "subs",
  "Dining":        "dining",
  "Gifts Fund":    "gift",
  "Other":         "other",
};
window.CAT_TONE = CAT_TONE;

/* Inline editable money cell */
function CellMoney({ value, onChange, placeholder = "0", large = false }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value ?? ""));
  React.useEffect(() => { setDraft(String(value ?? "")); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    onChange(isFinite(n) ? n : 0);
    setEditing(false);
  };
  const cancel = () => { setDraft(String(value ?? "")); setEditing(false); };

  if (editing) {
    return (
      <input
        className={`cell cell--edit ${large ? "cell--lg" : ""}`}
        type="number" step="0.01"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
    );
  }
  return (
    <button type="button"
      className={`cell ${large ? "cell--lg" : ""}`}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}>
      {value || value === 0 ? fmt(value) : <span className="cell__ph">{placeholder}</span>}
    </button>
  );
}

function CatProgress({ actual, expected }) {
  if (!expected) return <span className="dim tiny">—</span>;
  const p = actual / expected;
  const over = p > 1;
  return (
    <div className="catrow__bar">
      <div className={`catrow__fill ${over ? "over" : ""}`}
           style={{ width: `${Math.min(100, p * 100)}%` }} />
    </div>
  );
}

function MonthTotalsStrip({ expected, actual, income }) {
  const remaining = expected - actual;
  const vsIncome = income - actual;
  return (
    <div className="xsum">
      <div className="xsum__cell">
        <span className="xsum__l">Budgeted</span>
        <span className="xsum__v">{fmt0(expected)}</span>
        <span className="xsum__sub"></span>
      </div>
      <div className="xsum__cell">
        <span className="xsum__l">Spent so far</span>
        <span className="xsum__v">{fmt0(actual)}</span>
        <span className="xsum__sub"></span>
      </div>
      <div className="xsum__cell">
        <span className="xsum__l">Bi-weekly remaining</span>
        <span className={`xsum__v ${remaining < 0 ? "neg" : "pos"}`}>{fmt0(Math.abs(remaining))}</span>
        <span className="xsum__sub">{remaining < 0 ? "over budget" : ""}</span>
      </div>
      <div className="xsum__cell">
        <span className="xsum__l">Monthly remaining</span>
        <span className={`xsum__v ${vsIncome < 0 ? "neg" : "pos"}`}>{fmt0(Math.abs(vsIncome))}</span>
        <span className="xsum__sub"></span>
      </div>
    </div>
  );
}

function nextMonthName(current) {
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const parts = current.split(" ");
  if (parts.length !== 2) return "";
  const idx = MONTHS.indexOf(parts[0]);
  if (idx === -1) return "";
  if (idx === 11) return `January ${parseInt(parts[1]) + 1}`;
  return `${MONTHS[idx + 1]} ${parts[1]}`;
}

function ExpensesPage({ ledgers, setLedgers, selectedMonth, income }) {
  const ledger   = ledgers[selectedMonth] || { expenses: [] };
  const expenses = ledger.expenses;

  const updateLedger = (fn) =>
    setLedgers((prev) => ({ ...prev, [selectedMonth]: fn(prev[selectedMonth]) }));

  const setExpenses = (fn) =>
    updateLedger((l) => ({ ...l, expenses: typeof fn === "function" ? fn(l.expenses) : fn }));

  /* Category operations */
  const setField    = (cat, field, v) =>
    setExpenses((prev) => prev.map((e) => (e.cat === cat ? { ...e, [field]: v } : e)));
  const setNote     = (cat, note) =>
    setExpenses((prev) => prev.map((e) => (e.cat === cat ? { ...e, note } : e)));
  const setGroup    = (cat, g) =>
    setExpenses((prev) => prev.map((e) => (e.cat === cat ? { ...e, group: g } : e)));
  const renameCat   = (oldCat, newCat) =>
    setExpenses((prev) => prev.map((e) => (e.cat === oldCat ? { ...e, cat: newCat } : e)));
  const removeCat   = (cat) =>
    setExpenses((prev) => prev.filter((e) => e.cat !== cat));

  const notes    = ledger.notes || "";
  const setNotes = (v) => updateLedger((l) => ({ ...l, notes: v }));

  const addWant = () => {
    if (expenses.some((e) => e.cat === "")) return;
    setExpenses((prev) => [...prev, { cat: "", expected: 0, actual: 0, group: "want", note: "" }]);
  };

  const needs = expenses.filter((e) => e.group === "need");
  const wants = expenses.filter((e) => e.group === "want");
  const sumExp = expenses.reduce((s, e) => s + (e.expected || 0), 0);
  const sumAct = expenses.reduce((s, e) => s + (e.actual   || 0), 0);

  const donutData = expenses
    .filter((e) => e.actual > 0 && e.cat !== "Rent")
    .map((e) => ({ k: e.cat, v: e.actual }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const donutTotal = donutData.reduce((s, d) => s + d.v, 0);

  const renderRow = (e) => {
    const remain = e.expected - e.actual;
    return (
      <tr key={e.cat} className="catrow">
        <td className="catrow__cat">
          <input
            className={`catchip catchip--input cat--${CAT_TONE[e.cat] || "other"}`}
            value={e.cat}
            autoFocus={e.cat === ""}
            placeholder="Category name"
            onChange={(ev) => renameCat(e.cat, ev.target.value)}
          />
          <select className="minisel" value={e.group}
            onChange={(ev) => setGroup(e.cat, ev.target.value)}>
            <option value="need">need</option>
            <option value="want">want</option>
          </select>
        </td>
        <td className="catrow__note">
          <input className="noteinput" value={e.note || ""}
            placeholder="Add a note"
            onChange={(ev) => setNote(e.cat, ev.target.value)} />
        </td>
        <td className="num"><CellMoney value={e.expected} onChange={(v) => setField(e.cat, "expected", v)} /></td>
        <td className="num"><CellMoney value={e.actual}   onChange={(v) => setField(e.cat, "actual",   v)} /></td>
        <td className="catrow__progress">
          <CatProgress actual={e.actual} expected={e.expected} />
        </td>
        <td className={`num ${remain < 0 ? "neg" : "muted"}`}>
          {remain < 0 ? `−${fmt0(Math.abs(remain))}` : fmt0(remain)}
          <button className="rm" onClick={() => {
            if (confirm(`Remove "${e.cat}"?`)) removeCat(e.cat);
          }} title="Remove row">×</button>
        </td>
      </tr>
    );
  };

  return (
    <>
      <MonthTotalsStrip expected={sumExp} actual={sumAct} income={income} />

      <div className="xgrid">

        {/* Breakdown donut */}
        <Section tone="cream" eyebrow="Where it went" title="Breakdown" titleKey="exp-breakdown"
          className="grid__full"
          right={<span className="sec__range">top 6 · excl. rent</span>}>
          <div className="catv">
            <Donut data={donutData} />
            <ul className="catv__legend">
              {donutData.map((d, i) => (
                <li key={d.k}>
                  <span className="sw" style={{ background: `var(--don-${i % 6})` }} />
                  <span className="catv__name">{d.k}</span>
                  <span className="catv__pct dim">{((d.v / (donutTotal || 1)) * 100).toFixed(0)}%</span>
                  <span className="catv__val num">{fmt0(d.v)}</span>
                </li>
              ))}
              {donutData.length === 0 && (
                <li className="dim" style={{ padding: "12px 0" }}>No spend logged yet this month.</li>
              )}
            </ul>
          </div>
        </Section>

        {/* Categories table */}
        <Section tone="clay" eyebrow="Monthly total" title="Categories" titleKey="exp-categories"
          className="grid__full"
          right={<span className="sec__range">{expenses.length} categories · {selectedMonth}</span>}>
          <table className="catbl">
            <thead>
              <tr>
                <th>Category</th>
                <th>Note</th>
                <th className="num">Budgeted</th>
                <th className="num">Actual</th>
                <th>Progress</th>
                <th className="num">Left</th>
              </tr>
            </thead>
            <tbody>
              {/* Needs group */}
              <tr className="catrow__group">
                <td colSpan={6}>
                  <span className="dot dot--need" /> Needs · {needs.length} categories · {fmt0(needs.reduce((s, e) => s + e.expected, 0))} budgeted
                </td>
              </tr>
              {needs.map(renderRow)}

              {/* Wants group */}
              <tr className="catrow__group">
                <td colSpan={6}>
                  <span className="dot dot--want" /> Wants · {wants.length} categories · {fmt0(wants.reduce((s, e) => s + e.expected, 0))} budgeted
                </td>
              </tr>
              {wants.map(renderRow)}

              {/* Inline add row for Wants */}
              <tr>
                <td colSpan={6} style={{ paddingTop: 8, paddingBottom: 4 }}>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={addWant}>
                    + Add want
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="catbl__ft">Total</td>
                <td className="num catbl__ft">{fmt(sumExp)}</td>
                <td className="num catbl__ft">{fmt(sumAct)}</td>
                <td></td>
                <td className={`num catbl__ft ${sumExp - sumAct < 0 ? "neg" : "pos"}`}>
                  {fmt(sumExp - sumAct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Section>

        {/* Notes */}
        <Section tone="cream" eyebrow={selectedMonth} title="Notes" titleKey="exp-notes" className="grid__full">
          <textarea
            className="notes-area"
            placeholder="Add any notes for this month…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Section>

      </div>
    </>
  );
}

Object.assign(window, { ExpensesPage, CellMoney, nextMonthName });
