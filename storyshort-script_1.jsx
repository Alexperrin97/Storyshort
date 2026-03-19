import { useState, useRef, useCallback } from "react";
import * as mammoth from "mammoth";

// ─────────────── API ───────────────────────────────────────────
const callAPI = async (system, messages, useSearch = false, maxTokens = 4096) => {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error("API: " + data.error.message);
  if (data.type === "error") throw new Error("API error: " + JSON.stringify(data));
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  return text;
};

const parseJSON = (raw) => {
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch {}
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  try {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s !== -1 && e > s) return JSON.parse(raw.slice(s, e + 1));
  } catch {}
  return null;
};

// ─────────────── FILE READERS ──────────────────────────────────
const readTxt = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const readPdfB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
const readDocx = async (f) => { const buf = await f.arrayBuffer(); const r = await mammoth.extractRawText({ arrayBuffer: buf }); return r.value; };
const parseFile = async (f) => {
  const ext = f.name.split(".").pop().toLowerCase();
  if (ext === "txt" || ext === "md") return { type: "text", content: await readTxt(f) };
  if (ext === "docx") return { type: "text", content: await readDocx(f) };
  if (ext === "pdf") return { type: "pdf", content: await readPdfB64(f) };
  throw new Error("Format non supporté : ." + ext);
};

const extractVideoId = (url) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
};

// ─────────────── DESIGN TOKENS ─────────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  surface2: "#181818",
  border: "#2a1535",
  borderBright: "#5a2070",
  accent: "#b900ff",
  accentGlow: "#b900ff40",
  accentSoft: "#b900ff18",
  pink: "#fb00f3",
  text: "#ffffff",
  textMid: "#d0b0e8",
  textDim: "#7a5a90",
  success: "#40e890",
  successBg: "#0a1f14",
  error: "#ff4060",
  errorBg: "#1f0a10",
  gold: "#ffb800",
};

// ─────────────── BASE COMPONENTS ───────────────────────────────
const Spinner = ({ size = 14, color = C.accent }) => (
  <span style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />
);

const Btn = ({ onClick, disabled, children, variant = "primary", small, full }) => {
  const v = {
    primary: { bg: "linear-gradient(135deg,#7a00cc,#b900ff)", border: C.accentGlow, color: "#fff", shadow: "0 4px 20px #b900ff30" },
    ghost: { bg: C.surface, border: C.border, color: C.textMid, shadow: "none" },
    outline: { bg: "transparent", border: C.accentGlow, color: C.accent, shadow: "none" },
    success: { bg: "linear-gradient(135deg,#009944,#40e890)", border: "#40e89040", color: "#fff", shadow: "0 4px 20px #40e89020" },
    danger: { bg: C.errorBg, border: "#ff406040", color: C.error, shadow: "none" },
  }[variant] || {};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "6px 14px" : "11px 22px", background: disabled ? C.surface : v.bg,
      border: `1px solid ${disabled ? C.border : v.border}`, borderRadius: 10,
      color: disabled ? C.textDim : v.color, fontFamily: "'DM Sans', sans-serif",
      fontSize: small ? 12 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : v.shadow, transition: "all .15s",
      display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
      width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined,
    }}>{children}</button>
  );
};

const Tag = ({ children, color = C.accent }) => (
  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: color + "18", border: `1px solid ${color}35`, color, fontWeight: 600, letterSpacing: ".04em" }}>{children}</span>
);

const Input = ({ value, onChange, placeholder, multiline, rows = 2, style: s }) => {
  const base = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 12px", color: "#ffffff", fontFamily: "'DM Sans', sans-serif",
    fontSize: 13, lineHeight: 1.6, width: "100%", resize: multiline ? "vertical" : "none",
    ...s,
  };
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={base} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />;
};

