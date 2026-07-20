import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthResult = { error: string | null };

type AuthContextValue = {
  /** Supabase yapılandırılmamışsa (anon key eksik) her zaman false — ekranlar guest gibi davranır. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  /** İlk oturum kontrolü bitti mi. Guest akışını bloklamak için kullanılmamalı. */
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(message: string): string {
  if (/already registered/i.test(message)) return 'auth.errors.emailInUse';
  if (/email not confirmed/i.test(message)) return 'auth.errors.emailNotConfirmed';
  if (/invalid login credentials/i.test(message)) return 'auth.errors.invalidCredentials';
  if (/password.*(at least|6 characters)/i.test(message)) return 'auth.errors.weakPassword';
  if (/rate limit/i.test(message)) return 'auth.errors.rateLimited';
  if (/network/i.test(message)) return 'auth.errors.network';
  return 'auth.errors.generic';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: supabase != null,
      session,
      user: session?.user ?? null,
      loading,
      signUpWithEmail: async (email, password) => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        return { error: error ? mapAuthError(error.message) : null };
      },
      signInWithEmail: async (email, password) => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return { error: error ? mapAuthError(error.message) : null };
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      deleteAccount: async () => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
        if (error) return { error: 'auth.errors.generic' };
        await supabase.auth.signOut();
        return { error: null };
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return ctx;
}
