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
        onFocus={(e) => e.target.select()}
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

function ExpensesPage({ ledgers, setLedgers, selectedMonth, incomeRows = [], setIncomeRows, applyExpenses, undo, redo, canUndo, canRedo }) {
  const ledger   = ledgers[selectedMonth] || { expenses: [] };
  const expenses = ledger.expenses;
  const income   = incomeRows.reduce((s, i) => s + (i.amount || 0), 0);

  const updateLedger = (fn) =>
    setLedgers((prev) => ({ ...prev, [selectedMonth]: fn(prev[selectedMonth]) }));

  const setExpenses = (fn) => {
    const next = typeof fn === "function" ? fn(expenses) : fn;
    applyExpenses(next);
  };

  /* Category operations — rows are identified by stable id, not category name */
  const setField  = (id, field, v) =>
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: v } : e)));
  const removeRow = (id) =>
    setExpenses((prev) => prev.filter((e) => e.id !== id));

  const notes    = ledger.notes || "";
  const setNotes = (v) => updateLedger((l) => ({ ...l, notes: v }));

  const addWant = () => {
    if (expenses.some((e) => e.cat === "")) return;
    setExpenses((prev) => [...prev, { id: uid("e"), cat: "", expected: 0, actual: 0, group: "want", note: "" }]);
  };

  /* Income operations */
  const setIncomeField = (id, field, v) =>
    setIncomeRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  const removeIncome = (id) =>
    setIncomeRows((prev) => prev.filter((r) => r.id !== id));
  const addIncome = () =>
    setIncomeRows((prev) => [...prev, { id: uid("i"), label: "", amount: 0, note: "" }]);

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
      <tr key={e.id} className="catrow">
        <td className="catrow__cat">
          <input
            className={`catchip catchip--input cat--${CAT_TONE[e.cat] || "other"}`}
            value={e.cat}
            autoFocus={e.cat === ""}
            placeholder="Category name"
            onChange={(ev) => setField(e.id, "cat", ev.target.value)}
          />
          <select className="minisel" value={e.group}
            onChange={(ev) => setField(e.id, "group", ev.target.value)}>
            <option value="need">need</option>
            <option value="want">want</option>
          </select>
        </td>
        <td className="catrow__note">
          <input className="noteinput" value={e.note || ""}
            placeholder="Add a note"
            onChange={(ev) => setField(e.id, "note", ev.target.value)} />
        </td>
        <td className="num"><CellMoney value={e.expected} onChange={(v) => setField(e.id, "expected", v)} /></td>
        <td className="num"><CellMoney value={e.actual}   onChange={(v) => setField(e.id, "actual",   v)} /></td>
        <td className="catrow__progress">
          <CatProgress actual={e.actual} expected={e.expected} />
        </td>
        <td className={`num ${remain < 0 ? "neg" : "muted"}`}>
          {remain < 0 ? `−${fmt0(Math.abs(remain))}` : fmt0(remain)}
          <button className="rm" onClick={() => {
            if (confirm(`Remove "${e.cat}"?`)) removeRow(e.id);
          }} title="Remove row">×</button>
        </td>
      </tr>
    );
  };

  return (
    <>
      <MonthTotalsStrip expected={sumExp} actual={sumAct} income={income} />

      <LayoutGrid id="expenses">

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

        {/* Income — per-month, editable */}
        <Section tone="sage" eyebrow={selectedMonth} title="Income" titleKey="exp-income" className="grid__full"
          right={<span className="sec__total"><span className="lbl">Total</span><span className="num">{fmt0(income)}</span></span>}>
          <table className="catbl">
            <thead>
              <tr>
                <th>Source</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((r) => (
                <tr key={r.id} className="catrow">
                  <td>
                    <input className="noteinput" style={{ fontWeight: 500, color: "var(--ink)", minWidth: 140 }}
                      value={r.label}
                      placeholder="Income source"
                      onChange={(ev) => setIncomeField(r.id, "label", ev.target.value)} />
                  </td>
                  <td>
                    <input className="noteinput" value={r.note || ""}
                      placeholder="Add a note"
                      onChange={(ev) => setIncomeField(r.id, "note", ev.target.value)} />
                  </td>
                  <td className="num">
                    <CellMoney value={r.amount} onChange={(v) => setIncomeField(r.id, "amount", v)} />
                  </td>
                  <td>
                    <button className="rm" onClick={() => {
                      if (confirm(`Remove "${r.label || "income row"}"?`)) removeIncome(r.id);
                    }} title="Remove row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="catbl__ft">Total Income</td>
                <td className="num catbl__ft">{fmt0(income)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={addIncome}>+ Add income</button>
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

      </LayoutGrid>
    </>
  );
}

Object.assign(window, { ExpensesPage, CellMoney, nextMonthName });
