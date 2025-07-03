'use client';

import { createContext, useContext, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/lib/supabase-client';

const SupabaseContext = createContext<SupabaseClient<Database> | undefined>(
  undefined
);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a RealtimeProvider');
  }
  return context;
};