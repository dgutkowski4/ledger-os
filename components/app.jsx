/* App shell — tab routing, header stats, lifted ledger + month state */

const MONTHS_LIST = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  const [allPlannerSavings, setAllPlannerSavings] = React.useState(() => lsGet("ledger_planner_savings", {}));
  const plannerSavings = allPlannerSavings[selectedMonth] || {};
  const setPlannerSavings = React.useCallback((updater) => {
    setAllPlannerSavings((prev) => {
      const cur = prev[selectedMonth] || {};
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, [selectedMonth]: next };
    });
  }, [selectedMonth]);
  const [accounts,       setAccounts]       = React.useState(() => lsGet("ledger_accounts",        window.SAVINGS_ACCOUNTS));
  const [nwAssets,       setNwAssets]       = React.useState(() => lsGet("ledger_nw_assets",       window.NW_ASSETS_SEED));
  const [nwLiabilities,  setNwLiabilities]  = React.useState(() => lsGet("ledger_nw_liabilities",  window.NW_LIABILITIES_SEED));
  const [nwHistory,      setNwHistory]      = React.useState(() =>
    lsGet("ledger_nw_history", window.NETWORTH_HISTORY).filter((h) => MONTHS_SHORT.includes(h.m))
  );
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
  React.useEffect(() => { localStorage.setItem("ledger_planner_savings",JSON.stringify(allPlannerSavings));}, [allPlannerSavings]);
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

  /* Undo / redo for expenses — lifted here so xbar buttons can reach it */
  const expHistoryRef = React.useRef([expenses]);
  const [expHistoryIdx, setExpHistoryIdx] = React.useState(0);
  React.useEffect(() => { expHistoryRef.current = [expenses]; setExpHistoryIdx(0); }, [selectedMonth]);

  const applyExpenses = (next) => {
    const stack = expHistoryRef.current.slice(0, expHistoryIdx + 1).concat([next]);
    expHistoryRef.current = stack;
    setExpHistoryIdx(stack.length - 1);
    setLedgers((prev) => ({ ...prev, [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: next } }));
  };

  const undoExpenses = React.useCallback(() => {
    const h = expHistoryRef.current;
    if (expHistoryIdx <= 0) return;
    const idx = expHistoryIdx - 1;
    setExpHistoryIdx(idx);
    setLedgers((prev) => ({ ...prev, [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: h[idx] } }));
  }, [expHistoryIdx, selectedMonth]);

  const redoExpenses = React.useCallback(() => {
    const h = expHistoryRef.current;
    if (expHistoryIdx >= h.length - 1) return;
    const idx = expHistoryIdx + 1;
    setExpHistoryIdx(idx);
    setLedgers((prev) => ({ ...prev, [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: h[idx] } }));
  }, [expHistoryIdx, selectedMonth]);

  const canUndo = expHistoryIdx > 0;
  const canRedo = expHistoryIdx < expHistoryRef.current.length - 1;

  React.useEffect(() => {
    const undoFn = tab === "savings" ? undoSavings : tab === "networth" ? undoNw : undoExpenses;
    const redoFn = tab === "savings" ? redoSavings : tab === "networth" ? redoNw : redoExpenses;
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoFn(); }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redoFn(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoExpenses, redoExpenses, undoSavings, redoSavings, undoNw, redoNw, tab]);

  /* Short month label for section eyebrows, e.g. "APRIL" */
  const monthLabel = selectedMonth.split(" ")[0].toUpperCase();

  /* Live net worth — drives both dashboard chart and Net Worth tab */
  const liveNetWorth = nwAssets.reduce((s, a) => s + a.value, 0)
                     - nwLiabilities.reduce((s, l) => s + l.value, 0);

  /* Per-month savings paid amounts + targets — stored inside the ledger, not in base savings. */
  const monthSavingsPaid    = currentLedger.savingsPaid    || {};
  const monthSavingsTargets = currentLedger.savingsTargets || {};
  const effectiveSavings = savings.map((r) => ({
    ...r,
    paid1:  r.id in monthSavingsPaid    ? monthSavingsPaid[r.id].paid1  : r.paid1,
    paid2:  r.id in monthSavingsPaid    ? monthSavingsPaid[r.id].paid2  : r.paid2,
    target: r.id in monthSavingsTargets ? monthSavingsTargets[r.id]     : r.target,
  }));

  /* Setter: structural changes → base savings; paid + targets → current ledger */
  const setEffectiveSavings = (updater) => {
    const next = typeof updater === "function" ? updater(effectiveSavings) : updater;
    setSavings(next.map((r) => ({ ...r, paid1: 0, paid2: 0 })));
    const paid = {}, targets = {};
    next.forEach((r) => {
      paid[r.id]    = { paid1: r.paid1, paid2: r.paid2 };
      targets[r.id] = r.target;
    });
    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), savingsPaid: paid, savingsTargets: targets },
    }));
  };

  /* Undo / redo for savings */
  const savHistoryRef = React.useRef([effectiveSavings]);
  const [savHistoryIdx, setSavHistoryIdx] = React.useState(0);
  React.useEffect(() => { savHistoryRef.current = [effectiveSavings]; setSavHistoryIdx(0); }, [selectedMonth]);

  const applySavings = (nextOrFn) => {
    const next = typeof nextOrFn === "function" ? nextOrFn(effectiveSavings) : nextOrFn;
    const stack = savHistoryRef.current.slice(0, savHistoryIdx + 1).concat([next]);
    savHistoryRef.current = stack;
    setSavHistoryIdx(stack.length - 1);
    setEffectiveSavings(next);
  };

  const undoSavings = React.useCallback(() => {
    const h = savHistoryRef.current;
    if (savHistoryIdx <= 0) return;
    const idx = savHistoryIdx - 1;
    setSavHistoryIdx(idx);
    setEffectiveSavings(h[idx]);
  }, [savHistoryIdx, selectedMonth]);

  const redoSavings = React.useCallback(() => {
    const h = savHistoryRef.current;
    if (savHistoryIdx >= h.length - 1) return;
    const idx = savHistoryIdx + 1;
    setSavHistoryIdx(idx);
    setEffectiveSavings(h[idx]);
  }, [savHistoryIdx, selectedMonth]);

  const canSavUndo = savHistoryIdx > 0;
  const canSavRedo = savHistoryIdx < savHistoryRef.current.length - 1;

  /* Undo / redo for Net Worth (assets + liabilities tracked together) */
  const nwEditHistoryRef = React.useRef([{ assets: nwAssets, liabilities: nwLiabilities }]);
  const [nwEditHistoryIdx, setNwEditHistoryIdx] = React.useState(0);

  const applyNwAssets = (assetsOrFn) => {
    const assets = typeof assetsOrFn === "function" ? assetsOrFn(nwAssets) : assetsOrFn;
    const snap = { assets, liabilities: nwLiabilities };
    const stack = nwEditHistoryRef.current.slice(0, nwEditHistoryIdx + 1).concat([snap]);
    nwEditHistoryRef.current = stack;
    setNwEditHistoryIdx(stack.length - 1);
    setNwAssets(assets);
  };

  const applyNwLiabilities = (liabsOrFn) => {
    const liabilities = typeof liabsOrFn === "function" ? liabsOrFn(nwLiabilities) : liabsOrFn;
    const snap = { assets: nwAssets, liabilities };
    const stack = nwEditHistoryRef.current.slice(0, nwEditHistoryIdx + 1).concat([snap]);
    nwEditHistoryRef.current = stack;
    setNwEditHistoryIdx(stack.length - 1);
    setNwLiabilities(liabilities);
  };

  const undoNw = React.useCallback(() => {
    const h = nwEditHistoryRef.current;
    if (nwEditHistoryIdx <= 0) return;
    const idx = nwEditHistoryIdx - 1;
    setNwEditHistoryIdx(idx);
    setNwAssets(h[idx].assets);
    setNwLiabilities(h[idx].liabilities);
  }, [nwEditHistoryIdx]);

  const redoNw = React.useCallback(() => {
    const h = nwEditHistoryRef.current;
    if (nwEditHistoryIdx >= h.length - 1) return;
    const idx = nwEditHistoryIdx + 1;
    setNwEditHistoryIdx(idx);
    setNwAssets(h[idx].assets);
    setNwLiabilities(h[idx].liabilities);
  }, [nwEditHistoryIdx]);

  const canNwUndo = nwEditHistoryIdx > 0;
  const canNwRedo = nwEditHistoryIdx < nwEditHistoryRef.current.length - 1;

  /* Header derived totals */
  const incomeTotal  = window.INCOME.reduce((s, i) => s + i.amount, 0);
  const actualTotal  = expenses.reduce((s, e) => s + e.actual, 0);
  const leftover     = incomeTotal - actualTotal;
  const savingsTotal = effectiveSavings.reduce((s, r) => s + r.paid1 + r.paid2, 0);

  /* Delete a month — switches selection to adjacent month first, removes NW history entry */
  const deleteMonth = (key) => {
    if (!confirm(`Delete "${key}" and all its data?`)) return;
    const remaining = months.filter((m) => m !== key);
    const nextSelected = key === selectedMonth
      ? (remaining[months.indexOf(key)] || remaining[months.indexOf(key) - 1] || remaining[0])
      : selectedMonth;
    const shortLabel = key.split(" ")[0].slice(0, 3);
    setNwHistory((prev) => {
      const idx = prev.findLastIndex((h) => h.m === shortLabel);
      if (idx === -1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
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

    /* Snapshot current month's paid amounts + targets into ledger before switching */
    const snapshotPaid = {}, snapshotTargets = {};
    effectiveSavings.forEach((r) => {
      snapshotPaid[r.id]    = { paid1: r.paid1, paid2: r.paid2 };
      snapshotTargets[r.id] = r.target;
    });

    /* Append new NW history entry for the new month */
    const newMonthShort = key.split(" ")[0].slice(0, 3);
    setNwHistory((prev) => {
      /* Replace last point (current) with live value, then add new blank entry */
      const updated = prev.map((h, i) => i === prev.length - 1 ? { ...h, v: liveNetWorth } : h);
      return [...updated, { m: newMonthShort, v: liveNetWorth }];
    });

    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), savingsPaid: snapshotPaid, savingsTargets: snapshotTargets },
      [key]: { expenses: expenses.map((e) => ({ ...e, actual: 0 })), savingsPaid: {}, savingsTargets: snapshotTargets },
    }));
    /* Clear base savings paid amounts now that they're in the ledger */
    setSavings((prev) => prev.map((r) => ({ ...r, paid1: 0, paid2: 0 })));
    setSelectedMonth(key);
  };

  const handleCategorizerSave = (txns) => {
    const totals = {};
    txns.filter(t => t.confirmedCategory).forEach(t => {
      totals[t.confirmedCategory] = (totals[t.confirmedCategory] || 0) + t.amount;
    });
    setLedgers((prev) => {
      const ledger = prev[selectedMonth] || { expenses: [] };
      const matched = new Set();
      const updated = ledger.expenses.map((e) => {
        if (e.cat in totals) { matched.add(e.cat); return { ...e, actual: (e.actual || 0) + totals[e.cat] }; }
        return e;
      });
      const newRows = Object.entries(totals)
        .filter(([cat]) => !matched.has(cat))
        .map(([cat, actual]) => ({ cat, expected: 0, actual, group: "want", note: "imported" }));
      return { ...prev, [selectedMonth]: { ...ledger, expenses: [...updated, ...newRows] } };
    });
    setTab("expenses");
  };

  const tabLabel = {
    dashboard:   "Dashboard",
    expenses:    "Monthly Expenses",
    savings:     "Savings & Investments",
    networth:    "Net Worth",
    categorizer: "Expense Categorizer",
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
          { k: "categorizer", l: "Categorizer" },
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

      {/* Toolbar — month selector + undo/redo for all tabs */}
      <div className="xbar">
        <div className="xbar__l">
          {tab !== "networth" && (<>
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
          </>)}
        </div>
        <div className="xbar__r" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(() => {
            const u = tab === "savings" ? undoSavings : tab === "networth" ? undoNw : undoExpenses;
            const r = tab === "savings" ? redoSavings : tab === "networth" ? redoNw : redoExpenses;
            const cu = tab === "savings" ? canSavUndo : tab === "networth" ? canNwUndo : canUndo;
            const cr = tab === "savings" ? canSavRedo : tab === "networth" ? canNwRedo : canRedo;
            return (<>
              <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 12px", opacity: cu ? 1 : 0.4 }}
                disabled={!cu} onClick={u} title="Undo (⌘Z)">↩ Undo</button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 12px", opacity: cr ? 1 : 0.4 }}
                disabled={!cr} onClick={r} title="Redo (⌘⇧Z)">↪ Redo</button>
            </>);
          })()}
          {tab !== "networth" && (addingMonth ? (
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
          ))}
        </div>
      </div>

      {/* Dashboard */}
      {tab === "dashboard" && (
        <LayoutGrid id="dashboard" cols="1.2fr 1fr">
          <div key="dash-nw" className="grid__full">
            <NetWorthSection history={nwHistory} netWorth={liveNetWorth} month={monthLabel} />
          </div>
          <SpendBreakdownSection key="dash-spend" expenses={expenses} month={monthLabel} />
          <AllocationSection key="dash-alloc" savings={effectiveSavings} month={monthLabel} />
          <div key="dash-planner" className="grid__full">
            <PayDayPlanner
              key={selectedMonth}
              month={monthLabel}
              selectedMonth={selectedMonth}
              savingsRows={savings}
              plannerSavings={plannerSavings}
              setPlannerSavings={setPlannerSavings} />
          </div>
        </LayoutGrid>
      )}

      {/* Expenses tab */}
      {tab === "expenses" && (
        <ExpensesPage
          ledgers={ledgers}
          setLedgers={setLedgers}
          selectedMonth={selectedMonth}
          income={incomeTotal}
          applyExpenses={applyExpenses}
          undo={undoExpenses}
          redo={redoExpenses}
          canUndo={canUndo}
          canRedo={canRedo} />
      )}

      {/* Savings tab */}
      {tab === "savings" && (
        <SavingsPage
          accounts={accounts} setAccounts={setAccounts}
          savings={effectiveSavings} setSavings={applySavings}
          month={monthLabel}
          selectedMonth={selectedMonth}
          savingsNotes={savingsNotes} setSavingsNotes={setSavingsNotes} />
      )}

      {/* Categorizer tab */}
      {tab === "categorizer" && (
        <ExpenseCategorizer onSave={handleCategorizerSave} />
      )}

      {/* Net Worth tab */}
      {tab === "networth" && (
        <NetWorthPage
          assets={nwAssets}           setAssets={applyNwAssets}
          liabilities={nwLiabilities} setLiabilities={applyNwLiabilities}
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
