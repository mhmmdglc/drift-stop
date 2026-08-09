import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isSocialError, signInWithApple, signInWithGoogle } from '@/lib/socialAuth';
import { supabase } from '@/lib/supabase';
import { purgePremiumCacheForSignOut } from '@/services/premiumCacheGuard';

type AuthResult = { error: string | null };

/**
 * Sosyal girişin sonucu üç durumlu: başarı / vazgeçme / hata.
 *
 * `cancelled` olmadan vazgeçmek ile başarı çağıran taraf için AYNI görünüyordu
 * (ikisi de `error: null`), o yüzden `/auth` iptalde de kapanıyor ve kullanıcı
 * hiçbir açıklama olmadan misafir olarak Ayarlar'a düşüyordu. Satın almadaki
 * `PurchaseResult` ile aynı biçim (`usePurchases.tsx`).
 */
type SocialAuthResult = AuthResult & { cancelled?: boolean };

type AuthContextValue = {
  /** Supabase yapılandırılmamışsa (anon key eksik) her zaman false — ekranlar guest gibi davranır. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  /** İlk oturum kontrolü bitti mi. Guest akışını bloklamak için kullanılmamalı. */
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  /**
   * Onay e-postasını yeniden gönderir. Kayıt olan ama maili hiç almayan kullanıcı
   * için tek çıkış yolu buydu — yoksa hesap var, giriş yapılamıyor ve ekranda
   * yapılabilecek hiçbir şey kalmıyordu.
   */
  resendConfirmation: (email: string) => Promise<AuthResult>;
  /**
   * Şifre sıfırlama e-postası gönderir. Bu ekran hiç yoktu: şifresini unutan
   * kullanıcının hesabına dönmesinin HİÇBİR yolu yoktu — Pro erişimi de,
   * premium paketleri de hesaba bağlı olduğu için bu doğrudan gelir kaybı.
   */
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  /**
   * Google / Apple ile giriş. Tek adımda hem kayıt hem giriş: e-posta doğrulama
   * beklemek yok, şifre yok. Kullanıcı vazgeçerse `{ error: null, cancelled: true }`
   * döner — vazgeçmek hata değil (kırmızı yazı çıkmamalı) ama başarı da değil
   * (ekran kapanmamalı).
   */
  signInWithProvider: (provider: 'google' | 'apple') => Promise<SocialAuthResult>;
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
      sendPasswordReset: async (email) => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        // `redirectTo` uygulamanın kendi şemasına dönüyor; Supabase'in varsayılan
        // site URL'i bir web sayfası ve mobilde kullanıcıyı hiçbir yere götürmez.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: 'driftstop://auth',
        });
        return { error: error ? mapAuthError(error.message) : null };
      },
      signInWithProvider: async (provider) => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };

        const result =
          provider === 'google' ? await signInWithGoogle() : await signInWithApple();

        if (isSocialError(result)) {
          if (result.cancelled) return { error: null, cancelled: true };
          if (result.reason === 'unavailable') return { error: 'auth.errors.providerUnavailable' };
          // Play Services eksik/eskiyse kullanıcının yapabileceği bir şey var:
          // genel "bir şeyler ters gitti" satırı bunu gizliyordu.
          if (result.reason === 'playServices') return { error: 'auth.errors.playServices' };
          return { error: 'auth.errors.generic' };
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: result.provider,
          token: result.idToken,
        });
        if (error) return { error: mapAuthError(error.message) };

        // Apple adı YALNIZCA ilk yetkilendirmede veriyor. Kaçırırsak bir daha hiç
        // gelmiyor, o yüzden hemen profile yazıyoruz — ama YALNIZCA dolu bir ad
        // geldiyse ve kayıtlıdan farklıysa: ikinci girişte Apple ad göndermiyor,
        // o anda yazmak daha önce saklanan adı silerdi.
        const storedName =
          typeof data.user?.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name.trim()
            : '';
        if (result.fullName && result.fullName !== storedName) {
          await supabase.auth.updateUser({ data: { full_name: result.fullName } });
        }
        return { error: null };
      },
      resendConfirmation: async (email) => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
        return { error: error ? mapAuthError(error.message) : null };
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        // Premium erişim hesaba bağlı (webhook `profiles.is_premium`'u kullanıcı
        // id'sine yazar): oturum kapanınca indirilmiş premium sözler de gitmeli.
        // RevenueCat'in logOut dinleyicisini beklemeyiz — o başarısız olabilir.
        purgePremiumCacheForSignOut();
      },
      deleteAccount: async () => {
        if (!supabase) return { error: 'auth.errors.notConfigured' };
        const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
        if (error) return { error: 'auth.errors.generic' };
        await supabase.auth.signOut();
        // Onay metni "premium paket erişimin sona erecek" diyor; yerel kopya
        // silinmezse bu söz yalan olur.
        purgePremiumCacheForSignOut();
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
