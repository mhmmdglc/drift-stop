import { I18n } from 'i18n-js';

import ar from '@/locales/ar.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import it from '@/locales/it.json';
import ja from '@/locales/ja.json';
import tr from '@/locales/tr.json';

/**
 * Desteklenen diller. available:true olanlar tam çevrili ve seçilebilir.
 * available:false olanlar dil seçicide görünür ama "Yakında".
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', available: true },
  { code: 'en', name: 'English', available: true },
  { code: 'es', name: 'Español', available: true },
  { code: 'de', name: 'Deutsch', available: true },
  { code: 'fr', name: 'Français', available: true },
  { code: 'it', name: 'Italiano', available: true },
  { code: 'ar', name: 'العربية', available: false },
  { code: 'ja', name: '日本語', available: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const AVAILABLE_LANGUAGE_CODES = SUPPORTED_LANGUAGES.filter((l) => l.available).map(
  (l) => l.code
) as LanguageCode[];

const i18n = new I18n({ tr, en, es, de, fr, it, ar, ja });

i18n.locale = 'tr'; // başlangıç; SettingsProvider ayara göre günceller
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

export default i18n;
