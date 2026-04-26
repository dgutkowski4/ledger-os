/* Savings page — monthly summary + allocation (from pay-day data) + monthly tracking. */

const TYPE_TONE = {
  HYSA:       "sage",
  Retirement: "lilac",
  Brokerage:  "sky",
  Crypto:     "clay",
  Other:      "cream",
};

/* Fallback map — resolves type from account name when r.type is absent */
const ACCT_TYPE_MAP = {
  "Marcus HYSA":        "HYSA",
  "Vanguard IRA":       "Retirement",
  "Fidelity Brokerage": "Brokerage",
  "Coinbase Crypto":    "Crypto",
  "Charles Schwab":     "Brokerage",
};

function resolveType(r) {
  return r.type || ACCT_TYPE_MAP[r.acct] || "Other";
}

function SavingsPage({ accounts, setAccounts, savings, setSavings, month = "APRIL" }) {
  /* All stats derived from the monthly savings rows */
  const totalPaid     = savings.reduce((s, r) => s + r.paid1 + r.paid2, 0);
  const totalTarget   = savings.reduce((s, r) => s + r.target, 0);
  const totalRemaining = Math.max(0, totalTarget - totalPaid);
  const annualGoal    = savings.reduce((s, r) => s + r.target * 12, 0);

  /* Allocation by type from paid amounts — falls back to targets if nothing paid yet */
  const usePaid = totalPaid > 0;
  const allocByType = {};
  savings.forEach((r) => {
    const type = resolveType(r);
    const val  = usePaid ? r.paid1 + r.paid2 : r.target;
    if (val > 0) allocByType[type] = (allocByType[type] || 0) + val;
  });
  const allocData = Object.entries(allocByType)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);
  const allocTotal = allocData.reduce((s, d) => s + d.v, 0);

  return (
    <>
      {/* Summary strip — month-specific */}
      <div className="xsum">
        <div className="xsum__cell">
          <span className="xsum__l">Saved this month</span>
          <span className="xsum__v">{fmt0(totalPaid)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">Monthly target</span>
          <span className="xsum__v">{fmt0(totalTarget)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">Remaining</span>
          <span className={`xsum__v ${totalRemaining === 0 ? "pos" : ""}`}>{totalRemaining === 0 ? "✓ Done" : fmt0(totalRemaining)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">Annual goal</span>
          <span className="xsum__v">{fmt0(annualGoal)}</span>
          <span className="xsum__sub"></span>
        </div>
      </div>

      <div className="xgrid">
        {/* Allocation donut — driven by this month's paid amounts */}
        <Section tone="sage" eyebrow={month} title="Allocation" titleKey="allocation-savings"
          right={<span className="sec__range">{usePaid ? "by amount paid" : "by target"}</span>}>
          <div className="catv">
            <Donut data={allocData} label={usePaid ? "Paid" : "Target"} />
            <ul className="catv__legend">
              {allocData.map((d, i) => (
                <li key={d.k}>
                  <span className="sw" style={{ background: `var(--don-${i % 6})` }} />
                  <span className="catv__name">{d.k}</span>
                  <span className="catv__pct dim">{((d.v / (allocTotal || 1)) * 100).toFixed(0)}%</span>
                  <span className="catv__val num">{fmt0(d.v)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Monthly progress by account */}
        <Section tone="sky" eyebrow={month} title="By Account" titleKey="savings-by-account"
          right={<span className="sec__total"><span className="lbl">Paid</span><span className="num">{fmt0(totalPaid)} / {fmt0(totalTarget)}</span></span>}>
          <table className="catbl">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="num">Target</th>
                <th className="num">Paid</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {savings.map((r) => {
                const paid = r.paid1 + r.paid2;
                const pct  = r.target ? Math.min(100, (paid / r.target) * 100) : 0;
                const done = paid >= r.target && r.target > 0;
                const tone = TYPE_TONE[resolveType(r)] || "cream";
                return (
                  <tr key={r.id} className="catrow">
                    <td>
                      <input className="noteinput" style={{ fontWeight: 500, color: "var(--ink)", minWidth: 140 }}
                        value={r.acct}
                        onChange={(e) => setSavings(prev => prev.map(row => row.id === r.id ? { ...row, acct: e.target.value } : row))} />
                    </td>
                    <td>
                      <select className="typesel" value={resolveType(r)}
                        onChange={(e) => setSavings(prev => prev.map(row => row.id === r.id ? { ...row, type: e.target.value } : row))}>
                        {Object.keys(TYPE_TONE).map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="num dim">{fmt0(r.target)}</td>
                    <td className={`num ${done ? "pos" : ""}`}>{done ? `✓ ${fmt0(paid)}` : fmt0(paid)}</td>
                    <td className="catrow__progress">
                      <div className="catrow__bar">
                        <div className="catrow__fill"
                          style={{ width: `${pct}%`, background: `var(--${tone}-ink, var(--accent))` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="catbl__ft">Total</td>
                <td className="num catbl__ft">{fmt0(totalTarget)}</td>
                <td className="num catbl__ft">{fmt0(totalPaid)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </Section>

        {/* Monthly pay-day tracking */}
        <div className="grid__full">
          <SavingsSection savings={savings} setSavings={setSavings} month={month} />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SavingsPage });
