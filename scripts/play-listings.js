#!/usr/bin/env node
/**
 * Play mağaza metinlerini (başlık, kısa/tam açıklama) toplu günceller.
 *
 * Metinler `store-assets/listings/<locale>.json` içinde; kaynak orada, burada değil.
 * Play sınırları: başlık 30, kısa açıklama 80, tam açıklama 4000 karakter.
 * Sınırı aşan bir metin gönderilmez — API'nin hatasını beklemek yerine önce durur.
 *
 * Kullanım:
 *   node scripts/play-listings.js            # hepsi
 *   node scripts/play-listings.js tr-TR en-US
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'com.driftstop.app';
const KEY_PATH = path.join(__dirname, '..', 'credentials', 'driftstop-891f4e9df260.json');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const DIR = path.join(__dirname, '..', 'store-assets', 'listings');
const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };

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

async function main() {
  const wanted = process.argv.slice(2);
  const locales = (wanted.length
    ? wanted
    : fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
  ).sort();

  const payloads = locales.map((loc) => {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, `${loc}.json`), 'utf8'));
    for (const [k, max] of Object.entries(LIMITS)) {
      if (!d[k]) throw new Error(`${loc}: ${k} boş`);
      if (d[k].length > max) throw new Error(`${loc}: ${k} ${d[k].length}/${max} — sınır aşıldı`);
    }
    return { loc, d };
  });

  const token = await playToken();
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const edit = await (
    await fetch(`${API}/applications/${PACKAGE}/edits`, { method: 'POST', headers: auth })
  ).json();
  if (!edit.id) throw new Error(`edit açılamadı: ${JSON.stringify(edit)}`);
  console.log('edit', edit.id);

  for (const { loc, d } of payloads) {
    const res = await fetch(
      `${API}/applications/${PACKAGE}/edits/${edit.id}/listings/${loc}`,
      { method: 'PUT', headers: auth, body: JSON.stringify({ language: loc, ...d }) }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(`${loc}: ${JSON.stringify(j)}`);
    console.log(`  ${loc}  başlık ${d.title.length}  kısa ${d.shortDescription.length}  tam ${d.fullDescription.length}`);
  }

  const commit = await (
    await fetch(`${API}/applications/${PACKAGE}/edits/${edit.id}:commit`, {
      method: 'POST',
      headers: auth,
    })
  ).json();
  if (!commit.id) throw new Error(`commit başarısız: ${JSON.stringify(commit)}`);
  console.log(`\n${payloads.length} dil güncellendi`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
