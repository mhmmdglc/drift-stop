# Engagement Roadmap — "kullanıcı bizi neden kullanmak ister" dalgası

Ürün görüşmesinden (2026-08-16) çıkan kararların uygulama planı. Çerçeve: DriftStop bugün
kullanıcıya sürekli konuşuyor ama onu hiç dinlemiyor — bildirim + değişken ödül tarafı kurulu,
**kullanıcının kendinden bir şey yatırdığı** taraf boş. Bu dokümandaki her iş o boşluğu dolduruyor.

Bu bir **spec + TODO** dokümanıdır: her özellik için veri modeli, dosya dosya değişiklik listesi,
i18n anahtarları, testler, cihaz-QA adımları ve kabul kriterleri. İşler `project-manager` →
`ux-designer` → `frontend-dev`/`backend-dev` → `code-reviewer` → `qa-tester` hattından geçer
(bkz. `.claude/docs/WORKFLOW.md`). Bir madde bittiğinde buradaki kutusu işaretlenir ve
`WORKLOG.md`'ye kanıtıyla kaydedilir.

---

## Dalga planı özeti

| Dalga | İş | Boyut | Neden bu sırada |
|---|---|---|---|
| W0 | Doküman doğrulama spike'ları | S | W1'in iki işi API varsayımına dayanıyor; önce doğrula |
| W1.1 | Rotasyonda tekrar önleme | S | En ucuz kalite kazancı, başka hiçbir şeye bağlı değil |
| W1.2 | Onboarding'de "Neyi bırakmak üzeresin?" | S | En yüksek kaldıraç/maliyet oranı |
| W1.3 | Gece hesaplaşması + streak | M | Ritüel katmanının temeli; W1.4'ün kategorilerini kullanır |
| W1.4 | Bildirim aksiyonları (❤️ / bir tane daha) | M | Sürtünmesiz etkileşim; W0 spike'ına bağlı |
| W2.1 | Geleceğe mesaj kasası | M | Ayrıştırıcı özellik; scheduler'a W1'de girilen düzeni kullanır |
| W2.2 | SOS | M | Aktif kullanım senaryosu; widget spike'ına bağlı |
| W3.1 | Sertlik ayarı | L | 1000 sözün etiketlenmesi içerik işi — sahip onayı gerekir |
| W3.2 | Akıllı zamanlama | M | W1.4'ün biriktirdiği etkileşim verisine bağlı |
| W3.3 | Özel bildirim sesi | S kod / M süreç | Yeni build + kanal göçü gerektirir, release ile hizalanmalı |

**Bağımlılıklar:** W1.4 ve W2.2 → W0 spike sonuçları. W3.2 → W1.4'ün veri logu (en az 2-3 hafta
gerçek kullanım). W3.3 → bir sonraki store build'i. Geri kalan her şey birbirinden bağımsız,
paralel yürüyebilir.

---

## Her işte geçerli ortak kurallar (tek tek maddelere yazılmadı, hepsinde zorunlu)

- [ ] Yeni her string **6 locale dosyasına** girer (`src/locales/{tr,en,es,de,fr,it}.json`;
      `ar`/`ja` dosyalarına da anahtar eklenir ki parity testi geçsin). Parity testi kırmızıysa iş bitmemiştir.
- [ ] Her etkileşimli öğeye accessibility props (`accessibilityRole`, `accessibilityLabel`,
      gerekliyse `accessibilityState`).
- [ ] Renkler `useTheme()`, boşluklar `@/constants/layout`; UI `Sketch*`/`Wobbly*` ailesiyle kurulur.
      Yeni ekranlar `ux-designer` ajanından yerleşim kararı alınmadan yazılmaz.
