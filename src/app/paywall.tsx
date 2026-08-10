import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/PaperBackground';
import { SketchStrike } from '@/components/SketchStrike';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Spacing } from '@/constants/layout';
import { Links } from '@/constants/links';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { usePurchases } from '@/hooks/usePurchases';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { buildPaywallPricing } from '@/utils/pricing';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Boş URL'i hiç açmaya kalkma — `Linking.openURL('')` sessizce reddediliyor. */
function openLink(url: string) {
  if (!url) return;
  void Linking.openURL(url);
}

function packageLabel(pkg: PurchasesPackage, t: Translate): { label: string; hint: string | null } {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.LIFETIME:
      return { label: t('paywall.packages.lifetimeLabel'), hint: t('paywall.packages.lifetimeHint') };
    case PACKAGE_TYPE.ANNUAL:
      return { label: t('paywall.packages.annualLabel'), hint: t('paywall.packages.annualHint') };
    case PACKAGE_TYPE.MONTHLY:
      return { label: t('paywall.packages.monthlyLabel'), hint: null };
    default:
      return { label: pkg.product.title, hint: null };
  }
}

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  // Satın alma eylemleri `usePurchases`ten; "hakkı var mı" sorusu `useEntitlement`ten.
  // Denemedeki kullanıcıya paketler GÖSTERİLMELİ — dönüştürmek istediğimiz kişi o.
  const { configured, loading, offering, purchasePackage, restorePurchases } = usePurchases();
  const { user, configured: authConfigured } = useAuth();
  const { source, trialDaysLeft, isSubscribed, isAdsRemoved } = useEntitlement();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'accent' | 'fire' } | null>(null);

  const buy = async (pkg: PurchasesPackage) => {
    setBusyId(pkg.identifier);
    setMessage(null);
    const result = await purchasePackage(pkg);
    setBusyId(null);
    if (result.cancelled) return;
    if (result.error) {
      setMessage({ text: t('paywall.errors.generic'), tone: 'fire' });
      return;
    }
    // Tek bir "reklamlar kapandı" mesajı HER satın almada gösteriliyordu — Pro
    // abone olan kullanıcıya daha ucuz ürünün onayını vermek yanlış bilgi.
    //
    // Misafire ayrı bir onay veriliyor çünkü onun için iş bitmiyor: premium
    // sözler RLS gereği yalnızca oturum açmış kullanıcıya dönüyor
    // (bkz. services/quotesSync.ts). Bunu söylemezsek kullanıcı ödeme yapıp
    // paketleri açık görüyor, içeri girince sonsuza kadar "senkronize ediliyor"
    // yazısıyla kalıyor — sattığımız şeyin ta kendisi eksik kalıyor.
    const proMessage =
      authConfigured && !user
        ? t('paywall.purchaseSuccessProGuest')
        : t('paywall.purchaseSuccessPro');
    setMessage({
      text:
        pkg.packageType === PACKAGE_TYPE.LIFETIME
          ? t('paywall.purchaseSuccessAdsRemoved')
          : proMessage,
      tone: 'accent',
    });
  };

  const restore = async () => {
    setRestoring(true);
    setMessage(null);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.error) {
      setMessage({ text: t('paywall.errors.generic'), tone: 'fire' });
      return;
    }
    setMessage({ text: t('paywall.restoreSuccess'), tone: 'accent' });
  };

  const packages = offering?.availablePackages ?? [];
  // Türetilmiş fiyatların tamamı mağazadan gelen sayılardan hesaplanıyor;
  // paket eksikse ilgili alan null döner ve o satırda hiçbir şey gösterilmez.
  const monthlyProduct = packages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY)?.product;
  const annualProduct = packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL)?.product;
  const pricing = useMemo(
    () => buildPaywallPricing(monthlyProduct, annualProduct, locale),
    [monthlyProduct, annualProduct, locale]
  );

  const restoreDisabled = restoring || !configured;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.skip')}>
            <ThemedText variant="label" tone="textMuted">
              {t('paywall.skip')}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <ThemedText variant="heading">{t('paywall.title')}</ThemedText>
          {/* Eski `paywall.subtitle` (özellik cümlesi) burada DEĞİL: iki paragraf
              üst üste binince planlar ekranın altına kaçıyordu. Somut liste
              hemen aşağıdaki tek satırlık `proFeatures`ta duruyor. */}
          <ThemedText variant="body" style={styles.intro}>
            {t('paywall.intro')}
          </ThemedText>
          <ThemedText variant="label" tone="textMuted">
            {t('paywall.packages.proFeatures')}
          </ThemedText>

          {source === 'trial' && (
            <ThemedText variant="label" tone="accent">
              {trialDaysLeft <= 1
                ? t('trial.lastDay')
                : t('trial.activeBadge', { count: trialDaysLeft })}
            </ThemedText>
          )}

          {isSubscribed ? (
            <ThemedText variant="body" tone="accent" style={styles.stateMsg}>
              {t('paywall.alreadyPro')}
            </ThemedText>
          ) : isAdsRemoved ? (
            <ThemedText variant="body" tone="accent" style={styles.stateMsg}>
              {t('paywall.alreadyAdsRemoved')}
            </ThemedText>
          ) : !configured ? (
            <ThemedText variant="body" tone="fire" style={styles.stateMsg}>
              {t('paywall.errors.notConfigured')}
            </ThemedText>
          ) : loading ? (
            <ThemedText variant="body" tone="textMuted" style={styles.stateMsg}>
              {t('common.loading')}
            </ThemedText>
          ) : packages.length === 0 ? (
            <ThemedText variant="body" tone="fire" style={styles.stateMsg}>
              {t('paywall.errors.noOffering')}
            </ThemedText>
          ) : (
            <View style={styles.packages}>
              {packages.map((pkg) => {
                const { label, hint } = packageLabel(pkg, t);
                const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
                const comparison = isAnnual ? pricing.comparison : null;
                const perWeek = isAnnual
                  ? pricing.annualPerWeek
                  : pkg.packageType === PACKAGE_TYPE.MONTHLY
                    ? pricing.monthlyPerWeek
                    : null;
                // Tahsil edilen tutar dönemi olmadan asla yazılmıyor: haftalık
                // rakam büyük dururken yalnız bir "$35.99" görmek kullanıcıya
                // hangi periyotta ne ödeyeceğini söylemez.
                const billed = perWeek
                  ? t(
                      isAnnual
                        ? 'paywall.packages.billedAnnual'
                        : 'paywall.packages.billedMonthly',
                      { price: pkg.product.priceString }
                    )
                  : null;
                const busy = busyId === pkg.identifier;

                // Ekran okuyucu için satır tek bir cümle: büyük rakam haftalık
                // olsa da GERÇEK tahsilat ve dönemi burada da açıkça geçmeli —
                // görsel hiyerarşi ile sesli okuma birbirinden ayrılırsa hem
                // kullanıcı hem denetçi için yanıltıcı olur.
                const a11yLabel = !perWeek
                  ? t('paywall.packages.a11yPackage', {
                      label,
                      price: pkg.product.priceString,
                    })
                  : comparison
                    ? t('paywall.packages.a11yAnnualSaving', {
                        label,
                        price: pkg.product.priceString,
                        compare: comparison.annualizedMonthly,
                        perWeek,
                        percent: comparison.savingPercentText,
                      })
                    : t(
                        isAnnual
                          ? 'paywall.packages.a11yAnnual'
                          : 'paywall.packages.a11yMonthly',
                        { label, price: pkg.product.priceString, perWeek }
                      );

                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => buy(pkg)}
                    disabled={busyId !== null}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel}
                    accessibilityState={{ disabled: busyId !== null, busy }}
                    style={({ pressed }) => [
                      styles.packageCard,
                      // Dolgulu kart: satın alma satırları ekranın en tıklanabilir
                      // görünen öğesi olmalı (eskiden "geri yükle" öyleydi).
                      { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
                    ]}>
                    <WobblyBorder stroke={colors.accent} strokeWidth={1.8} />
                    <View style={styles.packageRow}>
                      <View style={styles.packageInfo}>
                        <ThemedText variant="body">{label}</ThemedText>
                        {comparison ? (
                          <ThemedText variant="label" tone="accent">
                            {t('paywall.packages.savePercent', {
                              percent: comparison.savingPercentText,
                            })}
                          </ThemedText>
                        ) : hint ? (
                          <ThemedText variant="label" tone="accent">
                            {hint}
                          </ThemedText>
                        ) : null}
                      </View>
                      {/* Fiyat sütununda hiyerarşi: en büyük rakam haftalık
                          karşılık, hemen altında tahsil edilen tutar dönemiyle
                          birlikte. Tahsilat satırı küçük ama SÖNÜK DEĞİL (ana
                          metin rengi, gövde boyu) — mağaza kuralları gerçek
                          tutarın okunaklı kalmasını şart koşuyor. Rakamlar sağ
                          kenara hizalı, çünkü el yazısı font tabular değil ve
                          soldan hizalanınca satırlar rastgele kayıyor. */}
                      <View style={styles.priceColumn}>
                        {busy ? (
                          <ThemedText variant="body" tone="accent">
                            {t('common.loading')}
                          </ThemedText>
                        ) : perWeek ? (
                          <>
                            <View style={styles.heroRow}>
                              <ThemedText variant="heading" tone="accent">
                                {perWeek}
                              </ThemedText>
                              <ThemedText variant="label" tone="textMuted">
                                {t('paywall.packages.perWeekUnit')}
                              </ThemedText>
                            </View>
                            <View style={styles.billedGroup}>
                              {comparison && (
                                <SketchStrike>
                                  <ThemedText variant="label" tone="textMuted">
                                    {comparison.annualizedMonthly}
                                  </ThemedText>
                                </SketchStrike>
                              )}
                              <ThemedText variant="body" style={styles.billedText}>
                                {billed}
                              </ThemedText>
                            </View>
                          </>
                        ) : (
                          // Tek seferlik ürün: haftalık karşılığı yok, ödenecek
                          // tutarın kendisi başlık rakamı.
                          <ThemedText variant="heading" tone="accent">
                            {pkg.product.priceString}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {message && (
            <ThemedText variant="body" tone={message.tone} style={styles.message}>
              {message.text}
            </ThemedText>
          )}

          {/* Kurtarma eylemi, satın alma satırlarından daha "buton" görünmemeli —
              eskiden ekrandaki tek buton buydu ve hiyerarşi tersti. */}
          <Pressable
            onPress={restore}
            disabled={restoreDisabled}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.restorePurchases')}
            accessibilityState={{ disabled: restoreDisabled, busy: restoring }}
            style={[styles.restoreBtn, { opacity: restoreDisabled ? 0.4 : 1 }]}>
            <ThemedText variant="label" tone="textMuted">
              {restoring ? t('common.loading') : t('paywall.restorePurchases')}
            </ThemedText>
          </Pressable>

          {/* Abonelik satan bir ekranda gizlilik ve kullanım koşulları
              bağlantıları isteğe bağlı değil (App Store 3.1.2). Ekranın en
              altında ve sönük duruyorlar — fiyat hiyerarşisini bozmasınlar
              diye — ama gerçekten tıklanabilirler; hitSlop dokunma alanını
              yazının küçüklüğünden bağımsız tutuyor. */}
          <View style={styles.legalRow}>
            <Pressable
              onPress={() => openLink(Links.privacyPolicy)}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel={t('paywall.legal.privacyPolicy')}>
              <ThemedText variant="label" tone="textMuted" style={styles.legalLink}>
                {t('paywall.legal.privacyPolicy')}
              </ThemedText>
            </Pressable>
            {/* Android'de koşullar bağlantısı yok (bkz. constants/links.ts),
                o yüzden ayırıcı da onunla birlikte gidiyor. */}
            {Links.termsOfUse ? (
              <>
                <ThemedText variant="label" tone="textMuted">
                  {'  ·  '}
                </ThemedText>
                <Pressable
                  onPress={() => openLink(Links.termsOfUse)}
                  hitSlop={12}
                  accessibilityRole="link"
                  accessibilityLabel={t('paywall.legal.termsOfUse')}>
                  <ThemedText variant="label" tone="textMuted" style={styles.legalLink}>
                    {t('paywall.legal.termsOfUse')}
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  intro: {
    marginTop: -Spacing.xs,
  },
  stateMsg: {
    marginTop: Spacing.md,
  },
  packages: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  packageCard: {
    position: 'relative',
    padding: Spacing.md,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  packageInfo: {
    flexShrink: 1,
    gap: Spacing.xs / 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
    gap: Spacing.xs / 2,
  },
  heroRow: {
    flexDirection: 'row',
    // Büyük rakam ile küçük "/ hafta" ekinin ortak taban çizgisi; ortalanınca
    // ek, rakamın ortasına gelip kazara hizalanmış gibi duruyordu.
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  billedGroup: {
    alignItems: 'flex-end',
    gap: Spacing.xs / 2,
    marginTop: Spacing.xs / 2,
  },
  billedText: {
    textAlign: 'right',
  },
  message: {
    textAlign: 'center',
  },
  restoreBtn: {
    marginTop: Spacing.lg,
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  legalLink: { textDecorationLine: 'underline' },
});
