# Mağaza Otomasyonu — Tarayıcısız Yayın Rehberi

Bir mobil ürünü App Store ve Google Play'e tarayıcıya girmeden yönetmek için kurulum ve komut seti.
**Ürüne özel değil** — yeni her projede bu dosya kopyalanıp uygulanabilir.

Buradaki her şey DriftStop üzerinde gerçekten çalıştırıldı ve doğrulandı (2026-07). Doğrulanmamış olanlar
açıkça işaretli.

**Temel ilke:** Kimlik doğrulama, yasal sözleşme ve para/vergi işlemleri otomatikleşmez. Geri kalan her şey olur.

---

# BÖLÜM 0 — Elle yapman gerekenler

Bunlar API ile yapılamaz. Kimlik, hukuk veya para gerektirdikleri için insan eli şart.
**Yeni bir üründe önce bu listeyi bitir**, sonrası otomatik akar.

## Hesap seviyesi — ömürde bir kez

| # | İş | Nerede | Not |
|---|---|---|---|
| 1 | Apple Developer Program üyeliği | developer.apple.com | Yıllık ücret, kimlik doğrulama |
| 2 | Play Console geliştirici hesabı | play.google.com/console | Tek seferlik ücret + kimlik doğrulama |
| 3 | **Paid Apps sözleşmesi** | ASC → Business | IAP satacaksan zorunlu. Ödeme profili + banka + vergi formu (W-8BEN) tamamlanmadan "Active" olmaz |
| 4 | Play ödeme profili + vergi + banka | Play Console → Ayarlar → Ödeme profili | Aynı mantık |
| 5 | **DSA trader beyanı** | ASC → Business → Compliance | AB'de dağıtım için. Adres/telefon/e-posta **herkese açık yayınlanır**. Kimlik belgesi (vergi levhası vb.) yüklenir |
| 6 | Android geliştirici doğrulaması | Play Console | Kimlik belgesi |

> **Kuruluş vs kişisel hesap:** Play'de kişisel hesaplar prodüksiyona çıkmadan önce **12 tester + 14 gün**
> kapalı test şartına tabi. Kuruluş hesapları muaf. Çok ürün yayınlayacaksan bu, otomasyondan daha büyük
> kaldıraç — her üründe 12 kişi bulup 14 gün beklemek tooling ile çözülemez.

## Ürün seviyesi — her yeni uygulamada bir kez

| # | İş | Otomatikleşir mi | Not |
|---|---|---|---|
| 7 | **Play'de uygulama kaydı oluşturma** | ❌ Hayır | Play Developer API'sinde "create app" uç noktası **yok**. Konsoldan elle. |
| 8 | **Play'e ilk AAB yüklemesi** | ⚠️ Muhtemelen hayır | API, paket için ilk sürüm konsoldan yüklenene kadar reddediyor. Kendi hesabında doğrula. |
| 9 | App Store Connect'te uygulama kaydı | ⚠️ Kısmen | Resmî ASC API'de uygulama **oluşturma** yok. `fastlane produce` / `eas submit` bunu spaceship üzerinden yapabiliyor (belgelenmemiş uç noktalar). Elle açmak daha güvenli. |
| 10 | **Play Data safety formu** | ❌ Hayır | Konsol işi. CSV içe aktarma var ama yine konsoldan. |
| 11 | **Play içerik derecelendirme anketi** | ❌ Hayır | Konsol-only |
| 12 | **App Store App Privacy (nutrition labels)** | ❌ Hayır | Konsol-only |
| 13 | Uygulama adı rezervasyonu | ❌ | Apple'da isim globalde benzersiz |

## Süreç boyunca elle kalan

- App Review / Play incelemesinin kendisi
- Politika ihlali itirazları
- Gerçek cihazda satın alma testi (emülatörde Play Billing yok)
- Ekran görüntülerinin **içeriğine** karar vermek (üretimi otomatik, seçimi değil)

---

# BÖLÜM 1 — Kimlik bilgisi kurulumu

Bir kez yapılır, sonrası tamamen otomatik. Yaklaşık 30 dakika.

## 1.1 Apple — App Store Connect API anahtarı

**ASC → Users and Access → Integrations → App Store Connect API → Team Keys → +**
Rol: **App Manager**. `.p8` dosyası **tek sefer** iner.

Toplanacaklar:
- `.p8` dosyası → `~/.<proje>-secrets/AuthKey_XXXXXXXX.p8` (klasör `chmod 700`)
- **Key ID** (10 karakter)
- **Issuer ID** (UUID, sayfanın üstünde)
- **Team ID** → developer.apple.com → Membership details

> İlk kez giriyorsan sayfa "Request Access" gösterir — Account Holder'ın tıklaması gerekir.

