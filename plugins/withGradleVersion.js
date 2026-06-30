/**
 * Config plugin: Gradle wrapper sürümünü sabitler.
 * Neden: Expo SDK 56 prebuild'i Gradle 9.3.1 üretiyor ama proje AGP 8.12 kullanıyor;
 * AGP 8, Gradle 9'u desteklemiyor (JvmVendorSpec.IBM_SEMERU hatası).
 * Bu plugin her prebuild'de (lokal + EAS bulut) wrapper'ı 8.13'e çeker.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GRADLE_VERSION = '8.13';

module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const patched = content.replace(
          /gradle-[\d.]+-(bin|all)\.zip/,
          `gradle-${GRADLE_VERSION}-bin.zip`
        );
        fs.writeFileSync(file, patched);
      }
      return cfg;
    },
  ]);
};
