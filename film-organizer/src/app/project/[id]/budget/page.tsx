'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BudgetLine } from '@/lib/types';
import { DEPARTMENTS } from '@/lib/types';

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(DEPARTMENTS));

  const blank: Omit<BudgetLine, 'id' | 'created_at'> = {
    project_id: id, department: DEPARTMENTS[0], category: '', description: '',
    estimated: 0, actual: 0, supplier: '', notes: '',
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const { data } = await supabase.from('budget_lines').select('*').eq('project_id', id).order('department').order('category').order('created_at');
    setLines(data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openCreate(dept?: string) {
    setForm({ ...blank, department: dept || DEPARTMENTS[0] });
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(l: BudgetLine) { setForm({ ...l }); setEditing(l); setShowForm(true); }

  async function save() {
    if (!form.description.trim()) return;
    if (editing) {
      await supabase.from('budget_lines').update(form).eq('id', editing.id);
    } else {
      await supabase.from('budget_lines').insert(form);
    }
    setShowForm(false);
    load();
  }

  async function remove(lineId: string) {
    if (!confirm('Supprimer cette ligne ?')) return;
    await supabase.from('budget_lines').delete().eq('id', lineId);
    load();
  }

  function toggleDept(dept: string) {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  }

  // Group by department
  const byDept = lines.reduce<Record<string, BudgetLine[]>>((acc, l) => {
    (acc[l.department] = acc[l.department] || []).push(l);
    return acc;
  }, {});

  const totalEstimated = lines.reduce((s, l) => s + (l.estimated || 0), 0);
  const totalActual = lines.reduce((s, l) => s + (l.actual || 0), 0);
  const diff = totalActual - totalEstimated;

  function exportCSV() {
    const headers = ['Département', 'Catégorie', 'Description', 'Fournisseur', 'Estimé (€)', 'Réel (€)', 'Écart (€)', 'Notes'];
    const rows = lines.map(l => [
      l.department, l.category, l.description, l.supplier || '',
      l.estimated, l.actual, (l.actual - l.estimated).toFixed(2), l.notes || '',
    ]);
    // Add department subtotals
    const withTotals: (string | number)[][] = [];
    let currentDept = '';
    for (const row of rows) {
      if (row[0] !== currentDept) {
        if (currentDept) {
          const deptLines = lines.filter(l => l.department === currentDept);
          const dEst = deptLines.reduce((s, l) => s + l.estimated, 0);
          const dAct = deptLines.reduce((s, l) => s + l.actual, 0);
          withTotals.push(['', '', `TOTAL ${currentDept}`, '', dEst.toFixed(2), dAct.toFixed(2), (dAct - dEst).toFixed(2), '']);
          withTotals.push([]);
        }
        currentDept = row[0] as string;
      }
      withTotals.push(row);
    }
    if (currentDept) {
      const deptLines = lines.filter(l => l.department === currentDept);
      const dEst = deptLines.reduce((s, l) => s + l.estimated, 0);
      const dAct = deptLines.reduce((s, l) => s + l.actual, 0);
      withTotals.push(['', '', `TOTAL ${currentDept}`, '', dEst.toFixed(2), dAct.toFixed(2), (dAct - dEst).toFixed(2), '']);
    }
    withTotals.push([]);
    withTotals.push(['', '', 'TOTAL GÉNÉRAL', '', totalEstimated.toFixed(2), totalActual.toFixed(2), diff.toFixed(2), '']);

    const csv = [headers, ...withTotals]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-tournage.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-6 text-center text-[#8b949e]">Chargement...</div>;

  const activeDepts = DEPARTMENTS.filter(d => byDept[d]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-[#8b949e] uppercase tracking-wide mb-1">Budget estimé</div>
          <div className="text-2xl font-bold text-[#e6edf3]">{fmt(totalEstimated)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[#8b949e] uppercase tracking-wide mb-1">Dépenses réelles</div>
          <div className="text-2xl font-bold text-[#e6edf3]">{fmt(totalActual)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[#8b949e] uppercase tracking-wide mb-1">Écart</div>
          <div className={`text-2xl font-bold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-[#e6edf3]'}`}>
            {diff > 0 ? '+' : ''}{fmt(diff)}
          </div>
        </div>
      </div>

      {/* Department overview bar */}
      {totalEstimated > 0 && (
        <div className="card p-4 mb-6">
          <div className="text-xs text-[#8b949e] uppercase tracking-wide mb-3">Répartition par département</div>
          <div className="space-y-2">
            {activeDepts.map(dept => {
              const dLines = byDept[dept] || [];
              const dEst = dLines.reduce((s, l) => s + l.estimated, 0);
              const dAct = dLines.reduce((s, l) => s + l.actual, 0);
              const pct = totalEstimated > 0 ? (dEst / totalEstimated) * 100 : 0;
              const overBudget = dAct > dEst;
              return (
                <div key={dept} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-[#8b949e] truncate">{dept}</div>
                  <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#8b949e] w-24 text-right">{fmt(dEst)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mb-4 no-print">
        <span className="text-sm text-[#8b949e]"><strong className="text-[#e6edf3]">{lines.length}</strong> lignes</span>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCSV}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimer PDF
          </button>
          <button className="btn-primary" onClick={() => openCreate()}>+ Ligne</button>
        </div>
      </div>

      {/* Budget table */}
      {lines.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <p className="mb-3">Aucune ligne budgétaire. Commence à saisir ton budget.</p>
          <button className="btn-primary" onClick={() => openCreate()}>Ajouter une ligne</button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDepts.map(dept => {
            const dLines = byDept[dept] || [];
            const dEst = dLines.reduce((s, l) => s + l.estimated, 0);
            const dAct = dLines.reduce((s, l) => s + l.actual, 0);
            const dDiff = dAct - dEst;
            const expanded = expandedDepts.has(dept);

            return (
              <div key={dept} className="card overflow-hidden">
                {/* Department header */}
                <div
                  className="px-4 py-3 bg-[#1c2128] border-b border-[#30363d] flex items-center justify-between cursor-pointer hover:bg-[#21262d] transition-colors"
                  onClick={() => toggleDept(dept)}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2"
                      className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                    >
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className="text-sm font-semibold text-[#e6edf3]">{dept}</span>
                    <span className="text-xs text-[#8b949e]">{dLines.length} ligne{dLines.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-xs text-[#8b949e]">Estimé</div>
                      <div className="font-medium text-[#e6edf3]">{fmt(dEst)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#8b949e]">Réel</div>
                      <div className="font-medium text-[#e6edf3]">{fmt(dAct)}</div>
                    </div>
                    <div className="text-right w-24">
                      <div className="text-xs text-[#8b949e]">Écart</div>
                      <div className={`font-medium ${dDiff > 0 ? 'text-red-400' : dDiff < 0 ? 'text-emerald-400' : 'text-[#8b949e]'}`}>
                        {dDiff > 0 ? '+' : ''}{fmt(dDiff)}
                      </div>
                    </div>
                    <button
                      className="btn-ghost p-1 text-xs"
                      onClick={e => { e.stopPropagation(); openCreate(dept); }}
                      title="Ajouter une ligne"
                    >
                      +
                    </button>
                  </div>
                </div>

                {expanded && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[#8b949e] border-b border-[#30363d]">
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Catégorie</th>
                        <th className="px-4 py-2 text-left">Fournisseur</th>
                        <th className="px-4 py-2 text-right w-28">Estimé</th>
                        <th className="px-4 py-2 text-right w-28">Réel</th>
                        <th className="px-4 py-2 text-right w-24">Écart</th>
                        <th className="px-4 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dLines.map(l => {
                        const lDiff = l.actual - l.estimated;
                        return (
                          <tr key={l.id} className="border-b border-[#21262d] last:border-0 table-row-hover">
                            <td className="px-4 py-2.5 text-[#e6edf3]">
                              {l.description}
                              {l.notes && <div className="text-xs text-[#8b949e]">{l.notes}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-[#8b949e]">{l.category || '—'}</td>
                            <td className="px-4 py-2.5 text-[#8b949e]">{l.supplier || '—'}</td>
                            <td className="px-4 py-2.5 text-right text-[#e6edf3]">{fmt(l.estimated)}</td>
                            <td className="px-4 py-2.5 text-right text-[#e6edf3]">
                              <InlineEdit
                                value={l.actual}
                                onSave={async val => {
                                  await supabase.from('budget_lines').update({ actual: val }).eq('id', l.id);
                                  setLines(ll => ll.map(x => x.id === l.id ? { ...x, actual: val } : x));
                                }}
                              />
                            </td>
                            <td className={`px-4 py-2.5 text-right font-medium ${lDiff > 0 ? 'text-red-400' : lDiff < 0 ? 'text-emerald-400' : 'text-[#8b949e]'}`}>
                              {lDiff !== 0 ? (lDiff > 0 ? '+' : '') + fmt(lDiff) : '—'}
                            </td>
                            <td className="px-4 py-2.5 flex gap-1 justify-end">
                              <button className="btn-ghost p-1" onClick={() => openEdit(l)}><EditSVG /></button>
                              <button className="btn-danger p-1" onClick={() => remove(l.id)}><TrashSVG /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="card p-4 border-[#58a6ff]/30">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#e6edf3]">TOTAL GÉNÉRAL</span>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <div className="text-xs text-[#8b949e]">Estimé</div>
                  <div className="font-bold text-[#e6edf3] text-lg">{fmt(totalEstimated)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#8b949e]">Réel</div>
                  <div className="font-bold text-[#e6edf3] text-lg">{fmt(totalActual)}</div>
                </div>
                <div className="text-right w-24">
                  <div className="text-xs text-[#8b949e]">Écart</div>
                  <div className={`font-bold text-lg ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-[#8b949e]'}`}>
                    {diff > 0 ? '+' : ''}{fmt(diff)}
                  </div>
                </div>
                <div className="w-16" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#e6edf3]">{editing ? 'Modifier la ligne' : 'Nouvelle ligne budgétaire'}</h2>
              <button className="btn-ghost p-1" onClick={() => setShowForm(false)}><XSvg /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Description *</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Caméra principale, Location salle..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Département</label>
                  <select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Catégorie</label>
                  <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Location, Achat, Prestation..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Montant estimé (€)</label>
                  <input className="input" type="number" step="0.01" value={form.estimated} onChange={e => setForm(f => ({ ...f, estimated: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Montant réel (€)</label>
                  <input className="input" type="number" step="0.01" value={form.actual} onChange={e => setForm(f => ({ ...f, actual: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="label">Fournisseur</label>
                <input className="input" value={form.supplier || ''} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
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

/* ─── INLINE EDIT for actual amount ─────────────────────────────────────── */
function InlineEdit({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));

  if (!editing) {
    return (
      <button
        className="hover:text-white hover:underline underline-offset-2 cursor-pointer"
        onClick={() => { setLocal(String(value)); setEditing(true); }}
        title="Cliquer pour modifier"
      >
        {fmt(value)}
      </button>
    );
  }

  return (
    <input
      className="bg-[#0d1117] border border-[#58a6ff] rounded px-2 py-0.5 text-right w-24 text-sm text-[#e6edf3] focus:outline-none"
      type="number"
      step="0.01"
      value={local}
      autoFocus
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { onSave(parseFloat(local) || 0); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(parseFloat(local) || 0); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
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
