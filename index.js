// Özel giriş noktası: Android widget task handler'ı expo-router yüklenmeden ÖNCE kaydeder.
// (Headless widget güncellemelerinin çalışması için gerekli.)
// iOS'ta react-native-android-widget'ın native modülü yok — import güvenli ama
// register çağrısı yapılmamalı, bu yüzden platform kontrolüyle sarıldı.
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

// Bildirim aksiyon butonlarının (hesaplaşma + W1.4 söz aksiyonları) headless
// işleyicisi (W0.a/W1.3/W1.4). `expo-task-manager`in kendisi TaskManager.defineTask'ı
// router yüklenmeden ÖNCE modül kapsamında ister — aksi halde OS'un tetiklediği bir
// aksiyon dokunuşunun çağıracağı görev tanımlı olmaz.
//
// `require()`'ın KENDİSİ try/catch'e sarılı: `expo-task-manager` paketinin JS'i
// kendi native modülünü (`requireNativeModule('ExpoTaskManager')`) MODÜL KAPSAMINDA,
// import edilir edilmez okuyor — native taraf henüz derlenmemiş bir dev client'ta
// (bu, yeni eklenen bir native bağımlılık; CNG rebuild ister) bu senkron olarak
// fırlıyor ve `notificationTaskHandler.ts` içindeki `nativeFeaturesAvailable` guard'ı
// bu noktaya hiç ulaşmadan uygulamayı çöktürüyordu (qa-tester'da gözlendi — burada
// sarmalamak `widget-task-handler` deseninden farklı çünkü o paketin native modülü
// yalnızca ÇAĞRI anında (register), IMPORT anında değil erişiliyor).
try {
  require('./src/utils/notificationTaskHandler');
} catch {
  // Native modül linklenmemiş (Expo Go veya rebuild edilmemiş dev client) —
  // sessizce geç. W0.a fallback (`getLastNotificationResponseAsync`,
  // `useNotifications.ts`) hesaplaşma/söz cevaplarını yine de yakalar.
}

require('expo-router/entry');
