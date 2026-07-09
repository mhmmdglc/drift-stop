# Google Play Store'a Uygulama Yayınlama Rehberi

> DriftStop'u yayınlarken çıkardığımız **yeniden kullanılabilir playbook.**
> Sonraki app'lerde bu sırayı takip et. Play Console arayüzü Türkçe varsayılmıştır; buton adları birebir yazılıdır.

---

## 0) Büyük resim — akış

```
İmzalı AAB hazırla
   ↓
Play Console'da uygulama oluştur
   ↓
Dahili test sürümü yükle (app hemen testçilerde canlı)
   ↓
App content beyanları (9-10 form)
   ↓
Store listing (açıklama + 6 görsel)
   ↓
Mağaza ayarları (kategori + iletişim)   ← kontrol panelini 11/11 yapar
   ↓
[KİŞİSEL HESAP İSE] Kapalı test + 12 testçi × 14 gün
   ↓
"Üretime başvur" → Google inceler
   ↓
Üretim sürümü → incelemeye gönder → CANLI
```

**En kritik ayrım — hesap tipi:**
| Hesap tipi | Üretime çıkış |
|---|---|
| **Kişisel** (bizimki) | ⚠️ Önce **12 testçi × 14 gün kapalı test** ZORUNLU (Kasım 2023 kuralı) |
| **Kuruluş** (şirket) | ✅ Doğrudan üretim — 12 testçi şartı YOK. Ama **D-U-N-S numarası** gerekir. |

Yeni app'te 12 testçi derdi istemiyorsan **kuruluş hesabı** aç. Kişisel → kuruluş dönüşümüne Google genelde izin vermez, yeni hesap gerekir.

---

## 1) Ön koşullar (başlamadan hazırla)

