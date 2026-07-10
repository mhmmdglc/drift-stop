// DriftStop — Faz 4: RevenueCat webhook → profiles.is_premium
//
// Kritik ilke (bkz. .claude/docs/backend-roadmap.md): entitlement (premium
// içerik erişimi) İSTEMCİDE asla karar verilmez. Bu fonksiyon, RevenueCat'in
// gönderdiği satın alma olaylarını dinleyip Supabase `profiles.is_premium`
// alanını günceller; premium sözlerin RLS ile korunması (`quotes_premium_read_entitled`)
// bu alana bakar.
//
// Deploy (kullanıcı tarafından yapılmalı — CLI hesap girişi/secret yönetimi
// gerektiriyor, bkz. supabase/functions/revenuecat-webhook/README.md):
//   supabase login
//   supabase link --project-ref ftohdffebzhrthrpeuos
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//   supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=<üretilen-gizli-değer>
// Sonra RevenueCat → Project settings → Integrations → Webhooks'ta:
//   URL: https://ftohdffebzhrthrpeuos.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value: <yukarıdaki-gizli-değerle-aynı>

import { createClient } from 'jsr:@supabase/supabase-js@2';

// `pro` = premium içerik paketlerini + senkronu açan abonelik entitlement'ı
// (bkz. src/hooks/usePurchases.tsx). `no_ads` bu alana etki etmez.
const PREMIUM_ENTITLEMENT_ID = 'pro';

// Bu olaylar entitlement'ın AKTİF olduğunu bildirir → is_premium = true.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'TRANSFER',
]);

// Sadece bu olay entitlement'ın gerçekten SONA erdiğini bildirir → is_premium = false.
// CANCELLATION/BILLING_ISSUE'da kullanıcı dönem sonuna kadar erişimi korur;
// EXPIRATION o dönem sonu geldiğinde gelir.
const REVOKE_EVENTS = new Set(['EXPIRATION']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN');
  if (expectedAuth) {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (token !== expectedAuth) return json(401, { error: 'unauthorized' });
  }

  let payload: { event?: RevenueCatEvent };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const event = payload.event;
  if (!event?.type || !event.app_user_id) return json(400, { error: 'missing event/app_user_id' });

  // Test olayları (RevenueCat dashboard'dan "Send test event") gerçek bir
  // profile yazmamalı — sadece bağlantının çalıştığını doğrular.
  if (event.type === 'TEST') return json(200, { ok: true, test: true });

  // Anonim (henüz Supabase'e giriş yapmamış) kullanıcıların profiles satırı
  // yok — app_user_id gerçek bir Supabase UUID değilse sessizce atla.
  if (!UUID_RE.test(event.app_user_id)) {
    return json(200, { ok: true, skipped: 'anonymous app_user_id' });
  }

  const entitlements = event.entitlement_ids ?? [];
  const touchesPremiumEntitlement = entitlements.includes(PREMIUM_ENTITLEMENT_ID);

  let nextIsPremium: boolean | null = null;
  if (GRANT_EVENTS.has(event.type) && touchesPremiumEntitlement) nextIsPremium = true;
  else if (REVOKE_EVENTS.has(event.type) && touchesPremiumEntitlement) nextIsPremium = false;

  if (nextIsPremium === null) {
    // Bu olay `pro` entitlement'ını etkilemiyor (ör. sadece no_ads, ya da
    // CANCELLATION/BILLING_ISSUE — erişim dönem sonuna kadar sürüyor).
    return json(200, { ok: true, skipped: 'not a pro entitlement change' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const update: Record<string, unknown> = { is_premium: nextIsPremium };
  if (nextIsPremium) update.premium_since = new Date().toISOString();

  const { error } = await supabase.from('profiles').update(update).eq('id', event.app_user_id);
  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, userId: event.app_user_id, isPremium: nextIsPremium });
});
