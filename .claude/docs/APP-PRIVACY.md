# App Privacy — App Store Connect anketi için hazır cevaplar

App Store Connect → DriftStop → **App Privacy** ekranını doldururken bunu yanına al.
Cevaplar koddan çıkarıldı, tahmin yok; her satırın gerekçesi ve kaynağı yazılı.

Bu bir **hukuki beyan** — son onay sende. Yanlış beyan, uygulamanın mağazadan
kaldırılma sebebi olabiliyor, o yüzden "emin değilim" dediğin bir satır varsa
bana sor, kodda birlikte bakalım.

---

## Özet: ne topluyoruz

| Veri | Toplanıyor mu | Nereye |
|---|---|---|
| E-posta adresi | **Evet**, yalnızca hesap açan kullanıcıdan | Supabase (`auth.users`) |
| Kullanıcı kimliği | **Evet** | Supabase `profiles`, RevenueCat `app_user_id` |
| Satın alma geçmişi | **Evet** | RevenueCat |
| Reklam kimliği (IDFA) | **Evet**, ATT izni verilirse | Google AdMob |
| Kaba konum | **Evet** (IP'den, reklam tarafında) | Google AdMob |
| Cihaz kimliği / kullanım verisi | **Evet** | Google AdMob, Sentry |
| Çökme verisi | **Evet** | Sentry |
| Favoriler, geçmiş, ayarlar | **Hayır** — cihazda kalıyor | AsyncStorage / SQLite |
| İsim, telefon, adres, kişiler, fotoğraf, sağlık, finans | **Hayır** | — |

Favorilerin ve ayarların cihazda kalması önemli bir nokta: `useFavorites`,
`useSettings` ve `useHistory` yalnızca AsyncStorage'a yazıyor, sunucuya gitmiyor.
Sunucuya giden tek kullanıcı içeriği hesap e-postası.

---

## Anket cevapları, kategori kategori

### Contact Info → Email Address
- **Toplanıyor:** Evet
- **Kullanım:** App Functionality
- **Kimliğe bağlı mı:** Evet
- **İzleme için mi:** Hayır
- *Neden:* hesap oluşturma opsiyonel (`useAuth`, Supabase e-posta + şifre). Misafir
  kullanıcıdan hiçbir iletişim bilgisi alınmıyor.

### Identifiers → User ID
- **Toplanıyor:** Evet
- **Kullanım:** App Functionality
- **Kimliğe bağlı mı:** Evet
- **İzleme için mi:** Hayır
- *Neden:* Supabase kullanıcı id'si `profiles` satırına ve RevenueCat'in
  `app_user_id`'sine bağlanıyor (`usePurchases` → `Purchases.logIn`). Pro hakkının
  hesabı takip etmesi bunu gerektiriyor.

### Identifiers → Device ID
- **Toplanıyor:** Evet
- **Kullanım:** Third-Party Advertising, Analytics
- **Kimliğe bağlı mı:** Hayır
- **İzleme için mi:** **Evet**
- *Neden:* AdMob reklam kimliği kullanıyor. ATT izni verilmezse kişiselleştirilmemiş
  reklam isteniyor (`requestNonPersonalizedAdsOnly`), ama beyan yine "izleme" tarafında
  olmalı çünkü izin verildiğinde kimlik kullanılıyor.

### Purchases → Purchase History
- **Toplanıyor:** Evet
- **Kullanım:** App Functionality
- **Kimliğe bağlı mı:** Evet
- **İzleme için mi:** Hayır
- *Neden:* abonelik durumu RevenueCat'te tutuluyor ve `revenuecat-webhook` üzerinden
  `profiles.is_premium`'a yazılıyor. Premium içerik erişimi buna bağlı.

### Location → Coarse Location
- **Toplanıyor:** Evet
- **Kullanım:** Third-Party Advertising
- **Kimliğe bağlı mı:** Hayır
- **İzleme için mi:** **Evet**
- *Neden:* uygulama konum izni İSTEMİYOR. Ama AdMob IP'den kaba konum türetiyor ve
  Apple bunu beyan edilmesi gereken bir toplama sayıyor.

### Usage Data → Advertising Data, Product Interaction
- **Toplanıyor:** Evet
- **Kullanım:** Third-Party Advertising, Analytics
- **Kimliğe bağlı mı:** Hayır
- **İzleme için mi:** **Evet**
- *Neden:* reklam gösterimleri ve etkileşimleri AdMob tarafında ölçülüyor.

### Diagnostics → Crash Data, Performance Data
- **Toplanıyor:** Evet
- **Kullanım:** App Functionality (Analytics değil)
- **Kimliğe bağlı mı:** Hayır
- **İzleme için mi:** Hayır
- *Neden:* Sentry (`utils/crashReporting.ts`). Yalnızca hata teşhisi için.

### Beyan EDİLMEYECEKLER
İsim, telefon, fiziksel adres, diğer iletişim bilgileri, sağlık, fitness, finansal
bilgi, hassas bilgi, kişiler, kullanıcı içeriği (fotoğraf/video/ses), arama geçmişi,
tarama geçmişi. Hiçbiri toplanmıyor.

Favoriler ve ayarlar da beyan edilmez — cihazdan hiç çıkmıyorlar. Apple yalnızca
cihazdan **ayrılan** veriyi "toplama" sayıyor.

---

## Bağlantılı iki ekran

**Tracking (ATT):** "Does this app use data for tracking purposes?" → **Yes**.
İzin metni altı dile çevrildi (`assets/locales/*.json`, `ios` anahtarı altında) ve
istem SDK başlatılmadan önce gösteriliyor.

**Export Compliance:** uygulama yalnızca standart HTTPS kullanıyor, özel şifreleme
algoritması içermiyor → "Does your app use encryption?" sorusuna Apple'ın muafiyet
şıkkı seçilir (standart şifreleme, ihracat belgesi gerekmez).

---

## Gizlilik politikası

`https://mgulcu.me/driftstop/privacy` — ASC'ye API'den girildi. Metin misafir modu,
opsiyonel hesap, sunucuda tutulanlar ve uygulama içi hesap silme akışını kapsıyor.
Reklam tarafı da kapsanıyor: canlı sayfada AdMob ve reklam/`advertising` ifadeleri
hem İngilizce hem Türkçe bölümlerde geçiyor (2026-08-03'te `curl` ile doğrulandı),
yani beyanla politika tutarlı.
