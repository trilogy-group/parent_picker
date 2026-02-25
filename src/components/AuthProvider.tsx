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
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isOfflineMode: false,
  isAdmin: false,
});

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
  const { setUserId, loadUserVotes, clearUserVotes, setUserLocation } = useVotesStore();

  // If Supabase is not configured, run in offline/demo mode
  const isOfflineMode = !isSupabaseConfigured;

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const loadProfile = async (token: string) => {
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        if (profile.home_lat && profile.home_lng) {
          setUserLocation({ lat: profile.home_lat, lng: profile.home_lng });
        }
      }
    } catch {}
  };

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
        if (session.access_token) loadProfile(session.access_token);
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
          if (session.access_token) loadProfile(session.access_token);
        } else if (event === "SIGNED_OUT") {
          setUserId(null);
          clearUserVotes();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUserId, loadUserVotes, clearUserVotes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isOfflineMode, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
