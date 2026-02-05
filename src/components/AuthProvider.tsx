"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useVotesStore } from "@/lib/votes";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isOfflineMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isOfflineMode: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Start as not loading if Supabase isn't configured (offline mode)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const { setUserId, loadUserVotes, clearUserVotes } = useVotesStore();

  // If Supabase is not configured, run in offline/demo mode
  const isOfflineMode = !isSupabaseConfigured;

  useEffect(() => {
    // If Supabase is not configured, nothing to do
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setUserId(session.user.id);
        loadUserVotes(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === "SIGNED_IN" && session?.user) {
          setUserId(session.user.id);
          loadUserVotes(session.user.id);
        } else if (event === "SIGNED_OUT") {
          setUserId(null);
          clearUserVotes();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUserId, loadUserVotes, clearUserVotes]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isOfflineMode }}>
      {children}
    </AuthContext.Provider>
  );
}
