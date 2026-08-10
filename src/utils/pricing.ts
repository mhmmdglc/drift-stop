/**
 * Paywall fiyat aritmetiği.
 *
 * Buradaki HİÇBİR rakam sabit değil ve olamaz: fiyatlar mağazada ülkeye göre
 * ayrı ayrı belirleniyor (Türkiye'de aylık ₺229.99 — doların kuru değil), yani
 * ekrana gömülecek bir "yılda $47.88" dünyanın çoğu için düpedüz yanlış bilgi
 * olurdu. Tek kaynak RevenueCat'in döndürdüğü sayısal `product.price` ve
 * `product.currencyCode`.
 *
 * `priceString` ASLA ayrıştırılmaz: yerelleştirilmiş bir metindir ("2.759,88 ₺",
 * "¥600", "US$3.99") — ayırıcıları, sembol yeri ve ondalık basamak sayısı
 * para birimine göre değişir, güvenilir biçimde sayıya çevrilemez.
 *
 * Not: bu modül bilerek `react-native-purchases`'ı import ETMEZ. Paketleri
 * seçmek (PACKAGE_TYPE) ekranın işi; burası saf aritmetik kalsın ki native
 * modül olmadan test edilebilsin.
 */

const MONTHS_PER_YEAR = 12;
/** Mağazaların "haftalık" hesabında kullandığı kaba yıl uzunluğu. */
const WEEKS_PER_YEAR = 52;

/** Bir mağaza ürününden ihtiyacımız olan tek şey. */
export type PricedProduct = {
  price: number;
  currencyCode: string;
};

export type AnnualComparison = {
  /** Aynı süre aylık ödenseydi çıkacak toplam — üstü çizili gösterilir. */
  annualizedMonthly: string;
  /** AŞAĞI yuvarlanmış tasarruf yüzdesi; her zaman >= 1. */
  savingPercent: number;
  /** Yüzdenin yerelleştirilmiş yazımı: "%24" (tr), "24%" (en), "24 %" (fr). */
  savingPercentText: string;
};

export type PaywallPricing = {
  monthlyPerWeek: string | null;
  annualPerWeek: string | null;
  annualPerMonth: string | null;
  /** Sadece HEM aylık HEM yıllık paket varken ve yıllık gerçekten ucuzken dolu. */
  comparison: AnnualComparison | null;
};

/**
 * Mağazanın para birimiyle biçimlendirir; böylece Türk kullanıcı ₺ ve doğru
 * ayırıcıları görür. Ondalık basamak sayısını da para birimi belirler
 * (USD 2, JPY 0) — bunu elde hesaplamıyoruz.
 *
 * Yedek yol neden var: Hermes'in `Intl` desteği platforma ve derlemeye göre
 * değişiyor; `style: 'currency'` bazı derlemelerde hata atıyor, `Intl`in kendisi
 * hiç bulunmayabiliyor. Öyle bir durumda yaklaşık bir sembol UYDURMAK yerine
 * ISO kodunu dürüstçe yazıyoruz ("47.88 USD").
 */
export function formatMoney(amount: number, currencyCode: string, locale: string): string {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
    // Sessizce bozuk bir Intl (rakamsız/boş çıktı) yedeğe düşsün.
    if (typeof formatted === 'string' && /\d/.test(formatted)) return formatted;
  } catch {
    // yedeğe düş
  }
  return `${amount.toFixed(2)} ${currencyCode}`;
}

/**
 * Yüzde işaretinin yeri dile göre değişiyor (tr "%24", en "24%", fr "24 %").
 * Bunu çeviri metnine gömemiyoruz: i18n-js'in yer tutucu deseni hem `{{x}}`
 * hem `%{x}` kabul ettiği için Türkçedeki "%{{percent}}" yazımı yer tutucuyu
 * bozup "[missing … value]" bastırıyor. Dolayısıyla yazımı `Intl` belirliyor,
 * çeviri dosyaları sadece hazır metni yerleştiriyor.
 */
export function formatPercent(percent: number, locale: string): string {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(percent / 100);
    if (typeof formatted === 'string' && /\d/.test(formatted)) return formatted;
  } catch {
    // yedeğe düş
  }
  return `${percent}%`;
}

function usable(product: PricedProduct | null | undefined): product is PricedProduct {
  return (
    !!product &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    typeof product.currencyCode === 'string' &&
    product.currencyCode.length > 0
  );
}

function buildComparison(
  monthly: PricedProduct | null,
  annual: PricedProduct | null,
  locale: string
): AnnualComparison | null {
  // Karşılaştırma için taban gerekiyor: aylık paket yoksa uyduramayız.
  if (!monthly || !annual) return null;
  // Farklı para birimindeki iki fiyat karşılaştırılamaz (kur bilmiyoruz).
  if (monthly.currencyCode !== annual.currencyCode) return null;

  const annualized = monthly.price * MONTHS_PER_YEAR;
  // Yanlış fiyatlanmış bir teklifte yıllık ucuz olmayabilir; o zaman negatif ya
  // da sıfır "indirim" göstermek yerine hiçbir şey göstermiyoruz.
  if (annual.price >= annualized) return null;

  // AŞAĞI yuvarlıyoruz: %24.8'e "%25" demek pazarlama yalanı, "%24" sadece
  // temkinli.
  const savingPercent = Math.floor(((annualized - annual.price) / annualized) * 100);
  if (savingPercent < 1) return null;

  return {
    annualizedMonthly: formatMoney(annualized, monthly.currencyCode, locale),
    savingPercent,
    savingPercentText: formatPercent(savingPercent, locale),
  };
}

/**
 * Paywall'da gösterilecek türetilmiş fiyatlar. Eksik paket = null alan;
 * çağıran taraf null'ı "gösterme" diye okur, asla varsayılan uydurmaz.
 */
export function buildPaywallPricing(
  monthly: PricedProduct | null | undefined,
  annual: PricedProduct | null | undefined,
  locale: string
): PaywallPricing {
  const m = usable(monthly) ? monthly : null;
  const a = usable(annual) ? annual : null;

  return {
    monthlyPerWeek: m
      ? formatMoney((m.price * MONTHS_PER_YEAR) / WEEKS_PER_YEAR, m.currencyCode, locale)
      : null,
    annualPerWeek: a ? formatMoney(a.price / WEEKS_PER_YEAR, a.currencyCode, locale) : null,
    annualPerMonth: a ? formatMoney(a.price / MONTHS_PER_YEAR, a.currencyCode, locale) : null,
    comparison: buildComparison(m, a, locale),
  };
}
