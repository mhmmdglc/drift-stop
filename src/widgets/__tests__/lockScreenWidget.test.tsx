import { DriftStopWidget } from '../DriftStopWidget';
import type { Quote } from '@/types/quote';

const LONG = 'a'.repeat(400);
const quote = { id: 1, text: LONG, textTr: LONG, author: 'Test', theme: 'motivation' } as unknown as Quote;

// FlexWidget/TextWidget native tarafta render edilir; test ortamında ağacı
// doğrudan React element'leri üzerinden geziyoruz.
function texts(el: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== 'object') return;
    if (typeof n.props?.text === 'string') out.push(n.props.text);
    walk(n.props?.children);
  };
  walk(el);
  return out;
}

function quoteLine(height: number, width = 250): string {
  // en uzun metin söz satırıdır (başlık ve yazar kısa)
  return texts(DriftStopWidget({ quote, height, width })).sort((a, b) => b.length - a.length)[0];
}

describe('widget boyuta göre uyarlanıyor', () => {
  it('kilit ekranı yüksekliğinde (4x3) ana ekrandan belirgin şekilde daha çok metin gösterir', () => {
    const home = quoteLine(110);
    const lock = quoteLine(190);
    expect(lock.length).toBeGreaterThan(home.length);
    expect(lock.length).toBeGreaterThan(150);
  });

  it('sığ hücrede metni kısaltır', () => {
    expect(quoteLine(80).length).toBeLessThan(quoteLine(110).length);
  });

  it('yükseklik verilmezse ana ekran ölçüsüne düşer (headless güvenliği)', () => {
    const fallback = texts(DriftStopWidget({ quote })).sort((a, b) => b.length - a.length)[0];
    expect(fallback.length).toBe(quoteLine(110).length);
  });
});

describe('kilit ekranı uygunluğu', () => {
  // Android 16 kilit ekranı widget'ları opt-out modeli: `not_keyguard` yazılırsa
  // widget kilit ekranından tamamen düşer. Bunu kimse kazara eklemesin.
  const plugin = require('../../../plugins/withLockScreenWidget.js');

  it('plugin keyguard kategorisini yazıyor, not_keyguard yazmıyor', () => {
    const raw = require('fs').readFileSync(
      require('path').join(__dirname, '../../../plugins/withLockScreenWidget.js'),
      'utf8'
    );
    // Yorumlar `not_keyguard`'ı açıklıyor; sadece gerçek kodu tara.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toContain('home_screen|keyguard');
    expect(src).not.toContain('not_keyguard');
    expect(typeof plugin).toBe('function');
  });

  it('app.json widget plugin listesinin başında (Expo mod zinciri son eklendi-önce çalışır)', () => {
    const app = require('../../../app.json');
    expect(app.expo.plugins[0]).toBe('./plugins/withLockScreenWidget');
  });
});
