/* Net Worth page — assets, liabilities, net worth calculation, and history chart.
   State is lifted to App so the dashboard chart stays in sync. */

const ASSET_CATS = ["Cash & Savings", "Investments", "Retirement", "Crypto", "Real Estate", "Other"];
const LIAB_CATS  = ["Credit Card", "Student Loan", "Mortgage", "Auto Loan", "Other"];

const NW_ASSETS_SEED = [
  { id: "a1", name: "Marcus HYSA",        category: "Cash & Savings", value: 8420.00 },
  { id: "a2", name: "Vanguard Roth IRA",  category: "Retirement",     value: 9180.50 },
  { id: "a3", name: "Fidelity Brokerage", category: "Investments",    value: 5120.20 },
  { id: "a4", name: "Coinbase Crypto",    category: "Crypto",         value: 1840.00 },
  { id: "a5", name: "Charles Schwab",     category: "Investments",    value:  640.80 },
  { id: "a6", name: "Checking",           category: "Cash & Savings", value: 4200.00 },
];

const NW_LIABILITIES_SEED = [
  { id: "l1", name: "Chase Sapphire", category: "Credit Card",  value:  284.60 },
  { id: "l2", name: "Capital One",    category: "Credit Card",  value:   82.40 },
  { id: "l3", name: "Discover",       category: "Credit Card",  value:   21.00 },
  { id: "l4", name: "Student Loans",  category: "Student Loan", value: 3235.00 },
];

function NetWorthPage({ assets, setAssets, liabilities, setLiabilities, history = window.NETWORTH_HISTORY }) {
  const totalAssets      = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth         = totalAssets - totalLiabilities;

  const chartData  = history.map((h, i) =>
    i === history.length - 1 ? { ...h, v: netWorth } : h
  );
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

      <div className="xgrid">
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
                    <button className="rm" onClick={() => removeAsset(a.id)} title="Remove">×</button>
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
                    <button className="rm" onClick={() => removeLiability(l.id)} title="Remove">×</button>
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
      </div>
    </>
  );
}

Object.assign(window, { NetWorthPage, NW_ASSETS_SEED, NW_LIABILITIES_SEED });
