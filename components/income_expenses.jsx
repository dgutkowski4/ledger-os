/* Income + Expenses sections — used on the Dashboard tab */

function IncomeSection({ income }) {
  const total = income.reduce((s, i) => s + i.amount, 0);
  return (
    <Section tone="sage" eyebrow="APRIL" title="Monthly Income"
      right={<span className="sec__total"><span className="lbl"></span><span className="num">{fmt(total)}</span></span>}>
      <ul className="list">
        {income.map((i, idx) => (
          <li key={idx} className="list__row">
            <span className="list__label">{i.label}</span>
            <span className="list__note">{i.note}</span>
            <span className="list__num num">{fmt(i.amount)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ExpenseRow({ e, onActual }) {
  const pctUsed = e.expected ? (e.actual / e.expected) : 0;
  const over = e.actual > e.expected;
  return (
    <tr className={`xr ${e.group}`}>
      <td className="xr__cat">
        <span className={`catchip cat--${(window.CAT_TONE && window.CAT_TONE[e.cat]) || "other"}`}>{e.cat}</span>
      </td>
      <td className="xr__note">{e.note}</td>
      <td className="num dim">{fmt(e.expected)}</td>
      <td className="num">
        <input
          className="ed-num"
          type="number"
          step="0.01"
          value={e.actual}
          onChange={(ev) => onActual(e.cat, parseFloat(ev.target.value) || 0)}
        />
      </td>
      <td className="xr__bar">
        <div className="minibar">
          <div className={`minibar__fill ${over ? "over" : ""}`}
               style={{ width: `${Math.min(120, pctUsed * 100)}%` }} />
        </div>
      </td>
      <td className={`num ${over ? "neg" : "muted"}`}>
        {fmt(e.expected - e.actual, 0)}
      </td>
    </tr>
  );
}

function ExpensesSection({ expenses, setExpenses, month }) {
  const needs = expenses.filter((e) => e.group === "need");
  const wants = expenses.filter((e) => e.group === "want");
  const sum = (arr, k) => arr.reduce((s, e) => s + (e[k] || 0), 0);
  const onActual = (cat, v) =>
    setExpenses((prev) => prev.map((e) => (e.cat === cat ? { ...e, actual: v } : e)));

  const totalExp = sum(expenses, "expected");
  const totalAct = sum(expenses, "actual");
  const remaining = totalExp - totalAct;

  return (
    <Section tone="clay" eyebrow="APRIL" title="Expenses" right={<span className="sec__month">{month}</span>}>
      <table className="xtbl">
        <thead>
          <tr>
            <th>Category</th>
            <th>Note</th>
            <th className="num">Expected</th>
            <th className="num">Actual</th>
            <th>Progress</th>
            <th className="num">Left</th>
          </tr>
        </thead>
        <tbody>
          <tr className="xr__group"><td colSpan={6}>Needs</td></tr>
          {needs.map((e) => <ExpenseRow key={e.cat} e={e} onActual={onActual} />)}
          <tr className="xr__group"><td colSpan={6}>Wants</td></tr>
          {wants.map((e) => <ExpenseRow key={e.cat} e={e} onActual={onActual} />)}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="xt__ft">Expenses Total</td>
            <td className="num">{fmt(totalExp)}</td>
            <td className="num">{fmt(totalAct)}</td>
            <td></td>
            <td className={`num ${remaining < 0 ? "neg" : "pos"}`}>{fmt(remaining)}</td>
          </tr>
          <tr className="xt__subft">
            <td colSpan={2}>Needs</td>
            <td className="num dim">{fmt(sum(needs, "expected"))}</td>
            <td className="num">{fmt(sum(needs, "actual"))}</td>
            <td colSpan={2}></td>
          </tr>
          <tr className="xt__subft">
            <td colSpan={2}>Wants</td>
            <td className="num dim">{fmt(sum(wants, "expected"))}</td>
            <td className="num">{fmt(sum(wants, "actual"))}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </Section>
  );
}

Object.assign(window, { IncomeSection, ExpensesSection });
