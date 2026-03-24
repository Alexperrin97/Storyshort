'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [form, setForm] = useState({ name: '', description: '', director: '', producer: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const saved = JSON.parse(localStorage.getItem('film-organizer-projects') || '[]') as string[];
    if (saved.length === 0) { setLoading(false); return; }

    const { data } = await supabase.from('projects').select('*').in('id', saved).order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('projects').insert({ ...form }).select().single();
    if (error || !data) { setSaving(false); return; }

    const saved = JSON.parse(localStorage.getItem('film-organizer-projects') || '[]') as string[];
    localStorage.setItem('film-organizer-projects', JSON.stringify([data.id, ...saved]));
    setProjects(p => [data, ...p]);
    setShowCreate(false);
    setForm({ name: '', description: '', director: '', producer: '' });
    setSaving(false);
    router.push(`/project/${data.id}/prep`);
  }

  async function joinProject() {
    const token = joinToken.trim();
    if (!token) return;
    setSaving(true);

    const { data, error } = await supabase.from('projects').select('*').eq('share_token', token).single();
    if (error || !data) {
      alert('Projet introuvable. Vérifie le token d\'invitation.');
      setSaving(false);
      return;
    }

    const saved = JSON.parse(localStorage.getItem('film-organizer-projects') || '[]') as string[];
    if (!saved.includes(data.id)) {
      localStorage.setItem('film-organizer-projects', JSON.stringify([data.id, ...saved]));
    }
    setSaving(false);
    setShowJoin(false);
    setJoinToken('');
    router.push(`/project/${data.id}/prep`);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Header */}
      <header className="border-b border-[#30363d] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
              </svg>
            </div>
            <span className="font-semibold text-lg text-[#e6edf3]">Film Organizer</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowJoin(true)}>Rejoindre un projet</button>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Nouveau projet</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-20 text-[#8b949e]">Chargement...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#161b22] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#30363d]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-2">Aucun projet</h2>
            <p className="text-[#8b949e] mb-6">Crée ton premier projet de tournage ou rejoins-en un avec un lien d'invitation.</p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>Créer un projet</button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-[#e6edf3] mb-6">Mes projets</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/project/${p.id}/prep`)}
                  className="card p-5 text-left hover:border-[#58a6ff] transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-red-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e63946" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                    </div>
                    <span className="text-[#8b949e] text-xs">{formatDate(p.created_at)}</span>
                  </div>
                  <h3 className="font-semibold text-[#e6edf3] group-hover:text-white mb-1">{p.name}</h3>
                  {p.description && <p className="text-sm text-[#8b949e] line-clamp-2 mb-2">{p.description}</p>}
                  <div className="flex gap-3 text-xs text-[#8b949e]">
                    {p.director && <span>Dir. {p.director}</span>}
                    {p.producer && <span>Prod. {p.producer}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Create project */}
      {showCreate && (
        <Modal title="Nouveau projet" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Titre du projet *</label>
              <input className="input" placeholder="Ex: Court-métrage #3" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={2} placeholder="Synopsis, genre..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Réalisateur</label>
                <input className="input" placeholder="Nom" value={form.director} onChange={e => setForm(f => ({ ...f, director: e.target.value }))} />
              </div>
              <div>
                <label className="label">Producteur</label>
                <input className="input" placeholder="Nom" value={form.producer} onChange={e => setForm(f => ({ ...f, producer: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn-primary" onClick={createProject} disabled={saving || !form.name.trim()}>
                {saving ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Join project */}
      {showJoin && (
        <Modal title="Rejoindre un projet" onClose={() => setShowJoin(false)}>
          <div className="space-y-4">
            <p className="text-sm text-[#8b949e]">Entre le token d'invitation partagé par ton équipe.</p>
            <div>
              <label className="label">Token d'invitation</label>
              <input className="input font-mono" placeholder="ex: a1b2c3d4e5f6..." value={joinToken} onChange={e => setJoinToken(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowJoin(false)}>Annuler</button>
              <button className="btn-primary" onClick={joinProject} disabled={saving || !joinToken.trim()}>
                {saving ? 'Recherche...' : 'Rejoindre'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#e6edf3]">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