## 1.2 Apple — In-App Purchase anahtarı (RevenueCat için)

**ASC → Users and Access → Integrations → In-App Purchase → +**

⚠️ Bu, 1.1'deki anahtardan **farklı bir tür**. En sık karıştırılan yer.
Apple tek başına dört ayrı kimlik veriyor: gönderim anahtarı, makbuz anahtarı, dağıtım sertifikası, provisioning profile.

## 1.3 Google — Play Developer API servis hesabı

⚠️ **Play Console'daki "API erişimi" sayfası kaldırıldı.** Eski dokümanların hepsi yanlış. Yeni akış:

1. **Google Cloud'da proje seç/oluştur** → console.cloud.google.com
2. **API'yi etkinleştir:** `console.cloud.google.com/apis/library/androidpublisher.googleapis.com?project=<PROJE>`
3. **Servis hesabı oluştur:** IAM & Admin → Service Accounts → Create. **Cloud tarafında rol verme, gerek yok.**
4. **JSON anahtarı indir:** hesaba tıkla → Keys → Add key → JSON
5. **Play Console → Kullanıcılar ve izinler → Yeni kullanıcılar davet et** → servis hesabının e-postasını yapıştır
6. **Uygulama izinleri** sekmesinden hedef uygulamayı seç ve şu üçünü işaretle:
   - Üretim sürümüne yayınlama
   - Uygulamaları test kanallarına yayınlama
   - **Mağazadaki varlığı yönetme** ← ürün/fiyat okuma-yazma için şart
7. Davet et

> **6. adımı atlarsan** anahtar OAuth token alır ama her çağrı `403 The caller does not have permission` döner.
> **2. adımı atlarsan** `403 SERVICE_DISABLED` döner. İki hatayı ayırt et, teşhis hızlanır.
>
> Geliştirici hesabını Cloud projesine "bağlamaya" **artık gerek yok** — o adım kaldırıldı.

## 1.4 RevenueCat

- Public SDK key (`appl_...` / `goog_...`) → uygulamaya gömülür, gizli değil
- Secret API key → sunucu tarafı sorgular için
- iOS: 1.2'deki In-App Purchase anahtarını RevenueCat'e yükle
- Android: 1.3'teki servis hesabı JSON'unu (veya finansal veri yetkili ayrı bir tanesini) yükle
- Webhook URL'ini kendi sunucuna ver, paylaşılan sırla doğrula

## 1.5 Expo / EAS

- `EXPO_TOKEN` → expo.dev → Access Tokens (CI için; yerelde login yeterli)
- ⚠️ **`.env` dosyası EAS'in bulut derleyicilerine ulaşmaz.** Her `EXPO_PUBLIC_*` değişkeni ayrıca:
  ```bash
  eas env:create --name EXPO_PUBLIC_X --value "..." --environment production --visibility plaintext
  eas env:list --environment production   # doğrula
  ```
  Bu atlanırsa uygulama **çökmez** — özellikler sessizce hiçbir şey yapmaz. En pahalı hata türü.

## 1.6 Dosya düzeni

```
~/.<proje>-secrets/          chmod 700
  AuthKey_XXXXXXXX.p8        ASC API anahtarı
  AuthKey_YYYYYYYY.p8        In-App Purchase anahtarı
  play-service-account.json  Play servis hesabı
```

`.gitignore`'a: `*.p8`, `*.json` (credential klasörü), `.env`

---

# BÖLÜM 2 — Otomatikleşen her şey

## 2.1 App Store Connect API — kimlik doğrulama

ES256 JWT. Harici bağımlılık gerekmez, Node crypto yeterli.

```js
const crypto = require('crypto'), fs = require('fs');
const KEY_ID = '...', ISSUER_ID = '...', KEY_PATH = '...';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function derToJose(der) {                    // ASN.1 DER -> JOSE (r||s)
  let off = 2;
  if (der[1] & 0x80) off += der[1] & 0x7f;
  const read = () => {
    off++; const len = der[off++];
    let v = der.subarray(off, off + len); off += len;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    return Buffer.concat([Buffer.alloc(32 - v.length), v]);
  };
  return Buffer.concat([read(), read()]).toString('base64url');
}

function ascToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const p = b64({ iss: ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
  const s = crypto.createSign('SHA256'); s.update(`${h}.${p}`);
  return `${h}.${p}.${derToJose(s.sign(fs.readFileSync(KEY_PATH)))}`;
}
```

Kullanım: `Authorization: Bearer <token>` ile `https://api.appstoreconnect.apple.com/v1/...`