- [ ] **Google Play Console geliştirici hesabı** (25$ tek seferlik)
- [ ] **İmzalı release AAB** (keystore ile imzalı). Expo/EAS ile:
  - `eas build -p android --profile production` (bulut, keystore'u EAS yönetir — **önerilen**), veya
  - Yerel: `cd android && ./gradlew bundleRelease` (keystore'u sen yönetirsin)
  - ⚠️ **Keystore'u ASLA kaybetme** — upload key budur. Kaybedersen uygulamayı güncelleyemezsin. Yedekle. (bizde: `credentials/`)
- [ ] **Paket adı** kesinleşmiş olsun — sonradan **DEĞİŞMEZ** (bizde `com.driftstop.app`)
- [ ] **AdMob** (reklam varsa): AdMob'da app + reklam birimleri oluştur, **gerçek ID'leri** koda koy. Dev'de `TestIds`, prod'da gerçek ID.
- [ ] **Gizlilik politikası** — bir URL'de yayında olmalı (bizde kendi sitemizde: `https://mgulcu.me/driftstop/privacy`)
- [ ] **Görseller** (aşağıda detay): ikon 512×512, feature 1024×500, en az 2 telefon ekran görüntüsü
- [ ] **Metinler**: kısa açıklama (≤80 karakter) + tam açıklama

---

## 2) Uygulama oluştur

Play Console → **Uygulama oluştur** → ad, varsayılan dil, "Uygulama mı Oyun mu", "Ücretsiz mi Ücretli mi", beyan kutuları.

---

## 3) Dahili test sürümü (AAB yükle)

**Test edin ve yayınlayın → Dahili test → Yeni sürüm oluştur**
1. AAB'yi kutuya **sürükle-bırak** (veya yükle)
2. Sürüm adı + sürüm notu (`<en-US> ... </en-US>` formatı)
3. **İleri** → **Kaydet ve yayınla** → onay diyaloğunda tekrar **Kaydet ve yayınla**

→ Uygulama artık dahili testte **canlı**; testçiler indirebilir. (14 gün beklerken ürün ölü değil.)

> 💡 AAB'yi başka bir track'e (kapalı/üretim) koyarken **tekrar yükleme** — o track'te "**Kitaplıktan ekle**" ile mevcut paketi seç.

---

## 4) App content beyanları (zorunlu)

**Politika ve programlar → Uygulama içeriği.** Her biri "Beyanı başlat". DriftStop cevaplarımız (motivasyon sözü app'i, giriş yok, AdMob reklamı var):

| Beyan | Cevap |
|---|---|
| **Gizlilik politikası** | URL yapıştır |
| **Oturum açma bilgileri** (App access) | "Hayır" (kısıtlama/giriş yok) |
| **Reklam** | "Evet, reklam içeriyor" (AdMob) |
| **İçerik derecelendirme** (IARC anketi) | E-posta + kategori "Diğer Tüm Uygulama Türleri" + IARC şartlarını kabul + tüm sorulara içeriğe göre (bizde hepsi "Hayır") |
| **Hedef kitle ve içerik** | Yaş grupları — **13+ seçersen** çocukla ilgili adımlar atlanır |
| **Veri güvenliği** | AdMob varsa: "Cihaz veya diğer kimlikler" → toplanır **+ paylaşılır** → kısa süreli **değil** → **zorunlu** → amaç **Reklam veya pazarlama** (hem toplama hem paylaşım). Şifreleme "Evet". Hesap oluşturma "izin vermiyor". Veri silme yöntemi "Hayır". |
| **Reklam kimliği** (AD_ID) | AdMob varsa "**Evet**" + amaç "Reklam veya pazarlama". (Manifest'te `AD_ID` izni var çünkü.) |
| **Resmi kurum uygulamaları** | "Hayır" |
| **Finans ile ilgili özellikler** | "Uygulamamda finans özelliği yok" |
| **Sağlık** | "Uygulamamda sağlık özelliği yok" |

**Veri güvenliği notu:** App'in kendisi veri toplamasa bile **AdMob reklam kimliğini topluyor** → Google bunu beyan etmeni ister. "Hiç toplamıyorum" deyip AdMob ile yayınlarsan reddedilir. Reklam istemiyorsan AdMob'u tamamen çıkar, o zaman "veri yok" diyebilirsin.

---

## 5) Store listing (mağaza girişi)

**Play Store'daki varlığı → Mağaza girişleri.**
- **Uygulama adı** (≤30)
- **Kısa açıklama** (≤80)
- **Tam açıklama** (≤4000)
- **Görseller** (bkz. bölüm 8): Uygulama simgesi, Öne çıkan grafik, Telefon ekran görüntüleri (min 2)
- Tablet / Chromebook / Android XR → **opsiyonel**, boş bırakılabilir (yalnızca telefon zorunlu)

> Metinleri girip bir görsel yüklemeden **"Taslak olarak kaydet"** ile metni güvene al (oturum düşerse kaybolmasın).

---

## 6) Mağaza ayarları (kategori + iletişim) — ATLANMASIN

**Play Store'daki varlığı → Mağaza ayarları:**
- **Uygulama kategorisi**: Uygulama/Oyun + Kategori (bizde "Yaşam Tarzı")
- **İletişim bilgileri**: e-posta (zorunlu) + web sitesi (opsiyonel)

⚠️ Bu adım **Kontrol paneli kurulumunu 11/11 yapan son parça.** Bunu bitirmeden **"İncelemeye gönder" butonu KİLİTLİ kalır** ve kapalı test açılmaz. Bizi en çok yakalayan yer burasıydı.

---

## 7) [Kişisel hesap] Kapalı test — 12 testçi × 14 gün

**Test edin ve yayınlayın → Kapalı test → (Alpha kanalı) Kanalı yönet.** 4 görev:

1. **Yeni sürüm oluştur** → "**Kitaplıktan ekle**" (mevcut AAB) → sürüm notu → İleri
2. **Ülke seçin** → Ülkeler/bölgeler sekmesi → başlıktan **tümünü seç** → Kaydet
   - ⚠️ Ülke seçmezsen "hiçbir ülke seçilmedi" hatasıyla yayına alınmaz.
3. **Test kullanıcılarını seçin** → E-posta listesi oluştur → 12+ Gmail ekle → listeyi işaretle → (geri bildirim e-postası) → Kaydet
4. **Sürümü önizle ve onayla** → Kaydet → **Yayın özeti**nde "**N değişikliği incelemeye gönder**"

**Katılım linki** (arkadaşlara): `https://play.google.com/apps/testing/PAKET.ADI`
- Örn: `https://play.google.com/apps/testing/com.driftstop.app`
- Çalışması için: **(a)** inceleme onaylanmış olmalı, **(b)** kişinin e-postası listede olmalı.
- Testçi: linke tıklar → "Become a tester" → birkaç dk → Play'den kurar.

**12 testçiyi nereden bulursun:**
- Tanıdıklar (WhatsApp grubuna link) — en kolay
- **Testçi-değişim toplulukları** (herkes birbirinin app'ini test eder): testerscommunity.com (ücretsiz mutual + ~15$ paket), theclosedtest, Reddit r/androiddev / r/alphaandbetausers
- ⚠️ Emülatör genelde saymaz; **gerçek cihaz** gerekir. 12 hesabı tek telefonda saf sahte kurmak riskli (reddedilebilir).

**14 gün sonra:** Kontrol paneli → Üretim → "**Üretime başvur**" (buton açılır) → Google inceler.

---

## 8) Görseller

**Boyutlar:**
| Görsel | Boyut | Zorunlu |
|---|---|---|
| Uygulama simgesi | 512×512 PNG | ✅ |
| Öne çıkan grafik (feature) | 1024×500 | ✅ |
| Telefon ekran görüntüleri | 1080×2400 vb. (min 320, max 3840 px; 2-8 adet) | ✅ (min 2) |
| Tablet/Chromebook/XR | — | opsiyonel |

**İpuçları (bizim yaşadıklarımız):**
- Ekran görüntülerinde **"Test Ad" banner'ı GÖRÜNMESİN** — amatör durur. Reklamı gizle veya banner'ı arka planla düzenle (PIL/Chrome).
- **Marka tutarlılığı**: aynı renk + motif kullan (bizde koyu #1C1A16 + amber #C8923A + el-çizimi alev). İkon, feature ve kahraman görsel aynı dilde.
- İlk ekran görüntüsü **markalı "kahraman" görsel** olabilir (güçlü bir alıntı/söz dikkat çeker).
- **HTML tasarla → headless Chrome ile tam boyut PNG render et:**
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --force-device-scale-factor=1 --hide-scrollbars \
    --window-size=1024,500 --virtual-time-budget=4000 \
    --screenshot=out.png "file:///.../tasarim.html"
  ```
  (`--force-device-scale-factor=1` → tam piksel; retina 2x'i önler. Web font için `--virtual-time-budget`.)
- Boyut doğrula: `sips -g pixelWidth -g pixelHeight out.png`

---

## 9) Bizi yakalayan tuzaklar (mutlaka oku)

1. **Kaydet → onay diyaloğu var.** Çoğu ekranda "Değişiklik Google Play'de yayınlansın mı?" çıkar; **onaylamadan** sayfadan çıkarsan **kaydolmaz.** (İletişim bilgileri tam bu yüzden 2 kez boşa gitti.)
2. **Radio/checkbox → Kaydet gecikmesi:** seçtikten hemen sonra Kaydet bir an pasif kalır; ilk tık boşa gidebilir, tekrar bas.
3. **Oturum sessizce düşebilir:** "Kaydetmek için hataları düzeltin" gibi **yanıltıcı** hata verir. Sayfayı yenile → yeniden giriş → düzelir. (Form cevapları doğruydu, sorun oturumdaydı.)
4. **"İncelemeye gönder" kilidi:** Kontrol paneli kurulum adımları (özellikle **kategori + iletişim**) bitmeden gönder butonu gri kalır.
5. **Üretim kilidi (kişisel hesap):** 12 testçi × 14 gün bitmeden "Üretime başvur" açılmaz. Ekranda net yazıyor.
6. **Tek-ABI uyarısı:** biz disk için sadece `arm64-v8a` derledik → uyarı verir ama **engellemez**. Normalde tüm ABI'ları derle (`bundleRelease` hepsini yapar).
7. **Katılım linki** onaydan önce / e-posta listede değilse **çalışmaz** — "uygulama mevcut değil" der.

---

## 10) Yeni app için HIZLI CHECKLIST

```
ÖN HAZIRLIK
[ ] Hesap tipi netleştir (kişisel = 12 testçi / kuruluş = muaf)
[ ] İmzalı AAB üret (keystore YEDEKLE)
[ ] AdMob ID'leri koda (varsa) — prod'da gerçek, dev'de TestIds
[ ] Gizlilik politikası URL'de yayında
[ ] 6 görsel hazır (ikon, feature, 4 ekran) — marka tutarlı, test-ad yok
[ ] Kısa (≤80) + tam açıklama yazılı

PLAY CONSOLE
[ ] Uygulama oluştur
[ ] Dahili test → AAB yükle → yayına al
[ ] App content: 10 beyan (gizlilik, app access, reklam, IARC, hedef kitle,
    veri güvenliği, reklam kimliği, resmi kurum, finans, sağlık)
[ ] Store listing: ad + açıklamalar + görseller
[ ] Mağaza ayarları: kategori + iletişim  ← 11/11 için ŞART
[ ] [Kişisel] Kapalı test: sürüm(kitaplıktan) + ülke(tümü) + 12 testçi + gönder
[ ] 12 testçi × 14 gün
[ ] Üretime başvur → Google inceler
[ ] Üretim sürümü → incelemeye gönder → CANLI
```

---

## 11) Kalıcı notlar / kimlikler

- **Keystore = upload key.** Kaybetme, yedekle. Kaybolursa güncelleme yapamazsın (Google Play App Signing ile kurtarma başvurusu gerekir).
- **Paket adı değişmez.** Baştan doğru seç.
- **AdMob prod ID'leri** yalnızca prod build'de; dev'de test ID (yoksa hesabın askıya alınabilir).
- İnceleme süresi: genelde **birkaç saat–gün** (Google "7 güne kadar" der).
- **CNG (Expo):** `android/` klasörü gitignore; native değişiklikler config plugin ile. Prebuild sonrası elle native edit kaybolur → plugin kullan.

---

### DriftStop referans değerleri (örnek)
- Paket: `com.driftstop.app` · Hesap: evolaroa.app (u/0, **kişisel**)
- Kategori: Yaşam Tarzı · İletişim: muhammed.gulcu@gmail.com / mgulcu.me
- Gizlilik: https://mgulcu.me/driftstop/privacy
- Kapalı test linki: https://play.google.com/apps/testing/com.driftstop.app
- Görseller: `store-assets/` · Keystore: `credentials/` (gitignored)
