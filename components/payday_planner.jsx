/* Bi-Weekly Pay-Day Planner
   Credits are internal (cards/fixed expenses).
   Savings rows come from App savings state — names stay in sync automatically.
   plannerSavings is lifted: { [savingsId]: { pd1: {checked, amount}, pd2: {checked, amount} } }
*/

function PDCell({ value, onChange }) {
  return <CellMoney value={value} onChange={onChange} />;
}

function PDRow({ item, column, onToggle, onAmount, onName, onRemove }) {
  const col = item[column];
  return (
    <tr className={`pd-row ${col.checked ? "is-checked" : ""}`}>
      <td className="pd-check">
        <input type="checkbox" checked={col.checked || false}
          onChange={(e) => onToggle(e.target.checked)} />
      </td>
      <td className="pd-name">
        <input className="pd-text"
          value={item.name}
          readOnly={!onName}
          style={!onName ? { opacity: 0.75, cursor: "default" } : {}}
          onChange={(e) => onName && onName(e.target.value)} />
      </td>
      <td className="num pd-amt">
        <PDCell value={col.amount} onChange={onAmount} />
      </td>
      <td className="pd-rm">
        {onRemove
          ? <button className="rm" title="Remove" onClick={onRemove}>×</button>
          : <span />}
      </td>
    </tr>
  );
}

const PD_CREDITS_DEFAULT = [
  { id: "c1", name: "Chase",         pd1: { checked: false, amount: 0 },   pd2: { checked: false, amount: 0 } },
  { id: "c2", name: "Capital One",   pd1: { checked: false, amount: 0 },   pd2: { checked: false, amount: 0 } },
  { id: "c3", name: "Discover",      pd1: { checked: false, amount: 0 },   pd2: { checked: false, amount: 0 } },
  { id: "c4", name: "Student Loans", pd1: { checked: false, amount: 55 },  pd2: { checked: false, amount: 55 } },
  { id: "c5", name: "Rent",          pd1: { checked: false, amount: 580 }, pd2: { checked: false, amount: 580 } },
];

function pdLsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function PayDayPlanner({ month = "APRIL", savingsRows = [], plannerSavings = {}, setPlannerSavings }) {
  const [dates, setDates] = React.useState(() => pdLsGet("ledger_pd_dates", ["4.17.26", "5.01.26"]));
  const [pay,   setPay]   = React.useState(() => pdLsGet("ledger_pd_pay",   [2035, 2035]));
  const [credits, setCredits] = React.useState(() => pdLsGet("ledger_pd_credits", PD_CREDITS_DEFAULT));

  React.useEffect(() => { localStorage.setItem("ledger_pd_dates",   JSON.stringify(dates));   }, [dates]);
  React.useEffect(() => { localStorage.setItem("ledger_pd_pay",     JSON.stringify(pay));     }, [pay]);
  React.useEffect(() => { localStorage.setItem("ledger_pd_credits", JSON.stringify(credits)); }, [credits]);

  /* Credit helpers — fully internal */
  const updateCredit = (id, col, patch) =>
    setCredits(credits.map((r) => (r.id === id ? { ...r, [col]: { ...r[col], ...patch } } : r)));
  const renameCredit = (id, name) =>
    setCredits(credits.map((r) => (r.id === id ? { ...r, name } : r)));
  const removeCredit = (id) =>
    setCredits(credits.filter((r) => r.id !== id));
  const addCredit = () =>
    setCredits([...credits, { id: "c" + Math.random().toString(36).slice(2, 8),
      name: "New item", pd1: { checked: false, amount: 0 }, pd2: { checked: false, amount: 0 } }]);

  /* Savings helpers — keyed by savingsRow id, lifted to App */
  const getPD = (svId) =>
    plannerSavings[svId] || { pd1: { checked: false, amount: 0 }, pd2: { checked: false, amount: 0 } };

  const updatePlannerSavings = (svId, col, patch) => {
    setPlannerSavings && setPlannerSavings((prev) => {
      const cur = prev[svId] || { pd1: { checked: false, amount: 0 }, pd2: { checked: false, amount: 0 } };
      return { ...prev, [svId]: { ...cur, [col]: { ...cur[col], ...patch } } };
    });
  };

  const renderColumn = (colKey, idx) => {
    const creditTotal  = credits.reduce((s, r) => s + (r[colKey].amount || 0), 0);
    const savingsTotal = savingsRows.reduce((s, r) => s + (getPD(r.id)[colKey].amount || 0), 0);
    const left4        = pay[idx] - creditTotal;
    const remainder    = left4 - savingsTotal;

    return (
      <div className="pd-col" key={colKey}>
        <div className="pd-hd">
          <span className="pd-hd__lbl">Pay day</span>
          <input className="pd-text pd-date"
            value={dates[idx]}
            placeholder="[Date]"
            onChange={(e) => { const d = [...dates]; d[idx] = e.target.value; setDates(d); }} />
        </div>

        <div className="pd-line pd-line--hero">
          <span className="pd-line__l">Projected Pay</span>
          <PDCell value={pay[idx]} onChange={(v) => { const p = [...pay]; p[idx] = v; setPay(p); }} />
        </div>

        {/* Credits & fixed expenses */}
        <div className="pd-section">
          <div className="pd-section__hd">
            <span className="pd-section__t">Credit Cards &amp; Fixed Expenses</span>
          </div>
          <table className="pd-tbl">
            <tbody>
              {credits.map((c) => (
                <PDRow key={c.id} item={c} column={colKey}
                  onToggle={(v) => updateCredit(c.id, colKey, { checked: v })}
                  onAmount={(v) => updateCredit(c.id, colKey, { amount: v })}
                  onName={(v) => renameCredit(c.id, v)}
                  onRemove={() => removeCredit(c.id)} />
              ))}
            </tbody>
          </table>
          {idx === 0 && (
            <button className="btn-ghost" style={{ marginTop: 8, fontSize: 11 }} onClick={addCredit}>
              + Add item
            </button>
          )}
        </div>

        <div className="pd-line pd-line--total">
          <span className="pd-line__l">Total</span>
          <span className="num pd-line__v">{fmt0(creditTotal)}</span>
        </div>

        <div className="pd-line pd-line--accent">
          <span className="pd-line__l">Left for Investments</span>
          <span className="num pd-line__v">{fmt0(left4)}</span>
        </div>

        {/* Savings & Investments — derived from App savings */}
        <div className="pd-section">
          <div className="pd-section__hd">
            <span className="pd-section__t">Savings &amp; Investments</span>
          </div>
          <table className="pd-tbl">
            <tbody>
              {savingsRows.map((r) => {
                const pdata = getPD(r.id);
                const item  = { id: r.id, name: r.acct, pd1: pdata.pd1, pd2: pdata.pd2 };
                return (
                  <PDRow key={r.id} item={item} column={colKey}
                    onToggle={(v) => updatePlannerSavings(r.id, colKey, { checked: v })}
                    onAmount={(v) => updatePlannerSavings(r.id, colKey, { amount: v })}
                    onName={null}
                    onRemove={null} />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pd-line pd-line--final">
          <span className="pd-line__l">Remainder</span>
          <span className={`num pd-line__v ${remainder < 0 ? "neg" : "pos"}`}>{fmt0(remainder)}</span>
        </div>
      </div>
    );
  };

  return (
    <Section tone="lilac" eyebrow={month} title="Bi-Weekly Pay Day Planner" titleKey="payday-planner"
      className="grid__full"
      right={<span className="sec__range"></span>}>
      <div className="pd-grid">
        {renderColumn("pd1", 0)}
        {renderColumn("pd2", 1)}
      </div>
    </Section>
  );
}

Object.assign(window, { PayDayPlanner });