**Ne yapabilirsin:** uygulamaları listele, bundle ID kaydet, sürüm/metadata oku-yaz, ekran görüntüsü yükle,
yaş derecelendirmesi ayarla, TestFlight grupları yönet, incelemeye gönder.

## 2.2 Google Play Developer API — kimlik doğrulama

RS256 JWT → OAuth token değişimi.

```js
const crypto = require('crypto'), fs = require('fs');
async function playToken(keyPath) {
  const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', typ: 'JWT' });
  const c = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
                  aud: sa.token_uri, iat: now, exp: now + 3600 });
  const s = crypto.createSign('RSA-SHA256'); s.update(`${h}.${c}`);
  const r = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${h}.${c}.${s.sign(sa.private_key).toString('base64url')}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(JSON.stringify(j));
  return j.access_token;
}
```

## 2.3 Abonelik fiyatlarını okuma ve yazma

Bu, konsolda en çok hata yapılan yer — ve API ile en güvenli yapılan iş.
DriftStop'ta canlıda `pro_monthly` **299,99 $/ay** çıktı; ondalık kaymıştı, kimse fark etmemişti.
**Yeni bir ürün yayınlamadan önce fiyatları mutlaka API'den okuyup doğrula.**

**Okuma:**
```
GET /androidpublisher/v3/applications/{pkg}/subscriptions
```
Her `basePlans[].regionalConfigs[]` içinde `regionCode` + `price {currencyCode, units, nanos}`.
Gerçek fiyat = `units + nanos / 1e9`.

**Yazma — üç adım:**

```js
// 1) Hedef USD fiyatını Google'ın kuruyla 170+ bölgeye çevirt
POST /androidpublisher/v3/applications/{pkg}/pricing:convertRegionPrices
{ "price": { "currencyCode": "USD", "units": "3", "nanos": 990000000 } }
// -> { convertedRegionPrices: {...}, convertedOtherRegionsPrice: {...}, regionVersion: {version:"2025/03"} }

// 2) Mevcut aboneliği oku, her bölgenin SADECE price alanını değiştir,
//    newSubscriberAvailability gibi diğer alanları olduğu gibi koru

// 3) PATCH
PATCH /androidpublisher/v3/applications/{pkg}/subscriptions/{productId}
      ?updateMask=basePlans&regionsVersion.version=2025/03
```

⚠️ **Tek seferlik ürünler için `/inappproducts` uç noktası kapatıldı** —
`403 "Please migrate to the new publishing API"` döner. Yeni monetization uç noktalarını kullan.

## 2.4 Build ve gönderim

```bash
# iOS imzalama kimlikleri (EAS bulutunda)
export EXPO_ASC_API_KEY_PATH=~/.proje-secrets/AuthKey_XXXX.p8
export EXPO_ASC_KEY_ID=XXXX EXPO_ASC_ISSUER_ID=... EXPO_APPLE_TEAM_ID=...

eas build --platform ios --profile production --non-interactive --no-wait
eas submit --platform ios --profile production --non-interactive
eas submit --platform android --profile production --non-interactive
```

`eas.json` içinde Android servis hesabını göster:
```json
{ "submit": { "production": { "android": { "serviceAccountKeyPath": "./credentials/play-service-account.json" } } } }
```

⚠️ **İlk iOS build'i non-interactive çalışmaz:**
`Distribution Certificate is not validated for non-interactive builds` hatası verir. Üç seçenek:
1. Bir kez etkileşimli çalıştır (`eas build -p ios` ve sorulara cevap ver)
2. Sertifika + provisioning profile'ı ASC API ile kendin üret, `credentialsSource: "local"` kullan
3. `credentials.json`'a hazır kimlikleri koy

Ayrıca `eas.json`'da `credentialsSource` **platform bazlı** verilebilir — profil seviyesinde `"local"` yazarsan
Android keystore'un varken iOS build'i anında düşer:
```json
"production": {
  "android": { "buildType": "app-bundle", "credentialsSource": "local" },
  "ios": { "credentialsSource": "remote" }
}
```

## 2.5 Mağaza metinleri ve görselleri

`eas submit` **metadata sürmez**, sadece binary yükler. Metin/görsel için:

- **iOS:** ASC API ile doğrudan, ya da `fastlane deliver`
- **Android:** `fastlane supply` (Play API'sinin metadata tarafını sarmalar)
- EAS Metadata var ama iOS-only ve önizleme aşamasında

`supply` her sürüm için şunu bekler: `metadata/android/<locale>/changelogs/<versionCode>.txt`
Yoksa ya hata verir ya mevcut notu siler. Sürüm notlarını da otomatik üret.

## 2.6 Ekran görüntüleri

Simülatör/emülatörde **Release** konfigürasyonuyla üret — dev build'de üstte kırmızı uyarı bandı ve
alt köşede geliştirici toast'ları çıkar, mağaza reddeder.

```bash
xcrun simctl boot "iPhone 17 Pro Max"        # 6.9" — App Store'un zorunlu boyutu
xcrun simctl io <UDID> screenshot out.png
```

Dili değiştirip her lokal için ayrı set üretebilirsin. Yükleme ASC API / `deliver` ile otomatik.

## 2.7 RevenueCat

Secret API key ile REST üzerinden: offering/paket yapılandırması okunur, abone durumu sorgulanır,
yetki verilir/alınır. Webhook'u kendi sunucuna bağlayıp abonelik olaylarını kendi veritabanına yaz.

---

# BÖLÜM 3 — Tuzaklar

Hepsi bu projede gerçekten yaşandı. Zaman kaybının çoğu bunlardan geldi.

| Belirti | Sebep | Çözüm |
|---|---|---|
| Özellikler sessizce çalışmıyor, çökme yok | `.env` EAS bulutuna ulaşmıyor | `eas env:create` + `eas env:list` ile doğrula |
| `Unicode Normalization not appropriate for ASCII-8BIT` | CocoaPods UTF-8 locale istiyor, kabuk `LC_CTYPE=C` | `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` |
| Yeni plugin ayarları native projeye işlenmiyor | `expo run:ios`, `ios/` klasörü varsa prebuild'i tekrar çalıştırmıyor | `npx expo prebuild -p ios --clean` |
| `expo config --type introspect` temiz ama uygulama çöküyor | Introspect **çözülmüş config'i** gösterir, **üretilmiş projeyi** değil | Üretilen `Info.plist` / manifest'i doğrudan oku |
| `403 SERVICE_DISABLED` | Cloud projesinde androidpublisher API kapalı | Bölüm 1.3 adım 2 |
| `403 The caller does not have permission` | Servis hesabı Play Console'a davet edilmemiş | Bölüm 1.3 adım 5-6 |
| `403 Please migrate to the new publishing API` | `/inappproducts` kapatıldı | Yeni monetization uç noktaları |
| iOS build ilk saniyede düşüyor | `credentialsSource: "local"` profil seviyesinde, iOS kimliği yok | Platform bazlı ayır |
| Non-interactive build credential hatası | İlk dağıtım sertifikası etkileşimli mod istiyor | Bölüm 2.4'teki üç seçenek |
| Konsolda tıklamalar kaydolmuyor | Menü açılma animasyonu sırasında tıklanıyor | Beklemeden tıklama; mümkünse API kullan |
| Gradle: `Unable to locate a Java Runtime` | Ajan/CI kabuğunda `JAVA_HOME` yok — macOS'ta sistem Java'sı gelmiyor | `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` |
| Gradle: `SDK location not found` | Aynı kabukta `ANDROID_HOME` da yok | `export ANDROID_HOME="$HOME/Library/Android/sdk"` |
| `expo run:android --device emulator-5554` → `Could not find device` | Expo, adb seri numarasını değil AVD adını bekliyor | `--device` bayrağını hiç verme; tek cihaz varsa kendisi bulur |

---

# BÖLÜM 4 — Yeni ürün sırası

```
[ELLE]  Hesap seviyesi kurulum (bir ömür, Bölüm 0 · 1-6)
   │
[ELLE]  Play'de uygulama kaydı  +  ASC'de uygulama kaydı
   │
[ELLE]  Data safety · içerik derecelendirme · App Privacy formları
   │
[OTO]   Kimlik bilgileri (Bölüm 1) → bir kez, 30 dakika
   │
[OTO]   IAP ürünleri + fiyatlar          → API ile kur, API ile DOĞRULA
   │
[OTO]   Build (eas build)
   │
[ELLE]  İlk AAB yüklemesi (yalnızca ilk sürüm)
   │
[OTO]   Sonraki tüm sürümler: build → submit → metadata → sürüm notları
   │
[ELLE]  İnceleme bekleme · gerçek cihazda satın alma testi
```

**Kaba oran:** ilk kurulumda işin %60'ı elle, sonraki her sürümde **%95'i otomatik.**

Asıl kazanç tek üründe değil — bu kurulum bir kez yapıldığında her yeni sürüm tek komuta iniyor.

---

## Bu belge nasıl güncellenir

Google ve Apple konsol akışlarını sık değiştiriyor (bu dosyanın yazıldığı hafta Play'in "API erişimi" sayfası
kaldırılmıştı). Bir adım tutmazsa **önce hata mesajını Bölüm 3'te ara**, sonra güncel dokümana bak,
bulduğunu buraya işle.