const Section = ({ label, children }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.border},transparent)` }} />
    </div>
    {children}
  </div>
);

const ChipRow = ({ options, value, onChange, color = C.accent }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
    {options.map(o => (
      <button key={o} onClick={() => onChange(o)} style={{
        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif", transition: "all .12s",
        border: value === o ? `1px solid ${color}` : `1px solid ${C.border}`,
        background: value === o ? color + "1a" : C.surface,
        color: value === o ? color : C.textDim,
        boxShadow: value === o ? `0 0 12px ${color}20` : "none",
      }}>{o}</button>
    ))}
  </div>
);

const NumCtrl = ({ label, value, onChange, min, max }) => (
  <div>
    <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 8 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px" }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 20, lineHeight: 1, fontFamily: "monospace" }}>−</button>
      <span style={{ flex: 1, textAlign: "center", color: C.accent, fontWeight: 700, fontSize: 18 }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 20, lineHeight: 1, fontFamily: "monospace" }}>+</button>
    </div>
  </div>
);

// ─────────────── SCRIPT VIEWER ──────────────────────────────────
const ScriptViewer = ({ text }) => {
  const lines = (text || "").split("\n");
  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", lineHeight: 2, fontSize: 13 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^(INT\.|EXT\.|---|\*\*\*|ÉP|EP\.|EPISODE|ÉPISODE)/i.test(t))
          return <div key={i} style={{ color: C.accent, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700, marginTop: 16, marginBottom: 4, borderLeft: `3px solid ${C.accent}50`, paddingLeft: 10 }}>{t}</div>;
        if (/^\[.*\]$/.test(t) || /^\(.*\)$/.test(t))
          return <div key={i} style={{ color: "#50a870", fontStyle: "italic", fontSize: 12 }}>{t}</div>;
        if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s]{1,35}(\s*:)?$/.test(t) && t.length < 40)
          return <div key={i} style={{ color: C.pink, fontWeight: 700, marginTop: 10, letterSpacing: ".06em" }}>{t}</div>;
        return <div key={i} style={{ color: C.textMid }}>{line}</div>;
      })}
    </div>
  );
};

// ─────────────── LOCATION BUILDER ──────────────────────────────
const LIEUX = ["Bureau","Appartement","Café","Hôpital","École","Rue","Château","Villa","Hôtel","Tribunal","Studio","Forêt","Aéroport","Restaurant","Commissariat","Maison familiale"];
const LocBuilder = ({ locs, onChange }) => {
  const add = () => { if (locs.length >= 8) return; onChange([...locs, { id: Date.now(), name: LIEUX[locs.length % LIEUX.length], custom: "" }]); };
  const rm = (id) => onChange(locs.filter(l => l.id !== id));
  const up = (id, k, v) => onChange(locs.map(l => l.id === id ? { ...l, [k]: v } : l));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>📍 Lieux ({locs.length}/8)</span>
        <Btn onClick={add} small variant="ghost" disabled={locs.length >= 8}>+ Ajouter</Btn>
      </div>
      {locs.map((loc, i) => (
        <div key={loc.id} style={{ display: "flex", gap: 8, alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 7 }}>
          <span style={{ color: C.textDim, fontSize: 12, minWidth: 20 }}>#{i + 1}</span>
          <select value={loc.name} onChange={e => up(loc.id, "name", e.target.value)} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", flex: 1, fontWeight: 600 }}>
            {LIEUX.map(o => <option key={o} value={o} style={{ background: C.surface2 }}>{o}</option>)}
          </select>
          <input placeholder="Précision optionnelle" value={loc.custom} onChange={e => up(loc.id, "custom", e.target.value)} style={{ background: "transparent", border: "none", borderLeft: `1px solid ${C.border}`, paddingLeft: 10, color: C.textMid, fontSize: 12, fontFamily: "'DM Sans',sans-serif", width: 170 }} />
          <button onClick={() => rm(loc.id)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      ))}
      {locs.length === 0 && <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>Aucun lieu — clique "+ Ajouter"</div>}
    </div>
  );
};

// ─────────────── DNA SYSTEM ────────────────────────────────────
const DNA_SYS = `Tu es expert en analyse de micro drama viral (ReelShort, DramaBox, TikTok). Analyse les scripts fournis et extrais une ADN de style en JSON pur, sans markdown.`;
const buildDnaMessages = (files) => {
  const content = [];
  for (const f of files) {
    if (f.type === "text") content.push({ type: "text", text: `=== ${f.name} ===\n${f.content.slice(0, 8000)}` });
    else if (f.type === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.content } });
  }
  content.push({ type: "text", text: `Analyse et retourne UNIQUEMENT ce JSON:\n{"hooks":{"topFormulas":[],"openingTechniques":[]},"cliffhangers":{"types":[],"triggerPhrases":[],"placementPattern":""},"dialogues":{"rhythmStyle":"","powerFormulas":[],"emotionalTriggers":[]},"narrative":{"arcStructure":"","tensionCurve":"","characterDynamics":[]},"styleSignature":"","viralIngredients":[]}` });
  return [{ role: "user", content }];
};

const buildDnaBlock = (dna) => {
  if (!dna) return "";
  return [
    "━━━ 🧬 ADN DE STYLE ━━━",
    "Style: " + dna.styleSignature,
    "Hooks: " + (dna.hooks?.topFormulas?.slice(0, 3).join(" | ") || ""),
    "Cliffhangers: " + (dna.cliffhangers?.types?.slice(0, 3).join(", ") || ""),
    "Dialogues: " + (dna.dialogues?.rhythmStyle || "") + " | " + (dna.dialogues?.powerFormulas?.slice(0, 2).join(" | ") || ""),
    "Viral: " + (dna.viralIngredients?.join(", ") || ""),
    "Structure: " + (dna.narrative?.arcStructure || ""),
    "CONSIGNE: Réinterprète ces patterns, ne les copie pas.",
    "━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
};

// ─────────────── DNA CARD ──────────────────────────────────────
const DnaCard = ({ dna }) => {
  const [open, setOpen] = useState(false);
  if (!dna) return null;
  const Chips = ({ items, color }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {(items || []).slice(0, 5).map((x, i) => <span key={i} style={{ fontSize: 11, color, background: color + "15", border: `1px solid ${color}30`, borderRadius: 5, padding: "3px 8px" }}>{x}</span>)}
    </div>
  );
  return (
    <div style={{ background: "linear-gradient(135deg,#0d0015,#120020)", border: `1px solid ${C.borderBright}`, borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, background: `linear-gradient(135deg,${C.accent},${C.pink})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧬</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, letterSpacing: ".06em" }}>ADN DE STYLE ACTIF</div>
          <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic", marginTop: 2 }}>{dna.styleSignature}</div>
        </div>
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
          {open ? "↑ Réduire" : "↓ Détails"}
        </button>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>⚡ Hooks</div><Chips items={dna.hooks?.topFormulas} color={C.accent} /></div>
          <div><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>🔚 Cliffhangers</div><Chips items={dna.cliffhangers?.types} color={C.pink} /></div>
          <div><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>💬 Formules</div><Chips items={dna.dialogues?.powerFormulas} color="#50c8ff" /></div>
          <div><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>📈 Viral</div><Chips items={dna.viralIngredients} color={C.success} /></div>
        </div>
      )}
    </div>
  );
};

