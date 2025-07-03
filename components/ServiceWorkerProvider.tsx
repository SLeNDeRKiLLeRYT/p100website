'use client';

import { useServiceWorker } from '@/hooks/useServiceWorker';

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  useServiceWorker();
  return <>{children}</>;
}
