'use client';

import { createContext, useContext, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
// FIX: Import the singleton instance and the Database type
import supabase, { Database } from '@/lib/supabase-client';

const SupabaseContext = createContext<SupabaseClient<Database> | undefined>(
  undefined
);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  // FIX: Do not create a new client. Provide the imported singleton.
  // const supabase = createClient(); 
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