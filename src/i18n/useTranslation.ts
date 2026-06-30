import { useCallback } from 'react';

import { useSettings } from '@/hooks/useSettings';
import i18n from './index';

/**
 * Aktif dili ayarlardan okur; dil değişince bu hook'u kullanan bileşenler
 * yeniden render olur. i18n.locale de senkron tutulur.
 */
export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  if (i18n.locale !== locale) {
    i18n.locale = locale;
  }
  const t = useCallback(
    (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
    [locale]
  );
  return { t, locale };
}
