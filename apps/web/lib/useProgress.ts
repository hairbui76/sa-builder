'use client';
import { useEffect, useState } from 'react';
import { loadProgress, type Progress } from './progress';

/** Progress from localStorage; empty during SSR and the first client render. */
export function useProgress(): Progress {
  const [p, setP] = useState<Progress>({});
  useEffect(() => {
    const read = () => setP(loadProgress());
    read();
    window.addEventListener('sab-progress', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('sab-progress', read);
      window.removeEventListener('storage', read);
    };
  }, []);
  return p;
}
