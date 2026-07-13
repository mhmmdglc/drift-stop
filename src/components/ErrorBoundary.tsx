import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { reportError } from '@/utils/crashReporting';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Kök seviye hata sınırı. Herhangi bir yerde beklenmedik bir render hatası
 * olursa uygulamayı boş/siyah ekrana düşürmek yerine kurtarma seçeneği olan
 * bir ekran gösterir. Sabit stiller kullanır (tema/ayar context'lerine
 * bağımlı değil) — çünkü hata tam olarak o context'lerin içinde de olabilir.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, info.componentStack);
    }
    reportError(error, { componentStack: info.componentStack });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Text style={styles.message}>
            Uygulama beklenmedik bir hatayla karşılaştı. Tekrar denemek genelde sorunu çözer.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Tekrar dene">
            <Text style={styles.buttonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1A16',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#F2E9D8',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#B8AD98',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 21,
  },
  button: {
    borderWidth: 1,
    borderColor: '#C8923A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#C8923A',
    fontSize: 15,
    fontWeight: '600',
  },
});
