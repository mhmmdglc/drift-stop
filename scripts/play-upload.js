#!/usr/bin/env node
/**
 * AAB'yi Google Play'e doğrudan yükler.
 *
 * Neden `eas submit` değil: ücretsiz kuyrukta saatlerce bekliyor, bu yol dakikalar
 * sürüyor. Play Console'un sürükle-bırak'ı da tarayıcıdan otomatikleştirilemiyor
 * (dosya yükleme aracı 10 MB'ta kesiyor, AAB ~86 MB).
 *
 * Kullanım:
 *   node scripts/play-upload.js <aab-yolu> [track]
 *
 * `track` verilmezse `alpha` (kapalı test). Üretime çıkarken bilerek `production`
 * yazılmalı — varsayılanın üretim olması, yanlışlıkla herkese yayınlamak demektir.
 *
 * Servis hesabı anahtarı `credentials/` altında ve gitignored; yoksa betik durur.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'com.driftstop.app';
const KEY_PATH = path.join(__dirname, '..', 'credentials', 'driftstop-891f4e9df260.json');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

async function playToken() {
  const sa = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', typ: 'JWT' });
  const c = b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  });
  const s = crypto.createSign('RSA-SHA256');
  s.update(`${h}.${c}`);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${h}.${c}.${s.sign(sa.private_key).toString('base64url')}`,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`token alınamadı: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function call(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    // 403'ün iki ayrı sebebi var ve karıştırmak teşhisi saatlerce geciktiriyor:
    // SERVICE_DISABLED = API açılmamış, permission = Play Console'da izin verilmemiş.
    throw new Error(`${res.status} ${url}\n${JSON.stringify(body).slice(0, 600)}`);
  }
  return body;
}

(async () => {
  const aab = process.argv[2];
  const track = process.argv[3] || 'alpha';
  if (!aab || !fs.existsSync(aab)) {
    console.error('kullanım: node scripts/play-upload.js <aab-yolu> [track]');
    process.exit(1);
  }

  const token = await playToken();
  console.log('token alındı');

  const edit = await call(token, `${API}/applications/${PACKAGE}/edits`, { method: 'POST' });
  console.log('edit', edit.id);

  const bytes = fs.readFileSync(aab);
  const bundle = await call(
    token,
    `${UPLOAD_API}/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }
  );
  console.log('yüklendi: versionCode', bundle.versionCode, `(${(bytes.length / 1e6).toFixed(1)} MB)`);

  await call(token, `${API}/applications/${PACKAGE}/edits/${edit.id}/tracks/${track}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      track,
      releases: [{ versionCodes: [String(bundle.versionCode)], status: 'completed' }],
    }),
  });
  console.log('track ayarlandı:', track);

  const done = await call(token, `${API}/applications/${PACKAGE}/edits/${edit.id}:commit`, {
    method: 'POST',
  });
  console.log('commit edildi:', done.id);
  console.log(`\nversionCode ${bundle.versionCode} → ${track}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
