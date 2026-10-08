'use client';
import { useEffect, useState } from 'react';

export function SafeDateRender({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return <span className="opacity-0">{children}</span>;
  return <>{children}</>;
}
