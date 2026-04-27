/* App shell — tab routing, header stats, lifted ledger + month state */

const MONTHS_LIST = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function App() {
  /* Lifted ledger state — persisted to localStorage */
  const [ledgers, setLedgers] = React.useState(() =>
    lsGet("ledger_ledgers", {
      "April 2026": { expenses: window.EXPENSES.map((e) => ({ ...e })) },
    })
  );
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    lsGet("ledger_selected_month", "April 2026")
  );
  const months = Object.keys(ledgers);

  const [savings,        setSavings]        = React.useState(() => lsGet("ledger_savings",         window.SAVINGS));
  const [plannerSavings, setPlannerSavings] = React.useState(() => lsGet("ledger_planner_savings", {}));
  const [accounts,       setAccounts]       = React.useState(() => lsGet("ledger_accounts",        window.SAVINGS_ACCOUNTS));
  const [nwAssets,       setNwAssets]       = React.useState(() => lsGet("ledger_nw_assets",       window.NW_ASSETS_SEED));
  const [nwLiabilities,  setNwLiabilities]  = React.useState(() => lsGet("ledger_nw_liabilities",  window.NW_LIABILITIES_SEED));
  const [nwHistory,      setNwHistory]      = React.useState(() => lsGet("ledger_nw_history",      window.NETWORTH_HISTORY));
  const [accent,         setAccent]         = React.useState(() => lsGet("ledger_accent",          "terra"));
  const [density,        setDensity]        = React.useState(() => lsGet("ledger_density",         "relaxed"));
  const [savingsNotes, setSavingsNotes] = React.useState(() => lsGet("ledger_savings_notes", {}));
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [tab, setTab] = React.useState(() => localStorage.getItem("ledger_tab") || "dashboard");
  const [addingMonth, setAddingMonth] = React.useState(false);
  const [newMonthDraft, setNewMonthDraft] = React.useState("");

  /* Persist all state to localStorage on change */
  React.useEffect(() => { localStorage.setItem("ledger_tab",            tab);                          }, [tab]);
  React.useEffect(() => { localStorage.setItem("ledger_ledgers",        JSON.stringify(ledgers));       }, [ledgers]);
  React.useEffect(() => { localStorage.setItem("ledger_selected_month", JSON.stringify(selectedMonth)); }, [selectedMonth]);
  React.useEffect(() => { localStorage.setItem("ledger_savings",        JSON.stringify(savings));       }, [savings]);
  React.useEffect(() => { localStorage.setItem("ledger_planner_savings",JSON.stringify(plannerSavings));}, [plannerSavings]);
  React.useEffect(() => { localStorage.setItem("ledger_accounts",       JSON.stringify(accounts));      }, [accounts]);
  React.useEffect(() => { localStorage.setItem("ledger_nw_assets",      JSON.stringify(nwAssets));      }, [nwAssets]);
  React.useEffect(() => { localStorage.setItem("ledger_nw_liabilities", JSON.stringify(nwLiabilities)); }, [nwLiabilities]);
  React.useEffect(() => { localStorage.setItem("ledger_nw_history",     JSON.stringify(nwHistory));     }, [nwHistory]);
  React.useEffect(() => { localStorage.setItem("ledger_accent",         JSON.stringify(accent));        }, [accent]);
  React.useEffect(() => { localStorage.setItem("ledger_density",        JSON.stringify(density));       }, [density]);
  React.useEffect(() => { localStorage.setItem("ledger_savings_notes",  JSON.stringify(savingsNotes));  }, [savingsNotes]);
  React.useEffect(() => { window.applyAccent(accent); }, [accent]);

  /* Derived from current ledger */
  const currentLedger = ledgers[selectedMonth] || { expenses: [] };
  const expenses      = currentLedger.expenses;

  /* Short month label for section eyebrows, e.g. "APRIL" */
  const monthLabel = selectedMonth.split(" ")[0].toUpperCase();

  /* Live net worth — drives both dashboard chart and Net Worth tab */
  const liveNetWorth = nwAssets.reduce((s, a) => s + a.value, 0)
                     - nwLiabilities.reduce((s, l) => s + l.value, 0);

  /* Per-month savings paid amounts — stored inside the ledger, not in base savings.
     effectiveSavings = base savings structure merged with current month's paid amounts.
     Fallback to base savings.paid1/paid2 for initial April data (migration). */
  const monthSavingsPaid = currentLedger.savingsPaid || {};
  const effectiveSavings = savings.map((r) => ({
    ...r,
    paid1: r.id in monthSavingsPaid ? monthSavingsPaid[r.id].paid1 : r.paid1,
    paid2: r.id in monthSavingsPaid ? monthSavingsPaid[r.id].paid2 : r.paid2,
  }));

  /* Setter: structural changes → base savings; paid amounts → current ledger */
  const setEffectiveSavings = (updater) => {
    const next = typeof updater === "function" ? updater(effectiveSavings) : updater;
    setSavings(next.map((r) => ({ ...r, paid1: 0, paid2: 0 })));
    const paid = {};
    next.forEach((r) => { paid[r.id] = { paid1: r.paid1, paid2: r.paid2 }; });
    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), savingsPaid: paid },
    }));
  };

  /* Header derived totals */
  const incomeTotal  = window.INCOME.reduce((s, i) => s + i.amount, 0);
  const actualTotal  = expenses.reduce((s, e) => s + e.actual, 0);
  const leftover     = incomeTotal - actualTotal;
  const savingsTotal = effectiveSavings.reduce((s, r) => s + r.paid1 + r.paid2, 0);

  /* Delete a month — switches selection to adjacent month first */
  const deleteMonth = (key) => {
    if (!confirm(`Delete "${key}" and all its data?`)) return;
    const remaining = months.filter((m) => m !== key);
    const nextSelected = key === selectedMonth
      ? (remaining[months.indexOf(key)] || remaining[months.indexOf(key) - 1] || remaining[0])
      : selectedMonth;
    setLedgers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedMonth(nextSelected || "");
  };

  /* Add a new month — inline, no prompt.
     Snapshots current paid amounts into ledger, appends to NW history. */
  const startAddMonth = () => {
    const idx  = MONTHS_LIST.indexOf(selectedMonth.split(" ")[0]);
    const year = parseInt(selectedMonth.split(" ")[1] || "2026", 10);
    const suggested = idx === -1 ? "" :
      idx === 11 ? `January ${year + 1}` : `${MONTHS_LIST[idx + 1]} ${year}`;
    setNewMonthDraft(suggested);
    setAddingMonth(true);
  };

  const commitNewMonth = () => {
    setAddingMonth(false);
    const key = newMonthDraft.trim();
    setNewMonthDraft("");
    if (!key) return;
    if (ledgers[key]) { setSelectedMonth(key); return; }

    /* Snapshot current month's paid amounts into ledger before switching */
    const snapshotPaid = {};
    effectiveSavings.forEach((r) => { snapshotPaid[r.id] = { paid1: r.paid1, paid2: r.paid2 }; });

    /* Append new NW history entry for the new month */
    const newMonthShort = key.split(" ")[0].slice(0, 3);
    setNwHistory((prev) => {
      /* Replace last point (current) with live value, then add new blank entry */
      const updated = prev.map((h, i) => i === prev.length - 1 ? { ...h, v: liveNetWorth } : h);
      return [...updated, { m: newMonthShort, v: liveNetWorth }];
    });

    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), savingsPaid: snapshotPaid },
      [key]: { expenses: expenses.map((e) => ({ ...e, actual: 0 })), savingsPaid: {} },
    }));
    /* Clear base savings paid amounts now that they're in the ledger */
    setSavings((prev) => prev.map((r) => ({ ...r, paid1: 0, paid2: 0 })));
    setSelectedMonth(key);
  };

  const tabLabel = {
    dashboard: "Dashboard",
    expenses:  "Monthly Expenses",
    savings:   "Savings & Investments",
    networth:  "Net Worth",
  };

  return (
    <div className={`page density-${density}`}>
      {/* Page header */}
      <header className="pagehd">
        <div className="pagehd__l">
          <span className="pagehd__eyebrow"></span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PixelSprite />
            <h1 className="pagehd__title">{tabLabel[tab]}</h1>
          </div>
        </div>
        <div className="pagehd__r">
          <div className="pagehd__stat">
            <span className="l">Income</span>
            <span className="v num">{fmt0(incomeTotal)}</span>
          </div>
          <div className="pagehd__stat">
            <span className="l">Spent</span>
            <span className="v num">{fmt0(actualTotal)}</span>
          </div>
          <div className="pagehd__stat">
            <span className="l">Saved &amp; Invested</span>
            <span className="v num">{fmt0(savingsTotal)}</span>
          </div>
          <div className="pagehd__stat">
            <span className="l">Leftover</span>
            <span className={`v num ${leftover >= 0 ? "pos" : "neg"}`}>{fmt0(leftover)}</span>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="tabs">
        {[
          { k: "dashboard", l: "Dashboard" },
          { k: "expenses",  l: "Expenses"  },
          { k: "savings",   l: "Savings"   },
          { k: "networth",  l: "Net Worth" },
        ].map((t) => (
          <button key={t.k}
            className={`tabs__b ${tab === t.k ? "is-on" : ""}`}
            onClick={() => setTab(t.k)}>
            {t.l}
          </button>
        ))}
        <button
          className="tabs__b"
          style={{ marginLeft: "auto" }}
          onClick={() => setTweaksOpen((v) => !v)}
          title="Tweaks">
          ⚙
        </button>
      </nav>

      {/* Shared month selector — all tabs except Net Worth */}
      {tab !== "networth" && (
        <div className="xbar">
          <div className="xbar__l">
            <span className="xbar__lbl">Month</span>
            <div className="month-chips">
              {months.map((m) => (
                <span key={m} className={`month-chip ${m === selectedMonth ? "is-on" : ""}`}>
                  <button className="month-chip__label" onClick={() => setSelectedMonth(m)}>
                    {m.split(" ")[0]}
                  </button>
                  {months.length > 1 && (
                    <button className="month-chip__del" onClick={() => deleteMonth(m)} title={`Delete ${m}`}>×</button>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="xbar__r">
            {addingMonth ? (
              <input
                className="month-chip-input"
                autoFocus
                value={newMonthDraft}
                placeholder="e.g. May 2026"
                onChange={(e) => setNewMonthDraft(e.target.value)}
                onBlur={commitNewMonth}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNewMonth();
                  if (e.key === "Escape") { setAddingMonth(false); setNewMonthDraft(""); }
                }}
              />
            ) : (
              <button className="btn-ghost" onClick={startAddMonth}>+ New Month</button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard */}
      {tab === "dashboard" && (
        <div className="grid">
          <div className="grid__full">
            <NetWorthSection history={nwHistory} netWorth={liveNetWorth} month={monthLabel} />
          </div>
          <SpendBreakdownSection expenses={expenses} month={monthLabel} />
          <AllocationSection savings={effectiveSavings} month={monthLabel} />
          <div className="grid__full">
            <PayDayPlanner
              month={monthLabel}
              savingsRows={savings}
              plannerSavings={plannerSavings}
              setPlannerSavings={setPlannerSavings} />
          </div>
        </div>
      )}

      {/* Expenses tab */}
      {tab === "expenses" && (
        <ExpensesPage
          ledgers={ledgers}
          setLedgers={setLedgers}
          selectedMonth={selectedMonth}
          income={incomeTotal} />
      )}

      {/* Savings tab */}
      {tab === "savings" && (
        <SavingsPage
          accounts={accounts} setAccounts={setAccounts}
          savings={effectiveSavings} setSavings={setEffectiveSavings}
          month={monthLabel}
          selectedMonth={selectedMonth}
          savingsNotes={savingsNotes} setSavingsNotes={setSavingsNotes} />
      )}

      {/* Net Worth tab */}
      {tab === "networth" && (
        <NetWorthPage
          assets={nwAssets}           setAssets={setNwAssets}
          liabilities={nwLiabilities} setLiabilities={setNwLiabilities}
          history={nwHistory} />
      )}

      {/* Tweaks panel */}
      {tweaksOpen && (
        <TweaksPanel
          accent={accent}   setAccent={setAccent}
          density={density} setDensity={setDensity}
          onClose={() => setTweaksOpen(false)} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
