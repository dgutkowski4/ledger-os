/* Cloud sync via Supabase — optional layer; the app works local-only when signed out.
   Model: the entire app state (the synced localStorage keys) is one JSONB blob per user
   in the `ledgers` table, protected by row-level security. localStorage stays the
   offline cache; every write schedules a debounced upload. */

const SUPABASE_URL = "https://dfgtpxrcchlczewcudso.supabase.co";
const SUPABASE_KEY = "sb_publishable_YO9bUcflj0_VS9KTUKUtRA_N4-POQv5";

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/* Which localStorage keys make up "the user's data" */
const SYNC_PREFIXES = ["ledger_", "sec_title_", "sec_tone_", "layout_", "expense_merchant_memory"];
const SYNC_EXCLUDE = new Set(["ledger_tab"]); // active tab is per-device, not data
const syncedKey = (k) => !SYNC_EXCLUDE.has(k) && SYNC_PREFIXES.some((p) => k.startsWith(p));

const origSet = localStorage.setItem.bind(localStorage);
const origRemove = localStorage.removeItem.bind(localStorage);

function snapshot() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (syncedKey(k)) out[k] = localStorage.getItem(k);
  }
  return out;
}

function applySnapshot(data) {
  const stale = Object.keys(snapshot()).filter((k) => !(k in data));
  stale.forEach((k) => origRemove(k));
  Object.entries(data).forEach(([k, v]) => origSet(k, v));
}

/* Key-order-independent comparison (jsonb does not preserve key order) */
const canon = (obj) => JSON.stringify(Object.keys(obj).sort().map((k) => [k, obj[k]]));

let currentUser = null;
let uploadTimer = null;
let pendingLocal = false;      // local edits waiting to upload
let lastKnownRemote = null;    // cloud updated_at we last saw
let syncStatus = "off"; // off | syncing | synced | error
let statusListeners = [];
const setSyncStatus = (s) => { syncStatus = s; statusListeners.forEach((fn) => fn(s)); };

async function uploadNow() {
  if (!sb || !currentUser) return;
  setSyncStatus("syncing");
  const stamp = new Date().toISOString();
  const { data: row, error } = await sb.from("ledgers").upsert({
    user_id: currentUser.id,
    data: snapshot(),
    updated_at: stamp,
  }).select("updated_at").maybeSingle();
  pendingLocal = false;
  if (error) { console.error("Sync upload failed:", error.message); setSyncStatus("error"); return; }
  lastKnownRemote = row?.updated_at || stamp;
  setSyncStatus("synced");
}

function scheduleUpload() {
  if (!sb || !currentUser) return;
  clearTimeout(uploadTimer);
  pendingLocal = true;
  setSyncStatus("syncing");
  uploadTimer = setTimeout(uploadNow, 1200);
}

/* Refresh from the cloud when this tab regains focus, so an idle device
   doesn't clobber newer data from another device with stale edits. Skipped
   while local changes are pending upload — active edits win. */
async function pullRemote() {
  if (!sb || !currentUser || pendingLocal) return;
  const { data: row, error } = await sb.from("ledgers")
    .select("data, updated_at").eq("user_id", currentUser.id).maybeSingle();
  if (error || !row || row.updated_at === lastKnownRemote) return;
  lastKnownRemote = row.updated_at;
  if (row.data && Object.keys(row.data).length && canon(row.data) !== canon(snapshot())) {
    applySnapshot(row.data);
    window.location.reload();
  }
}
window.addEventListener("focus", pullRemote);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pullRemote(); });

/* Every app write goes through localStorage — patch it so all state changes
   (ledgers, section titles, layout, merchant memory) trigger a debounced upload. */
localStorage.setItem = (k, v) => { origSet(k, v); if (syncedKey(k)) scheduleUpload(); };
localStorage.removeItem = (k) => { origRemove(k); if (syncedKey(k)) scheduleUpload(); };

