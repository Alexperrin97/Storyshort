'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/lib/types';

const NAV = [
  { label: 'Préparation', path: 'prep', icon: <PencilIcon /> },
  { label: 'Tournage', path: 'shoot', icon: <CameraIcon /> },
  { label: 'Post-prod', path: 'postprod', icon: <EditIcon /> },
  { label: 'Budget', path: 'budget', icon: <EuroIcon /> },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setProject(data);
    });
  }, [params.id]);

  function copyToken() {
    if (!project) return;
    navigator.clipboard.writeText(project.share_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1117' }}>
      {/* Top bar */}
      <header className="border-b border-[#30363d] px-4 py-3 flex items-center gap-4 no-print">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
            </svg>
          </div>
        </Link>
        <span className="text-[#8b949e]">/</span>
        <span className="font-medium text-[#e6edf3] truncate">{project?.name || '...'}</span>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary text-xs py-1.5" onClick={() => setShowShare(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Partager
          </button>
        </div>
      </header>

      {/* Phase navigation */}
      <nav className="border-b border-[#30363d] px-4 flex gap-1 no-print">
        {NAV.map(item => {
          const active = pathname.includes(`/${item.path}`);
          return (
            <Link
              key={item.path}
              href={`/project/${params.id}/${item.path}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-red-500 text-[#e6edf3]'
                  : 'border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:border-[#30363d]'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Share modal */}
      {showShare && project && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowShare(false)}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#e6edf3]">Partager le projet</h2>
              <button className="btn-ghost p-1" onClick={() => setShowShare(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-sm text-[#8b949e] mb-4">Partage ce token avec ton équipe. N'importe qui avec ce code peut accéder au projet.</p>
            <div className="flex gap-2">
              <input className="input font-mono text-xs flex-1" value={project.share_token} readOnly />
              <button className="btn-primary flex-shrink-0" onClick={copyToken}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function CameraIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
}
function EditIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 13 13"/><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>;
}
function EuroIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8a6 6 0 1 0 0 8M7 9h6M7 15h6"/></svg>;
}
