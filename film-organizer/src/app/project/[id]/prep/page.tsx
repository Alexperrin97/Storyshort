'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Scene, TeamMember, ShootingDay } from '@/lib/types';
import { STATUS_COLORS, DEPARTMENTS } from '@/lib/types';

type Tab = 'scenes' | 'team' | 'calendar' | 'callsheet';

const IE_OPTIONS = ['INT', 'EXT', 'INT/EXT'];
const DN_OPTIONS = ['JOUR', 'NUIT', 'AUBE', 'CRÉPUSCULE'];
const SCENE_STATUS_LIST = ['à tourner', 'en cours', 'tourné', 'à reprendre'];

export default function PrepPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('scenes');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex gap-2 mb-6 border-b border-[#30363d]">
        {([['scenes', 'Scènes'], ['team', 'Équipe'], ['calendar', 'Calendrier'], ['callsheet', 'Feuilles de service']] as [Tab, string][]).map(([key, label]) => (
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

      {tab === 'scenes' && <ScenesTab projectId={id} />}
      {tab === 'team' && <TeamTab projectId={id} />}
      {tab === 'calendar' && <CalendarTab projectId={id} />}
      {tab === 'callsheet' && <CallSheetTab projectId={id} />}
    </div>
  );
}

/* ─── SCENES TAB ─────────────────────────────────────────────────────────── */
function ScenesTab({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Scene | null>(null);
  const [showForm, setShowForm] = useState(false);
  const blank: Omit<Scene, 'id' | 'created_at'> = {
    project_id: projectId, number: '', title: '', location: '', interior_exterior: null,
    day_night: null, cast_list: '', synopsis: '', technical_notes: '', status: 'à tourner',
    estimated_duration: null, shoot_date: null, order_index: 0,
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('scenes').select('*').eq('project_id', projectId).order('order_index').order('number');
    setScenes(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ ...blank, order_index: scenes.length }); setEditing(null); setShowForm(true); }
  function openEdit(s: Scene) { setForm({ ...s }); setEditing(s); setShowForm(true); }

  async function save() {
    if (!form.number.trim()) return;
    if (editing) {
      await supabase.from('scenes').update(form).eq('id', editing.id);
    } else {
      await supabase.from('scenes').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette scène ?')) return;
    await supabase.from('scenes').delete().eq('id', id);
    load();
  }

  async function cycleStatus(scene: Scene) {
    const order = SCENE_STATUS_LIST as string[];
    const next = order[(order.indexOf(scene.status) + 1) % order.length] as Scene['status'];
    await supabase.from('scenes').update({ status: next }).eq('id', scene.id);
    setScenes(ss => ss.map(s => s.id === scene.id ? { ...s, status: next } : s));
  }

  const stats = {
    total: scenes.length,
    tourné: scenes.filter(s => s.status === 'tourné').length,
    àReprendre: scenes.filter(s => s.status === 'à reprendre').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm text-[#8b949e]">
          <span><strong className="text-[#e6edf3]">{stats.total}</strong> scènes</span>
          <span><strong className="text-emerald-400">{stats.tourné}</strong> tournées</span>
          {stats.àReprendre > 0 && <span><strong className="text-red-400">{stats.àReprendre}</strong> à reprendre</span>}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Scène</button>
      </div>

      {loading ? <Spinner /> : scenes.length === 0 ? (
        <Empty text="Aucune scène. Ajoute ton découpage." onAdd={openCreate} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-[#8b949e] text-xs uppercase">
                <th className="px-4 py-3 text-left w-16">#</th>
                <th className="px-4 py-3 text-left">Titre / Lieu</th>
                <th className="px-4 py-3 text-left w-24">IE / JN</th>
                <th className="px-4 py-3 text-left w-32">Durée</th>
                <th className="px-4 py-3 text-left w-32">Date</th>
                <th className="px-4 py-3 text-left w-36">Statut</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {scenes.map(s => (
                <tr key={s.id} className="border-b border-[#21262d] table-row-hover">
                  <td className="px-4 py-3 font-mono text-[#e6edf3] font-semibold">{s.number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#e6edf3]">{s.title || '—'}</div>
                    {s.location && <div className="text-xs text-[#8b949e]">{s.location}</div>}
                  </td>
                  <td className="px-4 py-3 text-[#8b949e] text-xs">
                    {[s.interior_exterior, s.day_night].filter(Boolean).join(' · ')}
                  </td>
                  <td className="px-4 py-3 text-[#8b949e]">{s.estimated_duration ? `${s.estimated_duration} min` : '—'}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{s.shoot_date ? formatDate(s.shoot_date) : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => cycleStatus(s)}
                      className={`badge cursor-pointer hover:opacity-80 ${STATUS_COLORS[s.status]}`}
                    >
                      {s.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-1 justify-end">
                    <button className="btn-ghost p-1.5" onClick={() => openEdit(s)}><EditSVG /></button>
                    <button className="btn-danger p-1.5" onClick={() => remove(s.id)}><TrashSVG /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier la scène' : 'Nouvelle scène'} onClose={() => setShowForm(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Numéro *</label>
              <input className="input" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="1, 1A, 12B..." autoFocus />
            </div>
            <div>
              <label className="label">Titre</label>
              <input className="input" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de la scène" />
            </div>
            <div className="col-span-2">
              <label className="label">Lieu</label>
              <input className="input" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Appartement de Paul, Forêt de Fontainebleau..." />
            </div>
            <div>
              <label className="label">Intérieur / Extérieur</label>
              <select className="input" value={form.interior_exterior || ''} onChange={e => setForm(f => ({ ...f, interior_exterior: e.target.value as Scene['interior_exterior'] || null }))}>
                <option value="">—</option>
                {IE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jour / Nuit</label>
              <select className="input" value={form.day_night || ''} onChange={e => setForm(f => ({ ...f, day_night: e.target.value as Scene['day_night'] || null }))}>
                <option value="">—</option>
                {DN_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Durée estimée (min)</label>
              <input className="input" type="number" value={form.estimated_duration || ''} onChange={e => setForm(f => ({ ...f, estimated_duration: e.target.value ? parseInt(e.target.value) : null }))} placeholder="5" />
            </div>
            <div>
              <label className="label">Date de tournage</label>
              <input className="input" type="date" value={form.shoot_date || ''} onChange={e => setForm(f => ({ ...f, shoot_date: e.target.value || null }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Comédiens</label>
              <input className="input" value={form.cast_list || ''} onChange={e => setForm(f => ({ ...f, cast_list: e.target.value }))} placeholder="Paul, Marie, Jean..." />
            </div>
            <div className="col-span-2">
              <label className="label">Synopsis / Action</label>
              <textarea className="input resize-none" rows={2} value={form.synopsis || ''} onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes techniques</label>
              <textarea className="input resize-none" rows={2} value={form.technical_notes || ''} onChange={e => setForm(f => ({ ...f, technical_notes: e.target.value }))} placeholder="Grue, contre-jour, plan séquence..." />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Scene['status'] }))}>
                {SCENE_STATUS_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-5">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn-primary" onClick={save}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── TEAM TAB ───────────────────────────────────────────────────────────── */
function TeamTab({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const blank = { project_id: projectId, name: '', role: '', department: DEPARTMENTS[0], email: '', phone: '', notes: '' };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('team_members').select('*').eq('project_id', projectId).order('department').order('name');
    setMembers(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ ...blank }); setEditing(null); setShowForm(true); }
  function openEdit(m: TeamMember) { setForm({ ...m }); setEditing(m); setShowForm(true); }

  async function save() {
    if (!form.name.trim() || !form.role.trim()) return;
    if (editing) {
      await supabase.from('team_members').update(form).eq('id', editing.id);
    } else {
      await supabase.from('team_members').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce membre ?')) return;
    await supabase.from('team_members').delete().eq('id', id);
    load();
  }

  const byDept = members.reduce<Record<string, TeamMember[]>>((acc, m) => {
    (acc[m.department] = acc[m.department] || []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#8b949e]"><strong className="text-[#e6edf3]">{members.length}</strong> membres</span>
        <button className="btn-primary" onClick={openCreate}>+ Membre</button>
      </div>

      {loading ? <Spinner /> : members.length === 0 ? (
        <Empty text="Aucun membre d'équipe." onAdd={openCreate} />
      ) : (
        <div className="space-y-4">
          {Object.entries(byDept).map(([dept, list]) => (
            <div key={dept} className="card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#30363d] bg-[#1c2128]">
                <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">{dept}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {list.map(m => (
                    <tr key={m.id} className="border-b border-[#21262d] last:border-0 table-row-hover">
                      <td className="px-4 py-3 font-medium text-[#e6edf3]">{m.name}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{m.role}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{m.email || '—'}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{m.phone || '—'}</td>
                      <td className="px-4 py-3 flex gap-1 justify-end">
                        <button className="btn-ghost p-1.5" onClick={() => openEdit(m)}><EditSVG /></button>
                        <button className="btn-danger p-1.5" onClick={() => remove(m.id)}><TrashSVG /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier le membre' : 'Nouveau membre'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">Poste *</label>
              <input className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Chef opérateur, 1er AD..." />
            </div>
            <div>
              <label className="label">Département</label>
              <select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
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

/* ─── CALENDAR TAB ───────────────────────────────────────────────────────── */
function CalendarTab({ projectId }: { projectId: string }) {
  const [days, setDays] = useState<ShootingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShootingDay | null>(null);
  const blank = { project_id: projectId, date: '', location: '', call_time: '', wrap_time: '', general_notes: '' };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('shooting_days').select('*').eq('project_id', projectId).order('date');
    setDays(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ ...blank }); setEditing(null); setShowForm(true); }
  function openEdit(d: ShootingDay) { setForm({ ...d }); setEditing(d); setShowForm(true); }

  async function save() {
    if (!form.date) return;
    if (editing) {
      await supabase.from('shooting_days').update(form).eq('id', editing.id);
    } else {
      await supabase.from('shooting_days').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce jour de tournage ?')) return;
    await supabase.from('shooting_days').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#8b949e]"><strong className="text-[#e6edf3]">{days.length}</strong> jours de tournage</span>
        <button className="btn-primary" onClick={openCreate}>+ Jour</button>
      </div>

      {loading ? <Spinner /> : days.length === 0 ? (
        <Empty text="Aucun jour de tournage planifié." onAdd={openCreate} />
      ) : (
        <div className="space-y-2">
          {days.map((d, i) => (
            <div key={d.id} className="card p-4 flex items-start gap-4 hover:border-[#58a6ff] transition-colors">
              <div className="flex-shrink-0 w-12 text-center">
                <div className="text-xs text-[#8b949e] uppercase">{new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                <div className="text-2xl font-bold text-[#e6edf3] leading-none">{new Date(d.date + 'T12:00:00').getDate()}</div>
                <div className="text-xs text-[#8b949e]">{new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' })}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded font-medium">J{i + 1}</span>
                  {d.location && <span className="text-sm text-[#e6edf3] font-medium">{d.location}</span>}
                </div>
                {(d.call_time || d.wrap_time) && (
                  <div className="text-xs text-[#8b949e]">
                    {d.call_time && <span>Appel: {d.call_time}</span>}
                    {d.call_time && d.wrap_time && <span className="mx-2">·</span>}
                    {d.wrap_time && <span>Fin: {d.wrap_time}</span>}
                  </div>
                )}
                {d.general_notes && <p className="text-xs text-[#8b949e] mt-1 line-clamp-2">{d.general_notes}</p>}
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost p-1.5" onClick={() => openEdit(d)}><EditSVG /></button>
                <button className="btn-danger p-1.5" onClick={() => remove(d.id)}><TrashSVG /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier le jour' : 'Nouveau jour de tournage'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">Lieu principal</label>
              <input className="input" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Studio A, Mairie de Paris..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Heure d'appel</label>
                <input className="input" type="time" value={form.call_time || ''} onChange={e => setForm(f => ({ ...f, call_time: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fin de journée</label>
                <input className="input" type="time" value={form.wrap_time || ''} onChange={e => setForm(f => ({ ...f, wrap_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.general_notes || ''} onChange={e => setForm(f => ({ ...f, general_notes: e.target.value }))} />
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

/* ─── CALL SHEET TAB ─────────────────────────────────────────────────────── */
function CallSheetTab({ projectId }: { projectId: string }) {
  const [days, setDays] = useState<ShootingDay[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedDay, setSelectedDay] = useState<ShootingDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('shooting_days').select('*').eq('project_id', projectId).order('date'),
      supabase.from('scenes').select('*').eq('project_id', projectId).order('order_index'),
      supabase.from('team_members').select('*').eq('project_id', projectId).order('department'),
    ]).then(([{ data: d }, { data: s }, { data: t }]) => {
      setDays(d || []);
      setScenes(s || []);
      setTeam(t || []);
      if (d && d.length > 0) setSelectedDay(d[0]);
      setLoading(false);
    });
  }, [projectId]);

  const dayScenes = scenes.filter(s => s.shoot_date === selectedDay?.date);

  if (loading) return <Spinner />;

  if (days.length === 0) {
    return <Empty text="Ajoute des jours de tournage dans l'onglet Calendrier pour générer les feuilles de service." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 no-print">
        <select
          className="input max-w-xs"
          value={selectedDay?.id || ''}
          onChange={e => setSelectedDay(days.find(d => d.id === e.target.value) || null)}
        >
          {days.map((d, i) => (
            <option key={d.id} value={d.id}>
              Jour {i + 1} — {formatDate(d.date)}{d.location ? ` · ${d.location}` : ''}
            </option>
          ))}
        </select>
        <button className="btn-secondary" onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Imprimer
        </button>
      </div>

      {selectedDay && (
        <div className="card p-6 max-w-3xl">
          {/* Header */}
          <div className="border-b border-[#30363d] pb-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#e6edf3]">FEUILLE DE SERVICE</h1>
                <div className="text-sm text-[#8b949e] mt-1">
                  Jour {days.indexOf(selectedDay) + 1} / {days.length}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-[#e6edf3]">
                  {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                {selectedDay.location && <div className="text-sm text-[#8b949e]">{selectedDay.location}</div>}
              </div>
            </div>
            {(selectedDay.call_time || selectedDay.wrap_time) && (
              <div className="flex gap-6 mt-3 text-sm">
                {selectedDay.call_time && (
                  <div>
                    <span className="text-[#8b949e]">Heure d'appel : </span>
                    <strong className="text-[#e6edf3]">{selectedDay.call_time}</strong>
                  </div>
                )}
                {selectedDay.wrap_time && (
                  <div>
                    <span className="text-[#8b949e]">Fin prévisionnelle : </span>
                    <strong className="text-[#e6edf3]">{selectedDay.wrap_time}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scenes */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-3">Scènes du jour</h3>
            {dayScenes.length === 0 ? (
              <p className="text-sm text-[#8b949e] italic">Aucune scène assignée à ce jour (définir la date dans l'onglet Scènes).</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#8b949e] border-b border-[#30363d]">
                    <th className="pb-2 text-left w-12">#</th>
                    <th className="pb-2 text-left">Titre / Lieu</th>
                    <th className="pb-2 text-left w-20">IE/JN</th>
                    <th className="pb-2 text-left">Comédiens</th>
                    <th className="pb-2 text-right w-20">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {dayScenes.map(s => (
                    <tr key={s.id} className="border-b border-[#21262d]">
                      <td className="py-2 font-mono font-semibold text-[#e6edf3]">{s.number}</td>
                      <td className="py-2">
                        <div className="text-[#e6edf3]">{s.title || '—'}</div>
                        {s.location && <div className="text-xs text-[#8b949e]">{s.location}</div>}
                      </td>
                      <td className="py-2 text-xs text-[#8b949e]">{[s.interior_exterior, s.day_night].filter(Boolean).join(' ')}</td>
                      <td className="py-2 text-xs text-[#8b949e]">{s.cast_list || '—'}</td>
                      <td className="py-2 text-right text-[#8b949e]">{s.estimated_duration ? `${s.estimated_duration}mn` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Team */}
          {team.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-3">Équipe</h3>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {team.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1 border-b border-[#21262d]">
                    <span className="text-[#8b949e]">{m.role}</span>
                    <span className="text-[#e6edf3] font-medium">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDay.general_notes && (
            <div className="mt-5 p-3 bg-amber-900/20 border border-amber-700/30 rounded-md">
              <div className="text-xs font-semibold text-amber-400 uppercase mb-1">Notes</div>
              <p className="text-sm text-[#e6edf3]">{selectedDay.general_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#e6edf3]">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose}><XSvg /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="text-center py-12 text-[#8b949e]">Chargement...</div>;
}

function Empty({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <div className="text-center py-16 text-[#8b949e]">
      <p className="mb-3">{text}</p>
      {onAdd && <button className="btn-primary" onClick={onAdd}>Ajouter</button>}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
