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

require('expo-router/entry');
