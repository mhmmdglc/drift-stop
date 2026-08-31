/**
 * Config plugin: widget'ı Android kilit ekranında da gösterilebilir yapar.
 *
 * Google, kilit ekranı widget'larını **Android 16 QPR2** ile telefonlara geri getirdi ve
 * modeli "opt-out" olarak tanımlıyor: widget'lar varsayılan olarak uygun, istemeyen uygulama
 * kategorisine `not_keyguard` ekliyor. Ama `react-native-android-widget` üretilen
 * `widgetprovider_*.xml` dosyasına `android:widgetCategory="home_screen"` değerini **sabit**
 * yazıyor ve bunu yapılandırmaya açmıyor (bkz. lib/typescript/config-plugin.type.d.ts —
 * `Widget` arayüzünde widgetCategory alanı yok).
 *
 * Bu plugin kategoriyi `home_screen|keyguard` yapıyor. İki sebeple:
 *  1. Niyeti açıkça beyan ediyor; "opt-out varsayılanına" güvenmiyoruz.
 *  2. `keyguard` bayrağı Android 4.2'den beri var (5.0'da kilit ekranı kaldırılınca
 *     kullanımdan kalkmıştı). OEM arayüzleri (One UI, OxygenOS…) kilit ekranı widget'ını
 *     kendi akışlarıyla uyguluyor; eski opt-in bayrağını arayan bir cihaz varsa onu da
 *     memnun ediyoruz. Bayrağın fazladan olması home_screen davranışını etkilemiyor.
 *
 * ⚠️ Kütüphane güncellenip `widgetCategory`'yi kendi yapılandırmasına eklerse bu plugin
 * gereksiz hale gelir — o zaman kaldırılmalı.
 *
 * ⚠️ SIRALAMA ÖNEMLİ: bu plugin `app.json` içindeki `plugins` dizisinde **en başta** durmalı.
 * Expo mod zincirinde son eklenen mod ÖNCE çalışır; yani dizide en başta olan en SON koşar.
 * `react-native-android-widget`'ten sonraya koyduğumuzda XML henüz yazılmamış oluyor ve
 * yama sessizce hiçbir şey yapmıyordu.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CATEGORY = 'home_screen|keyguard';

module.exports = function withLockScreenWidget(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      if (!fs.existsSync(dir)) return cfg;

      for (const file of fs.readdirSync(dir)) {
        if (!file.startsWith('widgetprovider_') || !file.endsWith('.xml')) continue;
        const full = path.join(dir, file);
        const content = fs.readFileSync(full, 'utf8');
        const patched = content.replace(
          /android:widgetCategory="[^"]*"/,
          `android:widgetCategory="${CATEGORY}"`
        );
        if (patched !== content) fs.writeFileSync(full, patched);
      }
      return cfg;
    },
  ]);
};
