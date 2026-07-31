/** Supabase `quote_packs` tablosunun istemci karşılığı. Faz 4 — premium içerik paketleri. */
export type QuotePack = {
  id: string;
  /** Dil koduna göre isim, ör. { tr: '...', en: '...' }. Eksik dilde `tr` veya `en`'e düşülür. */
  name: Record<string, string>;
  description: Record<string, string> | null;
  coverImageUrl: string | null;
  isPremium: boolean;
  sortOrder: number;
  /** Paketteki gerçek söz sayısı (herkese açık metadata — içerik değil). */
  quoteCount: number;
};

/** `QuotePack.name`/`description` gibi çok dilli jsonb alanlarından güvenli okuma. */
export function localizedPackField(
  field: Record<string, string> | null | undefined,
  locale: string
): string {
  if (!field) return '';
  const lang = locale.split('-')[0];
  // Yedek sırası locale → EN → TR. Eskiden TR, EN'den önceydi: Türk kullanıcı
  // zaten ilk adımda eşleştiği için o yedek yalnızca Türkçe BİLMEYEN kullanıcıda
  // devreye giriyordu — es/de/fr/it kullanıcıları paket başlıklarını Türkçe
  // görüyor, söz gövdelerini İngilizce görüyordu. İngilizce evrensel yedek.
  return field[lang] ?? field.en ?? field.tr ?? Object.values(field)[0] ?? '';
}
