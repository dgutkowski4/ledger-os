/* Default skeleton for brand-new users — category structure with all amounts at $0.
   Returning users' saved data (localStorage) always overrides these seeds. */

const INCOME = [
  { label: "Monthly Income", amount: 0, note: "" },
];

const EXPENSES = [
  { cat: "Rent",            expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Electricity",     expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Gas",             expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Internet",        expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Phone",           expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Apartment",       expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Student Loans",   expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Groceries",       expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Transportation",  expected: 0, actual: 0, group: "need", note: "" },
  { cat: "Disc. Shopping",  expected: 0, actual: 0, group: "want", note: "" },
  { cat: "Gym Membership",  expected: 0, actual: 0, group: "want", note: "" },
  { cat: "Subscriptions",   expected: 0, actual: 0, group: "want", note: "" },
  { cat: "Dining",          expected: 0, actual: 0, group: "want", note: "" },
  { cat: "Gifts Fund",      expected: 0, actual: 0, group: "want", note: "" },
];

const SAVINGS = [
  { id: "sv1", acct: "High-Yield Savings", type: "HYSA",       perCheck: 0, target: 0, paid1: 0, paid2: 0 },
  { id: "sv2", acct: "Retirement (IRA)",   type: "Retirement", perCheck: 0, target: 0, paid1: 0, paid2: 0 },
  { id: "sv3", acct: "Brokerage",          type: "Brokerage",  perCheck: 0, target: 0, paid1: 0, paid2: 0 },
];

/* Seed history starts at the current month with $0 */
const NETWORTH_HISTORY = [
  { m: new Date().toLocaleString("en-US", { month: "short" }), v: 0 },
];

Object.assign(window, { INCOME, EXPENSES, SAVINGS, NETWORTH_HISTORY });
