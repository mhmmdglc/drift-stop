import { ArchitectsDaughter_400Regular } from '@expo-google-fonts/architects-daughter';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Kalam_400Regular, Kalam_700Bold } from '@expo-google-fonts/kalam';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashOverlay } from '@/components/SplashOverlay';
import { AuthProvider } from '@/hooks/useAuth';
import { HistoryProvider, useHistory } from '@/hooks/useHistory';
import { useNotificationObserver } from '@/hooks/useNotifications';
import { PurchasesProvider } from '@/hooks/usePurchases';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { initAds } from '@/utils/ads';
import { initCrashReporting } from '@/utils/crashReporting';
import { nativeFeaturesAvailable } from '@/utils/runtime';
import { ensurePermissions, rescheduleIfNeeded, setupAndroidChannel } from '@/utils/scheduler';
import { getJSON, StorageKeys } from '@/utils/storage';
import { syncQuotes } from '@/services/quotesSync';
import { syncPacks } from '@/services/packsSync';
import { syncAuthorCounts } from '@/services/authorsSync';

SplashScreen.preventAutoHideAsync();
initCrashReporting();

function AppShell() {
  useNotificationObserver();
  const { settings, loaded: settingsLoaded } = useSettings();
  const { themeName } = useTheme();
  const { record } = useHistory();
  const router = useRouter();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const bootRan = useRef(false);

  useEffect(() => {
    void setupAndroidChannel();
    initAds();
    void syncQuotes();
    void syncPacks();
    void syncAuthorCounts();
    getJSON<boolean>(StorageKeys.onboardingComplete, false).then(setOnboarded);
  }, []);

  // Ön plandayken gelen bildirimin sözünü geçmişe ekle
  useEffect(() => {
    if (!nativeFeaturesAvailable) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const id = (n.request.content.data as { quoteId?: number } | undefined)?.quoteId;
      if (typeof id === 'number') record(id);
    });
    return () => sub.remove();
  }, [record]);

  useEffect(() => {
    if (bootRan.current) return;
    if (!splashDone || !settingsLoaded || onboarded === null) return;
    bootRan.current = true;
    if (!onboarded) {
      router.replace('/onboarding');
    } else {
      void ensurePermissions().then(() => rescheduleIfNeeded(settings));
    }
  }, [splashDone, settingsLoaded, onboarded, router, settings]);

  return (
    <>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="quote/[id]" />
        <Stack.Screen name="packs/index" />
        <Stack.Screen name="packs/[id]" />
        <Stack.Screen name="packs/author/[name]" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="paywall" />
      </Stack>
      {!splashDone && <SplashOverlay onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Caveat_400Regular,
    Caveat_700Bold,
    Kalam_400Regular,
    Kalam_700Bold,
    ArchitectsDaughter_400Regular,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SettingsProvider>
            <ThemeProvider>
              <AuthProvider>
                <PurchasesProvider>
                  <HistoryProvider>
                    <AppShell />
                  </HistoryProvider>
                </PurchasesProvider>
              </AuthProvider>
            </ThemeProvider>
          </SettingsProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
