# DriftStop — Play Store: kalan adımlar (senin yapman gerekenler)

Ben (Claude) buraya kadar her şeyi hazırladım. Aşağıdaki adımlar **bana kapalı** olduğu için sende kaldı.

## Neden ben bitiremedim (2 sert engel)
1. **AAB yüklemesi** — Play Console'a dosya yüklemek için tarayıcı otomasyonu yalnızca *senin sohbette paylaştığın* dosyaları kabul ediyor. AAB'yi ben sürükle-bırak edemiyorum. **Bu adımı sen yapmalısın.**
2. **Google inceleme** — gönderildikten sonra yayına girmesi birkaç saat–gün sürer (Google'ın elinde).
3. Bonus: **disk neredeyse dolu** (~%90, ~1.7GB boş). Build cache'lerini temizledim; sen de biraz yer aç.

## Hazır olanlar ✅
- **İmzalı production AAB**: `store-assets/DriftStop-release.aab` (39.6 MB, imza doğrulandı, gerçek AdMob ID'leri içinde)
  - Not: yer kazanmak için **arm64-v8a** tek mimari ile derlendi (modern cihazların hemen hepsi). Tüm mimariler istersen disk açıp `cd android && ./gradlew bundleRelease` ile yeniden üret.
- **AdMob**: app + Banner + Interstitial oluşturuldu, ID'ler app.json + src/constants/adUnits.ts'de
- **Play Console**: DriftStop uygulaması oluşturuldu (com.driftstop.app); **Dahili test → Yeni sürüm** taslağı açık bırakıldı
- **Gizlilik politikası**: canlı → https://mgulcu.me/driftstop/privacy
- **Kod**: github.com/mhmmdglc/drift-stop (main) pushlandı
- **Keystore + şifre**: `credentials/KEYSTORE-INFO.txt` ← ÇOK ÖNEMLİ, kaybetme/yedekle
- **Mağaza görselleri**: icon-512.png, 4 ekran görüntüsü, feature-1024x500.png (feature basit; istersen Canva'da güzelleştir)
- **Mağaza metni + beyan cevapları**: `store-assets/STORE-LISTING.md`

## EAS bağlandı — EN TEMİZ yol (önerilen)
EAS projesi bağlı: `@evolaroa.app/drift-stop`. Disk derdi olmadan + keystore'u EAS yönetir:
```bash
cd ~/workspace/MyWorkspace/drift-stop
eas build -p android --profile production    # "Generate a new Keystore?" → Yes (EAS saklar, kaybolma derdi yok)
```
~15-20 dk bulutta → AAB linki. Sonra ya:
- `eas submit -p android` (bir kez Google Play servis hesabı kurman gerekir — Play Console → Geliştirici hesabı → API erişimi), VEYA
- EAS'ten AAB'yi indir → Play Console'a sürükle-bırak.

> Not: EAS kendi keystore'unu üretirse, ilk yüklemeyi de EAS AAB'siyle yap (yereldeki `DriftStop-release.aab` ile karıştırma — upload key tutarlı kalsın). Yereldeki AAB sadece yedek; onu kullanırsan keystore = `credentials/driftstop-upload.keystore`.

## Senin adımların (~15-20 dk) — manuel/yerel yol
1. **Disk aç** (Ayarlar > Genel > Depolama). En az birkaç GB.
2. **AAB yükle**: Play Console açık olan "Dahili test sürümü oluşturma" sayfasında (yoksa: Test edin ve yayınlayın → Dahili test → Yeni sürüm oluştur), AAB kutusuna `store-assets/DriftStop-release.aab` dosyasını **sürükle-bırak**. Sürüm notu ekle → İleri → Kaydet/İncele.
3. **Uygulama içeriği (App content)** — sol menü "Politika durumu" / "Uygulama içeriği":
   - Gizlilik politikası: https://mgulcu.me/driftstop/privacy
   - Reklamlar: **Evet**
   - Uygulama erişimi: tüm işlevler serbest (giriş yok)
   - İçerik derecelendirme anketi (şiddet/cinsellik yok)
   - Hedef kitle: 13+
   - **Data safety**: "Device or other IDs" (reklam kimliği, AdMob için) — STORE-LISTING.md'deki cevaplar
4. **Store listing**: STORE-LISTING.md'den kısa+uzun açıklamayı yapıştır; icon-512 + en az 2 ekran görüntüsü + feature-1024x500 yükle.
5. Test edip beğenirsen **Üretim → Sürüm oluştur** (aynı AAB) → **İncelemeye gönder**.

Google onaylayınca canlı olur. Kolay gelsin 🔥