- [ ] `Settings`'e eklenen her alan `DEFAULT_SETTINGS`'e de eklenir — `useSettings` merge'ü
      (`{...DEFAULT_SETTINGS, ...stored}`) sayesinde migrasyon gerekmez; **bu varsayım her PR'da
      testle kanıtlanır** (eski shape'li stored objeyle bir merge testi).
- [ ] Yeni her AsyncStorage anahtarı `src/utils/storage.ts` → `StorageKeys`'e eklenir, çıplak string yasak.
- [ ] Kapılar: `npx tsc --noEmit` + `npx jest` + `npx expo lint` (yeni hata eklemeden).
- [ ] **Derlemek çalışmak değildir:** her özellik Android emülatöründe ekranda görülerek doğrulanır;
      bildirim işleri için uygulama **kapalıyken** de denenir. Doğrulanmayan şey raporda "doğrulanmadı" diye yazılır.
- [ ] Dokümantasyon aynı değişiklikte güncellenir: `PRODUCT.md` (ekran tablosu / bildirim döngüsü /
      free-vs-Pro matrisi), `ARCHITECTURE.md` (yeni hook/servis), `TODO.md`, `WORKLOG.md` (append).
- [ ] Expo API'leri koddan önce https://docs.expo.dev/versions/v56.0.0/ üzerinden doğrulanır — hafızadan API yazılmaz.

---

## W0 — Spike'lar: önce doğrula, sonra tasarımı sabitle (yarım gün)

Üç API varsayımı var; üçü de yanlışsa ilgili işin tasarımı değişir. Her spike'ın çıktısı bu
dokümana işlenen bir karar cümlesidir.

- [x] **W0.a — Bildirim aksiyon butonları (W1.3 + W1.4'ün temeli).** **SONUÇ (2026-08-16,
      doküman doğrulaması):** `setNotificationCategoryAsync` v56 dokümanında "Supported platforms:
      Android, iOS". Uygulama kapalıyken aksiyon dokunuşu için dokümanın cümlesi: *"Only on Android,
      the task also runs in response to a notification action tap when the app is backgrounded or
      terminated"* — yani headless işleme `Notifications.registerTaskAsync` + `expo-task-manager`
      ile mümkün (registerTaskAsync zaten expo-task-manager üstünde çalışıyor).
      - **Karar:** W1.4 `expo-task-manager` bağımlılığını ekler; aksiyon işleme birincil olarak
        background task'ta yapılır, `getLastNotificationResponseAsync` açılış mutabakatı yedek kalır
        (dikkat: yalnızca SON cevabı tutar — kapalıyken iki ❤️ basılırsa teki kurtulur, bu yüzden
        birincil yol background task'tır). `opensAppToForeground` için doküman varsayılan değer
        vermiyor → her aksiyonda AÇIKÇA yazılır.
      - **Doğrulanmadı:** çalışma zamanı davranışı. Mevcut dev client'ta denenemez — `expo-task-manager`
        kurulu değil, native modül binary'de yok; ilk kanıt W1.4'ün yeni dev client build'inde alınır.
        Dokümandaki davranış sahada çıkmazsa fallback tasarımı (aksiyonlar `opensAppToForeground: true`)
        aynen geçerli, W1.3/W1.4 kabul kriterleri fallback'le de sağlanır.
- [x] **W0.b — Widget'ta ikinci tıklama alanı (W2.2'nin temeli).** **SONUÇ (2026-08-16, kurulu
      paket 0.20.3'ün tip tanımlarından):** `clickAction`/`clickActionData` her widget öğesinin ortak
      prop'u (`common-internal.props.d.ts`), `'OPEN_URI'` + `{ uri }` destekleniyor
      (`click-action.d.ts`); mevcut widget kökte zaten `OPEN_URI` kullanıyor
      (`DriftStopWidget.tsx:45-46`). **Aynı widget'ta birden çok tıklama bölgesi API olarak mümkün →
      W2.2'nin widget girişi tasarlandığı gibi yapılır.** Ekranda davranış W2.2 cihaz-QA'sında doğrulanır.
- [x] **W0.c — i18n interpolasyonu (W1.2'nin temeli).** **SONUÇ (2026-08-16, yerel çalıştırma,
      i18n-js 4.5.3):** `t('key', { goal })` + `%{goal}` tr/en'de doğru çalışıyor. **Tuzak:** parametre
      verilmezse çıktı `[missing "%{goal}" value]` — bu metin bildirimde ASLA görünmemeli; `randomTitle`
      hedef `null` iken `goalTitles` havuzuna hiç girmez ve bunu sabitleyen test yazılır (W1.2 test
      listesinde zaten var, bu tuzak gerekçesidir).

---

## W1.1 — Rotasyonda tekrar önleme (S)

**Neden:** `pickQuoteId` (`src/utils/scheduler.ts:82`) yalnızca art arda tekrarı engelliyor; geçmişe
hiç bakmıyor. Günde 5 bildirimle tekrarlar fark edilir ve "hep aynı sözler" hissi uygulamayı sildirir.
`pickUnseenQuoteId` (`src/utils/quoteSelector.ts`) diye ölü bir fonksiyon zaten var ama scheduler'ın
kendi akışına bağlanmadı.

**Tasarım kararı:** seçim, `seenHistory`'nin son N kaydını (N = min(200, havuz × 0.5)) dışlayarak
yapılır; havuz küçükse (tema filtresi dar) dışlama havuzu %50'nin altına düşürmeyecek şekilde kırpılır —
küçük havuzda "hiç seçilecek söz kalmadı" durumu **olamaz**.

- [ ] `src/utils/scheduler.ts` — `applySchedule` başında `seenHistory`'yi bir kez oku
      (`getJSON(StorageKeys.seenHistory, [])`); `pickQuoteId(pool, prevId)` imzasını
      `pickQuoteId(pool, prevId, excludeSet)` yap. Dışlama kuralı: `excludeSet`'te olmayanlardan
      rastgele seç; hepsi dışlanmışsa dışlamayı yok say (mevcut davranışa düş).
- [ ] Dışlama setini kur: `new Set(history.slice(0, Math.min(history.length, Math.floor(pool.length * 0.5))))`.
      Havuz ≤ 2 ise dışlama tamamen kapalı (mevcut `pool.length === 1` dalı korunur).
- [ ] Aynı `applySchedule` çağrısı içinde seçilenler de sete eklenir — 3 günlük plan kendi içinde de
      tekrar etmesin (30 bildirimlik plan ≤ havuzun yarısı olduğu sürece).
- [ ] Ölü kodu kaldır: `pickUnseenQuoteId` ve `StorageKeys.seenToday`… `seenToday` zaten silinmiş
      (`storage.ts:10` yorumu); `quoteSelector.ts` ile testini bu işte sil (TODO.md #13'ün kalanı).
- [ ] **Testler** (`scheduler.test.ts` — 27 test mevcut, buraya eklenir): (a) geçmişteki id'ler
      seçilmiyor, (b) havuzun tamamı geçmişteyse yine seçim yapılabiliyor, (c) 3 günlük plan kendi
      içinde tekrarsız (havuz yeterince genişken), (d) tek sözlü havuz çökmüyor.
- [ ] **Cihaz QA:** temiz kurulum + tema filtresi ile havuzu ~60 söze indir, frekans 10, pencereyi
      daralt; `getAllScheduledNotificationsAsync` dökümünde 30 bildirimin tekrarsız olduğunu doğrula.

**Kabul kriteri:** 1000 sözlük havuzda 200 bildirimlik bir pencere boyunca aynı söz iki kez gelmez;
30 sözlük uç havuzda uygulama planlamaya devam eder.

---

## W1.2 — Onboarding'de "Neyi bırakmak üzeresin?" (S)

**Neden:** Onboarding bugün yalnızca tema seçtiriyor (`src/app/onboarding.tsx` — 3 slayt + 1 tercih
adımı). Tek serbest-metin soru, uygulamayı ilk dakikadan "genel söz uygulaması"ndan "*benim*
mücadelemin uygulaması"na çevirir ve bildirim başlıklarına kişisel bağ kazandırır.

**Veri modeli:** `Settings`'e `goal: string | null` (varsayılan `null`). Ayrı storage anahtarı yok —
settings zaten AsyncStorage'da. Kısıt: trim'lenmiş, 1–32 karakter; boş bırakmak tamamen serbest.

- [ ] `src/types/settings.ts` — `goal: string | null` alanı + `DEFAULT_SETTINGS.goal = null` +
      `GOAL_MAX_LENGTH = 32` sabiti.
- [ ] `src/hooks/useSettings.tsx` — `SCHEDULE_KEYS`'e `'goal'` ekle (başlıklar zamanlama anında
      pişiyor; hedef değişince plan yeniden kurulmalı — `language` ile aynı gerekçe).
- [ ] `src/app/onboarding.tsx` — `STEPS`'i 5'e çıkar: 3 slayt → **hedef adımı (yeni, index 3)** →
      tercih adımı (index 4). Hedef adımı: başlık `onboarding.goal.title` ("Neyi bırakmak üzeresin?"),
      alt metin `onboarding.goal.body`, tek satırlık `TextInput` (Sketch çizgisinde bir
      `SketchTextInput` yoksa `ux-designer`'dan bileşen kararı al), `maxLength={GOAL_MAX_LENGTH}`,
      `returnKeyType="done"`, klavye açıkken buton erişilebilir (Android `KeyboardAvoidingView`
      tuzağı — aynı hata `auth.tsx`'te bir kez yaşandı ve `40ffd94` ile düzeltildi, oradaki çözümü kopyala).
      "Atla" bu adımda da çalışır (hedefsiz devam). `finish()` içindeki `update({ themes })` çağrısı
      `update({ themes, goal: goalText.trim() || null })` olur.
- [ ] `src/utils/scheduler.ts` — `randomTitle()` → `randomTitle(goal: string | null)`:
      hedef varsa **%30 olasılıkla** `notifications.goalTitles` dizisinden interpolasyonlu bir şablon
      (`"%{goal} için buradasın."`, `"Bunu %{goal} uğruna okuyorsun."` vb., dizi başına 4-6 şablon),
      yoksa/kalan %70'te mevcut `notifications.titles`. Oran sabit olarak dosya başına
      `GOAL_TITLE_RATIO = 0.3` — her bildirim kişiselleşirse tekrar hissi verir, hiç kişiselleşmezse
      özellik görünmez.
- [ ] `src/app/(tabs)/settings.tsx` — "Hedefin" satırı (bildirim bölümünün üstüne; tam yer kararı
      `ux-designer`'dan): mevcut değeri gösterir, dokununca düzenleme (inline input veya küçük modal),
      boşaltmak serbest. `settings.goal.label`, `settings.goal.placeholder`, `settings.goal.hint` anahtarları.
- [ ] **i18n:** `onboarding.goal.*` (title, body, placeholder, skipHint), `notifications.goalTitles`
      (dizi), `settings.goal.*` — 6 aktif + 2 pasif locale. Şablonlarda `%{goal}` her dilin söz dizimine
      göre ayrı yazılır (W0.c doğrulaması ön koşul).
- [ ] **Testler:** (a) `randomTitle` hedef null iken asla goalTitles kullanmıyor; (b) hedef varken
      iki havuzdan da seçebiliyor (Math.random mock'u ile); (c) settings merge testi: eski stored
      obje (goal alansız) → `goal: null`; (d) 32 karakter kırpma.
- [ ] **Cihaz QA:** temiz kurulum → onboarding'de hedef gir → `getAllScheduledNotificationsAsync`
      dökümünde bazı başlıkların hedefi içerdiğini gör; Settings'ten hedefi değiştir → plan yeniden
      kuruldu ve yeni hedef başlıklarda; hedefi sil → hiçbir başlıkta hedef yok. Onboarding'i "Atla"
      ile geç → hiçbir şey kırılmıyor.

**Kabul kriteri:** Hedef giren kullanıcının bildirimlerinin bir kısmı hedefini adıyla anar; hedef
girmeyen kullanıcı için deneyim bugünkünden farksızdır; hedef Settings'ten her an değiştirilebilir/silinebilir.

---

## W1.3 — Gece hesaplaşması + streak (M)

**Neden:** Markanın kendi kelimesi "reckoning". Günde bir kez, pencere kapanışından sonra tek
dokunuşluk "Bugün direndin mi, kaçtın mı?" — anlamlı streak'in (uygulama açma değil, **beyan edilen
direniş**) ham verisi ve her akşam garantili temas noktası.

**Veri modeli:**
- `StorageKeys.reckoningLog = 'driftstop:reckoningLog'` → `Record<string, 'resisted' | 'drifted'>`
  (anahtar `dateKey` formatı, `timeUtils.dateKey` ile aynı). Cevapsız gün = kayıt yok.
- `Settings.reckoningEnabled: boolean` (varsayılan `true`; kapatınca hesaplaşma bildirimi kurulmaz,
  Home kartı gizlenir). `SCHEDULE_KEYS`'e eklenir.
- Yeni sabit `RECKONING_KIND = 'reckoning'` (`data.kind` işareti, `TRIAL_NOTICE_KIND` deseniyle aynı).

**Zamanlama tasarımı:** hesaplaşma bildirimi `applySchedule` İÇİNDE kurulur (günlük plana dahildir,
`cancelAll` onu da iptal eder ve yeniden kurulur — trial uyarılarının aksine korunması gerekmez,
çünkü her plan yeniden kuruluşunda tekrar üretilir). Saat: `endMin + 45 dk`, üst sınır 23:15;
`disableWeekends` hesaplaşmayı da atlar. Kanal: `NOTIFICATION_CHANNEL_ID` (ayrı kanal gerekmez —
kullanıcı günlük akışı susturuyorsa hesaplaşma da sussun; trial'daki ayrı-kanal gerekçesi burada geçerli değil).

- [ ] `src/utils/reckoning.ts` (yeni, saf fonksiyonlar): `computeStreak(log, today)` — bugünden
      (bugün cevapsızsa dünden) geriye kesintisiz `resisted` sayısı; `drifted` streak'i sıfırlar,
      **cevapsız gün de sıfırlar** (kaçış beyanı ile sessizlik aynı: hesaplaşmadan kaçmak da kaçmaktır —
      bu ürün kararıdır ve kopyada açıkça söylenir); `disableWeekends` açıksa hafta sonu günleri
      "yok" sayılır, streak'i kırmaz. `weekSummary(log, today)` → `{ resisted, drifted, unanswered }`
      (son 7 gün). `pruneLog(log)` → 90 günden eskiyi sil.
- [ ] `src/utils/scheduler.ts` — `applySchedule` döngüsünde her gün için (hafta sonu kuralına tabi)
      bir hesaplaşma bildirimi: `content.title = t('reckoning.notifTitle')` ("Günün hesabı"),
      `body = t('reckoning.notifBody')` ("Bugün direndin mi, kaçtın mı?"),
      `data: { kind: RECKONING_KIND, date: dateKey(day) }`, `categoryIdentifier: 'reckoning'`.
      `scheduledQuoteIds` planına **girmez** (söz değildir, `syncDeliveredToHistory` onu görmemeli —
      mevcut filtre `data.quoteId` okuduğu için doğal olarak dışarıda kalır, testle sabitle).
- [ ] Kategori kaydı: `setupAndroidChannel` yanına `setupNotificationCategories()` —
      `setNotificationCategoryAsync('reckoning', [{ identifier: 'resisted', buttonTitle: t('reckoning.actionResisted') },
      { identifier: 'drifted', buttonTitle: t('reckoning.actionDrifted') }])`, iki buton da W0.a
      sonucuna göre `opensAppToForeground` false (ideal) veya true (fallback). Dil değişince
      kategoriler yeniden kaydedilir (buton metinleri de pişiyor — `applySchedule` başına koy).
- [ ] Cevap işleme: `useNotificationObserver` (`src/hooks/useNotifications.ts`) genişler —
      response'un `actionIdentifier`'ı `resisted`/`drifted` ise `reckoningLog[date] = cevap` yaz
      (aynı güne ikinci cevap üzerine yazar), quote yönlendirmesi yapılmaz. `actionIdentifier`
      DEFAULT (bildirimin gövdesine dokunuldu) ve `kind === RECKONING_KIND` ise `/reckoning`
      ekranına yönlendir. **Fallback (W0.a olumsuzsa):** butonlar da uygulamayı açar; açılışta
      `getLastNotificationResponseAsync` cevabı yakalayıp yazar, sonra `/reckoning` özet halini gösterir.
- [ ] `src/app/reckoning.tsx` (yeni route, modal sunum): iki büyük Sketch buton (Direndim / Kaçtım),
      bugünün cevabı verilmişse onun yerine bugünkü durum + streak + haftalık özet. Bildirime hiç
      dokunmayan kullanıcı için de Settings/Home'dan ulaşılabilir tek hesaplaşma yüzeyi budur.
- [ ] Home kartı: `src/app/(tabs)/index.tsx` — quote kartının altında (yerleşim `ux-designer`)
      kompakt bir "hesaplaşma şeridi": streak alevi + sayı + bu hafta `5/7` gösterimi; dokununca
      `/reckoning`. `reckoningEnabled` false veya log tamamen boşsa gizli (ilk cevaba kadar Home kalabalıklaşmasın).
- [ ] `src/app/(tabs)/settings.tsx` — bildirim bölümüne `SketchToggle`: "Gece hesaplaşması"
      (`settings.reckoning.label` + `hint`).
- [ ] **i18n:** `reckoning.*` (notifTitle, notifBody, actionResisted, actionDrifted, title, question,
      streakLabel, weekLabel, emptyHint, settingsLabel, settingsHint) × 8 dosya.
- [ ] **Testler:** `reckoning.test.ts` — streak: kesintisiz seri, drifted kırması, cevapsız gün
      kırması, hafta sonu muafiyeti (toggle açık/kapalı), boş log; `pruneLog`; hafta özeti sınırları
      (bugün dahil 7 gün). `scheduler.test.ts` — hesaplaşma bildirimi doğru saatte/kanal/kategoriyle
      kuruluyor, `disableWeekends` atlıyor, `scheduledQuoteIds`'e sızmıyor, `notificationsEnabled=false`
      iken kurulmuyor, 23:15 üst sınırı.
- [ ] **Cihaz QA:** pencereyi şimdi+2s. bitecek şekilde ayarla → hesaplaşma bildirimi geldi mi;
      uygulama **kapalıyken** butona bas → tekrar aç, log yazılmış mı ve Home şeridi güncel mi;
      aynı güne ikinci cevap üzerine yazıyor mu; ertesi gün (emülatör saatini ileri al) streak artıyor mu;
      toggle kapat → bildirim planda yok.

**Kabul kriteri:** Kullanıcı uygulamayı açmadan tek dokunuşla günü kapatabilir; streak yalnızca
beyan edilen direnişleri sayar; özellik kapatılabilir; hesaplaşma bildirimi söz kotasından yemez.

---

## W1.4 — Bildirim aksiyonları: ❤️ ve "Bir tane daha" (M)

**Neden:** Bildirim bugün tek yönlü — dokun/ya da yoksay. İki aksiyonla bildirim, uygulama
açılmadan etkileşim yüzeyi olur; ❤️ verisi ileride rotasyon kişiselleştirmesinin (W3.2 ve sonrası)
hammaddesidir.

**Tasarım kararları:**
- ❤️ **Favorile**: `opensAppToForeground: false` (W0.a onaylarsa) — sözü açmadan favoriler.
- **"Bir tane daha"**: feed kapısı açmamak için sert sınır — günde **en fazla 2**, karşılığında
  5 saniye içinde havuzdan (tekrar-önleme kurallı) tek yeni bildirim. Sınıra takılınca sessiz no-op
  (bildirim gelmez; bu kasıtlı — "hakkın bitti" bildirimi göndermek dırdıra dönüşür).
- Aksiyonlar yalnızca günlük söz bildirimlerinde (`categoryIdentifier: 'quote'`); hesaplaşma ve
  trial bildirimlerinde yok.

**Veri modeli:** `StorageKeys.extraQuoteLog = 'driftstop:extraQuoteLog'` →
`{ date: string, count: number }`; `StorageKeys.engagementLog = 'driftstop:engagementLog'` →
`{ hour: number, at: number }[]` (cap 200 — W3.2 bunu tüketecek, log'u bu işte başlat ki veri birikmeye başlasın).

- [ ] **Bağımlılık (W0.a kararı):** `expo-task-manager` eklenir; `index.js`'te
      `TaskManager.defineTask` ile aksiyon işleyici tanımlanır (widget handler'ın oradaki kayıt
      deseniyle aynı mantık), boot'ta `Notifications.registerTaskAsync`. İşleyicinin çekirdeği
      `handleNotificationAction` saf fonksiyonudur — hem background task hem foreground listener
      aynı fonksiyonu çağırır. **Yeni dev client build gerektirir** (native modül); W1.4'ün cihaz
      QA'sı bu build üstünde koşulur ve W0.a'nın çalışma zamanı kanıtı burada alınır.
- [ ] Kategori: `setupNotificationCategories`'e `'quote'` kategorisi —
      `favorite` (`buttonTitle: t('notifications.actionFavorite')`) ve
      `oneMore` (`t('notifications.actionOneMore')`).
- [ ] `src/utils/scheduler.ts` — söz bildirimlerine `categoryIdentifier: 'quote'` ekle.
- [ ] Cevap işleme (`useNotificationObserver`):
      - `favorite`: `quoteId`'yi `StorageKeys.favorites` listesinin başına ekle (zaten varsa no-op).
        **Yarış notu:** `useFavorites` state'i mount'ta okunuyor; hook'a `AppState → active`'te
        yeniden okuma ekle (`useHistory.tsx:46`'daki desenin aynısı) — yoksa bildirimden favorilenen
        söz, açık duran uygulamada görünmez ve bir sonraki state yazımı onu ezer.
      - `oneMore`: bugünkü `extraQuoteLog.count < 2` ise sayacı artır, havuzdan (W1.1 dışlama
        kurallı) bir söz seç, `scheduleNotificationAsync` ile +5 sn'ye tek bildirim kur
        (`data: { quoteId }`, kategori `'quote'` — evet, onun da ❤️'si olur; `oneMore` zinciri
        günlük 2 sınırına takılır). Kurulan söz `scheduledQuoteIds` planına `{id, at}` olarak
        eklenir ki `syncDeliveredToHistory` onu da geçmişe taşısın.
      - `DEFAULT` (gövdeye dokunma): mevcut davranış (`/quote/[id]`) + `engagementLog`'a
        `{ hour: new Date().getHours(), at: Date.now() }` push (cap 200, baştan kes).
- [ ] **Fallback (W0.a olumsuzsa):** iki aksiyon da `opensAppToForeground: true`; işleme açılışta
      yapılır — ❤️ için `/quote/[id]` açılır ve favori işaretlenmiş olur (kullanıcı sonucu görür),
      `oneMore` için Home açılır ve bildirim yine +5 sn'ye kurulur.
- [ ] **i18n:** `notifications.actionFavorite`, `notifications.actionOneMore` × 8 dosya.
- [ ] **Testler:** cevap işleyicisini saf fonksiyona çıkar (`handleNotificationAction(response, deps)`)
      ve test et: favorite ekliyor/tekrar eklemiyor; oneMore 0→1→2→no-op; gün dönünce sayaç sıfır;
      engagementLog cap 200; hesaplaşma bildirimi bu işleyiciye düşmüyor.
- [ ] **Cihaz QA:** uygulama kapalıyken ❤️ → aç, Favoriler'de; kapalıyken "bir tane daha" ×3 →
      yalnızca 2 yeni bildirim; yeni gelen söz Home geçmişinde; uygulama açıkken ❤️ → Favoriler
      sekmesi anında güncel.

**Kabul kriteri:** Kullanıcı uygulamayı hiç açmadan söz favorileyebilir ve günde en çok 2 ek söz
çekebilir; hiçbir aksiyon hesaplaşma/trial bildirimlerinde görünmez; favori verisi uygulama içi
görünümle asla çelişmez.

---

## W2.1 — Geleceğe mesaj kasası (M)

**Neden:** İnsanın kendi cümlesi Marcus Aurelius'tan sert vurur. Güçlü bir anında kendine yazdığın
satır, haftalar sonra habersiz bir bildirim olarak döner. Kategoride benzeri yok ve doğal Pro yüzeyi.

**Tasarım kararları:**
- Mesajlar **söz değildir**: `seenHistory`'ye girmez (Home onları çözemez — premium dışlamasıyla
  aynı gerekçe, `quote/[id].tsx:41-43`), kendi route'unda açılır.
- Sürpriz kuralları: yazıldıktan sonra **en az 7 gün** uyur; günde en fazla 1 kasa mesajı; teslim
  olasılığı gün başına 0.25 (yani ortalama 4 günde bir — sabit `VAULT_DAILY_CHANCE = 0.25`).
- Teslim edilen mesaj varsayılan olarak emekli olur; kullanıcı mesaj detayında "yeniden kur" derse
  tekrar uykuya girer (yeni 7 gün).
- **Pro kapısı:** free 1 aktif (teslim bekleyen) mesaj, Pro sınırsız. Kapı her yerdeki gibi
  `purchasesConfigured && !isPro` desenine uyar (`settings.tsx:40` örneği) — RevenueCat yoksa kapı yok.
  Fiyat/paket değişikliği YOK (mevcut Pro'ya değer ekler).

**Veri modeli:** `StorageKeys.vaultMessages = 'driftstop:vaultMessages'` →
`{ id: number; text: string; createdAt: number; deliveredAt: number | null; rearmedAt: number | null }[]`.
`id` = artan yerel sayaç (`Date.now()` değil — çakışma riski yok ama okunur olsun); söz id'leriyle
çakışma alanı yok çünkü **hiçbir söz yüzeyinden geçmez** (`data.vaultId` ayrı alan, `quoteId` asla kullanılmaz).

- [ ] `src/services/vault.ts` (yeni): `listMessages`, `addMessage(text)` (trim, 4–280 karakter),
      `deleteMessage(id)`, `rearmMessage(id)`, `markDelivered(id, at)`, `eligibleMessages(now)`
      (deliveredAt null && yaş ≥ 7 gün, `rearmedAt` varsa ondan sayılır) — hepsi saf +
      AsyncStorage, hook değil (scheduler headless bağlamdan da çağıracak).
- [ ] `src/utils/scheduler.ts` — `applySchedule`: gün döngüsünde, o günün söz saatleri üretildikten
      sonra `Math.random() < VAULT_DAILY_CHANCE` ve uygun mesaj varsa rastgele bir saat dilimindeki
      sözün YERİNE kasa mesajı kurulur: `title` normal `randomTitle()` (sürpriz bozulmasın),
      `body = mesaj metni`, `subtitle = t('vault.signature', { date })` ("— Sen, 3 Mayıs"),
      `data: { kind: 'vault', vaultId }`, kategori **yok** (❤️/bir-tane-daha anlamsız).
      Plan kaydı: `ScheduledQuote` tipi `{ id, at, vaultId? }` olur; `vaultId`'li kayıtlar
      `syncDeliveredToHistory`'de geçmişe **girmez**, yerine `markDelivered(vaultId, at)` çağrılır.
      Bir mesaj plana girdiyse aynı planda ikinci kez seçilmez.
- [ ] `useNotificationObserver` — `kind === 'vault'` → `/vault/[id]` yönlendirmesi.
- [ ] `src/app/vault/index.tsx` (yeni): mesaj listesi (uyuyanlar "🔒 uykuda" — metni GÖSTERME,
      sürpriz kendine karşı da korunur; teslim edilenler açık), "+ Yeni mesaj" → editör (modal),
      free kullanıcı 2. aktif mesajı eklemek isterse Pro kartı → `/paywall`. Uzun basış → sil (onay diyaloğu).
- [ ] `src/app/vault/[id].tsx` (yeni): teslim edilmiş mesaj tam ekran (QuoteCard'a benzer ama kendi
      sade sunumu — `ux-designer` kararı), altında "Yeniden kur" ve "Sil".
- [ ] Giriş noktaları: Settings'te "Geleceğe mesaj" satırı (packs satırının yanına) + onboarding'in
      hedef adımına tek satır ipucu DEĞİL (onboarding şişmesin) → ilk teslimatta özellik kendini anlatır.
- [ ] `PRODUCT.md` free-vs-Pro matrisine satır: "Geleceğe mesaj — free 1 aktif / Pro sınırsız".
- [ ] **i18n:** `vault.*` (title, empty, addButton, editorTitle, editorPlaceholder, editorHint,
      sleeping, deliveredAt, signature, rearm, delete, deleteConfirm, proGateTitle, proGateBody) × 8 dosya.
- [ ] **Testler:** `vault.test.ts` — yaş kuralı (7 gün, rearm sıfırlar), free limit, karakter
      sınırları; `scheduler.test.ts` — kasa mesajı planda söz yerine geçiyor (toplam adet artmıyor),
      `vaultId`'li kayıt geçmişe sızmıyor ve `markDelivered` çağrılıyor, uygun mesaj yokken plan değişmiyor.
- [ ] **Cihaz QA:** mesaj yaz → `eligibleMessages`'ı test için 0 güne indirip (dev flag) planda kasa
      bildirimi oluştuğunu gör → bildirim gelince gövdede kendi metnin, dokununca `/vault/[id]`;
      Home geçmişinde YOK; free hesapta 2. mesaj Pro kartına çarpıyor; "yeniden kur" mesajı uykuya döndürüyor.

**Kabul kriteri:** Yazılan mesaj en az 7 gün sonra, önceden kestirilemeyen bir anda, günlük söz
kotasından bir slot kullanarak döner; Home/geçmiş/widget'a asla sızmaz; free kullanıcı 1 aktif
mesajla sınırlıdır ve sınır paywall'a bağlanır.

---

## W2.2 — SOS: "şu an vazgeçmek üzereyim" (M)

**Neden:** Uygulamanın bugün aktif hiçbir kullanım nedeni yok — tamamen pasif. Kriz anı, kullanıcının
uygulamayı kendi isteğiyle açacağı tek senaryo. "Next butonu yok" felsefesini bozmaz: bu bir feed
değil, acil durum kolu — çerçeveleme ve tasarım bunu hissettirmeli.

**Tasarım kararları:**
- SOS havuzu: `reckoning` + `discipline` tag'li sözler (en sert temalar); kullanıcının tema filtresi
  SOS'u ETKİLEMEZ (kriz anında "seçtiğin temalar" değil "en sert olan" gelir).
- Akış: dokun → 1.5 sn nefes perdesi (kararmış ekran, tek satır: "Dur.") → tek söz, tam ekran →
  tek çıkış "Devam ediyorum". **"Bir tane daha" yok** — SOS başına tek söz, feed kapısı burada da kapalı.
  Aynı SOS içinde söz değiştirilemez; yeni söz için yeni SOS (sürtünme kasıtlı).
- SOS açılışları `driftstop:sosLog`'a yazılır (`{ at, quoteId }[]`, cap 100) — ileride haftalık
  özete "3 kez SOS'a bastın, 3'ünde de devam ettin" satırı için (bu dalgada yalnızca log, gösterim yok).
- SOS'ta reklam/interstitial ASLA tetiklenmez (kriz anında reklam = silme sebebi) — Home'daki
  interstitial sayacı (`index.tsx:64`) SOS navigasyonunu saymamalı.

- [ ] `src/app/sos.tsx` (yeni route, `presentation: 'fullScreenModal'`, geri jesti kapalı değil):
      nefes perdesi (opacity animasyonu, `react-native-reanimated` zaten projede) → söz →
      "Devam ediyorum" Sketch butonu → `router.back()`. Havuz seçimi: `getQuotesByThemes(['reckoning','discipline'])`
      + son 20 SOS sözünü dışla (`sosLog`'dan).
- [ ] Giriş 1 — Home: başlık hattına (ayar dişlisinin karşısına; yerleşim `ux-designer`) küçük ama
      ayırt edilir bir SOS öğesi. Kopya "SOS" değil `home.sosLabel` = "Vazgeçmek üzereyim" (uzun
      basma gerektirmez, tek dokunuş).
- [ ] Giriş 2 — Widget: W0.b onaylıysa `DriftStopWidget`'a ikinci tıklama bölgesi (alt şerit):
      `clickAction` → `driftstop://sos`. `app.json`'daki deep link şeması zaten `driftstop://` —
      route eklemek yeterli. W0.b olumsuzsa bu madde düşer, widget tek tıklamalı kalır (spec'e sonuç işlenir).
- [ ] Giriş 3 (opsiyonel, ayrı PR): `expo-quick-actions` ile uygulama ikonuna uzun basınca "SOS"
      kısayolu. Yeni bağımlılık kararı sahibe sorulmaz ama `package.json`'a giren her paket
      `code-reviewer`'da gerekçelendirilir; W2.2'nin kabulü buna bağlı değil.
- [ ] Interstitial koruması: `index.tsx`'teki sayaç yalnızca Home içi gezinmeleri saymaya devam
      ettiğini testle sabitle (SOS ayrı route olduğu için doğal olarak saymaz — yine de regresyon testi yaz).
- [ ] **i18n:** `sos.*` (pauseLine "Dur.", continueButton "Devam ediyorum", title) + `home.sosLabel` × 8 dosya.
- [ ] **Testler:** havuz filtresi (tag'ler + son-20 dışlama, boş kalırsa dışlamayı bırak);
      sosLog cap 100.
- [ ] **Cihaz QA:** Home'dan SOS → perde → söz → geri; widget'tan SOS (uygulama kapalıyken) →
      doğrudan SOS ekranı; arka arkaya 5 SOS'ta tekrar söz yok; SOS gezintisi interstitial saydırmıyor.

**Kabul kriteri:** Kullanıcı krize bastığında iki dokunuş içinde tam ekran tek sert sözle karşılaşır;
akışta reklam yoktur; SOS bir feed'e dönüşemez (tek söz, değiştirilemez).

---

## W3.1 — Sertlik ayarı (L — içerik işi ağır basar)

**Neden:** "These words aren't for you" diyen ürünün kullanıcısına *sakin bilge → sert → acımasız*
ekseni sunmak hem doğru beklenti yönetimi hem bir yatırım anı (ayar yapmak bağlılıktır).

**Ön koşul — içerik etiketleme (işin %70'i):** 1000 söze `intensity: 1 | 2 | 3` alanı. Kural:
metin ÜRETİLMEZ (TODO.md'deki içerik ilkesi), yalnızca mevcut metin ETİKETLENİR — bu ilkeyi ihlal etmez.

- [ ] `scripts/tag-intensity.mjs` (yeni): sözleri sinyallere göre ön-etiketler (emir kipi, olumsuzlama
      yoğunluğu, tema — `reckoning` ağırlıklı 3'e, `legacy` 1-2'ye yatar) ve `intensity-review.csv`
      üretir (id, metin, öneri). **Otomatik etiket doğrudan yayınlanmaz.**
- [ ] CSV'nin sahip tarafından gözden geçirilmesi — 1000 satırın tamamı değil: script güven skoru
      düşük ~150-200 satırı ayrı işaretler, sahip yalnızca onları okur. Onay gelmeden sonraki
      maddeler başlamaz. **(Sahip aksiyonu — bloklayıcı.)**
- [ ] Onaylı etiketler `src/data/quotes.json`'a işlenir (`intensity` alanı); `src/types/quote.ts`'e
      alan eklenir; doğrulama testi: 1000/1000 sözde `intensity ∈ {1,2,3}`.
- [ ] `Settings.intensity: 'calm' | 'hard' | 'brutal' | null` (varsayılan `null` = filtre yok),
      `SCHEDULE_KEYS`'e eklenir. Eşleme: calm→{1,2}, hard→{2,3}, brutal→{3} (kesişimli — havuzlar
      dar kalmasın).
- [ ] `applySchedule` havuz kurulumu: tema filtresinden SONRA sertlik filtresi; sonuç < 100 söz ise
      sertlik filtresi gevşetilir (bir alt kademeye düşer, yine azsa kapanır) — kullanıcıya sessizce
      bozuk deneyim verilmez, Settings'te "seçimin havuzu daraltıyor" ipucu gösterilir.
- [ ] Settings UI: tema bölümünün yanına 3 chip (`ThemeChips` deseni) + `settings.intensity.*` kopyaları.
      SOS her zaman en sert havuzdan çeker, bu ayardan etkilenmez (kriz anı istisnası, W2.2 kararı).
- [ ] **i18n:** `settings.intensity.*` (label, calm, hard, brutal, hint, narrowPoolHint) × 8 dosya.
- [ ] **Testler:** filtre eşlemeleri; <100 gevşeme zinciri; null davranışı; merge testi (eski settings).
- [ ] **Cihaz QA:** brutal seç → planlanan 30 bildirimin gövdelerini dökümden örnekle, ton tutuyor mu
      (öznel ama bakılmadan geçilmez); dar tema + brutal → uygulama plan üretmeye devam ediyor.

**Kabul kriteri:** Sertlik seçimi bildirim havuzunu görünür biçimde değiştirir; hiçbir kombinasyonda
plan üretimi durmaz; etiketler sahip onayından geçmiştir.

---

## W3.2 — Akıllı zamanlama (M)

**Neden:** Hangi saatlerdeki bildirimlerin okunduğu cihazda zaten biliniyor (W1.4'ün `engagementLog`'u).
Rastgele saatleri okunan saatlere hafifçe yaklaştırmak, aynı bildirim sayısından daha çok temas üretir.
Tamamen yerel, hiçbir veri cihazdan çıkmaz.

**Ön koşul:** W1.4 sahada ve `engagementLog`'da ≥ 20 kayıt (yaklaşık 2-3 hafta gerçek kullanım).

- [ ] `src/utils/timeUtils.ts` — `generateWeightedTimes(startMin, endMin, count, minGap, weights)`:
      mevcut `generateRandomTimes`'ın üstüne kurulur; `weights` = saat başına etkileşim yoğunluğu
      (log'dan histogram, komşu saatlere ±1 saat yumuşatma). Karışım sabit: **%70 uniform + %30
      ağırlıklı** (`SMART_TIMING_MIX = 0.3`) — "beklenmedik an" vaadi ölmesin, tamamen tahmin
      edilebilir hale gelmesin. Pencere ve `MIN_GAP` kuralları aynen geçerli; mevcut daralma/yarılama
      fallback zinciri korunur.
- [ ] `src/utils/engagement.ts` (yeni): `hourWeights(log)` saf fonksiyon + `pruneEngagementLog`
      (90 gün). Kayıt sayısı < 20 ise `null` döner → scheduler düz `generateRandomTimes`'a düşer.
- [ ] `Settings.smartTiming: boolean` (varsayılan `true`), `SCHEDULE_KEYS`'e ekle; Settings'te toggle
      (`settings.smartTiming.label` = "Saatlerimi öğren", hint = "Seni en çok sarstığımız saatleri
      öğrenip oralara ağırlık veririz. Kapatırsan tamamen rastgele.").
- [ ] `applySchedule` — `settings.smartTiming && weights` ise ağırlıklı üreteci kullan.
- [ ] **Testler:** histogram/yumuşatma; <20 kayıtta null; ağırlıklı üretimde MIN_GAP ve pencere
      ihlali yok (1000 iterasyonlu property testi); %30 karışım istatistiksel olarak ölçülüyor
      (tohumlanmış Math.random mock'u ile deterministik).
- [ ] **Cihaz QA:** log'a elle 30 kayıt bas (dev flag), planı yeniden kur → saat dağılımının
      ağırlık merkezine kaydığını dökümden doğrula; toggle kapat → dağılım düz.

**Kabul kriteri:** Yeterli veri olduğunda bildirim saatleri kullanıcının okuduğu saatlere doğru
ölçülü biçimde kayar; kullanıcı bunu tek toggle ile kapatabilir; hiçbir veri cihaz dışına çıkmaz
(gizlilik politikasına dokunmayı gerektirmez — yine de release notunda `release-manager` teyit eder).

---

## W3.3 — Özel bildirim sesi (S kod / M süreç)

**Neden:** Bütün temas anları varsayılan sesle geliyor; kısa, tanınabilir, hafif rahatsız edici bir
DriftStop sesi telefona bakılmadan "bu o" dedirtir. Kod küçük, süreç tuzaklı — o yüzden ayrı iş.

**Kritik tuzaklar (bu yüzden release ile hizalanır):**
1. **Android'de kanal sesi kanal oluşturulduktan sonra DEĞİŞTİRİLEMEZ.** Mevcut
   `driftstop_motivation` kanalına ses eklenemez; yeni kanal id (`driftstop_motivation_v2`) açılır,
   eski kanal `deleteNotificationChannelAsync` ile silinir (kullanıcının eski kanal ayarları
   — susturma dahil — kaybolur; release notunda söylenir).
2. **CNG rebuild gerekir:** ses dosyası `expo-notifications` config plugin'i ile native'e gömülür —
   mevcut dev client'ta test EDİLEMEZ, yeni dev client + yeni store build ister.

- [ ] Ses varlığı: ~1 sn, .wav, telifsiz/özgün. Sahip seçer ya da yaptırır — **sahip aksiyonu,
      bloklayıcı**. Aday: tek kalem vuruşu/kâğıt hışırtısı (el çizimi görsel kimlikle akraba).
- [ ] `assets/sounds/driftstop.wav` + `app.json` → `["expo-notifications", { "sounds": ["./assets/sounds/driftstop.wav"] }]`
      (plugin zaten listede mi kontrol et; değilse ekle — v56 dokümanından sözdizimi teyidi).
- [ ] `setupAndroidChannel` → `driftstop_motivation_v2` (`sound: 'driftstop.wav'`), ardından eski
      kanalı sil. `NOTIFICATION_CHANNEL_ID` sabitini güncelle — trial kanalı DOKUNULMAZ.
      Hesaplaşma (W1.3) aynı kanalda olduğundan otomatik aynı sesi alır.
- [ ] iOS: bildirim içeriğine `sound: 'driftstop.wav'` (kanal kavramı yok, içerik başına) —
      scheduler'daki "sound belirtilmedi" yorumunu güncelle (`scheduler.ts:54` ve `:165` yorumları).
- [ ] Yeni dev client build → emülatörde ses geliyor mu; sessiz moda saygı duyuyor mu.
- [ ] `release-manager` maddesi: bu değişiklik hangi store sürümüne biniyorsa onun release notunda
      kanal sıfırlama uyarısı; `OPERATIONS.md` release bölümüne kanal-göçü notu.

**Kabul kriteri:** Yeni build'de günlük söz ve hesaplaşma bildirimleri DriftStop sesiyle gelir;
trial bildirimleri etkilenmez; kanal göçü kullanıcı görünür bir hataya yol açmaz.

---

## Yapılmayacaklar (bilinçli, tartışması kapanmış)

- **"Next" butonu / sınırsız söz çekme** — hiçbir dalgada yok. "Bir tane daha" günde 2 ile,
  SOS tek sözle sınırlı; ikisi de feed'e evrilmeyecek şekilde tasarlandı.
- **Sunucu tarafı hiçbir şey** — bu dokümandaki her özellik %100 yerel. Cross-device sync
  (Faz 5) bu dalganın işi değil; kasadaki mesajlar ve hesaplaşma logu sync geldiğinde
  taşınacak veri listesine eklenir (o spec yazılırken buraya bakılsın).
- **Makine üretimi söz/çeviri** — W3.1 yalnızca etiketler, metin üretmez.
- **Fiyat/paket değişikliği** — kasanın Pro kapısı mevcut Pro'ya değer ekler; yeni ürün/fiyat
  kararı gerekirse sahibe sorulur (bkz. hafıza kuralı: fiyat asla tek taraflı belirlenmez).

## Riskler ve açık sorular

| Risk | Etki | Paratoner |
|---|---|---|
| W0.a olumsuz (aksiyonlar headless çalışmaz) | W1.3/W1.4 UX'i bir tık ağırlaşır | Her iki özellikte fallback tasarımı baştan yazıldı; kabul kriterleri fallback'le de sağlanır |
| Bildirim sayısı artışı (hesaplaşma + kasa + bir-tane-daha) rahatsızlık üretir | Uninstall | Hesaplaşma toggle'lı; kasa söz kotasından slot ÇALAR (net artış 0); bir-tane-daha kullanıcı talebiyle ve ≤2 |
| `applySchedule` büyüyor (hesaplaşma + kasa + ağırlık + sertlik) | Bakım/regresyon | Her dalgada scheduler testleri büyür; W2.1 bitince `applySchedule` alt fonksiyonlara bölünür (`buildQuoteSlots`, `buildReckoningSlots`, `injectVaultMessages`) — refactor W2.1'in tanımına dahildir |
| Sertlik etiketleri öznel | Yanlış beklenti | Sahip onayı zorunlu adım; düşük güvenli etiketler ayrıca işaretli |
| iOS'ta bu özellikler test edilmeden Android'e biner | Platform sapması | Her cihaz-QA maddesi Android emülatör + iOS simülatörde koşulur (qa-tester'ın standart çifti) |

## Sıradaki adım

W0 spike'ları (yarım gün) → sonuçlar bu dokümana işlenir → W1.1 + W1.2 tek PR-çiftinde paralel
başlar (`project-manager` işleri açar). W1 bittiğinde bir sonraki store sürümüne girer; W3.3 o
sürümle hizalanmak isterse ses varlığı kararı sahipten erken istenir.
