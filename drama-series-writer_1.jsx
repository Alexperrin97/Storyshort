import { useState, useRef } from "react";

// maxTok: 8192 for JSON bible, 1000 for scripts/adjustments
const apiText = async (system, userMsg, maxTok = 1000) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTok, system, messages: [{ role: "user", content: userMsg }] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Erreur API");
  return data.content?.map(i => i.text || "").join("") || "";
};

const apiWithDocs = async (system, textMsg, docBlocks = [], maxTok = 1000) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTok, system, messages: [{ role: "user", content: [...docBlocks, { type: "text", text: textMsg }] }] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Erreur API");
  return data.content?.map(i => i.text || "").join("") || "";
};

const parseJSON = (raw) => {
  // Try 1: direct parse after stripping markdown fences
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch {}
  // Try 2: extract first {...} block (handles preamble/postamble text)
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  // Try 3: find JSON starting from first { to last }
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
  } catch {}
  return null;
};
const readFileAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Lecture impossible")); r.readAsText(file); });
const readFileAsBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = () => rej(new Error("Lecture impossible")); r.readAsDataURL(file); });

const Tag = ({ children, color = "#c8973a" }) => <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, background: `${color}15`, border: `1px solid ${color}35`, color, fontFamily: "'Courier Prime', monospace" }}>{children}</span>;
const Spinner = ({ color = "#c8973a" }) => <span style={{ width: 14, height: 14, border: `2px solid #1a1208`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />;
const Field = ({ label, children }) => <div><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span style={{ fontSize: 11, color: "#6a5030", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span><div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #2a1e10, transparent)" }} /></div>{children}</div>;
const ChipBtn = ({ label, active, onClick, color = "#c8973a" }) => <button onClick={onClick} style={{ padding: "6px 13px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "'Courier Prime', monospace", border: active ? `1px solid ${color}` : "1px solid #2a1e10", background: active ? `${color}18` : "#120e08", color: active ? color : "#5a4a32", transition: "all 0.12s" }}>{label}</button>;
const NumInput = ({ label, value, onChange, min, max }) => <div><div style={{ fontSize: 11, color: "#5a4030", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div><div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0a05", border: "1px solid #2a1e10", borderRadius: 9, padding: "6px 10px" }}><button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: "none", border: "none", color: "#5a4030", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>−</button><span style={{ flex: 1, textAlign: "center", color: "#c8973a", fontWeight: 700, fontSize: 16 }}>{value}</span><button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: "none", border: "none", color: "#5a4030", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>+</button></div></div>;
const ScriptViewer = ({ text }) => { const lines = (text || "").split("\n"); return <div style={{ fontFamily: "'Courier Prime', monospace", lineHeight: 1.9, fontSize: 13 }}>{lines.map((line, i) => { const t = line.trim(); if (!t) return <div key={i} style={{ height: 8 }} />; if (/^(INT\.|EXT\.|---|ÉPISODE|EPISODE)/i.test(t)) return <div key={i} style={{ color: "#c8973a", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 16, marginBottom: 4, borderLeft: "2px solid #c8973a50", paddingLeft: 10 }}>{t}</div>; if (/^\[.*\]$/.test(t) || /^\(.*\)$/.test(t)) return <div key={i} style={{ color: "#5a7a4a", fontStyle: "italic", fontSize: 12 }}>{t}</div>; if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s]{1,35}(\s*:)?$/.test(t) && t.length < 40) return <div key={i} style={{ color: "#e8b060", fontWeight: 700, marginTop: 10 }}>{t}</div>; return <div key={i} style={{ color: "#b89050" }}>{line}</div>; })}</div>; };

const LIEU_OPTIONS = ["Bureau","Appartement","Café","Hôpital","École","Rue","Château","Villa","Hôtel","Tribunal","Studio","Forêt","Aéroport","Restaurant","Commissariat","Maison familiale"];
const LocationBuilder = ({ locations, onChange }) => {
  const add = () => { if (locations.length >= 8) return; onChange([...locations, { id: Date.now(), name: LIEU_OPTIONS[locations.length % LIEU_OPTIONS.length], custom: "" }]); };
  const remove = (id) => onChange(locations.filter(l => l.id !== id));
  const update = (id, field, val) => onChange(locations.map(l => l.id === id ? { ...l, [field]: val } : l));
  return <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><span style={{ fontSize: 11, color: "#6a5030", textTransform: "uppercase", letterSpacing: "0.12em" }}>📍 Lieux ({locations.length}/8)</span><button onClick={add} disabled={locations.length >= 8} style={{ padding: "5px 12px", background: "#120e08", border: "1px solid #2a1e10", borderRadius: 7, color: "#6a5030", fontSize: 12, cursor: "pointer", fontFamily: "'Courier Prime', monospace" }}>+ Ajouter</button></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{locations.map((loc, idx) => <div key={loc.id} style={{ display: "flex", gap: 8, alignItems: "center", background: "#0d0a05", border: "1px solid #2a1e10", borderRadius: 9, padding: "8px 12px" }}><span style={{ color: "#4a3018", fontSize: 12, minWidth: 22 }}>#{idx + 1}</span><select value={loc.name} onChange={e => update(loc.id, "name", e.target.value)} style={{ background: "transparent", border: "none", color: "#c8973a", fontSize: 13, fontFamily: "'Courier Prime', monospace", cursor: "pointer", flex: 1 }}>{LIEU_OPTIONS.map(o => <option key={o} value={o} style={{ background: "#120e08" }}>{o}</option>)}</select><input placeholder="Nom / précision" value={loc.custom} onChange={e => update(loc.id, "custom", e.target.value)} style={{ background: "transparent", border: "none", borderLeft: "1px solid #2a1e10", paddingLeft: 10, color: "#8a6838", fontSize: 12, fontFamily: "'Courier Prime', monospace", width: 160 }} /><button onClick={() => remove(loc.id)} style={{ background: "none", border: "none", color: "#3a2010", cursor: "pointer", fontSize: 16 }}>×</button></div>)}{locations.length === 0 && <div style={{ color: "#3a2810", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>Aucun lieu — cliquez "+ Ajouter"</div>}</div></div>;
};

const DNA_SYSTEM = `Tu es un expert en analyse de scripts de micro drama viral. Réponds UNIQUEMENT en JSON valide, sans markdown.`;
const DNA_PROMPT = `Analyse ces scripts de référence et extrais leurs patterns de succès.\n\n{TEXTS}\n\nGénère ce JSON:\n{"hookPatterns":[{"type":"Type","formula":"Formule","example":"Exemple","frequency":"Fréquent/Récurrent/Rare"}],"cliffhangerPatterns":[{"episodeType":"Début/Milieu/Fin","technique":"Technique","formula":"Formule","example":"Exemple"}],"narrativeArchPatterns":[{"name":"Nom","structure":"Structure","tensionCurve":"Courbe de tension","keyMoments":["Moment 1"]}],"emotionalTriggers":["Déclencheur 1"],"paceRhythm":"Description du rythme","filesAnalyzed":0,"summary":"Résumé de l'ADN de style en 2-3 phrases"}`;

const DNAResult = ({ dna, onReset }) => {
  const [expanded, setExpanded] = useState(null);
  const sections = [
    { key: "hookPatterns", label: "⚡ Hooks d'ouverture", color: "#f0c060", render: (items) => items?.map((h, i) => <div key={i} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: "2px solid #f0c06040" }}><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}><span style={{ color: "#f0c060", fontSize: 12, fontWeight: 700 }}>{h.type}</span><span style={{ fontSize: 10, color: "#6a5020", background: "#1a1008", border: "1px solid #3a2810", borderRadius: 4, padding: "1px 7px" }}>{h.frequency}</span></div><div style={{ color: "#8a7040", fontSize: 12 }}>{h.formula}</div>{h.example && <div style={{ color: "#4a3818", fontSize: 11, fontStyle: "italic", marginTop: 3 }}>ex: "{h.example}"</div>}</div>) },
    { key: "cliffhangerPatterns", label: "🔚 Cliffhangers", color: "#f07858", render: (items) => items?.map((c, i) => <div key={i} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: "2px solid #f0785840" }}><div style={{ color: "#f07858", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{c.episodeType}</div><div style={{ color: "#8a5030", fontSize: 12 }}>{c.technique}</div><div style={{ color: "#6a3818", fontSize: 12, fontStyle: "italic" }}>{c.formula}</div>{c.example && <div style={{ color: "#4a2810", fontSize: 11, marginTop: 3 }}>ex: "{c.example}"</div>}</div>) },
    { key: "narrativeArchPatterns", label: "📐 Architecture narrative", color: "#70b8f0", render: (items) => items?.map((n, i) => <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: "2px solid #70b8f040" }}><div style={{ color: "#70b8f0", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{n.name}</div><div style={{ color: "#406888", fontSize: 12 }}>{n.structure}</div><div style={{ color: "#2a4858", fontSize: 11, fontStyle: "italic", marginTop: 3 }}>Tension : {n.tensionCurve}</div>{n.keyMoments?.length > 0 && <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>{n.keyMoments.map((m, j) => <span key={j} style={{ fontSize: 10, color: "#2a5878", background: "#06101a", border: "1px solid #1a3a5a30", borderRadius: 4, padding: "2px 8px" }}>{m}</span>)}</div>}</div>) },
    { key: "emotionalTriggers", label: "💥 Déclencheurs émotionnels", color: "#c070e8", render: (items) => <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{items?.map((t, i) => <span key={i} style={{ background: "#12081a", border: "1px solid #8040b830", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#9050c8" }}>{t}</span>)}</div> },
  ];
  return (
    <div style={{ background: "#05090e", border: "1px solid #1a3a5a60", borderRadius: 12, overflow: "hidden", animation: "rise 0.4s ease both" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a2a3a", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, background: "#40c890", borderRadius: "50%", boxShadow: "0 0 10px #40c89070" }} />
        <span style={{ color: "#40c890", fontWeight: 700, fontSize: 13 }}>Style DNA extrait</span>
        <span style={{ color: "#1a4a3a", fontSize: 11 }}>· {dna.filesAnalyzed} fichier{dna.filesAnalyzed > 1 ? "s" : ""} analysé{dna.filesAnalyzed > 1 ? "s" : ""}</span>
        <button onClick={onReset} style={{ marginLeft: "auto", background: "none", border: "1px solid #1a2a3a", borderRadius: 6, color: "#2a4a3a", fontSize: 11, cursor: "pointer", padding: "3px 10px", fontFamily: "'Courier Prime', monospace" }}>↺ Réinitialiser</button>
      </div>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #0e1e2a", color: "#4a8a70", fontSize: 12, fontStyle: "italic", lineHeight: 1.7 }}>{dna.summary}</div>
      {dna.paceRhythm && <div style={{ padding: "10px 18px", borderBottom: "1px solid #0e1e2a", display: "flex", gap: 10 }}><span style={{ fontSize: 12, color: "#2a4a3a" }}>🎵</span><span style={{ fontSize: 12, color: "#3a6a58" }}>{dna.paceRhythm}</span></div>}
      {sections.map(s => (
        <div key={s.key} style={{ borderBottom: "1px solid #0e1e2a" }}>
          <button onClick={() => setExpanded(expanded === s.key ? null : s.key)} style={{ width: "100%", padding: "10px 18px", background: "none", border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 12, color: s.color, fontFamily: "'Courier Prime', monospace", flex: 1 }}>{s.label}</span>
            <span style={{ color: "#1a3a2a", fontSize: 10, fontFamily: "'Courier Prime', monospace" }}>{expanded === s.key ? "▲ fermer" : "▼ voir"}</span>
          </button>
          {expanded === s.key && <div style={{ padding: "4px 18px 16px 18px", animation: "fadeIn 0.2s ease both" }}>{s.render(dna[s.key])}</div>}
        </div>
      ))}
    </div>
  );
};

const StyleDNAPanel = ({ dna, onDNAUpdate }) => {
  const [files, setFiles] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [dnaError, setDnaError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const addFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => [".txt",".pdf",".docx"].some(ext => f.name.toLowerCase().endsWith(ext)));
    if (!valid.length) { setDnaError("Formats acceptés : .txt · .pdf · .docx"); return; }
    setDnaError(null);
    setFiles(prev => { const names = prev.map(f => f.name); return [...prev, ...valid.filter(f => !names.includes(f.name))].slice(0, 10); });
  };
  const extractDNA = async () => {
    if (!files.length) return;
    setExtracting(true); setDnaError(null);
    try {
      const docBlocks = [], textParts = [];
      for (const file of files) {
        const ext = file.name.split(".").pop().toLowerCase();
        if (ext === "txt") { const text = await readFileAsText(file); textParts.push(`=== ${file.name} ===\n${text}`); }
        else if (ext === "pdf") { const b64 = await readFileAsBase64(file); docBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 }, title: file.name }); }
        else if (ext === "docx") { const b64 = await readFileAsBase64(file); docBlocks.push({ type: "document", source: { type: "base64", media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: b64 }, title: file.name }); }
      }
      const texts = textParts.length > 0 ? textParts.join("\n\n") : "(Scripts fournis dans les documents joints)";
      const raw = await apiWithDocs(DNA_SYSTEM, DNA_PROMPT.replace("{TEXTS}", texts), docBlocks);
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Impossible d'extraire les patterns. Vérifie que tes fichiers contiennent du texte lisible.");
      parsed.filesAnalyzed = files.length;
      onDNAUpdate(parsed);
    } catch (e) { setDnaError(e.message || "Erreur d'extraction."); }
    finally { setExtracting(false); }
  };
  const fileIcon = (name) => ({ pdf: "📕", docx: "📘", txt: "📄" }[name.split(".").pop().toLowerCase()] || "📄");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#060c14", border: "1px solid #1a3a5a40", borderRadius: 10, padding: "16px 18px", lineHeight: 1.8 }}>
        <div style={{ color: "#6ab0d8", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🧬 Comment fonctionne le Style DNA ?</div>
        <div style={{ color: "#3a5a7a", fontSize: 12 }}>L'IA analyse tes scripts de référence et extrait les <span style={{ color: "#5a90b8" }}>patterns invisibles</span> qui les rendent viraux — formules de hooks, architectures de cliffhangers, courbes de tension. Ces patterns sont injectés dans chaque épisode généré.</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["⚡ Hooks", "🔚 Cliffhangers", "📐 Architecture narrative"].map(t => <span key={t} style={{ fontSize: 11, color: "#2a6a8a", background: "#0a1a2a", border: "1px solid #1a3a5a30", borderRadius: 6, padding: "3px 10px" }}>{t}</span>)}
        </div>
      </div>
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${dragOver ? "#4a9ac8" : "#1a3a5a"}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: dragOver ? "#060e1880" : "transparent" }}>
        <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.docx" style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
        <div style={{ color: "#3a6a8a", fontSize: 13, marginBottom: 6 }}>Glisse tes scripts ici ou clique pour parcourir</div>
        <div style={{ color: "#1a3a5a", fontSize: 11 }}>.txt · .pdf · .docx — jusqu'à 10 fichiers</div>
      </div>
      {files.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><div style={{ fontSize: 11, color: "#3a5a7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{files.length} fichier{files.length > 1 ? "s" : ""} prêt{files.length > 1 ? "s" : ""}</div>{files.map(f => <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, background: "#060c14", border: "1px solid #1a2a3a", borderRadius: 8, padding: "8px 12px" }}><span style={{ fontSize: 16 }}>{fileIcon(f.name)}</span><span style={{ flex: 1, fontSize: 12, color: "#4a8ab0", fontFamily: "'Courier Prime', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><span style={{ fontSize: 10, color: "#1a3a5a", flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span><button onClick={() => setFiles(p => p.filter(x => x.name !== f.name))} style={{ background: "none", border: "none", color: "#2a4a5a", cursor: "pointer", fontSize: 16 }}>×</button></div>)}</div>}
      {dnaError && <div style={{ background: "#1a0808", border: "1px solid #8a201040", borderRadius: 9, padding: "10px 14px", color: "#c84030", fontSize: 12 }}>⚠ {dnaError}</div>}
      {files.length > 0 && !dna && <button onClick={extractDNA} disabled={extracting} style={{ width: "100%", padding: "16px", fontFamily: "'Courier Prime', monospace", fontSize: 14, fontWeight: 700, background: extracting ? "#060c14" : "linear-gradient(135deg, #060e1a, #0a1e38)", border: `1px solid ${extracting ? "#1a2a3a" : "#2a6aaa50"}`, borderRadius: 10, color: extracting ? "#2a4a5a" : "#5ab8e8", cursor: extracting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: extracting ? "none" : "0 4px 20px #2a6aaa18" }}>{extracting ? <><Spinner color="#4a9ac8" /> Analyse des patterns en cours...</> : "🧬 Extraire le Style DNA"}</button>}
      {dna && <DNAResult dna={dna} onReset={() => { onDNAUpdate(null); setFiles([]); }} />}
    </div>
  );
};

export default function App() {
  const [genre, setGenre] = useState("Romance");
  const [ton, setTon] = useState("Intense");
  const [locations, setLocations] = useState([{ id: 1, name: "Bureau", custom: "Tour de verre moderne" }, { id: 2, name: "Appartement", custom: "Loft industriel" }]);
  const [nbMainActors, setNbMainActors] = useState(3);
  const [nbExtras, setNbExtras] = useState(5);
  const [nbEpisodes, setNbEpisodes] = useState(5);
  const [durationPerEp, setDurationPerEp] = useState("60s");
  const [langue, setLangue] = useState("Français");
  const [idee, setIdee] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  const [dna, setDna] = useState(null);
  const [useDNA, setUseDNA] = useState(false);
  const [step, setStep] = useState("settings");
  const [genProgress, setGenProgress] = useState({ phase: "", done: 0, total: 0 });
  const [bible, setBible] = useState(null);
  const [scripts, setScripts] = useState({});
  const [scriptStatus, setScriptStatus] = useState({});
  const [selectedEp, setSelectedEp] = useState(null);
  const [adjustInput, setAdjustInput] = useState("");
  const [adjustHistory, setAdjustHistory] = useState({});
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const buildDNABlock = () => {
    if (!dna || !useDNA) return "";
    const hooks = dna.hookPatterns?.slice(0, 3).map(h => `  - [${h.type}] ${h.formula}`).join("\n") || "";
    const cliffs = dna.cliffhangerPatterns?.slice(0, 3).map(c => `  - [${c.episodeType}] ${c.technique} : ${c.formula}`).join("\n") || "";
    const arches = dna.narrativeArchPatterns?.slice(0, 2).map(n => `  - ${n.name} : ${n.structure}`).join("\n") || "";
    const triggers = dna.emotionalTriggers?.slice(0, 5).join(" · ") || "";
    return `\n━━━ 🧬 STYLE DNA — PATTERNS EXTRAITS DE TES SCRIPTS DE RÉFÉRENCE ━━━\nADN : ${dna.summary}\nRythme : ${dna.paceRhythm || "N/A"}\nHOOKS VALIDÉS :\n${hooks}\nCLIFFHANGERS VALIDÉS :\n${cliffs}\nARCHITECTURE NARRATIVE :\n${arches}\nDÉCLENCHEURS : ${triggers}\nCONSIGNE DNA : Réinterprète ces patterns — ne les copie pas, utilise-les comme squelette structurel.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  };

  const buildBiblePrompt = () => {
    const lieux = locations.map((l, i) => (i+1) + ". " + l.name + (l.custom ? " ("+l.custom+")" : "")).join(", ");
    const dnaBlock = buildDNABlock();
    const premise = idee ? "Prémisse: " + idee : "Invente une histoire originale et virale";
    const parts = [
      "TACHE: Generer une bible de serie de micro drama vertical.",
      "REGLE ABSOLUE: Repondre UNIQUEMENT avec du JSON brut. Zero texte avant ou apres. Zero markdown. Zero backtick.",
      "",
      "PARAMETRES:",
      "Genre=" + genre,
      "Ton=" + ton,
      "Langue=" + langue,
      "Lieux=" + (lieux || "Libre"),
      "NbActeursPrincipaux=" + nbMainActors,
      "NbFigurants=" + nbExtras,
      "NbEpisodes=" + nbEpisodes,
      "DureeParEpisode=" + durationPerEp,
      premise,
      dnaBlock,
      "",
      "RETOURNE CE JSON (remplace les ... par le contenu reel, garde la structure exacte):",
      '{"title":"...","tagline":"...","synopsis":"...","characters":[{"name":"...","role":"...","trait":"...","type":"main"}],"locations":[{"name":"...","description":"..."}],"episodes":[{"index":0,"title":"...","synopsis":"...","hook":"...","mainCharacters":["..."],"location":"...","cliffhanger":"..."}]}',
      "",
      "IMPORTANT: Le tableau episodes doit contenir exactement " + nbEpisodes + " elements (index 0 a " + (nbEpisodes-1) + ").",
      "Commence ta reponse directement par { sans aucun autre caractere avant."
    ];
    return parts.join("\n");
  };

  const buildEpisodePrompt = (epMeta) => {
    const lieux = locations.map((l, i) => `${i + 1}. ${l.name}${l.custom ? ` (${l.custom})` : ""}`).join("; ");
    const chars = bible?.characters?.map(c => `${c.name} (${c.role}, ${c.trait})`).join(", ");
    return `Tu es scénariste expert en vertical drama viral. Écris le script COMPLET de l'épisode ${epMeta.index + 1}.\n\nSÉRIE : ${bible?.title}\nSYNOPSIS : ${bible?.synopsis}\nPERSONNAGES : ${chars}\nLIEUX : ${lieux}\n${buildDNABlock()}\n\nÉPISODE ${epMeta.index + 1} : "${epMeta.title}"\n- Synopsis : ${epMeta.synopsis}\n- Hook : ${epMeta.hook}\n- Personnages : ${epMeta.mainCharacters?.join(", ")}\n- Lieu : ${epMeta.location}\n- Durée : ${durationPerEp}\n- Fin : ${epMeta.cliffhanger}\n\nRÈGLES : hook percutant, noms en MAJUSCULES, scènes entre [crochets], tension croissante, langue ${langue}.\n\nÉcris UNIQUEMENT le script.`;
  };

  const buildAdjustPrompt = (epMeta, currentScript, instruction) => `Tu es scénariste expert. Réécris ce script en appliquant exactement l'ajustement.\n\nÉPISODE : "${epMeta.title}"\nAJUSTEMENT : ${instruction}\n\nSCRIPT ACTUEL :\n${currentScript}\n\nRéécris le script complet. Conserve structure et longueur. Écris UNIQUEMENT le script révisé.`;

  const generateAll = async () => {
    setError(null); setStep("generating"); setGenProgress({ phase: "Bible de série...", done: 0, total: nbEpisodes + 1 });
    try {
      // Bible token budget: ~120 tokens/episode + overhead
      const bibleToks = Math.min(8192, 1800 + nbEpisodes * 120);
      const rawBible = await apiText(
        "Génère uniquement du JSON valide. Commence par { et termine par }. Zéro texte autour.",
        buildBiblePrompt(),
        bibleToks
      );
      let parsedBible = parseJSON(rawBible);
      if (!parsedBible) {
        setGenProgress({ phase: "Correction JSON...", done: 0, total: nbEpisodes + 1 });
        const repaired = await apiText(
          "Réponds UNIQUEMENT avec du JSON valide. Commence par { et termine par }.",
          "Ce JSON est invalide. Réécris-le correctement en JSON pur:\n" + rawBible.slice(0, 4000),
          bibleToks
        );
        parsedBible = parseJSON(repaired);
        if (!parsedBible) throw new Error("JSON invalide après 2 tentatives. Réduire le nombre d'épisodes peut aider.");
      }
      if (!Array.isArray(parsedBible.episodes) || parsedBible.episodes.length === 0) {
        throw new Error("La bible ne contient pas d'épisodes. Réessaie.");
      }
      setBible(parsedBible);
      const newScripts = {}, newStatus = {};
      for (let i = 0; i < parsedBible.episodes.length; i++) {
        const epMeta = parsedBible.episodes[i];
        setGenProgress({ phase: `Épisode ${i + 1} — "${epMeta.title}"`, done: i + 1, total: parsedBible.episodes.length + 1 });
        newStatus[i] = "loading"; setScriptStatus({ ...newStatus });
        newScripts[i] = await apiText("Tu es un scénariste expert. Réponds uniquement avec le script.", buildEpisodePrompt(epMeta));
        newStatus[i] = "done"; setScripts({ ...newScripts }); setScriptStatus({ ...newStatus });
      }
      setStep("board");
    } catch (e) { setError(e.message || "Erreur de génération."); setStep("settings"); }
  };

  const adjustEpisode = async (epIndex) => {
    if (!adjustInput.trim()) return;
    const instruction = adjustInput.trim(); setAdjustInput("");
    setScriptStatus(s => ({ ...s, [epIndex]: "loading" }));
    setAdjustHistory(h => ({ ...h, [epIndex]: [...(h[epIndex] || []), { instruction, timestamp: new Date().toLocaleTimeString() }] }));
    try { const revised = await apiText("Tu es scénariste expert. Réponds uniquement avec le script révisé.", buildAdjustPrompt(bible.episodes[epIndex], scripts[epIndex], instruction)); setScripts(s => ({ ...s, [epIndex]: revised })); } catch {}
    setScriptStatus(s => ({ ...s, [epIndex]: "done" }));
  };

  const regenEpisode = async (epIndex) => {
    setScriptStatus(s => ({ ...s, [epIndex]: "loading" }));
    try { const ep = await apiText("Tu es scénariste expert. Réponds uniquement avec le script.", buildEpisodePrompt(bible.episodes[epIndex])); setScripts(s => ({ ...s, [epIndex]: ep })); } catch {}
    setScriptStatus(s => ({ ...s, [epIndex]: "done" }));
  };

  const copyScript = async (idx) => { await navigator.clipboard.writeText(scripts[idx] || ""); setCopied(idx); setTimeout(() => setCopied(false), 2000); };
  const totalWords = Object.values(scripts).join(" ").split(/\s+/).length;
  const computeTotal = (n, dur) => { const map = { "30s": 0.5, "60s": 1, "90s": 1.5, "3 min": 3, "5 min": 5 }; const total = n * (map[dur] || 1); return total < 60 ? `${total} min` : `${Math.floor(total / 60)}h${total % 60 > 0 ? ` ${total % 60}min` : ""}`; };

  return (
    <div style={{ minHeight: "100vh", background: "#060503", fontFamily: "'Courier Prime', monospace", color: "#c8a870" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes rise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #0a0806; } ::-webkit-scrollbar-thumb { background: #2a1e10; border-radius: 3px; }
        textarea:focus, input:focus, select:focus { outline: none; }
        textarea::placeholder, input::placeholder { color: #2a1e10; }
        select option { background: #120e08; }
      `}</style>

      <div style={{ borderBottom: "1px solid #1e1508", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16, background: "#080602", position: "sticky", top: 0, zIndex: 100 }}>
        <div><h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#e8b870" }}>DRAMASCRIPT</h1><span style={{ fontSize: 9, color: "#3a2810", letterSpacing: "0.22em", textTransform: "uppercase" }}>Series Writer · AI Studio</span></div>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #2a1e10, transparent)" }} />
        {step === "board" && bible && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {useDNA && dna && <Tag color="#40c890">🧬 DNA actif</Tag>}
          <Tag>{bible.title}</Tag><Tag color="#6a8a4a">{Object.keys(scripts).length} ép.</Tag><Tag color="#6a6a8a">{totalWords.toLocaleString()} mots</Tag>
          <button onClick={() => { setStep("settings"); setBible(null); setScripts({}); setScriptStatus({}); setSelectedEp(null); }} style={{ padding: "6px 14px", background: "#120e08", border: "1px solid #2a1e10", borderRadius: 9, color: "#6a5030", fontSize: 12, cursor: "pointer", fontFamily: "'Courier Prime', monospace" }}>← Nouveau</button>
        </div>}
      </div>

      {step === "settings" && (
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "28px 20px 60px", animation: "rise 0.4s ease both" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#0d0a05", borderRadius: 10, padding: 4 }}>
            {[{ id: "settings", label: "⚙ Paramètres" }, { id: "dna", label: dna ? "🧬 Style DNA ✓" : "🧬 Style DNA" }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px 14px", background: activeTab === tab.id ? "#1a1208" : "transparent", border: activeTab === tab.id ? "1px solid #2a1e10" : "1px solid transparent", borderRadius: 8, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: activeTab === tab.id ? (tab.id === "dna" && dna ? "#40c890" : "#c8973a") : (tab.id === "dna" && dna ? "#2a6a4a" : "#4a3a22"), cursor: "pointer", transition: "all 0.15s" }}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <Field label="🎭 Genre & Ton">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>{["Romance","Thriller","Drame","Trahison","Revenge","Comédie","Horreur","Fantasy"].map(v => <ChipBtn key={v} label={v} active={genre === v} onClick={() => setGenre(v)} />)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["Intense","Sombre","Romantique","Explosif","Mystérieux","Humoristique"].map(v => <ChipBtn key={v} label={v} active={ton === v} onClick={() => setTon(v)} color="#8a7050" />)}</div>
              </Field>
              <LocationBuilder locations={locations} onChange={setLocations} />
              <Field label="🎬 Distribution"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><NumInput label="Acteurs principaux" value={nbMainActors} onChange={setNbMainActors} min={1} max={8} /><NumInput label="Figurants récurrents" value={nbExtras} onChange={setNbExtras} min={0} max={20} /></div></Field>
              <Field label="📺 Structure de la série">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <NumInput label="Nombre d'épisodes" value={nbEpisodes} onChange={setNbEpisodes} min={1} max={60} />
                  <div><div style={{ fontSize: 11, color: "#5a4030", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Durée / épisode</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{["30s","60s","90s","3 min","5 min"].map(v => <ChipBtn key={v} label={v} active={durationPerEp === v} onClick={() => setDurationPerEp(v)} color="#8a7040" />)}</div></div>
                </div>
                <div style={{ background: "#0d0a05", border: "1px solid #1e1608", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#5a4028" }}>≈ Durée totale : <span style={{ color: "#c8973a" }}>{computeTotal(nbEpisodes, durationPerEp)}</span></div>
              </Field>
              <Field label="🌐 Langue"><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["Français","English","Español","Deutsch"].map(v => <ChipBtn key={v} label={v} active={langue === v} onClick={() => setLangue(v)} color="#7a6848" />)}</div></Field>
              <Field label="💡 Prémisse (optionnel)"><textarea value={idee} onChange={e => setIdee(e.target.value)} placeholder="Ex : Une assistante découvre que son patron est le mari de sa meilleure amie..." rows={3} style={{ width: "100%", background: "#0d0a05", border: "1px solid #2a1e10", borderRadius: 9, padding: "12px 14px", color: "#c8a870", fontFamily: "'Courier Prime', monospace", fontSize: 13, lineHeight: 1.7, resize: "vertical" }} /></Field>

              {dna ? (
                <div style={{ background: useDNA ? "#050e08" : "#0d0a05", border: `1px solid ${useDNA ? "#1a4a2a" : "#2a1e10"}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setUseDNA(v => !v)}>
                  <div style={{ width: 38, height: 22, background: useDNA ? "#1a5a3a" : "#1a1208", borderRadius: 11, position: "relative", transition: "background 0.2s", flexShrink: 0, border: `1px solid ${useDNA ? "#40c89050" : "#2a2010"}` }}><div style={{ width: 16, height: 16, background: useDNA ? "#40c890" : "#3a2810", borderRadius: "50%", position: "absolute", top: 2, left: useDNA ? 18 : 2, transition: "all 0.2s", boxShadow: useDNA ? "0 0 10px #40c89090" : "none" }} /></div>
                  <div><div style={{ color: useDNA ? "#40c890" : "#5a4030", fontSize: 13, fontWeight: 700 }}>🧬 Utiliser le Style DNA</div><div style={{ color: useDNA ? "#2a6a4a" : "#3a2810", fontSize: 11, marginTop: 2 }}>{useDNA ? `Patterns de ${dna.filesAnalyzed} script(s) injectés dans chaque épisode` : "Générer sans les patterns de référence"}</div></div>
                </div>
              ) : (
                <div style={{ background: "#060a0e", border: "1px dashed #1a3a5a40", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setActiveTab("dna")}>
                  <span style={{ fontSize: 20 }}>🧬</span>
                  <div><div style={{ color: "#2a5a7a", fontSize: 12, fontWeight: 700 }}>Aucun Style DNA configuré</div><div style={{ color: "#1a3a5a", fontSize: 11, marginTop: 2 }}>Uploade tes scripts de référence → onglet Style DNA</div></div>
                  <span style={{ marginLeft: "auto", color: "#1a3a5a", fontSize: 13 }}>→</span>
                </div>
              )}

              {nbEpisodes > 20 && <div style={{ background: "#0d1008", border: "1px solid #4a6a2040", borderRadius: 9, padding: "12px 16px", fontSize: 12, color: "#6a8a40", lineHeight: 1.6 }}>⏱ <strong style={{ color: "#8ab050" }}>{nbEpisodes} épisodes</strong> — génération estimée : ~{Math.ceil(nbEpisodes * 0.4)} min. Les scripts s'affichent au fur et à mesure.</div>}
              {error && <div style={{ background: "#1a0808", border: "1px solid #8a201040", borderRadius: 9, padding: "12px 16px", color: "#c84030", fontSize: 13 }}>⚠ {error}</div>}

              <button onClick={generateAll} style={{ width: "100%", padding: "18px", fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, background: useDNA && dna ? "linear-gradient(135deg, #071a0e, #0e3020)" : "linear-gradient(135deg, #5a3010, #8a5020)", border: `1px solid ${useDNA && dna ? "#40c89040" : "#c8973a40"}`, borderRadius: 12, color: useDNA && dna ? "#40e8a0" : "#f0c870", cursor: "pointer", letterSpacing: "0.04em", boxShadow: `0 4px 30px ${useDNA && dna ? "#40c89015" : "#c8973a18"}` }}>
                {useDNA && dna ? "🧬 " : "✍ "}Générer{useDNA && dna ? " avec Style DNA" : ""} ({nbEpisodes} épisode{nbEpisodes > 1 ? "s" : ""})
              </button>
            </div>
          )}

          {activeTab === "dna" && <StyleDNAPanel dna={dna} onDNAUpdate={(newDna) => { setDna(newDna); if (newDna) { setUseDNA(true); setActiveTab("settings"); } }} />}
        </div>
      )}

      {step === "generating" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 32, animation: "fadeIn 0.4s ease both" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{useDNA && dna ? "🧬" : "🎬"}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8b870", margin: "0 0 8px" }}>Écriture en cours...</h2>
            <p style={{ color: "#5a4030", fontSize: 13, margin: 0, animation: "shimmer 2s infinite" }}>{genProgress.phase}</p>
            {useDNA && dna && <p style={{ color: "#2a6a4a", fontSize: 11, margin: "8px 0 0" }}>🧬 Style DNA actif · patterns de {dna.filesAnalyzed} script(s) injectés</p>}
          </div>
          <div style={{ width: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11, color: "#4a3018" }}><span>Progression</span><span>{genProgress.done} / {genProgress.total}</span></div>
            <div style={{ height: 6, background: "#1a1208", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(genProgress.done / Math.max(genProgress.total, 1)) * 100}%`, background: useDNA && dna ? "linear-gradient(90deg, #1a5a3a, #40c890)" : "linear-gradient(90deg, #8a5020, #c8973a)", borderRadius: 3, transition: "width 0.5s ease", boxShadow: `0 0 10px ${useDNA && dna ? "#40c89040" : "#c8973a40"}` }} /></div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
            {Array.from({ length: nbEpisodes }).map((_, i) => { const sz = nbEpisodes > 30 ? 26 : 36; return <div key={i} style={{ width: sz, height: sz, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: nbEpisodes > 30 ? 9 : 11, fontWeight: 700, transition: "all 0.3s", background: scriptStatus[i] === "done" ? "#1a3010" : i === genProgress.done - 1 ? "#1a1a08" : "#120e08", border: `1px solid ${scriptStatus[i] === "done" ? "#4a8a20" : i === genProgress.done - 1 ? "#5a5a18" : "#1e1508"}`, color: scriptStatus[i] === "done" ? "#6ac840" : i === genProgress.done - 1 ? "#c8c840" : "#3a2810" }}>{scriptStatus[i] === "done" ? "✓" : i === genProgress.done - 1 ? <Spinner /> : i + 1}</div>; })}
          </div>
        </div>
      )}

      {step === "board" && bible && (
        <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
          <div style={{ width: 280, borderRight: "1px solid #1e1508", overflowY: "auto", background: "#080602", flexShrink: 0 }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #1e1508" }}>
              <div style={{ fontSize: 14, fontFamily: "'Playfair Display', serif", color: "#e8b870", marginBottom: 4 }}>{bible.title}</div>
              <div style={{ fontSize: 11, color: "#4a3820", fontStyle: "italic", lineHeight: 1.5 }}>{bible.tagline}</div>
              {useDNA && dna && <div style={{ marginTop: 8, fontSize: 10, color: "#2a5a3a", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, background: "#40c890", borderRadius: "50%", display: "inline-block" }} />Généré avec Style DNA</div>}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>{bible.characters?.filter(c => c.type === "main").map(c => <span key={c.name} style={{ fontSize: 10, color: "#7a5a28", background: "#1a1208", border: "1px solid #2a1e10", borderRadius: 4, padding: "2px 7px" }}>{c.name}</span>)}</div>
            </div>
            {bible.episodes?.map((ep, i) => (
              <div key={i} onClick={() => setSelectedEp(i)} style={{ padding: "13px 18px", borderBottom: "1px solid #130f06", cursor: "pointer", background: selectedEp === i ? "#120e08" : "transparent", borderLeft: selectedEp === i ? "2px solid #c8973a" : "2px solid transparent", transition: "all 0.12s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: selectedEp === i ? "#c8973a" : "#3a2810", fontWeight: 700 }}>ÉP. {i + 1}</span>
                  {scriptStatus[i] === "loading" && <Spinner />}
                  {(adjustHistory[i]?.length || 0) > 0 && <span style={{ fontSize: 9, color: "#6a8a4a", marginLeft: "auto" }}>✎ {adjustHistory[i].length}</span>}
                </div>
                <div style={{ fontSize: 12, color: selectedEp === i ? "#e8b870" : "#7a5a28", lineHeight: 1.4 }}>{ep.title}</div>
                <div style={{ fontSize: 10, color: "#3a2810", marginTop: 4 }}>{ep.location}</div>
              </div>
            ))}
          </div>

          {selectedEp !== null ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: "1px solid #1e1508", display: "flex", alignItems: "flex-start", gap: 16, flexShrink: 0, background: "#080602" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#c8973a", fontWeight: 700, letterSpacing: "0.1em" }}>ÉPISODE {selectedEp + 1}</span>
                    <Tag color="#8a6020">{bible.episodes[selectedEp].location}</Tag>
                    {bible.episodes[selectedEp].mainCharacters?.map(c => <Tag key={c} color="#5a6a3a">{c}</Tag>)}
                    {useDNA && dna && <Tag color="#40c890">🧬</Tag>}
                  </div>
                  <div style={{ fontSize: 15, fontFamily: "'Playfair Display', serif", color: "#e8b870" }}>{bible.episodes[selectedEp].title}</div>
                  <div style={{ fontSize: 12, color: "#5a4028", marginTop: 4, fontStyle: "italic" }}>{bible.episodes[selectedEp].synopsis}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => regenEpisode(selectedEp)} disabled={scriptStatus[selectedEp] === "loading"} style={{ padding: "6px 14px", background: "#120e08", border: "1px solid #2a1e10", borderRadius: 9, color: "#6a5030", fontSize: 12, cursor: "pointer", fontFamily: "'Courier Prime', monospace", display: "flex", alignItems: "center", gap: 6 }}>{scriptStatus[selectedEp] === "loading" ? <Spinner /> : "↺"} Regénérer</button>
                  <button onClick={() => copyScript(selectedEp)} style={{ padding: "6px 14px", background: "#120e08", border: "1px solid #2a1e10", borderRadius: 9, color: "#6a5030", fontSize: 12, cursor: "pointer", fontFamily: "'Courier Prime', monospace" }}>{copied === selectedEp ? "✓ Copié" : "⎘ Copier"}</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                {scriptStatus[selectedEp] === "loading" ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "#4a3018" }}><Spinner /><span style={{ fontSize: 12, animation: "shimmer 2s infinite" }}>Réécriture en cours...</span></div> : scripts[selectedEp] ? <ScriptViewer text={scripts[selectedEp]} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#3a2810" }}>Script non disponible</div>}
              </div>
              <div style={{ borderTop: "1px solid #1e1508", padding: "16px 24px", background: "#080602", flexShrink: 0 }}>
                {(adjustHistory[selectedEp]?.length || 0) > 0 && <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>{adjustHistory[selectedEp].map((h, j) => <span key={j} style={{ fontSize: 10, color: "#5a6a3a", background: "#0a120a", border: "1px solid #2a3a1a", borderRadius: 5, padding: "3px 8px" }}>✎ {h.instruction.slice(0, 40)}{h.instruction.length > 40 ? "…" : ""}</span>)}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <textarea value={adjustInput} onChange={e => setAdjustInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) adjustEpisode(selectedEp); }} placeholder="Décris ton ajustement… ex: Rends le dialogue final plus agressif, change le lieu, ajoute un retournement… (⌘↵ pour envoyer)" rows={2} disabled={scriptStatus[selectedEp] === "loading"} style={{ flex: 1, background: "#0d0a05", border: "1px solid #2a1e10", borderRadius: 9, padding: "10px 14px", color: "#c8a870", fontFamily: "'Courier Prime', monospace", fontSize: 13, lineHeight: 1.6, resize: "none" }} />
                  <button onClick={() => adjustEpisode(selectedEp)} disabled={!adjustInput.trim() || scriptStatus[selectedEp] === "loading"} style={{ padding: "10px 20px", background: !adjustInput.trim() || scriptStatus[selectedEp] === "loading" ? "#120e08" : "linear-gradient(135deg, #5a3010, #8a5020)", border: "1px solid #c8973a40", borderRadius: 9, color: !adjustInput.trim() || scriptStatus[selectedEp] === "loading" ? "#3a2810" : "#f0c870", fontFamily: "'Courier Prime', monospace", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{scriptStatus[selectedEp] === "loading" ? <Spinner /> : "✎"} Ajuster</button>
                </div>
              </div>
            </div>
          ) : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#3a2810" }}><div style={{ fontSize: 40 }}>🎬</div><span style={{ fontSize: 13 }}>Sélectionne un épisode</span></div>}
        </div>
      )}
    </div>
  );
}
