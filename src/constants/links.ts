import { Platform } from 'react-native';

/**
 * Dış bağlantılar — canlıya almadan önce kullanıcı dolduracak.
 * Boş bırakılırsa ilgili ayar satırı "Yakında" gösterir.
 */

/**
 * Apple'ın standart EULA'sı.
 *
 * App Store Connect'teki özel EULA alanı BOŞ, yani bu uygulama için geçerli
 * sözleşme tam olarak budur — uydurma bir "koşullar" sayfasına link vermek
 * hem yanlış hem gereksiz olurdu.
 *
 * Neden gerekli: Kılavuz 3.1.2, otomatik yenilenen abonelik satan bir
 * uygulamanın **binary'sinin içinde** hem gizlilik politikasına hem kullanım
 * koşullarına çalışan bir bağlantı bulundurmasını istiyor. Fiyat ve dönem
 * zaten paywall'da yazıyordu; eksik olan bu ikiliydi.
 */
const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export const Links = {
  // Google Play uygulama sayfası (yayından sonra)
  rateAndroid: '',
  // Gizlilik politikası URL'i (AdMob için Play zorunlu)
  privacyPolicy: 'https://mgulcu.me/driftstop/privacy',
  /**
   * Kullanım koşulları — yalnızca iOS'ta bir karşılığı var.
   *
   * Android'de bilerek boş: Play böyle bir bağlantı istemiyor ve Android
   * kullanıcısını Apple'ın EULA'sına göndermek düpedüz yanlış bilgi olurdu.
   * Boş değer, bağlantıyı gösteren yerlerde satırı gizliyor.
   */
  termsOfUse: Platform.OS === 'ios' ? APPLE_STANDARD_EULA : '',
} as const;
