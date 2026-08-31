/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'DriftStopQuote',
  displayName: 'DriftStop',
  // Ana uygulamanın bundle id'sine eklenir: com.driftstop.app.quote
  bundleIdentifier: '.quote',
  icon: '../../assets/images/icon.png',
  frameworks: ['SwiftUI', 'WidgetKit'],
  // Kilit ekranı widget'ları (accessoryRectangular) iOS 16'da geldi.
  deploymentTarget: '16.0',
  // App Group, uygulama ile eklenti arasındaki TEK veri yolu. Ana uygulamanınkiyle
  // birebir aynı olmak zorunda — eşleşmezse eklenti sessizce boş okur.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [],
  },
  colors: {
    $accent: '#C8923A',
    $widgetBackground: { light: '#F2EDD8', dark: '#1C1A16' },
  },
});
