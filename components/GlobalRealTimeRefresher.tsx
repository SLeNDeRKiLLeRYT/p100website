'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/contexts/RealtimeContext';
import { useDebounce } from '@/hooks/useDebounce';

export default function GlobalRealtimeRefresher() {
  const supabase = useSupabase();
  const router = useRouter();

  // Debounce the refresh function to avoid excessive re-renders
  const debouncedRefresh = useDebounce(() => {
    console.log('Realtime change detected, refreshing server data...');
    router.refresh();
  }, 500); // 500ms delay

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          // Subscribe to changes on these three tables
          table: 'killers',
        },
        debouncedRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survivors',
        },
        debouncedRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artists',
        },
        debouncedRefresh
      )
      .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'p100_players',
        },
        debouncedRefresh)
        .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'p100_submissions',
        },
        debouncedRefresh)
            
      .subscribe();

    console.log('GlobalRealtimeRefresher: Subscribed to killers, survivors, artists, p100_players, and p100_submissions tables.');

    // Cleanup subscription on component unmount
    return () => {
      console.log('GlobalRealtimeRefresher: Unsubscribing...');
      supabase.removeChannel(channel);
    };
  }, [supabase, debouncedRefresh]);

  // This component renders nothing to the UI
  return null;
}