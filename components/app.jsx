/* App shell — tab routing, header stats, lifted ledger + month state */

const MONTHS_LIST = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* New users start on the current calendar month */
const DEFAULT_MONTH = `${MONTHS_LIST[new Date().getMonth()]} ${new Date().getFullYear()}`;

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

/* Ensure every expense row has a stable id and every month has income rows.
   Older saved data (and the seed) identified rows by category name only. */
function migrateLedgers(ledgers) {
  const out = {};
  Object.entries(ledgers).forEach(([month, ledger]) => {
    out[month] = {
      ...ledger,
      expenses: (ledger.expenses || []).map((e) => (e.id ? e : { ...e, id: uid("e") })),
      income: ledger.income || window.INCOME.map((i) => ({ ...i, id: uid("i") })),
    };
  });
  return out;
}

function App() {
  /* Lifted ledger state — persisted to localStorage */
  const [ledgers, setLedgers] = React.useState(() =>
    migrateLedgers(lsGet("ledger_ledgers", {
      [DEFAULT_MONTH]: { expenses: window.EXPENSES.map((e) => ({ ...e })) },
    }))
  );
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    lsGet("ledger_selected_month", DEFAULT_MONTH)
  );
  const months = Object.keys(ledgers);
  const activeMonths   = months.filter((m) => !ledgers[m]?.archived);
  const archivedMonths = months.filter((m) => ledgers[m]?.archived);
  const [archOpen, setArchOpen] = React.useState(false);
  const archRef = React.useRef(null);

  React.useEffect(() => {
    if (!archOpen) return;
    const handler = (e) => { if (!archRef.current?.contains(e.target)) setArchOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [archOpen]);

  /* Chip labels show the year once more than one year is in play, e.g. "Jul ’27" */
  const chipYears = new Set(
    activeMonths.concat(ledgers[selectedMonth]?.archived ? [selectedMonth] : [])
      .map((m) => m.split(" ")[1]).filter(Boolean)
  );
  const chipLabel = (m) => {
    const [name, year] = m.split(" ");
    return chipYears.size > 1 && year ? `${name.slice(0, 3)} ’${year.slice(2)}` : name;
  };

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
  const [nwAssets,       setNwAssets]       = React.useState(() => lsGet("ledger_nw_assets",       window.NW_ASSETS_SEED));
  const [nwLiabilities,  setNwLiabilities]  = React.useState(() => lsGet("ledger_nw_liabilities",  window.NW_LIABILITIES_SEED));
  const [nwHistory,      setNwHistory]      = React.useState(() =>
    lsGet("ledger_nw_history", window.NETWORTH_HISTORY).filter((h) => MONTHS_SHORT.includes(h.m))
  );
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
  React.useEffect(() => { localStorage.setItem("ledger_nw_assets",      JSON.stringify(nwAssets));      }, [nwAssets]);
  React.useEffect(() => { localStorage.setItem("ledger_nw_liabilities", JSON.stringify(nwLiabilities)); }, [nwLiabilities]);
  React.useEffect(() => { localStorage.setItem("ledger_nw_history",     JSON.stringify(nwHistory));     }, [nwHistory]);
  React.useEffect(() => { localStorage.setItem("ledger_density",        JSON.stringify(density));       }, [density]);
  React.useEffect(() => { localStorage.setItem("ledger_savings_notes",  JSON.stringify(savingsNotes));  }, [savingsNotes]);

  /* Derived from current ledger */
  const currentLedger = ledgers[selectedMonth] || { expenses: [] };
  const expenses      = currentLedger.expenses;
  const incomeRows    = currentLedger.income || [];

  /* Undo / redo for the Expenses tab — each snapshot covers expense rows AND income rows */
  const expHistoryRef = React.useRef([{ expenses, income: incomeRows }]);
  const [expHistoryIdx, setExpHistoryIdx] = React.useState(0);
  React.useEffect(() => { expHistoryRef.current = [{ expenses, income: incomeRows }]; setExpHistoryIdx(0); }, [selectedMonth]);

  const applyExpSnapshot = (snap) => {
    const stack = expHistoryRef.current.slice(0, expHistoryIdx + 1).concat([snap]);
    expHistoryRef.current = stack;
    setExpHistoryIdx(stack.length - 1);
    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: snap.expenses, income: snap.income },
    }));
  };

  const applyExpenses = (next) => applyExpSnapshot({ expenses: next, income: incomeRows });
  const applyIncome = (rowsOrFn) => {
    const next = typeof rowsOrFn === "function" ? rowsOrFn(incomeRows) : rowsOrFn;
    applyExpSnapshot({ expenses, income: next });
  };

  const undoExpenses = React.useCallback(() => {
    const h = expHistoryRef.current;
    if (expHistoryIdx <= 0) return;
    const idx = expHistoryIdx - 1;
    setExpHistoryIdx(idx);
    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: h[idx].expenses, income: h[idx].income },
    }));
  }, [expHistoryIdx, selectedMonth]);

  const redoExpenses = React.useCallback(() => {
    const h = expHistoryRef.current;
    if (expHistoryIdx >= h.length - 1) return;
    const idx = expHistoryIdx + 1;
    setExpHistoryIdx(idx);
    setLedgers((prev) => ({
      ...prev,
      [selectedMonth]: { ...(prev[selectedMonth] || { expenses: [] }), expenses: h[idx].expenses, income: h[idx].income },
    }));
  }, [expHistoryIdx, selectedMonth]);

  const canUndo = expHistoryIdx > 0;
  const canRedo = expHistoryIdx < expHistoryRef.current.length - 1;

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

  /* Keyboard undo/redo — declared after all undo/redo callbacks exist */
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

  /* Header derived totals — income is per-month, stored in the ledger */
  const incomeTotal  = incomeRows.reduce((s, i) => s + i.amount, 0);
  const actualTotal  = expenses.reduce((s, e) => s + e.actual, 0);
  const leftover     = incomeTotal - actualTotal;
  const savingsTotal = effectiveSavings.reduce((s, r) => s + r.paid1 + r.paid2, 0);

  /* Archive / restore — archived months keep their data (and stay in exports)
     but leave the chip bar; they live in the "Archived" dropdown. */
  const archiveMonth = (key) => {
    setLedgers((prev) => ({ ...prev, [key]: { ...(prev[key] || { expenses: [] }), archived: true } }));
    if (key === selectedMonth) {
      const nextActive = activeMonths.filter((m) => m !== key);
      if (nextActive.length) setSelectedMonth(nextActive[nextActive.length - 1]);
    }
  };
  const unarchiveMonth = (key) => {
    setLedgers((prev) => ({ ...prev, [key]: { ...(prev[key] || { expenses: [] }), archived: false } }));
  };

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
      [key]: {
        expenses: expenses.map((e) => ({ ...e, actual: 0 })),
        income: incomeRows.map((r) => ({ ...r })),
        savingsPaid: {},
        savingsTargets: snapshotTargets,
      },
    }));
    /* Clear base savings paid amounts now that they're in the ledger */
    setSavings((prev) => prev.map((r) => ({ ...r, paid1: 0, paid2: 0 })));
    setSelectedMonth(key);
  };

  /* Goes through applyExpenses so an imported batch is a single undoable step */
  const handleCategorizerSave = (txns) => {
    const totals = {};
    txns.filter(t => t.confirmedCategory).forEach(t => {
      totals[t.confirmedCategory] = (totals[t.confirmedCategory] || 0) + t.amount;
    });
    const matched = new Set();
    const updated = expenses.map((e) => {
      if (e.cat in totals) { matched.add(e.cat); return { ...e, actual: (e.actual || 0) + totals[e.cat] }; }
      return e;
    });
    const newRows = Object.entries(totals)
      .filter(([cat]) => !matched.has(cat))
      .map(([cat, actual]) => ({ id: uid("e"), cat, expected: 0, actual, group: "want", note: "imported" }));
    applyExpenses([...updated, ...newRows]);
    setTab("expenses");
  };

  /* Everything the export helpers need, in one place */
  const exportCtx = {
    ledgers, selectedMonth,
    savings: effectiveSavings,
    assets: nwAssets, liabilities: nwLiabilities, history: nwHistory,
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
          <AuthWidget />
          <button
            className="tabs__b"
            onClick={() => setTweaksOpen((v) => !v)}
            title="Tweaks">
            ⚙
          </button>
        </div>
      </nav>

      {/* Toolbar — month selector + undo/redo for all tabs */}
      <div className="xbar">
        <div className="xbar__l">
          {tab !== "networth" && (<>
            <span className="xbar__lbl">Month</span>
            <div className="month-chips">
              {activeMonths.map((m) => (
                <span key={m} className={`month-chip ${m === selectedMonth ? "is-on" : ""}`}>
                  <button className="month-chip__label" onClick={() => setSelectedMonth(m)} title={m}>
                    {chipLabel(m)}
                  </button>
                  <button className="month-chip__del" onClick={() => archiveMonth(m)} title={`Archive ${m}`}>⊟</button>
                  {months.length > 1 && (
                    <button className="month-chip__del" onClick={() => deleteMonth(m)} title={`Delete ${m}`}>×</button>
                  )}
                </span>
              ))}
              {ledgers[selectedMonth]?.archived && (
                <span className="month-chip is-on month-chip--arch">
                  <button className="month-chip__label" title={`${selectedMonth} (archived)`}>{chipLabel(selectedMonth)}</button>
                  <button className="month-chip__del" style={{ opacity: 0.7 }}
                    onClick={() => unarchiveMonth(selectedMonth)} title={`Restore ${selectedMonth}`}>↺</button>
                </span>
              )}
              {archivedMonths.length > 0 && (
                <div className="arch" ref={archRef}>
                  <button className="month-chip month-chip--ghost" onClick={() => setArchOpen((o) => !o)}>
                    Archived ({archivedMonths.length}) ▾
                  </button>
                  {archOpen && (
                    <div className="arch-pop">
                      {archivedMonths.map((m) => (
                        <div key={m} className="arch-row">
                          <button className="arch-name" onClick={() => { setSelectedMonth(m); setArchOpen(false); }}>{m}</button>
                          <button className="arch-act" title={`Restore ${m}`} onClick={() => unarchiveMonth(m)}>↺</button>
                          <button className="arch-act arch-act--del" title={`Delete ${m}`} onClick={() => deleteMonth(m)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
          {["dashboard", "expenses", "savings", "networth"].includes(tab) && (
            <button className="btn-ghost" onClick={() => downloadTabCSV(tab, exportCtx)}
              title="Download this tab's data as CSV">⬇ CSV</button>
          )}
          <button className="btn-ghost" onClick={() => downloadAllXLSX(exportCtx)}
            title="Download all data as an Excel workbook">⬇ All (.xlsx)</button>
          {tab !== "networth" && (addingMonth ? (
            <input
              className="month-chip-input"
              autoFocus
              value={newMonthDraft}
              placeholder="e.g. May 2026"
              onChange={(e) => setNewMonthDraft(e.target.value)}
              onBlur={() => { setAddingMonth(false); setNewMonthDraft(""); }}
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
          incomeRows={incomeRows}
          setIncomeRows={applyIncome}
          applyExpenses={applyExpenses}
          undo={undoExpenses}
          redo={redoExpenses}
          canUndo={canUndo}
          canRedo={canRedo} />
      )}

      {/* Savings tab */}
      {tab === "savings" && (
        <SavingsPage
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
          density={density} setDensity={setDensity}
          onClose={() => setTweaksOpen(false)} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
