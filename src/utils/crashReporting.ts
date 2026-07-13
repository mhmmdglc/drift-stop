import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * `EXPO_PUBLIC_SENTRY_DSN` `.env`'de yoksa init hiç çağrılmaz — Supabase/RevenueCat'teki
 * "yoksa sessizce devre dışı kal" kalıbıyla aynı. DSN eklenene kadar crash raporlama
 * pasif kalır, ama uygulama normal çalışır.
 */
export function initCrashReporting(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enabled: !__DEV__,
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
