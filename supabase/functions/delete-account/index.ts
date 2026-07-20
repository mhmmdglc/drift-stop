// DriftStop — hesap silme (Play Store zorunlu kılıyor: hesap oluşturma
// destekleniyorsa uygulama içi hesap silme de sunulmalı).
//
// Bu fonksiyon, çağıranın kendi Supabase auth kullanıcısını (JWT'den) siler.
// `profiles`/`favorites`/`reflections`/`user_settings` hepsi
// `references auth.users(id) on delete cascade` ile tanımlı (bkz.
// supabase/migrations/0001_init_schema.sql) — auth.users satırı silinince
// hepsi otomatik temizlenir, ayrı ayrı silmeye gerek yok.
//
// Deploy (kullanıcı tarafından yapılmalı, bkz. README.md — revenuecat-webhook
// ile aynı `supabase login`/`link` oturumunu paylaşır):
//   supabase functions deploy delete-account

import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'missing authorization' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Çağıranın kimliğini kendi JWT'siyle doğrula — böylece herhangi bir
  // kullanıcı sadece kendi hesabını silebilir, başkasının user id'sini
  // gönderip silemez.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'invalid session' });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return json(500, { error: deleteError.message });

  return json(200, { ok: true });
});
