/* Dashboard sections: Savings & Investments Monthly, Net worth, Allocation, Spend Breakdown */

function SavingsSection({ savings, setSavings, month = "APRIL" }) {
  const totalTarget = savings.reduce((s, r) => s + r.target, 0);
  const totalPaid   = savings.reduce((s, r) => s + r.paid1 + r.paid2, 0);

  const update = (id, patch) =>
    setSavings((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) =>
    setSavings((prev) => prev.filter((r) => r.id !== id));
  const addRow = () =>
    setSavings((prev) => [...prev, {
      id: "sv" + Math.random().toString(36).slice(2, 8),
      acct: "New Account", type: "Other", perCheck: 0, target: 0, paid1: 0, paid2: 0,
    }]);

  return (
    <Section tone="sky" eyebrow={month} title="Savings & Investments Monthly" titleKey="savings-monthly"
      right={<span className="sec__total"><span className="lbl">Goal</span><span className="num">{fmt0(totalPaid)} / {fmt0(totalTarget)}</span></span>}>
      <table className="stbl">
        <thead>
          <tr>
            <th>Account</th>
            <th className="num">Target</th>
            <th className="num">Pay Day 1</th>
            <th className="num">Pay Day 2</th>
            <th>Progress</th>
            <th className="num">Remaining</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {savings.map((r) => {
            const paid = r.paid1 + r.paid2;
            const remaining = Math.max(0, r.target - paid);
            const done = remaining === 0;
            return (
              <tr key={r.id} className="catrow">
                <td className="st__acct">
                  <input className="noteinput" style={{ fontWeight: 500, color: "var(--ink)", minWidth: 140 }}
                    value={r.acct}
                    onChange={(e) => update(r.id, { acct: e.target.value })} />
                </td>
                <td className="num">
                  <input className="ed-num sm" type="number" value={r.target}
                    onChange={(e) => update(r.id, { target: parseFloat(e.target.value) || 0 })} />
                </td>
                <td className="num">
                  <input className="ed-num sm" type="number" value={r.paid1}
                    onChange={(e) => update(r.id, { paid1: parseFloat(e.target.value) || 0 })} />
                </td>
                <td className="num">
                  <input className="ed-num sm" type="number" value={r.paid2}
                    onChange={(e) => update(r.id, { paid2: parseFloat(e.target.value) || 0 })} />
                </td>
                <td><Progress value={paid} max={r.target} tone="sky" /></td>
                <td className={`num ${done ? "pos" : "muted"}`}>{done ? "✓" : fmt0(remaining)}</td>
                <td>
                  <span className={`pill ${done ? "pill--done" : "pill--prog"}`}>
                    {done ? "Complete" : "In Progress"}
                  </span>
                </td>
                <td>
                  <button className="rm" style={{ opacity: 1 }} title="Remove"
                    onClick={() => { if (confirm(`Remove "${r.acct}"?`)) remove(r.id); }}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="btn-ghost" style={{ marginTop: 12 }} onClick={addRow}>+ Add account</button>
    </Section>
  );
}

function NetWorthSection({ history, netWorth, month = "APRIL" }) {
  const current   = netWorth != null ? netWorth : history[history.length - 1].v;
  const hasPrior  = history.length >= 2;
  const prior     = hasPrior ? history[history.length - 2].v : null;
  const delta     = hasPrior ? current - prior : null;
  const deltaP    = hasPrior && prior ? (delta / prior) * 100 : null;
  const ytdStart  = history.length >= 5 ? history[history.length - 5].v : history[0].v;
  const ytdD      = current - ytdStart;
  const chartData = history.map((h, i) =>
    i === history.length - 1 ? { ...h, v: current } : h
  );
  return (
    <Section tone="cream" eyebrow={month} title="Net Worth" titleKey="nw-dashboard"
      right={<span className="sec__range">{history.length} month{history.length !== 1 ? "s" : ""}</span>}>
      <div className="nw">
        <div className="nw__big">
          <span className="nw__lbl">Today</span>
          <span className="nw__v">{fmt0(current)}</span>
          {hasPrior && (
            <span className="nw__sub">
              <span className={delta >= 0 ? "pos" : "neg"}>
                {delta >= 0 ? "+" : ""}{fmt0(delta)}
              </span>
              <span className="muted"> vs. last month{deltaP != null ? ` · ${deltaP.toFixed(1)}%` : ""}</span>
            </span>
          )}
        </div>
        <div className="nw__kv">
          <div>
            <span className="nw__lbl">YTD change</span>
            <span className={`nw__kvv ${ytdD >= 0 ? "pos" : "neg"}`}>{ytdD >= 0 ? "+" : ""}{fmt0(ytdD)}</span>
          </div>
          <div>
            <span className="nw__lbl">12mo high</span>
            <span className="nw__kvv">{fmt0(Math.max(...chartData.map((h) => h.v)))}</span>
          </div>
          <div>
            <span className="nw__lbl">12mo low</span>
            <span className="nw__kvv">{fmt0(Math.min(...chartData.map((h) => h.v)))}</span>
          </div>
        </div>
      </div>
      <SoftLine data={chartData} height={150} />
    </Section>
  );
}

/* Allocation donut — driven by live savings rows (paid amounts, or target if nothing paid) */
function AllocationSection({ savings, month = "APRIL" }) {
  const totalPaid = savings.reduce((s, r) => s + r.paid1 + r.paid2, 0);
  const usePaid   = totalPaid > 0;
  const allocByType = {};
  savings.forEach((r) => {
    const type = r.type || "Other";
    const val  = usePaid ? r.paid1 + r.paid2 : r.target;
    if (val > 0) allocByType[type] = (allocByType[type] || 0) + val;
  });
  const allocData = Object.entries(allocByType)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);
  const total = allocData.reduce((s, d) => s + d.v, 0);

  return (
    <Section tone="sage" eyebrow={month} title="Allocation" titleKey="allocation-dashboard"
      right={<span className="sec__range">{usePaid ? "by amount paid" : "by target"}</span>}>
      <div className="catv">
        <Donut data={allocData} label={usePaid ? "Paid" : "Target"} />
        <ul className="catv__legend">
          {allocData.map((d, i) => (
            <li key={d.k}>
              <span className="sw" style={{ background: `var(--don-${i % 6})` }} />
              <span className="catv__name">{d.k}</span>
              <span className="catv__pct dim">{((d.v / (total || 1)) * 100).toFixed(0)}%</span>
              <span className="catv__val num">{fmt0(d.v)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* Spend breakdown donut — clay tone (spending = warm earthy) */
function SpendBreakdownSection({ expenses, month = "APRIL" }) {
  const donutData = expenses
    .filter((e) => e.actual > 0 && e.cat !== "Rent")
    .map((e) => ({ k: e.cat, v: e.actual }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const donutTotal = donutData.reduce((s, d) => s + d.v, 0);

  return (
    <Section tone="clay" eyebrow={month} title="Spending Breakdown" titleKey="spend-breakdown"
      right={<span className="sec__range">top 6 categories</span>}>
      <div className="catv">
        <Donut data={donutData} label="Spent" />
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
  );
}

Object.assign(window, { SavingsSection, NetWorthSection, AllocationSection, SpendBreakdownSection });