/* On sign-in: cloud copy wins if it exists; otherwise push local data up. */
async function initialSync(user) {
  currentUser = user;
  const { data: row, error } = await sb.from("ledgers").select("data, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("Sync load failed:", error.message);
    setSyncStatus("error");
    return;
  }
  lastKnownRemote = row?.updated_at || null;
  if (row && row.data && Object.keys(row.data).length) {
    if (canon(row.data) !== canon(snapshot())) {
      applySnapshot(row.data);
      window.location.reload();
      return;
    }
    setSyncStatus("synced");
  } else {
    await uploadNow();
  }
}

async function signOutAndClear() {
  if (!sb) return;
  clearTimeout(uploadTimer);
  await sb.auth.signOut();
  /* Data is safe in the cloud — leave the device clean for the next person */
  Object.keys(snapshot()).forEach((k) => origRemove(k));
  window.location.reload();
}

/* Reset-all (Tweaks panel) — wipes the cloud copy too when signed in */
async function ledgerReset() {
  clearTimeout(uploadTimer);
  if (sb && currentUser) {
    const { error } = await sb.from("ledgers").delete().eq("user_id", currentUser.id);
    if (error) console.error("Cloud reset failed:", error.message);
  }
  localStorage.clear();
  window.location.reload();
}

/* Backup / restore — full data snapshot as a .json file. Works signed out too. */
function ledgerBackup() {
  const payload = { _type: "ledger-os-backup", exportedAt: new Date().toISOString(), data: snapshot() };
  window.downloadFile(
    `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

async function ledgerRestore(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?._type === "ledger-os-backup" ? parsed.data : null;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      window.toast ? toast("Not a valid Ledger OS backup file", "danger") : alert("Not a valid Ledger OS backup file.");
      return;
    }
    applySnapshot(data);
    if (sb && currentUser) await uploadNow();
    window.location.reload();
  } catch (e) {
    window.toast ? toast(`Restore failed: ${e.message}`, "danger") : alert(`Restore failed: ${e.message}`);
  }
}

/* Headers for the Anthropic proxy — includes the session token when signed in */
async function apiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (sb) {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/* ── Sign-in / sync widget (lives in the tab bar) ── */
function AuthWidget() {
  const [user, setUser] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [status, setStatus] = React.useState(syncStatus);
  const ref = React.useRef(null);

  React.useEffect(() => {
    statusListeners.push(setStatus);
    if (sb) {
      sb.auth.onAuthStateChange((event, session) => {
        const u = session?.user || null;
        setUser(u);
        if (u && !currentUser) initialSync(u);
        if (!u) { currentUser = null; setSyncStatus("off"); }
      });
    }
    return () => { statusListeners = statusListeners.filter((f) => f !== setStatus); };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!sb) return null;

  const sendLink = async () => {
    setErr(""); setSending(true);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setErr(error.message);
    else setSent(true);
  };

  const statusText = {
    synced: "All changes synced",
    syncing: "Syncing…",
    error: "Sync error — retries on next change",
    off: "Connecting…",
  }[status];

  return (
    <div className="auth" ref={ref}>
      <button className="topbar__btn" onClick={() => setOpen((o) => !o)}
        title={user ? user.email : "Sign in to sync across devices"}>
        {user
          ? (<><span className={`auth-dot auth-dot--${status}`} />{user.email.split("@")[0]}</>)
          : "Sign in"}
      </button>
      {open && (
        <div className="auth-pop">
          {user ? (
            <>
              <div className="auth-email">{user.email}</div>
              <div className="auth-status">{statusText}</div>
              <button className="tweaks__opt" onClick={signOutAndClear}>Sign out</button>
            </>
          ) : sent ? (
            <div className="auth-sent">
              Check your email — we sent a sign-in link to <b>{email}</b>. You can close this.
            </div>
          ) : (
            <>
              <div className="auth-title">Sync across devices</div>
              <p className="auth-hint">Enter your email and we&rsquo;ll send a magic sign-in link. No password needed.</p>
              <input className="auth-input" type="email" placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendLink(); }} />
              {err && <div className="auth-err">{err}</div>}
              <button className="auth-send" disabled={sending || !/\S+@\S+\.\S+/.test(email)} onClick={sendLink}>
                {sending ? "Sending…" : "Send link"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AuthWidget, apiHeaders, ledgerReset, ledgerBackup, ledgerRestore });
