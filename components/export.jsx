/* Data export — per-tab CSV downloads + all-data XLSX workbook (SheetJS). */

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(rows) { return rows.map((r) => r.map(csvCell).join(",")).join("\n"); }

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const slug = (s) => s.replace(/\s+/g, "-").toLowerCase();

/* ── Sheet builders — each returns array-of-arrays including a header row ── */

function rowsExpensesAllMonths(ledgers) {
  const rows = [["Month", "Category", "Group", "Note", "Budgeted", "Actual"]];
  Object.entries(ledgers).forEach(([month, l]) =>
    (l.expenses || []).forEach((e) =>
      rows.push([month, e.cat, e.group, e.note || "", e.expected || 0, e.actual || 0])));
  return rows;
}

function rowsIncomeAllMonths(ledgers) {
  const rows = [["Month", "Source", "Note", "Amount"]];
  Object.entries(ledgers).forEach(([month, l]) =>
    (l.income || []).forEach((i) =>
      rows.push([month, i.label, i.note || "", i.amount || 0])));
  return rows;
}

function rowsSavingsAllMonths(ledgers, savings) {
  const rows = [["Month", "Account", "Type", "Target", "Paid 1", "Paid 2"]];
  Object.entries(ledgers).forEach(([month, l]) => {
    const paid = l.savingsPaid || {}, targets = l.savingsTargets || {};
    savings.forEach((r) => rows.push([
      month, r.acct, r.type || "",
      (r.id in targets ? targets[r.id] : r.target) || 0,
      paid[r.id]?.paid1 || 0,
      paid[r.id]?.paid2 || 0,
    ]));
  });
  return rows;
}

function rowsNetWorth(assets, liabilities) {
  const rows = [["Kind", "Name", "Category", "Value"]];
  assets.forEach((a) => rows.push(["Asset", a.name, a.category, a.value || 0]));
  liabilities.forEach((l) => rows.push(["Liability", l.name, l.category, l.value || 0]));
  return rows;
}

function rowsNwHistory(history) {
  return [["Month", "Net Worth"], ...history.map((h) => [h.y ? `${h.m} ${h.y}` : h.m, h.v || 0])];
}

function rowsTransactionsAllMonths(ledgers) {
  const rows = [["Month", "Date", "Description", "Category", "Card", "Amount"]];
  Object.entries(ledgers).forEach(([month, l]) =>
    (l.transactions || []).forEach((t) =>
      rows.push([month, t.date || "", t.description || "", t.category || "", t.card || "", t.amount || 0])));
  return rows;
}

/* ── Per-tab CSV — exports what the active tab shows ── */
function downloadTabCSV(tab, ctx) {
  const { ledgers, selectedMonth, savings, assets, liabilities, history } = ctx;
  const ledger = ledgers[selectedMonth] || {};
  const blocks = [];
  let name = `ledger-${tab}.csv`;

  if (tab === "expenses" || tab === "dashboard") {
    blocks.push([
      ["Category", "Group", "Note", "Budgeted", "Actual"],
      ...(ledger.expenses || []).map((e) => [e.cat, e.group, e.note || "", e.expected || 0, e.actual || 0]),
    ]);
    blocks.push([
      ["Income Source", "Note", "Amount"],
      ...(ledger.income || []).map((i) => [i.label, i.note || "", i.amount || 0]),
    ]);
    if ((ledger.transactions || []).length) {
      blocks.push([
        ["Date", "Description", "Category", "Card", "Amount"],
        ...ledger.transactions.map((t) => [t.date || "", t.description || "", t.category || "", t.card || "", t.amount || 0]),
      ]);
    }
    name = `ledger-expenses-${slug(selectedMonth)}.csv`;
  } else if (tab === "savings") {
    blocks.push([
      ["Account", "Type", "Target", "Paid 1", "Paid 2"],
      ...savings.map((r) => [r.acct, r.type || "", r.target || 0, r.paid1 || 0, r.paid2 || 0]),
    ]);
    name = `ledger-savings-${slug(selectedMonth)}.csv`;
  } else if (tab === "networth") {
    blocks.push(rowsNetWorth(assets, liabilities));
    blocks.push(rowsNwHistory(history));
    name = "ledger-networth.csv";
  } else {
    return;
  }
  downloadFile(name, blocks.map(toCSV).join("\n\n"), "text/csv;charset=utf-8");
}

/* ── All data — one .xlsx workbook, a sheet per domain ── */
function downloadAllXLSX(ctx) {
  const { ledgers, savings, assets, liabilities, history } = ctx;
  if (typeof XLSX === "undefined") {
    window.toast
      ? toast("Spreadsheet library not loaded — check your connection and reload", "danger")
      : alert("Spreadsheet library not loaded — check your connection and reload.");
    return;
  }
  const sheets = [
    ["Expenses",     rowsExpensesAllMonths(ledgers)],
    ["Income",       rowsIncomeAllMonths(ledgers)],
    ["Transactions", rowsTransactionsAllMonths(ledgers)],
    ["Savings",      rowsSavingsAllMonths(ledgers, savings)],
    ["Net Worth",    rowsNetWorth(assets, liabilities)],
    ["NW History",   rowsNwHistory(history)],
  ];
  const wb = XLSX.utils.book_new();
  sheets.forEach(([sheetName, rows]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName));
  XLSX.writeFile(wb, "ledger-data.xlsx");
}

Object.assign(window, { downloadFile, downloadTabCSV, downloadAllXLSX });
