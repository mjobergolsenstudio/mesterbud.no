import { useState, useEffect } from "react";

// ── CONFIG ──
// Sett disse i Vercel Environment Variables:
// REACT_APP_SUPABASE_URL og REACT_APP_SUPABASE_ANON_KEY
const SUPA_URL = typeof window !== "undefined" && window.__SUPABASE_URL__ ? window.__SUPABASE_URL__ : "";
const SUPA_KEY = typeof window !== "undefined" && window.__SUPABASE_KEY__ ? window.__SUPABASE_KEY__ : "";

// ── SUPABASE HELPERS ──
async function sbFetch(path, opts = {}, token = null) {
  if (!SUPA_URL) return null;
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPA_KEY,
    "Authorization": `Bearer ${token || SUPA_KEY}`,
    "Prefer": opts.prefer || "return=representation",
    ...opts.headers,
  };
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { ...opts, headers });
  if (!res.ok) { console.error("sbFetch error:", res.status, await res.text()); return null; }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function authSignUp(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function authSignIn(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function authSignOut(token) {
  await fetch(`${SUPA_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
  });
}

async function dbGetProfile(userId, token) {
  const data = await sbFetch(`profiles?user_id=eq.${userId}&limit=1`, {}, token);
  return data?.[0] || null;
}

async function dbSaveProfile(p, token) {
  if (p.id) {
    const data = await sbFetch(`profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify(p) }, token);
    return data?.[0] || p;
  }
  const data = await sbFetch("profiles", { method: "POST", body: JSON.stringify(p) }, token);
  return data?.[0] || p;
}

async function dbGetQuotes(profileId, token) {
  const data = await sbFetch(`quotes?profile_id=eq.${profileId}&order=created_at.desc`, {}, token);
  return (data || []).map(q => ({
    ...q, dbId: q.id, lineItems: q.line_items || [],
    paymentTerms: q.payment_terms, validDays: q.valid_days,
    sentAt: q.sent_at, sentTo: q.sent_to, signedBy: q.signed_by,
  }));
}

async function dbSaveQuote(q, profileId, token) {
  const row = {
    profile_id: profileId, num: q.num, firm: q.firm, trade: q.trade,
    cust: q.cust, addr: q.addr, summary: q.summary, line_items: q.lineItems,
    sub: q.sub, mva: q.mva, total: q.total, payment_terms: q.paymentTerms,
    valid_days: q.validDays, warranty: q.warranty, notes: q.notes,
    status: q.status || "kladd", sent_at: q.sentAt || null, sent_to: q.sentTo || null,
  };
  if (q.dbId) {
    const d = await sbFetch(`quotes?id=eq.${q.dbId}`, { method: "PATCH", body: JSON.stringify(row) }, token);
    return d?.[0];
  }
  const d = await sbFetch("quotes", { method: "POST", body: JSON.stringify(row) }, token);
  return d?.[0];
}

