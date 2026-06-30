// Özel giriş noktası: Android widget task handler'ı expo-router yüklenmeden ÖNCE kaydeder.
// (Headless widget güncellemelerinin çalışması için gerekli.)
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);

require('expo-router/entry');
