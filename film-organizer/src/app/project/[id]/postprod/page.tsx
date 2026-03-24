'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { PostProdTask } from '@/lib/types';
import { POSTPROD_CATEGORIES, TASK_STATUSES, STATUS_COLORS } from '@/lib/types';

const STATUS_ORDER = ['à faire', 'en cours', 'validé', 'livré'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Montage': 'bg-violet-900/40 text-violet-300 border-violet-700/30',
  'Son': 'bg-blue-900/40 text-blue-300 border-blue-700/30',
  'Étalonnage': 'bg-amber-900/40 text-amber-300 border-amber-700/30',
  'VFX': 'bg-cyan-900/40 text-cyan-300 border-cyan-700/30',
  'Mixage': 'bg-indigo-900/40 text-indigo-300 border-indigo-700/30',
  'Livraison': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/30',
  'Autre': 'bg-slate-700/40 text-slate-300 border-slate-600/30',
};

export default function PostProdPage() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState<PostProdTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PostProdTask | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const blank = {
    project_id: id, title: '', category: 'Montage' as PostProdTask['category'],
    assignee: '', due_date: null, status: 'à faire' as PostProdTask['status'],
    notes: '', order_index: 0,
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('postprod_tasks').select('*').eq('project_id', id).order('category').order('order_index').order('created_at');
    setTasks(data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openCreate(preCategory?: PostProdTask['category']) {
    setForm({ ...blank, category: preCategory || 'Montage', order_index: tasks.length });
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(t: PostProdTask) { setForm({ ...t }); setEditing(t); setShowForm(true); }

  async function save() {
    if (!form.title.trim()) return;
    if (editing) {
      await supabase.from('postprod_tasks').update(form).eq('id', editing.id);
    } else {
      await supabase.from('postprod_tasks').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function remove(taskId: string) {
    if (!confirm('Supprimer cette tâche ?')) return;
    await supabase.from('postprod_tasks').delete().eq('id', taskId);
    load();
  }

  async function cycleStatus(task: PostProdTask) {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    await supabase.from('postprod_tasks').update({ status: next }).eq('id', task.id);
    setTasks(tt => tt.map(t => t.id === task.id ? { ...t, status: next } : t));
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'livré').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) return <div className="p-6 text-center text-[#8b949e]">Chargement...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${view === 'kanban' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${view === 'list' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
            >
              Liste
            </button>
          </div>
          {total > 0 && (
            <span className="text-sm text-[#8b949e]">
              <strong className="text-emerald-400">{done}</strong> / {total} livrés ({pct}%)
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={() => openCreate()}>+ Tâche</button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden mb-6">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <p className="mb-3">Aucune tâche de post-production.</p>
          <button className="btn-primary" onClick={() => openCreate()}>Créer une tâche</button>
        </div>
      ) : view === 'kanban' ? (
        <KanbanView tasks={tasks} onEdit={openEdit} onDelete={remove} onCycleStatus={cycleStatus} onAddInStatus={cat => openCreate(cat as PostProdTask['category'])} />
      ) : (
        <ListView tasks={tasks} onEdit={openEdit} onDelete={remove} onCycleStatus={cycleStatus} />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#e6edf3]">{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
              <button className="btn-ghost p-1" onClick={() => setShowForm(false)}><XSvg /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Titre *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Catégorie</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as PostProdTask['category'] }))}>
                    {POSTPROD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PostProdTask['status'] }))}>
                    {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Responsable</label>
                  <input className="input" value={form.assignee || ''} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="Prénom" />
                </div>
                <div>
                  <label className="label">Date limite</label>
                  <input className="input" type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value || null }))} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
                <button className="btn-primary" onClick={save}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── KANBAN VIEW ────────────────────────────────────────────────────────── */
function KanbanView({
  tasks, onEdit, onDelete, onCycleStatus, onAddInStatus,
}: {
  tasks: PostProdTask[];
  onEdit: (t: PostProdTask) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (t: PostProdTask) => void;
  onAddInStatus: (category: string) => void;
}) {
  const byStatus = STATUS_ORDER.reduce<Record<string, PostProdTask[]>>((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<string, PostProdTask[]>);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STATUS_ORDER.map(status => (
        <div key={status} className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`badge text-xs ${STATUS_COLORS[status]}`}>{status}</span>
            <span className="text-xs text-[#8b949e]">{byStatus[status].length}</span>
          </div>
          {byStatus[status].map(task => (
            <div key={task.id} className="card p-3 hover:border-[#58a6ff] transition-colors group">
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className={`badge text-xs border ${CATEGORY_COLORS[task.category]}`}>{task.category}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost p-0.5" onClick={() => onEdit(task)}><EditSVG /></button>
                  <button className="btn-danger p-0.5" onClick={() => onDelete(task.id)}><TrashSVG /></button>
                </div>
              </div>
              <p className="text-sm text-[#e6edf3] mb-2 leading-snug">{task.title}</p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#8b949e]">
                  {task.assignee && <span>{task.assignee}</span>}
                  {task.due_date && <span className="ml-1 text-amber-400">{formatDate(task.due_date)}</span>}
                </div>
                <button
                  onClick={() => onCycleStatus(task)}
                  className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  title="Avancer le statut"
                >
                  →
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => onAddInStatus(status)}
            className="text-xs text-[#8b949e] hover:text-[#e6edf3] py-2 border border-dashed border-[#30363d] hover:border-[#58a6ff] rounded-md transition-colors"
          >
            + Ajouter
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── LIST VIEW ──────────────────────────────────────────────────────────── */
function ListView({
  tasks, onEdit, onDelete, onCycleStatus,
}: {
  tasks: PostProdTask[];
  onEdit: (t: PostProdTask) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (t: PostProdTask) => void;
}) {
  const byCategory = POSTPROD_CATEGORIES.reduce<Record<string, PostProdTask[]>>((acc, c) => {
    const list = tasks.filter(t => t.category === c);
    if (list.length > 0) acc[c] = list;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat} className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#30363d] bg-[#1c2128] flex items-center gap-2">
            <span className={`badge text-xs border ${CATEGORY_COLORS[cat]}`}>{cat}</span>
            <span className="text-xs text-[#8b949e]">{list.filter(t => t.status === 'livré').length}/{list.length}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {list.map(t => (
                <tr key={t.id} className="border-b border-[#21262d] last:border-0 table-row-hover">
                  <td className="px-4 py-3 text-[#e6edf3]">{t.title}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{t.assignee || '—'}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{t.due_date ? formatDate(t.due_date) : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onCycleStatus(t)}
                      className={`badge cursor-pointer hover:opacity-80 ${STATUS_COLORS[t.status]}`}
                    >
                      {t.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-1 justify-end">
                    <button className="btn-ghost p-1.5" onClick={() => onEdit(t)}><EditSVG /></button>
                    <button className="btn-danger p-1.5" onClick={() => onDelete(t.id)}><TrashSVG /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function EditSVG() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashSVG() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function XSvg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
