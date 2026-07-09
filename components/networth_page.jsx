/* Net Worth page — assets, liabilities, net worth calculation, and history chart.
   State is lifted to App so the dashboard chart stays in sync. */

const ASSET_CATS = ["Cash & Savings", "Investments", "Retirement", "Crypto", "Real Estate", "Other"];
const LIAB_CATS  = ["Credit Card", "Student Loan", "Mortgage", "Auto Loan", "Other"];

/* Zeroed skeleton for new users — saved data always overrides these */
const NW_ASSETS_SEED = [
  { id: "a1", name: "Checking",           category: "Cash & Savings", value: 0 },
  { id: "a2", name: "High-Yield Savings", category: "Cash & Savings", value: 0 },
  { id: "a3", name: "Retirement (IRA)",   category: "Retirement",     value: 0 },
  { id: "a4", name: "Brokerage",          category: "Investments",    value: 0 },
];

const NW_LIABILITIES_SEED = [
  { id: "l1", name: "Credit Card",   category: "Credit Card",  value: 0 },
  { id: "l2", name: "Student Loans", category: "Student Loan", value: 0 },
];

function CompoundCalculator({ initialPrincipal = 0 }) {
  const [principal,   setPrincipal]   = React.useState(initialPrincipal);
  const [monthly,     setMonthly]     = React.useState(500);
  const [rate,        setRate]        = React.useState(7);
  const [years,       setYears]       = React.useState(20);
  const [compounding, setCompounding] = React.useState("monthly");

  const n = compounding === "monthly" ? 12 : 1;
  const r = rate / 100 / n;

  const balanceAt = (yr) => {
    const periods = n * yr;
    if (r === 0) return principal + monthly * 12 * yr;
    const growth = Math.pow(1 + r, periods);
    return principal * growth + monthly * (compounding === "monthly" ? 1 : 12) * (growth - 1) / r;
  };

  const future        = balanceAt(years);
  const totalContribs = principal + monthly * 12 * years;
  const totalInterest = future - totalContribs;
  const gain          = totalContribs > 0 ? ((totalInterest / totalContribs) * 100).toFixed(0) : 0;

  const step = Math.max(1, Math.round(years / 6));
  const chartData = Array.from({ length: years + 1 }, (_, yr) => ({
    m: yr % step === 0 ? (yr === 0 ? "Now" : `Yr ${yr}`) : "",
    v: Math.round(balanceAt(yr)),
  }));

  const lbl = {
    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
    color: "var(--ink-3)", fontFamily: "var(--f-body)",
  };
  const selStyle = {
    fontFamily: "var(--f-num)", fontSize: 13, color: "var(--ink)",
    background: "color-mix(in oklch, var(--ink), transparent 96%)",
    border: "1px dashed color-mix(in oklch, var(--ink), transparent 78%)",
    borderRadius: 6, padding: "3px 6px", outline: "none",
  };

  return (
    <Section tone="lilac" eyebrow="Forecast" title="Compound Interest Calculator" titleKey="compound-calc" className="grid__full">

      {/* Result */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
        <div className="nw__big">
          <span className="nw__lbl">Balance after {years} year{years !== 1 ? "s" : ""}</span>
          <span className="nw__v pos">{fmt0(future)}</span>
          <span className="nw__sub">
            <span className="pos">{fmt0(Math.max(0, totalInterest))}</span>
            <span className="muted"> interest · {gain}% gain on contributions</span>
          </span>
        </div>
        <div className="nw__kv" style={{ marginTop: 8 }}>
          <div>
            <span className="nw__lbl">Total contributed</span>
            <span className="nw__kvv">{fmt0(totalContribs)}</span>
          </div>
          <div>
            <span className="nw__lbl">Interest earned</span>
            <span className="nw__kvv pos">{fmt0(Math.max(0, totalInterest))}</span>
          </div>
        </div>
      </div>

      {/* Inputs — table style, no box cards */}
      <table className="catbl" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Parameter</th>
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr className="catrow">
            <td style={lbl}>Starting amount</td>
            <td className="num">
              <input type="number" className="ed-num" style={{ width: 120 }}
                value={principal}
                onFocus={e => e.target.select()}
                onChange={e => setPrincipal(parseFloat(e.target.value) || 0)} />
            </td>
          </tr>
          <tr className="catrow">
            <td style={lbl}>Monthly contribution</td>
            <td className="num">
              <input type="number" className="ed-num" style={{ width: 120 }}
                value={monthly}
                onFocus={e => e.target.select()}
                onChange={e => setMonthly(parseFloat(e.target.value) || 0)} />
            </td>
          </tr>
          <tr className="catrow">
            <td style={lbl}>Annual return (%)</td>
            <td className="num">
              <input type="number" step="0.1" className="ed-num" style={{ width: 120 }}
                value={rate}
                onFocus={e => e.target.select()}
                onChange={e => setRate(parseFloat(e.target.value) || 0)} />
            </td>
          </tr>
          <tr className="catrow">
            <td style={lbl}>Time horizon (years)</td>
            <td className="num">
              <input type="number" min="1" max="60" className="ed-num" style={{ width: 120 }}
                value={years}
                onFocus={e => e.target.select()}
                onChange={e => setYears(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} />
            </td>
          </tr>
          <tr className="catrow">
            <td style={lbl}>Compounding</td>
            <td className="num">
              <select value={compounding} onChange={e => setCompounding(e.target.value)} style={selStyle}>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <SoftLine data={chartData} height={220} />
    </Section>
  );
}

function NetWorthPage({ assets, setAssets, liabilities, setLiabilities, history = window.NETWORTH_HISTORY }) {
  const totalAssets      = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth         = totalAssets - totalLiabilities;

  const multiYear  = new Set(history.map((h) => h.y).filter(Boolean)).size > 1;
  const chartData  = history.map((h, i) => ({
    ...h,
    m: multiYear && h.y ? `${h.m} ’${String(h.y).slice(2)}` : h.m,
    v: i === history.length - 1 ? netWorth : h.v,
  }));
  const hasPrior   = history.length >= 2;
  const lastMonthV = hasPrior ? history[history.length - 2].v : null;
  const mom        = hasPrior ? netWorth - lastMonthV : null;
  const ytdStart   = history.length >= 5 ? history[history.length - 5].v : history[0].v;
  const ytdD       = netWorth - ytdStart;

  /* Asset operations */
  const updateAsset  = (id, patch) => setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeAsset  = (id) => setAssets((prev) => prev.filter((a) => a.id !== id));
  const addAsset     = () => setAssets((prev) => [...prev, {
    id: "a" + Math.random().toString(36).slice(2, 6),
    name: "", category: "Cash & Savings", value: 0,
  }]);

  /* Liability operations */
  const updateLiability = (id, patch) => setLiabilities((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLiability = (id) => setLiabilities((prev) => prev.filter((l) => l.id !== id));
  const addLiability    = () => setLiabilities((prev) => [...prev, {
    id: "l" + Math.random().toString(36).slice(2, 6),
    name: "", category: "Credit Card", value: 0,
  }]);

  return (
    <>
      {/* Summary strip */}
      <div className="xsum">
        <div className="xsum__cell">
          <span className="xsum__l">Net Worth</span>
          <span className={`xsum__v ${netWorth >= 0 ? "pos" : "neg"}`}>{fmt0(netWorth)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">Total Assets</span>
          <span className="xsum__v">{fmt0(totalAssets)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">Total Liabilities</span>
          <span className="xsum__v neg">{fmt0(totalLiabilities)}</span>
          <span className="xsum__sub"></span>
        </div>
        <div className="xsum__cell">
          <span className="xsum__l">vs. Last Month</span>
          <span className={`xsum__v ${!hasPrior ? "muted" : mom >= 0 ? "pos" : "neg"}`}>
            {hasPrior ? (mom >= 0 ? "+" : "") + fmt0(mom) : "—"}
          </span>
          <span className="xsum__sub"></span>
        </div>
      </div>

      <LayoutGrid id="networth">
        {/* Net Worth history — full width, at top, live data */}
        <Section tone="cream" eyebrow="History" title="Net Worth over time" titleKey="nw-history"
          className="grid__full"
          right={<span className="sec__range">12 months</span>}>
          <div className="nw">
            <div className="nw__big">
              <span className="nw__lbl">Current</span>
              <span className="nw__v">{fmt0(netWorth)}</span>
              {hasPrior && (
                <span className="nw__sub">
                  <span className={mom >= 0 ? "pos" : "neg"}>{mom >= 0 ? "+" : ""}{fmt0(mom)}</span>
                  <span className="muted"> vs. last month</span>
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
          <SoftLine data={chartData} height={180} />
        </Section>

        {/* Assets */}
        <Section tone="sage" eyebrow="Assets" title="What you own" titleKey="nw-assets"
          right={<span className="sec__total"><span className="lbl">Total</span><span className="num">{fmt0(totalAssets)}</span></span>}>
          <table className="catbl">
            <thead>
              <tr>
                <th>Account / Asset</th>
                <th>Category</th>
                <th className="num">Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="catrow">
                  <td>
                    <input className="noteinput"
                      style={{ fontWeight: 500, color: "var(--ink)" }}
                      value={a.name}
                      placeholder="Asset name"
                      onChange={(e) => updateAsset(a.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className="typesel" value={a.category}
                      onChange={(e) => updateAsset(a.id, { category: e.target.value })}>
                      {ASSET_CATS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="num">
                    <CellMoney value={a.value} onChange={(v) => updateAsset(a.id, { value: v })} />
                  </td>
                  <td>
                    <button className="rm" onClick={() => removeAsset(a.id)} title="Remove"><Icon name="x" size={10} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="catbl__ft" colSpan={2}>Total Assets</td>
                <td className="num catbl__ft">{fmt0(totalAssets)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={addAsset}>+ Add asset</button>
        </Section>

        {/* Liabilities */}
        <Section tone="clay" eyebrow="Liabilities" title="What you owe" titleKey="nw-liabilities"
          right={<span className="sec__total"><span className="lbl">Total</span><span className="num neg">{fmt0(totalLiabilities)}</span></span>}>
          <table className="catbl">
            <thead>
              <tr>
                <th>Account / Debt</th>
                <th>Category</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <tr key={l.id} className="catrow">
                  <td>
                    <input className="noteinput"
                      style={{ fontWeight: 500, color: "var(--ink)" }}
                      value={l.name}
                      placeholder="Liability name"
                      onChange={(e) => updateLiability(l.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className="typesel" value={l.category}
                      onChange={(e) => updateLiability(l.id, { category: e.target.value })}>
                      {LIAB_CATS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="num">
                    <CellMoney value={l.value} onChange={(v) => updateLiability(l.id, { value: v })} />
                  </td>
                  <td>
                    <button className="rm" onClick={() => removeLiability(l.id)} title="Remove"><Icon name="x" size={10} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="catbl__ft" colSpan={2}>Total Liabilities</td>
                <td className="num catbl__ft neg">{fmt0(totalLiabilities)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={addLiability}>+ Add liability</button>
        </Section>

        <CompoundCalculator className="grid__full" titleKey="compound-calc" initialPrincipal={
          assets.filter(a => ["Retirement", "Investments", "Crypto"].includes(a.category))
                .reduce((s, a) => s + a.value, 0)
        } />
      </LayoutGrid>
    </>
  );
}

Object.assign(window, { NetWorthPage, NW_ASSETS_SEED, NW_LIABILITIES_SEED });
