import { useEffect, useState } from 'react';
import { useSupabase } from './useSupabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const useAuth = () => {
  const { supabaseClient } = useSupabase();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  return { user, loading };
};

export type User = SupabaseUser | null;