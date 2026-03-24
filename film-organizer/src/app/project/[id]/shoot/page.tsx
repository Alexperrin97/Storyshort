'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Scene, Incident, Rush } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';

type Tab = 'progress' | 'incidents' | 'rushes';

const INCIDENT_TYPES = ['Technique', 'Météo', 'Acteur', 'Sécurité', 'Transport', 'Décor', 'Autre'];
const SCENE_STATUS_LIST = ['à tourner', 'en cours', 'tourné', 'à reprendre'];

export default function ShootPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('progress');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex gap-2 mb-6 border-b border-[#30363d]">
        {([['progress', 'Avancement'], ['incidents', 'Incidents'], ['rushes', 'Rushes / Médias']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-red-500 text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'progress' && <ProgressTab projectId={id} />}
      {tab === 'incidents' && <IncidentsTab projectId={id} />}
      {tab === 'rushes' && <RushesTab projectId={id} />}
    </div>
  );
}

/* ─── PROGRESS TAB ───────────────────────────────────────────────────────── */
function ProgressTab({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const { data } = await supabase.from('scenes').select('*').eq('project_id', projectId).order('order_index').order('number');
    setScenes(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function cycleStatus(scene: Scene) {
    const order = SCENE_STATUS_LIST as string[];
    const next = order[(order.indexOf(scene.status) + 1) % order.length] as Scene['status'];
    await supabase.from('scenes').update({ status: next }).eq('id', scene.id);
    setScenes(ss => ss.map(s => s.id === scene.id ? { ...s, status: next } : s));
  }

  const total = scenes.length;
  const tourné = scenes.filter(s => s.status === 'tourné').length;
  const enCours = scenes.filter(s => s.status === 'en cours').length;
  const àReprendre = scenes.filter(s => s.status === 'à reprendre').length;
  const pct = total > 0 ? Math.round((tourné / total) * 100) : 0;

  const filtered = filter === 'all' ? scenes : scenes.filter(s => s.status === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Progress overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total scènes" value={total} />
        <StatCard label="Tournées" value={tourné} color="text-emerald-400" />
        <StatCard label="En cours" value={enCours} color="text-amber-400" />
        <StatCard label="À reprendre" value={àReprendre} color="text-red-400" />
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#8b949e]">Progression globale</span>
            <span className="text-sm font-semibold text-[#e6edf3]">{pct}%</span>
          </div>
          <div className="h-2 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[#8b949e]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Tourné</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />En cours</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />À reprendre</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />À tourner</span>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['all', 'Toutes'], ...SCENE_STATUS_LIST.map(s => [s, s])].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === val ? 'bg-red-600 text-white' : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {scenes.length === 0 ? (
        <Empty text="Aucune scène dans ce projet. Ajoute des scènes dans la phase Préparation." />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="card p-4 flex items-center gap-4 hover:border-[#30363d] transition-colors">
              <span className="font-mono font-bold text-[#e6edf3] w-10 flex-shrink-0">{s.number}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#e6edf3]">{s.title || '—'}</div>
                <div className="text-xs text-[#8b949e] flex gap-3 mt-0.5">
                  {s.location && <span>{s.location}</span>}
                  {s.shoot_date && <span>{formatDate(s.shoot_date)}</span>}
                  {s.cast_list && <span>{s.cast_list}</span>}
                </div>
              </div>
              <button
                onClick={() => cycleStatus(s)}
                className={`badge cursor-pointer hover:opacity-80 flex-shrink-0 ${STATUS_COLORS[s.status]}`}
                title="Cliquer pour changer le statut"
              >
                {s.status}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── INCIDENTS TAB ──────────────────────────────────────────────────────── */
function IncidentsTab({ projectId }: { projectId: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const blank = {
    project_id: projectId, date: today, time: '', incident_type: INCIDENT_TYPES[0],
    description: '', impact: '', resolved: false, resolution_notes: '',
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('incidents').select('*').eq('project_id', projectId).order('date', { ascending: false }).order('created_at', { ascending: false });
    setIncidents(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ ...blank }); setEditing(null); setShowForm(true); }
  function openEdit(i: Incident) { setForm({ ...i }); setEditing(i); setShowForm(true); }

  async function save() {
    if (!form.description.trim()) return;
    if (editing) {
      await supabase.from('incidents').update(form).eq('id', editing.id);
    } else {
      await supabase.from('incidents').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function toggleResolved(inc: Incident) {
    await supabase.from('incidents').update({ resolved: !inc.resolved }).eq('id', inc.id);
    setIncidents(ii => ii.map(i => i.id === inc.id ? { ...i, resolved: !i.resolved } : i));
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet incident ?')) return;
    await supabase.from('incidents').delete().eq('id', id);
    load();
  }

  const open = incidents.filter(i => !i.resolved).length;
  const resolved = incidents.filter(i => i.resolved).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm text-[#8b949e]">
          {open > 0 && <span><strong className="text-red-400">{open}</strong> ouverts</span>}
          {resolved > 0 && <span><strong className="text-emerald-400">{resolved}</strong> résolus</span>}
          {incidents.length === 0 && <span>Aucun incident</span>}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Incident</button>
      </div>

      {loading ? <Spinner /> : incidents.length === 0 ? (
        <Empty text="Aucun incident enregistré." onAdd={openCreate} />
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => (
            <div key={inc.id} className={`card p-4 flex gap-4 ${inc.resolved ? 'opacity-60' : ''}`}>
              <div className="flex-shrink-0 mt-0.5">
                <button
                  onClick={() => toggleResolved(inc)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    inc.resolved ? 'bg-emerald-500 border-emerald-500' : 'border-[#30363d] hover:border-emerald-400'
                  }`}
                  title="Marquer comme résolu"
                >
                  {inc.resolved && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-[#21262d] text-[#8b949e] text-xs">{inc.incident_type}</span>
                  <span className="text-xs text-[#8b949e]">{formatDate(inc.date)}{inc.time && ` · ${inc.time}`}</span>
                  {inc.resolved && <span className="badge bg-emerald-900/50 text-emerald-400 text-xs">Résolu</span>}
                </div>
                <p className="text-sm text-[#e6edf3]">{inc.description}</p>
                {inc.impact && <p className="text-xs text-amber-400 mt-1">Impact : {inc.impact}</p>}
                {inc.resolved && inc.resolution_notes && (
                  <p className="text-xs text-emerald-400 mt-1">Résolution : {inc.resolution_notes}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button className="btn-ghost p-1.5" onClick={() => openEdit(inc)}><EditSVG /></button>
                <button className="btn-danger p-1.5" onClick={() => remove(inc.id)}><TrashSVG /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier l\'incident' : 'Nouvel incident'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Heure</label>
                <input className="input" type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Type d'incident</label>
              <select className="input" value={form.incident_type} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))}>
                {INCIDENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">Impact sur le tournage</label>
              <input className="input" value={form.impact || ''} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} placeholder="Retard de 2h, scène repoussée..." />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="resolved"
                checked={form.resolved}
                onChange={e => setForm(f => ({ ...f, resolved: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500"
              />
              <label htmlFor="resolved" className="text-sm text-[#8b949e] cursor-pointer">Incident résolu</label>
            </div>
            {form.resolved && (
              <div>
                <label className="label">Notes de résolution</label>
                <textarea className="input resize-none" rows={2} value={form.resolution_notes || ''} onChange={e => setForm(f => ({ ...f, resolution_notes: e.target.value }))} />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── RUSHES TAB ─────────────────────────────────────────────────────────── */
function RushesTab({ projectId }: { projectId: string }) {
  const [rushes, setRushes] = useState<Rush[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Rush | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const blank = {
    project_id: projectId, date: today, card_name: '', size_gb: null,
    backed_up: false, backup_location: '', scenes_covered: '', codec: '', notes: '',
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('rushes').select('*').eq('project_id', projectId).order('date', { ascending: false });
    setRushes(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ ...blank }); setEditing(null); setShowForm(true); }
  function openEdit(r: Rush) { setForm({ ...r }); setEditing(r); setShowForm(true); }

  async function save() {
    if (!form.card_name.trim()) return;
    if (editing) {
      await supabase.from('rushes').update(form).eq('id', editing.id);
    } else {
      await supabase.from('rushes').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function toggleBackup(r: Rush) {
    await supabase.from('rushes').update({ backed_up: !r.backed_up }).eq('id', r.id);
    setRushes(rr => rr.map(x => x.id === r.id ? { ...x, backed_up: !x.backed_up } : x));
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    await supabase.from('rushes').delete().eq('id', id);
    load();
  }

  const totalGb = rushes.reduce((sum, r) => sum + (r.size_gb || 0), 0);
  const backedUp = rushes.filter(r => r.backed_up).length;
  const notBackedUp = rushes.filter(r => !r.backed_up).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm text-[#8b949e]">
          <span><strong className="text-[#e6edf3]">{rushes.length}</strong> cartes</span>
          {totalGb > 0 && <span><strong className="text-[#e6edf3]">{totalGb.toFixed(1)} Go</strong> total</span>}
          {notBackedUp > 0 && <span><strong className="text-red-400">{notBackedUp}</strong> non sauvegardées</span>}
          {backedUp > 0 && <span><strong className="text-emerald-400">{backedUp}</strong> sauvegardées</span>}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Carte</button>
      </div>

      {loading ? <Spinner /> : rushes.length === 0 ? (
        <Empty text="Aucune carte mémoire enregistrée." onAdd={openCreate} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-[#8b949e] text-xs uppercase">
                <th className="px-4 py-3 text-left">Carte</th>
                <th className="px-4 py-3 text-left w-24">Date</th>
                <th className="px-4 py-3 text-left w-20">Taille</th>
                <th className="px-4 py-3 text-left">Scènes</th>
                <th className="px-4 py-3 text-left w-24">Codec</th>
                <th className="px-4 py-3 text-center w-28">Sauvegarde</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rushes.map(r => (
                <tr key={r.id} className="border-b border-[#21262d] table-row-hover">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#e6edf3] font-mono">{r.card_name}</div>
                    {r.backup_location && <div className="text-xs text-[#8b949e]">{r.backup_location}</div>}
                  </td>
                  <td className="px-4 py-3 text-[#8b949e]">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{r.size_gb ? `${r.size_gb} Go` : '—'}</td>
                  <td className="px-4 py-3 text-[#8b949e] text-xs">{r.scenes_covered || '—'}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{r.codec || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleBackup(r)}
                      className={`badge cursor-pointer hover:opacity-80 ${r.backed_up ? 'bg-emerald-900 text-emerald-200' : 'bg-red-900/60 text-red-300'}`}
                    >
                      {r.backed_up ? 'Sauvegardé' : 'Non sauvegardé'}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-1 justify-end">
                    <button className="btn-ghost p-1.5" onClick={() => openEdit(r)}><EditSVG /></button>
                    <button className="btn-danger p-1.5" onClick={() => remove(r.id)}><TrashSVG /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier la carte' : 'Nouvelle carte mémoire'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nom de la carte *</label>
                <input className="input font-mono" value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))} placeholder="A001, SSD_01..." autoFocus />
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Taille (Go)</label>
                <input className="input" type="number" step="0.1" value={form.size_gb || ''} onChange={e => setForm(f => ({ ...f, size_gb: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="256" />
              </div>
              <div>
                <label className="label">Codec</label>
                <input className="input" value={form.codec || ''} onChange={e => setForm(f => ({ ...f, codec: e.target.value }))} placeholder="ProRes, BRAW, H.265..." />
              </div>
            </div>
            <div>
              <label className="label">Scènes couvertes</label>
              <input className="input" value={form.scenes_covered || ''} onChange={e => setForm(f => ({ ...f, scenes_covered: e.target.value }))} placeholder="1, 2A, 3-5..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="backed_up" checked={form.backed_up} onChange={e => setForm(f => ({ ...f, backed_up: e.target.checked }))} className="w-4 h-4 accent-emerald-500" />
              <label htmlFor="backed_up" className="text-sm text-[#8b949e] cursor-pointer">Sauvegardé</label>
            </div>
            {form.backed_up && (
              <div>
                <label className="label">Emplacement de sauvegarde</label>
                <input className="input" value={form.backup_location || ''} onChange={e => setForm(f => ({ ...f, backup_location: e.target.value }))} placeholder="NAS / Google Drive / Disque externe..." />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card p-4">
      <div className={`text-3xl font-bold mb-1 ${color || 'text-[#e6edf3]'}`}>{value}</div>
      <div className="text-xs text-[#8b949e] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#e6edf3]">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose}><XSvg /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spinner() { return <div className="text-center py-12 text-[#8b949e]">Chargement...</div>; }
function Empty({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <div className="text-center py-16 text-[#8b949e]">
      <p className="mb-3">{text}</p>
      {onAdd && <button className="btn-primary" onClick={onAdd}>Ajouter</button>}
    </div>
  );
}
function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function EditSVG() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashSVG() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function XSvg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
