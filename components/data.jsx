/* Seed data modeled on the user's spreadsheet. */

const INCOME = [
  { label: "Monthly Income",   amount: 4070.00, note: "" },
  { label: "HYSA Interest",    amount:   70.00, note: "" },
];

const EXPENSES = [
  { cat: "Rent",            expected: 1160.00, actual: 1160.00, group: "need", note: "145 W 27th" },
  { cat: "Electricity",     expected:   50.00, actual:   48.30, group: "need", note: "Con Ed" },
  { cat: "Gas",             expected:   60.00, actual:   42.10, group: "need", note: "" },
  { cat: "Internet",        expected:   21.00, actual:   21.00, group: "need", note: "Spectrum" },
  { cat: "Phone",           expected:  124.00, actual:  124.00, group: "need", note: "Verizon + iCloud" },
  { cat: "Apartment",       expected:   50.00, actual:   38.00, group: "need", note: "" },
  { cat: "Student Loans",   expected:  110.00, actual:  110.00, group: "need", note: "Nelnet" },
  { cat: "Groceries",       expected:  300.00, actual:  284.50, group: "need", note: "" },
  { cat: "Transportation",  expected:  200.00, actual:  164.00, group: "need", note: "MTA + Lyft" },
  { cat: "Disc. Shopping",  expected:  150.00, actual:   98.20, group: "want", note: "" },
  { cat: "Gym Membership",  expected:   31.35, actual:   31.35, group: "want", note: "Planet Fitness" },
  { cat: "Subscriptions",   expected:   69.00, actual:   69.00, group: "want", note: "Prime, iCloud, Spotify, Claude, n8n" },
  { cat: "Dining",          expected:  150.00, actual:  134.75, group: "want", note: "" },
  { cat: "Gifts Fund",      expected:  100.00, actual:   40.00, group: "want", note: "" },
];

const SAVINGS = [
  { id: "sv1", acct: "Marcus HYSA",        type: "HYSA",       perCheck: 250, target:  500, paid1: 0, paid2: 0 },
  { id: "sv2", acct: "Vanguard IRA",       type: "Retirement", perCheck: 292, target:  584, paid1: 0, paid2: 0 },
  { id: "sv3", acct: "Fidelity Brokerage", type: "Brokerage",  perCheck: 150, target:  300, paid1: 0, paid2: 0 },
  { id: "sv4", acct: "Coinbase Crypto",    type: "Crypto",     perCheck: 100, target:  100, paid1: 0, paid2: 0 },
  { id: "sv5", acct: "Charles Schwab",     type: "Brokerage",  perCheck:   8, target:   16, paid1: 0, paid2: 0 },
];

const PAYFLOW = [
  { step: "Pay off cards in full",    p1: true,  p2: false },
  { step: "Pay student loans",        p1: true,  p2: false },
  { step: "HYSA",                     p1: true,  p2: false },
  { step: "IRA",                      p1: true,  p2: false },
  { step: "Brokerage(s)",             p1: true,  p2: false },
  { step: "HYSA Interest → Crypto",   p1: false, p2: false, note: "monthly" },
  { step: "Update Net Worth tracker", p1: false, p2: false },
];

const NETWORTH_HISTORY = [
  { m: "Apr", v: 0 },
];

const CARDS = [
  { name: "Chase Sapphire",  role: "Every day",              balance:  284.60 },
  { name: "Capital One",     role: "Transportation",         balance:   82.40 },
  { name: "",                role: "",                       balance:    0    },
  { name: "Discover",        role: "iCloud, Credit History", balance:   21.00 },
];

