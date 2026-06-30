export const QUOTE_CATEGORIES = [
  'resilience',
  'fire',
  'discipline',
  'regret',
  'wisdom',
  'identity',
  'suffering',
  'legacy',
] as const;

export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

export const QUOTE_ERAS = ['ancient', 'medieval', 'modern', 'contemporary'] as const;

export type QuoteEra = (typeof QUOTE_ERAS)[number];

/**
 * Kullanıcıya gösterilen TEMA tag'leri (çoklu). Bir söz birden çok tema taşıyabilir.
 * Onboarding'de kullanıcı bunlardan seçer; sözler buna göre filtrelenir.
 */
export const QUOTE_TAGS = [
  'motivation', // Motivasyon — ateş, harekete geç
  'discipline', // Disiplin — irade, düzen
  'resilience', // Dayanıklılık — pes etme, ayağa kalk
  'focus', // Odak — dağılma, işine dön
  'wisdom', // Bilgelik — hikmet, derin görüş
  'peace', // Huzur — kabul, içsel sükunet (stoik)
  'reckoning', // Yüzleşme — pişmanlık, acı, sert gerçek
  'legacy', // Miras — ölümlülük, geride bırakılan
] as const;

export type QuoteTag = (typeof QUOTE_TAGS)[number];

export type Quote = {
  id: number;
  /** Orijinal / İngilizce metin */
  text: string;
  /** Türkçe çeviri (tüm sözlerde dolu) */
  textTr: string;
  author: string;
  origin: string;
  originEmoji: string;
  category: QuoteCategory;
  era: QuoteEra;
  /** Tema tag'leri (en az 1). */
  tags: QuoteTag[];
};
