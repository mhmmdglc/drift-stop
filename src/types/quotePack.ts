/** Supabase `quote_packs` tablosunun istemci karşılığı. Faz 4 — premium içerik paketleri. */
export type QuotePack = {
  id: string;
  /** Dil koduna göre isim, ör. { tr: '...', en: '...' }. Eksik dilde `tr` veya `en`'e düşülür. */
  name: Record<string, string>;
  description: Record<string, string> | null;
  coverImageUrl: string | null;
  isPremium: boolean;
  sortOrder: number;
};

/** `QuotePack.name`/`description` gibi çok dilli jsonb alanlarından güvenli okuma. */
export function localizedPackField(
  field: Record<string, string> | null | undefined,
  locale: string
): string {
  if (!field) return '';
  const lang = locale.split('-')[0];
  return field[lang] ?? field.tr ?? field.en ?? Object.values(field)[0] ?? '';
}
