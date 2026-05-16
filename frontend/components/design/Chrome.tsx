'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Mark } from './Mark';
import { UrlBar } from './primitives';

const LIVE_ROUTES = ['/demo', '/audit', '/pitch'];

export function Chrome() {
  const router = useRouter();
  const path = usePathname() || '/';
  const live = LIVE_ROUTES.some((r) => path.startsWith(r)) || path.startsWith('/agent/');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('inft2-theme') : null;
    if (stored === 'dark') {
      setDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('inft2-theme', next ? 'dark' : 'light'); } catch {}
  }

  return (
    <div className="chrome">
      <div className="chrome-inner">
        <div onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          <Mark />
        </div>
        <UrlBar path={path} live={live} />
        <div className="chrome-right">
          <button className="ghost-btn" onClick={() => router.push('/demo')}>Demo</button>
          <button className="ghost-btn" onClick={() => router.push('/agent/2')}>Agents</button>
          <button className="ghost-btn" onClick={() => router.push('/audit')}>Audit</button>
          <button className="ghost-btn" onClick={() => router.push('/pitch')}>Pitch</button>
          <button className="icon-btn square" onClick={toggleDark} title="Toggle theme">
            {dark ? '☾' : '☀'}
          </button>
        </div>
      </div>
    </div>
  );
}