async function dbUpdateStatus(num, status, token) {
  await sbFetch(`quotes?num=eq.${encodeURIComponent(num)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, responded_at: new Date().toISOString() }),
  }, token);
}

// ── CONSTANTS ──
const N = "#0f1f3d", B = "#3b6fd4", SKY = "#e8eef8", BRD = "#dde3ef", MUT = "#6b7a99", OFF = "#f7f9fc";
const TRADES = [
  { v: "rørlegger", l: "🚿 Rørlegger", rate: 1050 },
  { v: "elektriker", l: "⚡ Elektriker", rate: 1100 },
  { v: "maler", l: "🎨 Maler", rate: 850 },
  { v: "snekker", l: "🔨 Snekker / Tømrer", rate: 950 },
  { v: "flislegger", l: "🟫 Flislegger", rate: 900 },
  { v: "taktekker", l: "🏠 Taktekker", rate: 980 },
  { v: "annen håndverker", l: "🔧 Annen håndverker", rate: 900 },
];
const INP = { width: "100%", padding: "10px 13px", border: `1.5px solid ${BRD}`, borderRadius: 8, fontFamily: "system-ui", fontSize: 14, color: N, background: OFF, outline: "none", boxSizing: "border-box" };
const BTN = { fontFamily: "system-ui", fontWeight: 600, cursor: "pointer", border: "none", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };

function nok(n) { return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(n) || 0); }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }

function makeFallback(trade, cust, addr, desc) {
  const t = TRADES.find(x => x.v === trade) || TRADES[0];
  return {
    summary: `Utføre ${desc} for ${cust || "kunde"} på ${addr || "oppgitt adresse"}.`,
    lineItems: [
      { desc: "Arbeid og montering", qty: 3, unit: "timer", unitPrice: t.rate, total: t.rate * 3 },
      { desc: "Materialer og forbruksmateriell", qty: 1, unit: "stk", unitPrice: 850, total: 850 },
      { desc: "Reise og riggkostnader", qty: 1, unit: "stk", unitPrice: 450, total: 450 },
    ],
    paymentTerms: "14 dager netto", validDays: 30,
    warranty: "12 måneders garanti på utført arbeid", notes: "",
  };
}

// ══════════════════════════════════════
// LANDING PAGE
// ══════════════════════════════════════
function LandingPage({ onLogin, onSignup }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, sans-serif" }}>

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 32px", borderBottom: `1px solid ${BRD}`, position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: N }}>Mester<span style={{ color: B }}>bud</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onLogin} style={{ ...BTN, padding: "9px 18px", background: "transparent", border: `1.5px solid ${BRD}`, color: N, fontSize: 14 }}>Logg inn</button>
          <button onClick={onSignup} style={{ ...BTN, padding: "9px 18px", background: N, color: "#fff", fontSize: 14 }}>Start gratis →</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "80px 24px 60px", background: `linear-gradient(180deg, ${SKY} 0%, #fff 100%)` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: B, marginBottom: 18 }}>For norske håndverkere</div>
        <h1 style={{ fontSize: "clamp(34px,6vw,60px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, color: N, maxWidth: 660, margin: "0 auto 18px" }}>
          Profesjonelle tilbud på <span style={{ color: B }}>sekunder</span>
        </h1>
        <p style={{ fontSize: 17, color: MUT, maxWidth: 420, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Beskriv jobben med stemmen eller tekst — AI lager et ferdig tilbud klart til å sende kunden.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onSignup} style={{ ...BTN, padding: "13px 28px", background: N, color: "#fff", fontSize: 15 }}>Lag ditt første tilbud</button>
          <button onClick={onLogin} style={{ ...BTN, padding: "13px 28px", background: "transparent", border: `1.5px solid ${BRD}`, color: N, fontSize: 15 }}>Logg inn</button>
        </div>
        <div style={{ marginTop: 40, display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap" }}>
          {["3 gratis tilbud", "Tale-input", "Send til kunde", "Digital aksept", "Historikk"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: MUT, fontWeight: 500 }}>
              <div style={{ width: 5, height: 5, background: B, borderRadius: "50%" }} />{t}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { icon: "🎙️", title: "Tale-input", desc: "Snakk inn jobbbeskrivelsen — AI forstår norsk og lager tilbud automatisk." },
            { icon: "📷", title: "Bildeopplasting", desc: "Legg ved bilder av jobben. Kunden ser hva det gjelder." },
            { icon: "✏️", title: "Rediger linjer", desc: "Juster priser, antall og beskrivelse direkte i tilbudet." },
            { icon: "📧", title: "Send til kunde", desc: "Kunden mottar en profesjonell e-post med aksept-knapp." },
            { icon: "✅", title: "Digital aksept", desc: "Kunden signerer med navn. Du får varsel umiddelbart." },
            { icon: "📊", title: "Full historikk", desc: "Se alle sendte tilbud og statusen på hvert enkelt." },
          ].map(f => (
            <div key={f.title} style={{ background: OFF, borderRadius: 14, padding: "22px 20px", border: `1px solid ${BRD}` }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: N, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: MUT, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ background: N, padding: "70px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 34, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: -0.8 }}>Enkel pris</h2>
        <p style={{ textAlign: "center", color: "#8fa3c8", marginBottom: 44, fontSize: 15 }}>Prøv gratis. Ingen kredittkort kreves.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, maxWidth: 660, margin: "0 auto" }}>
          {[
            { name: "Gratis", price: "0", desc: "Kom i gang", feats: ["3 tilbud totalt", "AI-generering", "Tale-input", "Send til kunde"], featured: false },
            { name: "Pro", price: "299", desc: "Alt du trenger", feats: ["Ubegrenset tilbud", "PDF-nedlasting", "Din logo", "Prioritert support"], featured: true },
          ].map(p => (
            <div key={p.name} style={{ background: p.featured ? "#fff" : "rgba(255,255,255,0.07)", border: `1px solid ${p.featured ? "#fff" : "rgba(255,255,255,0.14)"}`, borderRadius: 14, padding: 28, color: p.featured ? N : "#fff", position: "relative" }}>
              {p.featured && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: B, color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "4px 14px", borderRadius: 100 }}>ANBEFALT</div>}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", opacity: p.featured ? 1 : 0.5, color: p.featured ? B : undefined, marginBottom: 10 }}>{p.name}</div>
              <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>
                <sup style={{ fontSize: 17, verticalAlign: "top", marginTop: 10, display: "inline-block" }}>kr</sup>{p.price}
                <sub style={{ fontSize: 14, fontWeight: 400, opacity: 0.55 }}>/mnd</sub>
              </div>
              <div style={{ fontSize: 13, opacity: 0.6, margin: "8px 0 20px" }}>{p.desc}</div>
              <ul style={{ listStyle: "none", marginBottom: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                {p.feats.map(f => (
                  <li key={f} style={{ fontSize: 13, opacity: p.featured ? 1 : 0.75, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: "50%", background: B, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignup} style={{ ...BTN, width: "100%", padding: 12, background: p.featured ? B : "rgba(255,255,255,0.1)", color: "#fff", border: p.featured ? "none" : "1px solid rgba(255,255,255,0.2)", fontSize: 14 }}>
                {p.featured ? "Kom i gang" : "Start gratis"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════
// AUTH SCREEN
// ══════════════════════════════════════
function AuthScreen({ onAuth, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    if (!email || !password) { setError("Fyll inn e-post og passord"); return; }
    if (password.length < 6) { setError("Passord må være minst 6 tegn"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const data = mode === "login" ? await authSignIn(email, password) : await authSignUp(email, password);
      if (data.error || data.error_description || data.msg) {
        const msg = data.error_description || data.msg || data.error || "Noe gikk galt";
        if (msg.toLowerCase().includes("invalid")) setError("Feil e-post eller passord");
        else if (msg.toLowerCase().includes("already")) setError("E-posten er allerede registrert");
        else setError(msg);
      } else if (mode === "signup" && !data.access_token) {
        setSuccess("✅ Sjekk e-posten din for bekreftelseslenke, logg deretter inn.");
      } else if (data.access_token) {
        localStorage.setItem("tai_token", data.access_token);
        localStorage.setItem("tai_user", JSON.stringify(data.user));
        onAuth(data.access_token, data.user);
      }
    } catch (e) { setError("Tilkoblingsfeil. Prøv igjen."); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${N} 0%, #1a3260 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", gap: 4, margin: "0 auto 16px" }}>← Tilbake til forsiden</button>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>Mester<span style={{ color: "#6fa3ff" }}>bud</span></div>
        <div style={{ fontSize: 14, color: "#8fa3c8", marginTop: 4 }}>Smarte tilbud for norske håndverkere</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: "36px 32px", maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: N, marginBottom: 6 }}>
          {mode === "login" ? "Logg inn" : "Opprett konto"}
        </h2>
        <p style={{ fontSize: 14, color: MUT, marginBottom: 24 }}>
          {mode === "login" ? "Velkommen tilbake!" : "Kom i gang gratis — 3 tilbud uten betaling"}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>E-postadresse</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="din@epost.no"
            style={{ ...INP, background: "#fff", border: `1.5px solid ${error ? "#fca5a5" : BRD}` }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Passord</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder={mode === "signup" ? "Minst 6 tegn" : "••••••••"}
            style={{ ...INP, background: "#fff", border: `1.5px solid ${error ? "#fca5a5" : BRD}` }} />
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#991b1b", marginBottom: 14 }}>⚠️ {error}</div>}
        {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#166534", marginBottom: 14 }}>{success}</div>}

        <button onClick={submit} disabled={loading}
          style={{ ...BTN, width: "100%", padding: 13, background: loading ? MUT : B, color: "#fff", fontSize: 15, marginBottom: 14 }}>
          {loading ? "⏳ Vennligst vent..." : mode === "login" ? "Logg inn" : "Opprett konto"}
        </button>

        <div style={{ textAlign: "center", fontSize: 13, color: MUT }}>
          {mode === "login" ? (
            <>Har du ikke konto? <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: B, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Registrer deg</button></>
          ) : (
            <>Har du allerede konto? <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: B, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Logg inn</button></>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
        Dine data er kryptert og lagret sikkert
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null); // { token, user }
  const [authLoading, setAuthLoading] = useState(true);
  const [appView, setAppView] = useState("landing"); // landing | auth | app

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem("tai_token");
    const user = localStorage.getItem("tai_user");
    if (token && user) {
      try { setSession({ token, user: JSON.parse(user) }); }
      catch (_) { localStorage.removeItem("tai_token"); localStorage.removeItem("tai_user"); }
    }
    setAuthLoading(false);
  }, []);

  function handleAuth(token, user) { setSession({ token, user }); }

  async function handleLogout() {
    if (session?.token) { try { await authSignOut(session.token); } catch (_) {} }
    localStorage.removeItem("tai_token");
    localStorage.removeItem("tai_user");
    setSession(null);
  }

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: N }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Mester<span style={{ color: "#6fa3ff" }}>bud</span></div>
    </div>
  );

  if (!session && appView !== "landing") return <AuthScreen onAuth={(t,u) => { handleAuth(t,u); setAppView("app"); }} onBack={() => setAppView("landing")} />;
  if (!session) return <LandingPage onLogin={() => setAppView("auth")} onSignup={() => setAppView("auth")} />;
  return <Dashboard session={session} onLogout={() => { handleLogout(); setAppView("landing"); }} />;
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function Dashboard({ session, onLogout }) {
  const { token, user } = session;

  const [tab, setTab] = useState("ny");
  const [isPro, setIsPro] = useState(false);
  const [used, setUsed] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [sendModal, setSendModal] = useState(null);
  const [acceptView, setAcceptView] = useState(null);
  const [profile, setProfile] = useState({ firm: "", trade: "rørlegger", phone: "", email: user?.email || "", org: "", address: "", logo: "" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [firm, setFirm] = useState("");
  const [trade, setTrade] = useState("rørlegger");
  const [cust, setCust] = useState("");
  const [addr, setAddr] = useState("");
  const [desc, setDesc] = useState("");
  const [imgs, setImgs] = useState([]);
  const [voiceRec, setVoiceRec] = useState(false);
  const [voiceObj, setVoiceObj] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [cnt, setCnt] = useState(1000);
  const [sentList, setSentList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const freeLeft = Math.max(0, 3 - used);

  // Load profile + quotes
  useEffect(() => {
    async function load() {
      setDataLoading(true);
      try {
        let p = await dbGetProfile(user.id, token);
        if (!p) {
          p = await dbSaveProfile({ user_id: user.id, firm: "", trade: "rørlegger", phone: "", email: user.email, org: "", address: "", logo: "" }, token);
        }
        if (p) {
          setProfile({ ...p });
          if (p.firm) setFirm(p.firm);
          if (p.trade) setTrade(p.trade);
          const qs = await dbGetQuotes(p.id, token);
          const sent = qs.filter(q => q.status !== "kladd");
          setSentList(sent);
          setUsed(qs.length);
        }
      } catch (e) { console.log("Load error:", e.message); }
      setDataLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    try {
      const updated = { ...profile, user_id: user.id };
      const saved = await dbSaveProfile(updated, token);
      if (saved) setProfile(saved);
    } catch (e) { console.log("Save profile error:", e); }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Tale støttes ikke i denne nettleseren. Prøv Chrome."); return; }
    const r = new SR();
    r.lang = "nb-NO"; r.continuous = true; r.interimResults = true;
    r.onstart = () => setVoiceRec(true);
    r.onresult = e => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setDesc(t); };
    r.onerror = () => { setVoiceRec(false); };
    r.onend = () => setVoiceRec(false);
    r.start();
    setVoiceObj(r);
  }

  function stopVoice() {
    try { voiceObj && voiceObj.stop(); } catch (_) {}
    setVoiceRec(false);
  }

  function addImgs(e) {
    Array.from(e.target.files).forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setImgs(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(f);
    });
  }

  async function generate() {
    if (!isPro && used >= 3) { setUpgradeModal(true); return; }
    if (!desc.trim()) { setErrMsg("Beskriv jobben først"); return; }
    setErrMsg(""); setLoading(true); setQuote(null);

    const firmName = firm || profile.firm || "Mitt Firma AS";
    const custName = cust || "Kunde";

    const prompt = `Du er en erfaren ${trade} i Norge. Lag et profesjonelt tilbud.
Firma: ${firmName} | Fag: ${trade} | Kunde: ${custName} | Adresse: ${addr || "ikke oppgitt"}
Jobb: ${desc}
${imgs.length ? `Bilder av jobben vedlagt: ${imgs.length} stk.` : ""}
Svar KUN med gyldig JSON, ingen markdown:
{"summary":"Beskrivelse","lineItems":[{"desc":"Arbeid","qty":2,"unit":"timer","unitPrice":950,"total":1900},{"desc":"Materialer","qty":1,"unit":"stk","unitPrice":600,"total":600}],"paymentTerms":"14 dager netto","validDays":30,"warranty":"12 måneders garanti","notes":""}`;

    let q = null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!data.error) {
        const raw = (data.content || []).map(b => b.text || "").join("");
        const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
        if (s !== -1 && e !== -1) { try { q = JSON.parse(clean.slice(s, e + 1)); } catch (_) {} }
      }
    } catch (_) {}

    if (!q) q = makeFallback(trade, custName, addr, desc);
    const sub = q.lineItems.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const mva = Math.round(sub * 0.25);
    const newQ = { ...q, firm: firmName, trade, cust: custName, addr, num: "TBU-" + (cnt + 1), date: new Date().toLocaleDateString("nb-NO"), id: Date.now(), sub, mva, total: sub + mva, logo: profile.logo };

    setCnt(c => c + 1);
    setQuote(newQ);
    if (!isPro) setUsed(u => u + 1);

    try {
      const saved = await dbSaveQuote(newQ, profile.id, token);
      if (saved) setQuote(prev => ({ ...prev, dbId: saved.id }));
    } catch (e) { console.log("Save quote error:", e); }

    setLoading(false);
  }

  async function handleSend(q) {
    const sentQ = { ...q, sentAt: new Date().toLocaleString("nb-NO"), status: "sendt" };
    setSentList(s => s.find(x => x.num === q.num) ? s.map(x => x.num === q.num ? sentQ : x) : [sentQ, ...s]);
    setSendModal(q);
    try { await dbUpdateStatus(q.num, "sendt", token); } catch (_) {}
  }

  async function updateSentStatus(num, status) {
    setSentList(s => s.map(x => x.num === num ? { ...x, status } : x));
    try { await dbUpdateStatus(num, status, token); } catch (_) {}
  }

  if (acceptView) return <AcceptPage q={acceptView} onBack={() => setAcceptView(null)} />;

  const tabs = [
    { id: "ny", label: "✦ Nytt tilbud" },
    { id: "sendt", label: `Sendt${sentList.length ? ` (${sentList.length})` : ""}` },
    { id: "profil", label: "Profil" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: OFF, fontFamily: "system-ui, sans-serif" }}>

      {/* Topbar */}
      <div style={{ background: N, padding: "0 20px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 20, height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <button onClick={() => setSideOpen(o => !o)} style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 7, color: "#fff", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
            {sideOpen ? "◀" : "▶"}
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Mester<span style={{ color: "#6fa3ff" }}>bud</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: isPro ? B : "rgba(255,255,255,0.12)", color: isPro ? "#fff" : "#a8c0f0" }}>
            {isPro ? "Pro ✓" : `Gratis · ${freeLeft} igjen`}
          </span>
          {!isPro && <button onClick={() => setUpgradeModal(true)} style={{ ...BTN, padding: "6px 14px", background: B, color: "#fff", fontSize: 12 }}>Oppgrader</button>}
          <button onClick={onLogout} style={{ ...BTN, padding: "6px 12px", background: "transparent", border: "1.5px solid rgba(255,255,255,0.2)", color: "#8fa3c8", fontSize: 12 }}>Logg ut</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BRD}`, display: "flex", paddingLeft: 16, position: "sticky", top: 54, zIndex: 19 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...BTN, padding: "13px 18px", background: "none", border: "none", borderBottom: `2.5px solid ${tab === t.id ? B : "transparent"}`, color: tab === t.id ? N : MUT, fontSize: 13, fontWeight: tab === t.id ? 700 : 500, borderRadius: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── NY TILBUD ── */}
      {tab === "ny" && (
        <div style={{ display: "grid", gridTemplateColumns: sideOpen ? "290px 1fr" : "0px 1fr", minHeight: "calc(100vh - 103px)", transition: "grid-template-columns 0.25s ease" }}>
          <div style={{ background: "#fff", borderRight: `1px solid ${BRD}`, overflowY: "auto", overflowX: "hidden" }}>
            <Section label="Firma">
              <Field label="Firmanavn"><input value={firm} onChange={e => setFirm(e.target.value)} placeholder={profile.firm || "Hansen Rør AS"} style={INP} /></Field>
              <Field label="Fag">
                <select value={trade} onChange={e => setTrade(e.target.value)} style={INP}>
                  {TRADES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </Field>
            </Section>
            <Section label="Kunde">
              <Field label="Navn"><input value={cust} onChange={e => setCust(e.target.value)} placeholder="Kari Nordmann" style={INP} /></Field>
              <Field label="Adresse"><input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Storgata 12, Oslo" style={INP} /></Field>
            </Section>
            <Section label="Beskriv jobben" last>
              {/* Voice button */}
              <button
                onClick={() => voiceRec ? stopVoice() : startVoice()}
                style={{ width: "100%", padding: "10px 14px", border: `1.5px dashed ${voiceRec ? "#b91c1c" : BRD}`, borderRadius: 8, background: voiceRec ? "#fff5f5" : OFF, cursor: "pointer", fontFamily: "system-ui", fontSize: 13, fontWeight: 500, color: voiceRec ? "#b91c1c" : MUT, display: "flex", alignItems: "center", gap: 8, marginBottom: 8, animation: voiceRec ? "none" : "none" }}>
                <span>{voiceRec ? "⏹️" : "🎙️"}</span>
                <span>{voiceRec ? "Snakker... trykk for å stoppe" : "Trykk for å snakke inn jobben"}</span>
              </button>

              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Eller skriv jobbbeskrivelse her..." style={{ ...INP, minHeight: 90, resize: "vertical" }} />

              {/* Image upload */}
              <div style={{ marginTop: 8 }}>
                <div onClick={() => document.getElementById("jobImgInput").click()}
                  style={{ border: `1.5px dashed ${BRD}`, borderRadius: 8, padding: "12px", textAlign: "center", cursor: "pointer", background: OFF, marginBottom: imgs.length ? 8 : 0 }}>
                  <input id="jobImgInput" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addImgs} />
                  <div style={{ fontSize: 20 }}>📷</div>
                  <div style={{ fontSize: 12, color: MUT, marginTop: 3 }}>Trykk for å legge til bilder</div>
                </div>
                {imgs.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {imgs.map((src, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden" }}>
                        <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => setImgs(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 9, cursor: "pointer" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {errMsg && <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>⚠️ {errMsg}</div>}
              <button onClick={generate} disabled={loading} style={{ ...BTN, width: "100%", marginTop: 12, padding: 13, background: loading ? MUT : N, color: "#fff", fontSize: 15 }}>
                {loading ? "⏳ Genererer..." : "✦ Generer tilbud"}
              </button>
            </Section>
          </div>

          <div style={{ padding: 24, overflowY: "auto" }}>
            {dataLoading && <div style={{ textAlign: "center", padding: "60px", color: MUT }}>Laster data...</div>}
            {!dataLoading && loading && <Spinner />}
            {!dataLoading && !loading && !quote && <EmptyState freeLeft={freeLeft} isPro={isPro} />}
            {!dataLoading && !loading && quote && <QuoteCard q={quote} isPro={isPro} onUpgrade={() => setUpgradeModal(true)} onSend={handleSend} />}
          </div>
        </div>
      )}

      {/* ── SENDT ── */}
      {tab === "sendt" && (
        <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
          {sentList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "70px 20px", color: MUT }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: N, marginBottom: 6 }}>Ingen sendte tilbud ennå</div>
              <div style={{ fontSize: 13 }}>Trykk «Send til kunde» på et tilbud for å logge det her</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                {[
                  { label: "Venter", count: sentList.filter(x => x.status === "sendt").length, bg: "#f1f5f9", col: "#334155" },
                  { label: "Akseptert", count: sentList.filter(x => x.status === "akseptert").length, bg: "#f0fdf4", col: "#166534" },
                  { label: "Avslått", count: sentList.filter(x => x.status === "avslått").length, bg: "#fef2f2", col: "#991b1b" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.col }}>{s.count}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.col, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sentList.map(q => {
                  const st = { sendt: { label: "Sendt", bg: "#f1f5f9", col: "#64748b", dot: "#94a3b8" }, akseptert: { label: "Akseptert", bg: "#f0fdf4", col: "#166534", dot: "#22c55e" }, avslått: { label: "Avslått", bg: "#fef2f2", col: "#991b1b", dot: "#ef4444" } }[q.status] || { label: "Sendt", bg: "#f1f5f9", col: "#64748b", dot: "#94a3b8" };
                  return (
                    <div key={q.num} style={{ background: "#fff", border: `1.5px solid ${BRD}`, borderRadius: 12, padding: "15px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: N }}>{q.cust}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: st.bg, color: st.col }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, display: "inline-block" }} />{st.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: MUT }}>{q.num} · {q.sentAt}</div>
                          <div style={{ fontSize: 13, color: MUT, marginTop: 2 }}>{(q.summary || "").slice(0, 55)}</div>
                        </div>
                        <div style={{ fontSize: 19, fontWeight: 800, color: N, flexShrink: 0 }}>{nok(q.total)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 10, borderTop: `1px solid ${BRD}` }}>
                        <button onClick={() => { setQuote(q); setTab("ny"); }} style={{ padding: "6px 14px", background: SKY, color: B, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>👁 Vis</button>
                        {q.status === "sendt" && <>
                          <button onClick={() => updateSentStatus(q.num, "akseptert")} style={{ padding: "6px 14px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✅ Akseptert</button>
                          <button onClick={() => updateSentStatus(q.num, "avslått")} style={{ padding: "6px 14px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>❌ Avslått</button>
                        </>}
                        {q.status === "akseptert" && <span style={{ padding: "6px 14px", background: "#f0fdf4", color: "#166534", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>🎉 Jobb bekreftet!</span>}
                        {q.status === "avslått" && <button onClick={() => updateSentStatus(q.num, "sendt")} style={{ padding: "6px 14px", background: "#f1f5f9", color: MUT, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↩ Angre</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PROFIL ── */}
      {tab === "profil" && (
        <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px", boxShadow: "0 1px 4px rgba(15,31,61,0.08)", marginBottom: 16 }}>
            {/* Logo */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Firmalogo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div onClick={() => document.getElementById("logoInput").click()}
                  style={{ width: 90, height: 90, borderRadius: 12, border: `2px dashed ${BRD}`, background: OFF, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
                  {profile.logo
                    ? <img src={profile.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <div style={{ textAlign: "center" }}><div style={{ fontSize: 26 }}>🏢</div><div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>Last opp</div></div>
                  }
                  <input id="logoInput" type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setProfile(p => ({ ...p, logo: ev.target.result }));
                    reader.readAsDataURL(file);
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: N }}>{profile.firm || "Mitt firma"}</div>
                  <div style={{ fontSize: 14, color: MUT, marginBottom: 8 }}>{cap(profile.trade)}</div>
                  <div style={{ fontSize: 12, color: MUT }}>{user?.email}</div>
                  {profile.logo && <button onClick={() => setProfile(p => ({ ...p, logo: "" }))} style={{ marginTop: 8, padding: "4px 12px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>🗑 Fjern logo</button>}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Firmanavn", key: "firm", placeholder: "Hansen Rør & Varme AS" },
                { label: "Organisasjonsnummer", key: "org", placeholder: "123 456 789" },
                { label: "Telefon", key: "phone", placeholder: "+47 900 00 000" },
                { label: "Adresse", key: "address", placeholder: "Verkstedveien 1, 0123 Oslo" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{f.label}</label>
                  <input value={profile[f.key] || ""} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...INP, background: "#fff" }} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Håndverksfag</label>
                <select value={profile.trade || "rørlegger"} onChange={e => setProfile(p => ({ ...p, trade: e.target.value }))} style={{ ...INP, background: "#fff" }}>
                  {TRADES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <button onClick={saveProfile} style={{ ...BTN, width: "100%", padding: 13, background: profileSaved ? "#16a34a" : N, color: "#fff", fontSize: 15, marginTop: 4 }}>
                {profileSaved ? "✅ Lagret!" : "💾 Lagre profil"}
              </button>
            </div>
          </div>

          {!isPro ? (
            <div style={{ background: N, borderRadius: 14, padding: "24px 28px", color: "#fff" }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Oppgrader til Pro</div>
              <div style={{ fontSize: 13, color: "#8fa3c8", marginBottom: 16 }}>Ubegrenset tilbud, PDF, logo og mer</div>
              <button onClick={() => setUpgradeModal(true)} style={{ ...BTN, padding: "11px 24px", background: B, color: "#fff", fontSize: 14 }}>Oppgrader nå – 299 kr/mnd</button>
            </div>
          ) : (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 4 }}>✅ Du er på Pro-planen</div>
              <button onClick={() => { setIsPro(false); setUsed(0); }} style={{ marginTop: 8, padding: "6px 14px", background: "transparent", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 12, cursor: "pointer" }}>Avslutt Pro</button>
            </div>
          )}
        </div>
      )}

      {sendModal && <SendModal q={sendModal} onClose={() => setSendModal(null)} onPreview={() => { setAcceptView(sendModal); setSendModal(null); }} />}

      {upgradeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,50,0.65)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 36, maxWidth: 400, width: "100%", position: "relative" }}>
            <button onClick={() => setUpgradeModal(false)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: MUT }}>✕</button>
            <h3 style={{ fontSize: 26, fontWeight: 800, color: N, marginBottom: 5 }}>Oppgrader til Pro</h3>
            <p style={{ fontSize: 14, color: MUT, marginBottom: 20 }}>299 kr/mnd · Ubegrensede tilbud</p>
            <div style={{ background: SKY, borderRadius: 10, padding: "14px 16px", marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["Ubegrenset tilbud", "PDF-nedlasting", "Din logo", "Historikk"].map(f => (
                <div key={f} style={{ fontSize: 13, fontWeight: 600, color: N }}>✅ {f}</div>
              ))}
            </div>
            <button onClick={() => { setIsPro(true); setUpgradeModal(false); }} style={{ ...BTN, width: "100%", padding: 13, background: B, color: "#fff", fontSize: 15, marginBottom: 12 }}>🚀 Aktiver Pro (demo)</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: BRD }} />
              <span style={{ fontSize: 12, color: MUT }}>eller betal med kort</span>
              <div style={{ flex: 1, height: 1, background: BRD }} />
            </div>
            {["E-post", "Kortnummer"].map(f => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{f}</label>
                <input placeholder={f === "E-post" ? "din@epost.no" : "4242 4242 4242 4242"} style={{ ...INP, padding: "11px 14px", background: "#fff", border: `1.5px solid ${BRD}` }} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {["Utløp", "CVC"].map(f => (
                <div key={f}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{f}</label>
                  <input placeholder={f === "Utløp" ? "MM/ÅÅ" : "123"} style={{ ...INP, padding: "11px 14px", background: "#fff", border: `1.5px solid ${BRD}` }} />
                </div>
              ))}
            </div>
            <button style={{ ...BTN, width: "100%", padding: 13, background: N, color: "#fff", fontSize: 15 }}>🔒 Betal 299 kr/mnd</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SMALL COMPONENTS ──
function Section({ label, children, last }) {
  return (
    <div style={{ padding: "18px 20px", borderBottom: last ? "none" : `1px solid ${BRD}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUT, marginBottom: 12 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUT, marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 34, height: 34, border: `3px solid ${BRD}`, borderTopColor: N, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <p style={{ fontSize: 14, color: MUT }}>Genererer tilbud...</p>
    </div>
  );
}

function EmptyState({ freeLeft, isPro }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>📋</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: N, marginBottom: 7 }}>Klar til å lage tilbud</h3>
      <p style={{ fontSize: 14, color: MUT, maxWidth: 240 }}>Fyll inn info til venstre og trykk «Generer tilbud»</p>
      <div style={{ marginTop: 18, background: SKY, border: `1px solid ${BRD}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#1a3260", fontWeight: 600 }}>
        {isPro ? "Ubegrenset (Pro)" : `${freeLeft} av 3 gratis tilbud gjenstår`}
      </div>
    </div>
  );
}

function SL({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUT, paddingBottom: 7, borderBottom: `1px solid ${BRD}`, marginBottom: 13 }}>{children}</div>;
}

// ── QUOTE CARD ──
function QuoteCard({ q, isPro, onUpgrade, onSend }) {
  const [lines, setLines] = useState(q.lineItems.map((l, i) => ({ ...l, _id: i })));
  const [editing, setEditing] = useState(false);
  const [nextId, setNextId] = useState(q.lineItems.length);

  function updateLine(id, field, val) {
    setLines(prev => prev.map(l => {
      if (l._id !== id) return l;
      const u = { ...l, [field]: field === "desc" || field === "unit" ? val : Number(val) || 0 };
      if (field === "qty" || field === "unitPrice") u.total = u.qty * u.unitPrice;
      return u;
    }));
  }

  const sub = lines.reduce((a, l) => a + (Number(l.total) || 0), 0);
  const mva = Math.round(sub * 0.25);
  const total = sub + mva;
  const ei = { padding: "4px 6px", border: `1.5px solid ${B}`, borderRadius: 6, fontFamily: "system-ui", fontSize: 13, color: N, background: "#fff", outline: "none" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${BRD}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,31,61,0.08)" }}>
      <div style={{ background: N, padding: "24px 28px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {q.logo && <div style={{ width: 52, height: 52, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}><img src={q.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{q.firm}</div>
            <div style={{ fontSize: 13, color: "#8fa3c8", marginTop: 2 }}>{cap(q.trade)}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6fa3ff" }}>{q.num}</div>
          <div style={{ fontSize: 12, color: "#8fa3c8", marginTop: 2 }}>Dato: {q.date} · Gyldig: {q.validDays} dager</div>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        <SL>Parter</SL>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div><div style={{ fontSize: 10, color: MUT, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Fra</div><div style={{ fontSize: 14, fontWeight: 600 }}>{q.firm}</div></div>
          <div><div style={{ fontSize: 10, color: MUT, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Til</div><div style={{ fontSize: 14, fontWeight: 600 }}>{q.cust}</div>{q.addr && <div style={{ fontSize: 13, color: MUT }}>{q.addr}</div>}</div>
        </div>

        <SL>Oppdrag</SL>
        <div style={{ background: SKY, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: "#1a3260", lineHeight: 1.7, marginBottom: 20 }}>{q.summary}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SL>Prisdetaljer</SL>
          <button onClick={() => setEditing(e => !e)} style={{ padding: "4px 12px", background: editing ? N : SKY, color: editing ? "#fff" : B, border: `1.5px solid ${editing ? N : BRD}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {editing ? "✓ Ferdig" : "✏️ Rediger"}
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
          <thead><tr>{["Beskrivelse", "Ant.", "Enhet", "Enhetspris", "Sum", ...(editing ? [""] : [])].map((h, i) => (
            <th key={i} style={{ textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUT, padding: "7px 7px", background: OFF }}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {lines.map(l => (
              <tr key={l._id}>
                <td style={{ padding: "8px 6px", borderBottom: `1px solid ${BRD}`, fontSize: 14 }}>{editing ? <input value={l.desc} onChange={e => updateLine(l._id, "desc", e.target.value)} style={{ ...ei, width: "100%" }} /> : l.desc}</td>
                <td style={{ padding: "8px 6px", borderBottom: `1px solid ${BRD}`, fontSize: 14, width: 50 }}>{editing ? <input type="number" value={l.qty} onChange={e => updateLine(l._id, "qty", e.target.value)} style={{ ...ei, width: 46 }} /> : l.qty}</td>
                <td style={{ padding: "8px 6px", borderBottom: `1px solid ${BRD}`, fontSize: 14, width: 68 }}>{editing ? <input value={l.unit} onChange={e => updateLine(l._id, "unit", e.target.value)} style={{ ...ei, width: 62 }} /> : l.unit}</td>
                <td style={{ padding: "8px 6px", borderBottom: `1px solid ${BRD}`, fontSize: 14, textAlign: "right", width: 90 }}>{editing ? <input type="number" value={l.unitPrice} onChange={e => updateLine(l._id, "unitPrice", e.target.value)} style={{ ...ei, width: 80, textAlign: "right" }} /> : nok(l.unitPrice)}</td>
                <td style={{ padding: "8px 6px", borderBottom: `1px solid ${BRD}`, fontSize: 14, textAlign: "right", fontWeight: 700, width: 88 }}>{nok(l.total)}</td>
                {editing && <td style={{ padding: "8px 4px", borderBottom: `1px solid ${BRD}`, width: 30 }}><button onClick={() => setLines(p => p.filter(x => x._id !== l._id))} style={{ background: "#fee2e2", border: "none", borderRadius: 5, color: "#b91c1c", fontSize: 13, width: 26, height: 26, cursor: "pointer" }}>✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>

        {editing && <button onClick={() => { setLines(p => [...p, { _id: nextId, desc: "Ny post", qty: 1, unit: "stk", unitPrice: 0, total: 0 }]); setNextId(n => n + 1); }} style={{ width: "100%", padding: "8px", background: SKY, border: `1.5px dashed ${B}`, borderRadius: 7, color: B, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>+ Legg til linje</button>}

        <div style={{ background: OFF, border: `1px solid ${BRD}`, borderRadius: 10, padding: "13px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}><span style={{ color: MUT }}>Subtotal eks. MVA</span><span>{nok(sub)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}><span style={{ color: MUT }}>MVA 25 %</span><span>{nok(mva)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, fontWeight: 800, color: N, paddingTop: 10, borderTop: `2px solid ${BRD}`, marginTop: 8 }}><span>Totalt inkl. MVA</span><span>{nok(total)}</span></div>
        </div>

        <div style={{ background: SKY, borderRadius: 8, padding: "11px 13px", fontSize: 13, color: MUT, lineHeight: 1.85, marginBottom: 16 }}>
          <strong style={{ color: N }}>Betaling:</strong> {q.paymentTerms}<br />
          <strong style={{ color: N }}>Garanti:</strong> {q.warranty}
          {q.notes ? <><br /><strong style={{ color: N }}>Merknader:</strong> {q.notes}</> : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isPro ? <button onClick={() => window.print()} style={{ padding: "10px 16px", background: N, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>🖨️ PDF</button>
                 : <button onClick={onUpgrade} style={{ padding: "10px 16px", background: N, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>🔒 PDF (Pro)</button>}
          <button onClick={() => navigator.clipboard.writeText(`TILBUD ${q.num}\n${q.firm}\nKunde: ${q.cust}\n\n${q.summary}\n\nTotalt: ${nok(total)}`)} style={{ padding: "10px 16px", background: "transparent", color: N, border: `1.5px solid ${BRD}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>📋 Kopier</button>
          <button onClick={() => onSend({ ...q, lineItems: lines, sub, mva, total })} style={{ padding: "10px 16px", background: B, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>📧 Send til kunde</button>
        </div>
      </div>
    </div>
  );
}

// ── SEND MODAL ──
function SendModal({ q, onClose, onPreview }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  async function send() {
    if (!email) return;
    setStatus("sending"); setErrMsg("");
    try {
      const res = await fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, quote: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ukjent feil");
      setStatus("sent");
    } catch (e) { setStatus("error"); setErrMsg(e.message); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,50,0.65)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 34, maxWidth: 420, width: "100%", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: MUT }}>✕</button>
        <h3 style={{ fontSize: 23, fontWeight: 800, color: N, marginBottom: 4 }}>Send tilbud</h3>
        <p style={{ fontSize: 14, color: MUT, marginBottom: 20 }}>{q.num} · {nok(q.total)} inkl. MVA</p>
        <div style={{ background: SKY, borderRadius: 10, padding: "13px 15px", marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: N, marginBottom: 4 }}>{q.summary}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUT }}><span>Gyldig {q.validDays} dager</span><span style={{ fontWeight: 700, color: N }}>{nok(q.total)}</span></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Kundens e-postadresse</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kunde@epost.no" disabled={status === "sent"} style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${status === "error" ? "#fca5a5" : BRD}`, borderRadius: 8, fontSize: 15, fontFamily: "system-ui", outline: "none", boxSizing: "border-box" }} />
        </div>
        {status === "idle" && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>✅ Kunden mottar HTML-e-post med <strong>«Aksepter tilbud»-knapp</strong></div>}
        {status === "sent" && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 14, color: "#166534", fontWeight: 700, textAlign: "center" }}>🎉 E-post sendt til {email}!</div>}
        {status === "error" && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>❌ Feil: {errMsg}</div>}
        {status !== "sent" && <button onClick={send} disabled={!email || status === "sending"} style={{ width: "100%", padding: 13, background: !email || status === "sending" ? MUT : B, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: !email || status === "sending" ? "not-allowed" : "pointer", fontSize: 15, marginBottom: 10 }}>{status === "sending" ? "⏳ Sender..." : "📧 Send e-post til kunde"}</button>}
        {status === "sent" && <button onClick={onClose} style={{ width: "100%", padding: 13, background: N, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15, marginBottom: 10 }}>✓ Lukk</button>}
        <button onClick={onPreview} style={{ width: "100%", padding: 11, background: "transparent", color: B, border: `1.5px solid ${BRD}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>👁 Forhåndsvis hva kunden ser</button>
      </div>
    </div>
  );
}

// ── ACCEPT PAGE ──
function AcceptPage({ q, onBack }) {
  const [status, setStatus] = useState("pending");
  const [name, setName] = useState("");

  if (status === "accepted") return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#166534", marginBottom: 6 }}>Tilbud akseptert!</h2>
      <p style={{ fontSize: 15, color: "#166534", marginBottom: 28 }}>Signert av: <strong>{name}</strong></p>
      <div style={{ background: "#fff", borderRadius: 14, padding: "20px 28px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: MUT, marginBottom: 3 }}>Tilbudsnummer</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: N }}>{q.num}</div>
        <div style={{ fontSize: 13, color: MUT, marginTop: 12, marginBottom: 3 }}>Totalt inkl. MVA</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: N }}>{nok(q.total)}</div>
      </div>
      {onBack && <button onClick={onBack} style={{ padding: "10px 24px", background: N, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>← Tilbake</button>}
    </div>
  );

  if (status === "declined") return (
    <div style={{ minHeight: "100vh", background: "#fef2f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#991b1b", marginBottom: 8 }}>Tilbud avslått</h2>
      {onBack && <button onClick={onBack} style={{ padding: "10px 24px", background: N, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>← Tilbake</button>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: OFF, fontFamily: "system-ui" }}>
      <div style={{ background: N, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Mester<span style={{ color: "#6fa3ff" }}>bud</span></div>
        {onBack && <button onClick={onBack} style={{ padding: "6px 14px", background: "transparent", border: "1.5px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>← Tilbake</button>}
      </div>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 16, boxShadow: "0 1px 4px rgba(15,31,61,0.08)", borderTop: `4px solid ${B}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUT, marginBottom: 5 }}>Tilbud fra</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: N }}>{q.firm}</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 3 }}>Tilbudsnr: {q.num} · {nok(q.total)} inkl. MVA</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 16, boxShadow: "0 1px 4px rgba(15,31,61,0.08)" }}>
          <div style={{ fontSize: 14, color: N, lineHeight: 1.7, marginBottom: 14 }}>{q.summary}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: N, paddingTop: 10, borderTop: `2px solid ${BRD}` }}><span>Totalt inkl. MVA</span><span>{nok(q.total)}</span></div>
          <div style={{ fontSize: 12, color: MUT, marginTop: 5 }}>Betaling: {q.paymentTerms} · Gyldig: {q.validDays} dager</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "0 1px 4px rgba(15,31,61,0.08)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: N, marginBottom: 12 }}>Signer og aksepter</div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Ditt fulle navn</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ola Nordmann" style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${BRD}`, borderRadius: 8, fontSize: 15, fontFamily: "system-ui", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: MUT, marginBottom: 14, lineHeight: 1.6 }}>Ved å akseptere godtar du tilbudet fra {q.firm} på {nok(q.total)} inkl. MVA.</div>
          <button onClick={() => { if (name.trim()) setStatus("accepted"); }} disabled={!name.trim()} style={{ width: "100%", padding: 13, background: name.trim() ? "#16a34a" : MUT, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontSize: 15, marginBottom: 10 }}>✅ Aksepter tilbud</button>
          <button onClick={() => setStatus("declined")} style={{ width: "100%", padding: 11, background: "transparent", color: "#b91c1c", border: "1.5px solid #fca5a5", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>❌ Avslå tilbud</button>
        </div>
      </div>
    </div>
  );
}