/* Individual transactions for the Expenses page */
const TRANSACTIONS = [
  { id: "t01", date: "Apr 18", merchant: "Blue Bottle Coffee",     cat: "Dining",         acct: "Sapphire",    amt:    6.75 },
  { id: "t02", date: "Apr 18", merchant: "Whole Foods Market",     cat: "Groceries",      acct: "Capital One", amt:   84.22 },
  { id: "t03", date: "Apr 17", merchant: "Uber",                   cat: "Transportation", acct: "Capital One", amt:   22.40 },
  { id: "t04", date: "Apr 17", merchant: "Con Edison",             cat: "Utilities",      acct: "BILT",        amt:   48.30 },
  { id: "t05", date: "Apr 16", merchant: "Angelika Film Center",   cat: "Disc. Shopping", acct: "Sapphire",    amt:   32.00 },
  { id: "t06", date: "Apr 15", merchant: "NYC MTA",                cat: "Transportation", acct: "Capital One", amt:  132.00 },
  { id: "t07", date: "Apr 14", merchant: "Trader Joe's",           cat: "Groceries",      acct: "Capital One", amt:   62.18 },
  { id: "t08", date: "Apr 14", merchant: "Sweetgreen",             cat: "Dining",         acct: "Sapphire",    amt:   16.90 },
  { id: "t09", date: "Apr 13", merchant: "Verizon Wireless",       cat: "Phone",          acct: "BILT",        amt:  110.00 },
  { id: "t10", date: "Apr 13", merchant: "iCloud+",                cat: "Subscriptions",  acct: "Discover",    amt:   14.00 },
  { id: "t11", date: "Apr 12", merchant: "Lyft",                   cat: "Transportation", acct: "Sapphire",    amt:   18.20 },
  { id: "t12", date: "Apr 12", merchant: "Kinokuniya",             cat: "Disc. Shopping", acct: "Capital One", amt:   48.60 },
  { id: "t13", date: "Apr 11", merchant: "Lucien",                 cat: "Dining",         acct: "Capital One", amt:  104.00 },
  { id: "t14", date: "Apr 10", merchant: "Planet Fitness",         cat: "Gym Membership", acct: "BILT",        amt:   31.35 },
  { id: "t15", date: "Apr 09", merchant: "Amazon",                 cat: "Disc. Shopping", acct: "Sapphire",    amt:   17.60 },
  { id: "t16", date: "Apr 08", merchant: "Rent — 145 W 27th",      cat: "Rent",           acct: "BILT",        amt: 1160.00 },
  { id: "t17", date: "Apr 07", merchant: "Claude Pro",             cat: "Subscriptions",  acct: "Discover",    amt:   21.00 },
  { id: "t18", date: "Apr 07", merchant: "Spotify",                cat: "Subscriptions",  acct: "Discover",    amt:    7.00 },
  { id: "t19", date: "Apr 06", merchant: "Prime",                  cat: "Subscriptions",  acct: "Discover",    amt:   15.00 },
  { id: "t20", date: "Apr 05", merchant: "Joe's Pizza",            cat: "Dining",         acct: "Sapphire",    amt:   11.85 },
  { id: "t21", date: "Apr 04", merchant: "Nelnet",                 cat: "Student Loans",  acct: "BILT",        amt:  110.00 },
  { id: "t22", date: "Apr 03", merchant: "Spectrum",               cat: "Internet",       acct: "BILT",        amt:   21.00 },
  { id: "t23", date: "Apr 02", merchant: "Shell",                  cat: "Gas",            acct: "Capital One", amt:   42.10 },
  { id: "t24", date: "Apr 01", merchant: "Trader Joe's",           cat: "Groceries",      acct: "Capital One", amt:  138.10 },
];

/* Daily spend series for the chart (April 1 -> 18) */
const DAILY_SPEND = [
  { d: 1,  v: 138 }, { d: 2,  v: 0   }, { d: 3,  v: 21  }, { d: 4,  v: 110  },
  { d: 5,  v: 12  }, { d: 6,  v: 15  }, { d: 7,  v: 28  }, { d: 8,  v: 1160 },
  { d: 9,  v: 18  }, { d: 10, v: 31  }, { d: 11, v: 104 }, { d: 12, v: 67   },
  { d: 13, v: 124 }, { d: 14, v: 79  }, { d: 15, v: 132 }, { d: 16, v: 32   },
  { d: 17, v: 71  }, { d: 18, v: 91  },
];

/* Savings accounts — balances, monthly contributions, goals */
const SAVINGS_ACCOUNTS = [
  { id: "s1", name: "Marcus HYSA",        type: "HYSA",       balance: 8420.00, monthly:  500, annualGoal:  7000, apy: 4.15 },
  { id: "s2", name: "Vanguard Roth IRA",  type: "Retirement", balance: 9180.50, monthly:  584, annualGoal:  7000, apy: 8.00 },
  { id: "s3", name: "Fidelity Brokerage", type: "Brokerage",  balance: 5120.20, monthly:  300, annualGoal:  4000, apy: 7.00 },
  { id: "s4", name: "Coinbase Crypto",    type: "Crypto",     balance: 1840.00, monthly:  100, annualGoal:  1200, apy: 0    },
  { id: "s5", name: "Charles Schwab",     type: "Brokerage",  balance:  640.80, monthly:   16, annualGoal:   200, apy: 7.00 },
];

Object.assign(window, { INCOME, EXPENSES, SAVINGS, PAYFLOW, NETWORTH_HISTORY, CARDS, TRANSACTIONS, DAILY_SPEND, SAVINGS_ACCOUNTS });