// ─────────────── STYLE LAB ─────────────────────────────────────
const StyleLab = ({ onDone, existingDna }) => {
  const [tab, setTab] = useState("youtube");
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytQueue, setYtQueue] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dna, setDna] = useState(existingDna || null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFiles = async (raw) => {
    setParsing(true); setError(null);
    const parsed = [];
    for (const f of Array.from(raw)) {
      try { parsed.push({ name: f.name, size: f.size, ...(await parseFile(f)) }); }
      catch (e) { setError(`"${f.name}" : ${e.message}`); }
    }
    setFiles(p => [...p, ...parsed]); setParsing(false);
  };

  const addYt = () => {
    const url = ytUrl.trim(); if (!url) return;
    const id = extractVideoId(url);
    if (!id) { setError("URL YouTube non reconnue."); return; }
    if (ytQueue.find(q => q.id === id)) { setError("Vidéo déjà dans la liste."); return; }
    setYtQueue(q => [...q, { url, id, status: "pending", msg: "" }]);
    setYtUrl(""); setError(null);
  };

  const fetchYt = async () => {
    const pending = ytQueue.filter(q => q.status === "pending" || q.status === "error");
    if (!pending.length) return;
    setYtLoading(true);
    for (const item of pending) {
      setYtQueue(q => q.map(x => x.id === item.id ? { ...x, status: "loading" } : x));
      try {
        const transcript = await callAPI(
          "Récupère la transcription complète de cette vidéo YouTube via web search. Retourne UNIQUEMENT le texte brut des dialogues/narration, sans timestamps.",
          [{ role: "user", content: `Transcris cette vidéo : https://www.youtube.com/watch?v=${item.id}` }],
          true
        );
        if (!transcript || transcript.length < 80) throw new Error("Transcription vide ou indisponible.");
        setFiles(p => [...p.filter(f => f.name !== "YT:" + item.id), { name: "YT:" + item.id, type: "text", content: transcript, isYt: true }]);
        setYtQueue(q => q.map(x => x.id === item.id ? { ...x, status: "done", msg: transcript.length.toLocaleString() + " car." } : x));
      } catch (e) {
        setYtQueue(q => q.map(x => x.id === item.id ? { ...x, status: "error", msg: e.message } : x));
      }
    }
    setYtLoading(false);
  };

  const analyze = async () => {
    if (!files.length) return;
    setAnalyzing(true); setError(null);
    try {
      const raw = await callAPI(DNA_SYS, buildDnaMessages(files));
      const p = parseJSON(raw);
      if (!p) throw new Error("Parsing JSON échoué.");
      setDna(p);
    } catch (e) { setError(e.message); }
    setAnalyzing(false);
  };

  const onDrop = useCallback(e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }, []);
  const totalRefs = files.length;
  const ytDone = ytQueue.filter(q => q.status === "done").length;
  const ytPending = ytQueue.filter(q => q.status === "pending" || q.status === "error").length;

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: "9px", background: tab === id ? C.surface2 : "transparent", border: `1px solid ${tab === id ? C.border : "transparent"}`, borderRadius: 8, color: tab === id ? C.accent : C.textDim, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 8px", letterSpacing: "-.02em" }}>🧬 Style Lab</h2>
        <p style={{ color: C.textMid, fontSize: 14, margin: 0, lineHeight: 1.6 }}>Charge tes top performers comme références. L'IA en extrait les patterns viraux injectés dans chaque génération.</p>
      </div>

      <div style={{ display: "flex", gap: 4, background: C.surface, borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <TabBtn id="youtube" icon="▶" label="Liens YouTube" />
        <TabBtn id="files" icon="📂" label="Fichiers .txt .pdf .docx" />
      </div>

      {tab === "youtube" && (
        <div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={ytUrl} onChange={setYtUrl} placeholder="https://youtube.com/watch?v=..." style={{ flex: 1 }} />
              <Btn onClick={addYt} variant="outline" small>+ Ajouter</Btn>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>Supporte : /watch · youtu.be · /shorts · /embed</div>
          </div>
          {ytQueue.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, background: item.status === "done" ? C.successBg : item.status === "error" ? C.errorBg : C.surface, border: `1px solid ${item.status === "done" ? C.success + "30" : item.status === "error" ? C.error + "30" : C.border}`, borderRadius: 9, padding: "10px 14px", marginBottom: 7 }}>
              {item.status === "loading" ? <Spinner /> : <span style={{ fontSize: 16 }}>{item.status === "done" ? "✅" : item.status === "error" ? "❌" : "▶"}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.textMid, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>youtube.com/watch?v={item.id}</div>
                {item.msg && <div style={{ fontSize: 11, color: item.status === "done" ? C.success : C.error, marginTop: 2 }}>{item.msg}</div>}
              </div>
              <button onClick={() => setYtQueue(q => q.filter(x => x.id !== item.id))} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
          {ytPending > 0 && !dna && <Btn onClick={fetchYt} disabled={ytLoading} full variant="outline" style={{ marginTop: 4 }}>{ytLoading ? <><Spinner /> Transcription...</> : `▶ Transcrire ${ytPending} vidéo${ytPending > 1 ? "s" : ""}`}</Btn>}
          {!ytQueue.length && <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, padding: "24px 0" }}>Colle des liens YouTube ci-dessus</div>}
        </div>
      )}

      {tab === "files" && (
        <div>
          <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? C.accent : C.border}`, borderRadius: 14, padding: "32px", textAlign: "center", cursor: "pointer", background: dragging ? C.accentSoft : "transparent", transition: "all .2s", marginBottom: 12 }}>
            <input ref={fileRef} type="file" multiple accept=".txt,.pdf,.docx,.md" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
            <div style={{ fontSize: 32, marginBottom: 10 }}>{parsing ? "⏳" : "📂"}</div>
            <div style={{ color: C.textMid, fontSize: 13 }}>{parsing ? "Lecture..." : "Glisse tes fichiers ou clique pour parcourir"}</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>.txt · .pdf · .docx</div>
          </div>
          {files.filter(f => !f.isYt).map(f => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 14px", marginBottom: 7 }}>
              <span style={{ fontSize: 16 }}>{f.name.endsWith(".pdf") ? "📄" : f.name.endsWith(".docx") ? "📝" : "📃"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.textMid, fontSize: 13 }}>{f.name}</div>
                <div style={{ color: C.textDim, fontSize: 11 }}>{f.type === "text" ? f.content?.length?.toLocaleString() + " car." : "PDF"}</div>
              </div>
              <button onClick={() => setFiles(f2 => f2.filter(x => x.name !== f.name))} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {(totalRefs > 0 || ytDone > 0) && (
        <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
          {ytDone > 0 && <Tag color={C.success}>▶ {ytDone} vidéo{ytDone > 1 ? "s" : ""} transcrite{ytDone > 1 ? "s" : ""}</Tag>}
          {files.filter(f => !f.isYt).length > 0 && <Tag color="#50a8ff">📂 {files.filter(f => !f.isYt).length} fichier{files.filter(f => !f.isYt).length > 1 ? "s" : ""}</Tag>}
          <Tag color={C.textMid}>{totalRefs} référence{totalRefs > 1 ? "s" : ""} au total</Tag>
        </div>
      )}
      {error && <div style={{ background: C.errorBg, border: `1px solid ${C.error}30`, borderRadius: 9, padding: "12px 16px", color: C.error, fontSize: 13, marginBottom: 14 }}>⚠ {error}</div>}

      {totalRefs > 0 && !dna && (
        <Btn onClick={analyze} disabled={analyzing} full variant="primary" style={{ marginBottom: 16 }}>
          {analyzing ? <><Spinner color="#fff" /> Extraction de l'ADN...</> : `🧬 Analyser ${totalRefs} référence${totalRefs > 1 ? "s" : ""}`}
        </Btn>
      )}

      {dna && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <DnaCard dna={dna} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" small onClick={() => { setDna(null); setFiles([]); setYtQueue([]); }}>↺ Recommencer</Btn>
            <Btn variant="success" full onClick={() => onDone(dna)}>✓ Utiliser cet ADN → Réglages</Btn>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={() => onDone(null)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          Passer cette étape (sans ADN)
        </button>
      </div>
    </div>
  );
};

// ─────────────── SETTINGS ──────────────────────────────────────
const Settings = ({ dna, onGenerate, onGoLab }) => {
  const [genre, setGenre] = useState("Romance");
  const [ton, setTon] = useState("Intense");
  const [locs, setLocs] = useState([{ id: 1, name: "Bureau", custom: "" }, { id: 2, name: "Appartement", custom: "" }]);
  const [nbMain, setNbMain] = useState(3);
  const [nbExtras, setNbExtras] = useState(4);
  const [nbEp, setNbEp] = useState(5);
  const [dur, setDur] = useState("60s");
  const [langue, setLangue] = useState("Français");
  const [idee, setIdee] = useState("");

  const total = (() => { const m = { "30s": .5, "60s": 1, "90s": 1.5, "3 min": 3, "5 min": 5 }; const t = nbEp * (m[dur] || 1); return t < 60 ? t + " min" : Math.floor(t / 60) + "h" + (t % 60 ? " " + t % 60 + "min" : ""); })();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 8px", letterSpacing: "-.02em" }}>⚙️ Réglages de la série</h2>
        <p style={{ color: C.textMid, fontSize: 14, margin: 0 }}>Configure ta série — l'IA générera la bible que tu pourras modifier avant d'écrire les scripts.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {dna ? <DnaCard dna={dna} /> : (
          <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.textDim }}>Aucun ADN chargé</span>
            <Btn variant="outline" small onClick={onGoLab}>🧬 Charger des références</Btn>
          </div>
        )}

        <Section label="🎭 Genre & Ton">
          <ChipRow options={["Romance","Thriller","Drame","Trahison","Revenge","Comédie","Horreur","Fantasy"]} value={genre} onChange={setGenre} />
          <div style={{ marginTop: 8 }}>
            <ChipRow options={["Intense","Sombre","Romantique","Explosif","Mystérieux","Humoristique"]} value={ton} onChange={setTon} color={C.pink} />
          </div>
        </Section>

        <Section label="📍 Lieux">
          <LocBuilder locs={locs} onChange={setLocs} />
        </Section>

        <Section label="🎬 Distribution">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <NumCtrl label="Acteurs principaux" value={nbMain} onChange={setNbMain} min={1} max={8} />
            <NumCtrl label="Figurants récurrents" value={nbExtras} onChange={setNbExtras} min={0} max={20} />
          </div>
        </Section>

        <Section label="📺 Structure">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
            <NumCtrl label="Nombre d'épisodes" value={nbEp} onChange={setNbEp} min={1} max={60} />
            <div>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 8 }}>Durée / épisode</div>
              <ChipRow options={["30s","60s","90s","3 min","5 min"]} value={dur} onChange={setDur} color="#50a8ff" />
            </div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textMid }}>
            ≈ Durée totale : <span style={{ color: C.accent, fontWeight: 700 }}>{total}</span>
            {nbEp > 20 && <span style={{ color: C.textDim, fontSize: 11, marginLeft: 10 }}>· génération ~{Math.ceil(nbEp * 0.4)} min</span>}
          </div>
        </Section>

        <Section label="🌐 Langue">
          <ChipRow options={["Français","English","Español","Deutsch"]} value={langue} onChange={setLangue} color="#50c8a0" />
        </Section>

        <Section label="💡 Prémisse (optionnel)">
          <Input value={idee} onChange={setIdee} placeholder="Ex : Une assistante découvre que son patron est le mari de sa meilleure amie..." multiline rows={3} />
        </Section>

        <Btn variant="primary" full onClick={() => onGenerate({ genre, ton, locs, nbMain, nbExtras, nbEp, dur, langue, idee })}>
          ✍ Générer la bible de la série
        </Btn>
      </div>
    </div>
  );
};

// ─────────────── BIBLE EDITOR ──────────────────────────────────
const BibleEditor = ({ bible, setBible, onGenerateEpisodes, loading }) => {
  const updateChar = (i, k, v) => setBible(b => ({ ...b, characters: b.characters.map((c, j) => j === i ? { ...c, [k]: v } : c) }));
  const addChar = () => setBible(b => ({ ...b, characters: [...b.characters, { name: "Nouveau perso", role: "Rôle", trait: "Trait", stakes: "Enjeu", type: "main" }] }));
  const removeChar = (i) => setBible(b => ({ ...b, characters: b.characters.filter((_, j) => j !== i) }));
  const updateEp = (i, k, v) => setBible(b => ({ ...b, episodes: b.episodes.map((e, j) => j === i ? { ...e, [k]: v } : e) }));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 4px", letterSpacing: "-.02em" }}>📖 Bible de la série</h2>
        <p style={{ color: C.textMid, fontSize: 14, margin: 0 }}>L'IA a généré cette bible. Modifie tout ce que tu veux avant de lancer l'écriture des épisodes.</p>
      </div>

      {/* Title / Tagline / Synopsis */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 6 }}>Titre de la série</div>
            <Input value={bible.title || ""} onChange={v => setBible(b => ({ ...b, title: v }))} placeholder="Titre" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 6 }}>Tagline</div>
            <Input value={bible.tagline || ""} onChange={v => setBible(b => ({ ...b, tagline: v }))} placeholder="Accroche courte" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 6 }}>Synopsis général</div>
          <Input value={bible.synopsis || ""} onChange={v => setBible(b => ({ ...b, synopsis: v }))} placeholder="Synopsis..." multiline rows={2} />
        </div>
      </div>

      {/* Characters */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>🎭 Personnages & Enjeux</span>
            <div style={{ height: 1, width: 40, background: C.border }} />
          </div>
          <Btn variant="outline" small onClick={addChar}>+ Personnage</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(bible.characters || []).map((char, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${char.type === "main" ? C.borderBright : C.border}`, borderRadius: 12, padding: "16px 18px", position: "relative" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: char.type === "main" ? `linear-gradient(135deg,${C.accent},${C.pink})` : C.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                  {char.type === "main" ? "★" : "·"}
                </div>
                <select value={char.type} onChange={e => updateChar(i, "type", e.target.value)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, color: char.type === "main" ? C.accent : C.textMid, fontSize: 11, padding: "3px 8px", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
                  <option value="main" style={{ background: C.surface2 }}>Principal</option>
                  <option value="extra" style={{ background: C.surface2 }}>Figurant</option>
                </select>
                <button onClick={() => removeChar(i)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18, marginLeft: "auto" }}>×</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>Nom</div>
                  <Input value={char.name || ""} onChange={v => updateChar(i, "name", v)} placeholder="Prénom" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>Rôle</div>
                  <Input value={char.role || ""} onChange={v => updateChar(i, "role", v)} placeholder="Ex : PDG ambitieux" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>Trait</div>
                  <Input value={char.trait || ""} onChange={v => updateChar(i, "trait", v)} placeholder="Ex : Froid en apparence" />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.pink, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>⚡ Enjeu principal</div>
                <Input value={char.stakes || ""} onChange={v => updateChar(i, "stakes", v)} placeholder="Ce que ce personnage risque vraiment dans cette série..." multiline rows={2} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Episodes */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>🎬 Arc des épisodes</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.border},transparent)` }} />
          <Tag color={C.textMid}>{(bible.episodes || []).length} épisodes</Tag>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(bible.episodes || []).map((ep, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: ".1em", minWidth: 50 }}>ÉP. {i + 1}</span>
                <Input value={ep.title || ""} onChange={v => updateEp(i, "title", v)} placeholder="Titre de l'épisode" style={{ flex: 1, border: "none", background: "transparent", padding: "4px 0", fontSize: 14, fontWeight: 600, color: C.text }} />
                <Tag color="#50a8ff">{ep.location || "—"}</Tag>
              </div>
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>Synopsis</div>
                  <Input value={ep.synopsis || ""} onChange={v => updateEp(i, "synopsis", v)} placeholder="Ce qui se passe..." multiline rows={2} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>⚡ Hook d'ouverture</div>
                  <Input value={ep.hook || ""} onChange={v => updateEp(i, "hook", v)} placeholder="Les 3 premières secondes..." multiline rows={2} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10, color: C.pink, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 5 }}>🔚 Cliffhanger / Fin</div>
                  <Input value={ep.cliffhanger || ""} onChange={v => updateEp(i, "cliffhanger", v)} placeholder="Comment ça finit / le cliffhanger..." />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Btn variant="primary" full onClick={onGenerateEpisodes} disabled={loading}>
        {loading ? <><Spinner color="#fff" /> Génération en cours...</> : `🎬 Écrire les ${(bible.episodes || []).length} scripts`}
      </Btn>
    </div>
  );
};

// ─────────────── MAIN APP ──────────────────────────────────────
export default function App() {
  const [dna, setDna] = useState(null);
  const [step, setStep] = useState("lab"); // lab | settings | generating-bible | bible | generating-eps | board
  const [settings, setSettings] = useState(null);
  const [bible, setBible] = useState(null);
  const [scripts, setScripts] = useState({});
  const [scriptStatus, setScriptStatus] = useState({});
  const [genProgress, setGenProgress] = useState({ phase: "", done: 0, total: 0 });
  const [selectedEp, setSelectedEp] = useState(null);
  const [adjustInput, setAdjustInput] = useState("");
  const [adjustHistory, setAdjustHistory] = useState({});
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── Build prompts ──────────────────────────────────────────
  const dnaBlock = buildDnaBlock(dna);

  const buildBiblePrompt = (s) => {
    const lieux = s.locs.map((l, i) => (i + 1) + ". " + l.name + (l.custom ? " (" + l.custom + ")" : "")).join(", ");
    const premise = s.idee || "Invente une histoire originale et virale";
    return [
      "TACHE: Generer une bible de serie de micro drama vertical.",
      "REGLE ABSOLUE: Repondre UNIQUEMENT avec du JSON brut. Zero texte avant ou apres. Zero markdown.",
      "PARAMETRES: Genre=" + s.genre + " | Ton=" + s.ton + " | Langue=" + s.langue,
      "Lieux=" + (lieux || "Libre") + " | Acteurs=" + s.nbMain + " | Figurants=" + s.nbExtras,
      "Episodes=" + s.nbEp + " | Duree=" + s.dur,
      "Premise=" + premise,
      dnaBlock,
      "",
      "RETOURNE CE JSON (exactement " + s.nbEp + " elements dans episodes, index 0 a " + (s.nbEp - 1) + "):",
      '{"title":"...","tagline":"...","synopsis":"...","characters":[{"name":"...","role":"...","trait":"...","stakes":"Ce que ce personnage risque vraiment","type":"main"}],"locations":[{"name":"...","description":"..."}],"episodes":[{"index":0,"title":"...","synopsis":"...","hook":"...","mainCharacters":["..."],"location":"...","cliffhanger":"..."}]}',
      "Commence directement par { sans rien avant."
    ].join("\n");
  };

  const buildEpPrompt = (epMeta, s) => {
    const lieux = s.locs.map((l, i) => (i + 1) + ". " + l.name + (l.custom ? " (" + l.custom + ")" : "")).join("; ");
    const chars = bible.characters.map(c => c.name + " (" + c.role + ", enjeu: " + (c.stakes || c.trait) + ")").join(", ");
    return [
      "Tu es scénariste expert en vertical drama viral.",
      "SERIE: " + bible.title + " | " + bible.synopsis,
      "PERSONNAGES: " + chars,
      "LIEUX: " + lieux,
      dnaBlock,
      "",
      "EPISODE " + (epMeta.index + 1) + ': "' + epMeta.title + '"',
      "Synopsis: " + epMeta.synopsis,
      "Hook d'ouverture: " + epMeta.hook,
      "Perso: " + (epMeta.mainCharacters || []).join(", "),
      "Lieu: " + epMeta.location,
      "Duree: " + s.dur,
      "Fin/Cliffhanger: " + epMeta.cliffhanger,
      "",
      "REGLES: hook percutant ligne 1, noms perso en MAJUSCULES, scenes entre [crochets], tension croissante, langue " + s.langue + ".",
      "Ecris UNIQUEMENT le script."
    ].join("\n");
  };

  const buildAdjustPrompt = (epMeta, currentScript, instruction) => [
    "Tu es scénariste expert. Réécris ce script en appliquant l'ajustement demandé.",
    "Episode: " + epMeta.title,
    "Ajustement: " + instruction,
    dnaBlock,
    "",
    "SCRIPT ACTUEL:",
    currentScript,
    "",
    "Réécris le script complet intégrant l'ajustement. Écris UNIQUEMENT le script révisé."
  ].join("\n");

  // ── Generate bible ────────────────────────────────────────
  const generateBible = async (s) => {
    setSettings(s); setError(null); setStep("generating-bible");
    try {
      const lieux = s.locs.map((l, i) => (i+1) + ". " + l.name + (l.custom ? " (" + l.custom + ")" : "")).join(", ");
      const premise = s.idee || "invente une histoire originale et virale";
      const dnaB = buildDnaBlock(dna);

      // ── Appel 1 : univers + personnages ──────────────────────
      const userMsg1 = [
        "Crée la bible d'une série de micro drama vertical.",
        "Genre: " + s.genre,
        "Ton: " + s.ton,
        "Langue: " + s.langue,
        "Lieux: " + (lieux || "libre"),
        "Acteurs principaux: " + s.nbMain,
        "Figurants: " + s.nbExtras,
        "Prémisse: " + premise,
        dnaB,
        "",
        'Réponds avec ce JSON exactement (remplace les valeurs, garde les clés):',
        '{"title":"TITRE","tagline":"TAGLINE","synopsis":"SYNOPSIS","characters":[{"name":"NOM","role":"ROLE","trait":"TRAIT","stakes":"ENJEU","type":"main"}],"locations":[{"name":"LIEU","description":"DESC"}]}',
      ].filter(Boolean).join("\n");

      const raw1 = await callAPI(null, [{ role: "user", content: userMsg1 }]);
      const part1 = parseJSON(raw1);
      if (!part1 || !part1.title) {
        throw new Error("Réponse API invalide: " + raw1.slice(0, 400));
      }

      // ── Appel 2 : épisodes par batch de 8 ────────────────────
      const allEps = [];
      const batchSize = 8;
      for (let start = 0; start < s.nbEp; start += batchSize) {
        const end = Math.min(start + batchSize, s.nbEp);
        const count = end - start;
        const charList = (part1.characters || []).map(c => c.name).join(", ");
        const locList = (part1.locations || []).map(l => l.name).join(", ");

        const userMsg2 = [
          "Série: " + part1.title,
          "Genre: " + s.genre + " | Ton: " + s.ton,
          "Personnages: " + charList,
          "Lieux disponibles: " + locList,
          dnaB,
          "",
          "Génère exactement " + count + " épisodes (numérotés " + start + " à " + (end-1) + ").",
          'Réponds avec ce JSON (tableau episodes avec ' + count + ' éléments):',
          '{"episodes":[{"index":' + start + ',"title":"TITRE","synopsis":"SYNOPSIS","hook":"HOOK","mainCharacters":["NOM"],"location":"LIEU","cliffhanger":"FIN"}]}',
        ].filter(Boolean).join("\n");

        const raw2 = await callAPI(null, [{ role: "user", content: userMsg2 }]);
        const part2 = parseJSON(raw2);
        if (!part2?.episodes?.length) {
          throw new Error("Épisodes invalides: " + raw2.slice(0, 300));
        }
        allEps.push(...part2.episodes);
      }

      setBible({
        ...part1,
        characters: (part1.characters || []).map(c => ({ stakes: "", ...c })),
        episodes: allEps.map((ep, i) => ({ index: i, ...ep })),
      });
      setStep("bible");
    } catch (e) {
      setError(e.message);
      setStep("settings");
    }
  };

  // ── Generate episodes ─────────────────────────────────────
  const generateEpisodes = async () => {
    setError(null); setStep("generating-eps");
    setGenProgress({ phase: "Préparation...", done: 0, total: bible.episodes.length });
    const newScripts = {}, newStatus = {};
    try {
      for (let i = 0; i < bible.episodes.length; i++) {
        const ep = bible.episodes[i];
        setGenProgress({ phase: `Épisode ${i + 1} — "${ep.title}"`, done: i, total: bible.episodes.length });
        newStatus[i] = "loading"; setScriptStatus({ ...newStatus });
        newScripts[i] = await callAPI("Scénariste expert. Réponds uniquement avec le script.", [{ role: "user", content: buildEpPrompt(ep, settings) }]);
        newStatus[i] = "done"; setScripts({ ...newScripts }); setScriptStatus({ ...newStatus });
      }
      setGenProgress({ phase: "Terminé !", done: bible.episodes.length, total: bible.episodes.length });
      setSelectedEp(0); setStep("board");
    } catch (e) {
      setError(e.message); setStep("bible");
    }
  };

  const adjustEp = async (idx) => {
    if (!adjustInput.trim()) return;
    const instruction = adjustInput.trim(); setAdjustInput("");
    setScriptStatus(s => ({ ...s, [idx]: "loading" }));
    setAdjustHistory(h => ({ ...h, [idx]: [...(h[idx] || []), { instruction, ts: new Date().toLocaleTimeString() }] }));
    try {
      const revised = await callAPI("Scénariste expert. Uniquement le script révisé.", [{ role: "user", content: buildAdjustPrompt(bible.episodes[idx], scripts[idx], instruction) }]);
      setScripts(s => ({ ...s, [idx]: revised }));
    } catch {}
    setScriptStatus(s => ({ ...s, [idx]: "done" }));
  };

  const regenEp = async (idx) => {
    setScriptStatus(s => ({ ...s, [idx]: "loading" }));
    try {
      const ep = await callAPI("Scénariste expert. Uniquement le script.", [{ role: "user", content: buildEpPrompt(bible.episodes[idx], settings) }]);
      setScripts(s => ({ ...s, [idx]: ep }));
    } catch {}
    setScriptStatus(s => ({ ...s, [idx]: "done" }));
  };

  const copyScript = async (idx) => { await navigator.clipboard.writeText(scripts[idx] || ""); setCopied(idx); setTimeout(() => setCopied(false), 2000); };
  const totalWords = Object.values(scripts).join(" ").split(/\s+/).filter(Boolean).length;
  const isGenerating = step === "generating-bible" || step === "generating-eps";

  // ── RENDER ────────────────────────────────────────────────
  const STEPS_META = [
    { id: "lab", label: "Style Lab", icon: "🧬" },
    { id: "settings", label: "Réglages", icon: "⚙️" },
    { id: "bible", label: "Bible", icon: "📖" },
    { id: "board", label: "Scripts", icon: "🎬" },
  ];
  const stepOrder = ["lab", "settings", "generating-bible", "bible", "generating-eps", "board"];
  const stepIdx = stepOrder.indexOf(step);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        textarea:focus, input:focus, select:focus { outline: 2px solid ${C.accentGlow}; outline-offset: 1px; }
        textarea::placeholder, input::placeholder { color: ${C.textDim}; }
        select option { background: ${C.surface2}; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 58, display: "flex", alignItems: "center", gap: 20, position: "sticky", top: 0, zIndex: 200 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg,${C.accent},${C.pink})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>▶</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, background: `linear-gradient(90deg,${C.accent},${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Storyshort</div>
            <div style={{ fontSize: 9, color: C.textDim, letterSpacing: ".18em", textTransform: "uppercase", lineHeight: 1 }}>Script</div>
          </div>
        </div>

        {/* Step bar */}
        {!isGenerating && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            {STEPS_META.map((s, i) => {
              const order = ["lab","settings","bible","board"];
              const active = step === s.id || (step === "generating-bible" && s.id === "bible") || (step === "generating-eps" && s.id === "board");
              const done = stepOrder.indexOf(step) > stepOrder.indexOf(s.id);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: active ? C.accentSoft : "transparent", border: `1px solid ${active ? C.accentGlow : "transparent"}` }}>
                    <span style={{ fontSize: 13 }}>{done ? "✓" : s.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.accent : done ? C.success : C.textDim }}>{s.label}</span>
                  </div>
                  {i < STEPS_META.length - 1 && <span style={{ color: C.textDim, fontSize: 12 }}>›</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Right info */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {dna && step !== "lab" && <Tag color={C.accent}>🧬 ADN actif</Tag>}
          {step === "board" && bible && (
            <>
              <Tag color={C.textMid}>{bible.title}</Tag>
              <Tag color={C.success}>{Object.keys(scripts).length} épisodes</Tag>
              <Tag color="#50a8ff">{totalWords.toLocaleString()} mots</Tag>
            </>
          )}
          {step !== "lab" && <Btn variant="ghost" small onClick={() => { setStep("lab"); setBible(null); setScripts({}); setScriptStatus({}); setSelectedEp(null); setDna(null); }}>← Nouveau</Btn>}
        </div>
      </header>

      {/* ── STYLE LAB ── */}
      {step === "lab" && <StyleLab onDone={d => { setDna(d); setStep("settings"); }} existingDna={dna} />}

      {/* ── SETTINGS ── */}
      {step === "settings" && <Settings dna={dna} onGenerate={generateBible} onGoLab={() => setStep("lab")} />}

      {/* ── GENERATING BIBLE ── */}
      {step === "generating-bible" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 24 }}>
          <div style={{ width: 64, height: 64, background: `linear-gradient(135deg,${C.accent},${C.pink})`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📖</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: C.text }}>Génération de la bible...</h2>
            <p style={{ color: C.textMid, fontSize: 14, margin: 0, animation: "pulse 2s infinite" }}>L'IA construit l'univers, les personnages et l'arc narratif</p>
          </div>
          <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner size={32} /></div>
        </div>
      )}

      {/* ── BIBLE EDITOR ── */}
      {step === "bible" && bible && (
        <BibleEditor bible={bible} setBible={setBible} onGenerateEpisodes={generateEpisodes} loading={false} />
      )}

      {/* ── GENERATING EPISODES ── */}
      {step === "generating-eps" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 24 }}>
          <div style={{ width: 64, height: 64, background: `linear-gradient(135deg,${C.accent},${C.pink})`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>✍️</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: C.text }}>Écriture des scripts...</h2>
            <p style={{ color: C.accent, fontSize: 14, margin: 0, animation: "pulse 2s infinite", fontWeight: 600 }}>{genProgress.phase}</p>
          </div>
          <div style={{ width: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textDim, marginBottom: 8 }}>
              <span>Progression</span><span style={{ color: C.accent, fontWeight: 700 }}>{genProgress.done} / {genProgress.total}</span>
            </div>
            <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(genProgress.done / Math.max(genProgress.total, 1)) * 100}%`, background: `linear-gradient(90deg,${C.accent},${C.pink})`, borderRadius: 3, transition: "width .5s ease", boxShadow: `0 0 12px ${C.accentGlow}` }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", maxWidth: 520 }}>
            {(bible?.episodes || []).map((_, i) => {
              const sz = bible.episodes.length > 30 ? 26 : 36;
              return (
                <div key={i} style={{ width: sz, height: sz, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: sz > 30 ? 11 : 9, fontWeight: 700, transition: "all .3s", background: scriptStatus[i] === "done" ? C.successBg : i === genProgress.done ? C.accentSoft : C.surface, border: `1px solid ${scriptStatus[i] === "done" ? C.success + "40" : i === genProgress.done ? C.accentGlow : C.border}`, color: scriptStatus[i] === "done" ? C.success : i === genProgress.done ? C.accent : C.textDim }}>
                  {scriptStatus[i] === "done" ? "✓" : i === genProgress.done ? <Spinner size={12} /> : i + 1}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOARD ── */}
      {step === "board" && bible && (
        <div style={{ display: "flex", height: "calc(100vh - 58px)" }}>
          {/* Sidebar */}
          <div style={{ width: 268, background: C.surface, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: "-.01em" }}>{bible.title}</div>
              <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic", marginBottom: 10 }}>{bible.tagline}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {bible.characters?.filter(c => c.type === "main").map(c => (
                  <span key={c.name} style={{ fontSize: 10, color: C.accent, background: C.accentSoft, border: `1px solid ${C.accentGlow}`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{c.name}</span>
                ))}
              </div>
            </div>
            {bible.episodes?.map((ep, i) => (
              <div key={i} onClick={() => setSelectedEp(i)} style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}20`, cursor: "pointer", background: selectedEp === i ? C.accentSoft : "transparent", borderLeft: `3px solid ${selectedEp === i ? C.accent : "transparent"}`, transition: "all .1s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: selectedEp === i ? C.accent : C.textDim, fontWeight: 700, letterSpacing: ".08em" }}>ÉP. {i + 1}</span>
                  {scriptStatus[i] === "loading" && <Spinner size={10} />}
                  {(adjustHistory[i]?.length || 0) > 0 && <span style={{ fontSize: 9, color: C.success, marginLeft: "auto" }}>✎ {adjustHistory[i].length}</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedEp === i ? C.text : C.textMid, lineHeight: 1.4 }}>{ep.title}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{ep.location}</div>
              </div>
            ))}
          </div>

          {/* Main panel */}
          {selectedEp !== null ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Episode header */}
              <div style={{ padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "flex-start", gap: 16, flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: C.accent, fontWeight: 800, letterSpacing: ".12em" }}>ÉPISODE {selectedEp + 1}</span>
                    <Tag color="#50a8ff">{bible.episodes[selectedEp].location}</Tag>
                    {bible.episodes[selectedEp].mainCharacters?.map(c => <Tag key={c} color={C.pink}>{c}</Tag>)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-.01em" }}>{bible.episodes[selectedEp].title}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 3, fontStyle: "italic" }}>{bible.episodes[selectedEp].synopsis}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Btn small variant="ghost" onClick={() => regenEp(selectedEp)} disabled={scriptStatus[selectedEp] === "loading"}>
                    {scriptStatus[selectedEp] === "loading" ? <Spinner /> : "↺"} Regénérer
                  </Btn>
                  <Btn small variant={copied === selectedEp ? "success" : "ghost"} onClick={() => copyScript(selectedEp)}>
                    {copied === selectedEp ? "✓ Copié" : "⎘ Copier"}
                  </Btn>
                </div>
              </div>

              {/* Script viewer */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
                {scriptStatus[selectedEp] === "loading" ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14 }}>
                    <Spinner size={28} /><span style={{ color: C.textDim, fontSize: 13, animation: "pulse 2s infinite" }}>Réécriture en cours...</span>
                  </div>
                ) : scripts[selectedEp] ? <ScriptViewer text={scripts[selectedEp]} />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDim }}>Script non disponible</div>}
              </div>

              {/* Adjust panel */}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 24px", background: C.surface, flexShrink: 0 }}>
                {(adjustHistory[selectedEp]?.length || 0) > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {adjustHistory[selectedEp].map((h, j) => (
                      <span key={j} style={{ fontSize: 10, color: C.success, background: C.successBg, border: `1px solid ${C.success}25`, borderRadius: 5, padding: "3px 8px" }}>
                        ✎ {h.instruction.slice(0, 50)}{h.instruction.length > 50 ? "…" : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <textarea value={adjustInput} onChange={e => setAdjustInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) adjustEp(selectedEp); }}
                    placeholder="Décris ton ajustement... ex : rends le dialogue final plus explosif · ajoute un retournement · change de lieu  (⌘↵ pour envoyer)"
                    rows={2} disabled={scriptStatus[selectedEp] === "loading"}
                    style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 14px", color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13, lineHeight: 1.6, resize: "none" }} />
                  <Btn onClick={() => adjustEp(selectedEp)} disabled={!adjustInput.trim() || scriptStatus[selectedEp] === "loading"} variant="primary">
                    {scriptStatus[selectedEp] === "loading" ? <Spinner color="#fff" /> : "✎"} Ajuster
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: C.textDim }}>
              <div style={{ fontSize: 40 }}>🎬</div>
              <span style={{ fontSize: 14 }}>Sélectionne un épisode dans la liste</span>
            </div>
          )}
        </div>
      )}

      {/* Error toast */}
      {error && step !== "board" && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.errorBg, border: `1px solid ${C.error}40`, borderRadius: 10, padding: "12px 20px", color: C.error, fontSize: 13, maxWidth: 480, zIndex: 999, boxShadow: "0 8px 32px #00000060" }}>
          ⚠ {error} <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: C.error, cursor: "pointer", marginLeft: 12, fontSize: 16 }}>×</button>
        </div>
      )}
    </div>
  );
}
