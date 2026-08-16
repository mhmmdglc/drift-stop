/// <reference types="jest" />
import * as quotesModule from '@/data/quotes';
import { QUOTES } from '@/data/quotes';
import type { Quote } from '@/types/quote';
import { logSosOpen, pickSosQuote, SOS_LOG_CAP, type SosLogEntry } from '../sos';

function makeQuote(id: number): Quote {
  return {
    id,
    text: `test quote ${id}`,
    textTr: `test söz ${id}`,
    author: 'Test',
    origin: 'Test',
    originEmoji: '🧪',
    category: 'discipline',
    era: 'ancient',
    tags: ['reckoning'],
  };
}

describe('pickSosQuote', () => {
  it('yalnızca reckoning/discipline tag\'li sözlerden seçiyor, tema filtresinden bağımsız', () => {
    for (let i = 0; i < 50; i++) {
      const q = pickSosQuote([]);
      expect(q.tags.some((t) => t === 'reckoning' || t === 'discipline')).toBe(true);
    }
  });

  it('son 20 SOS sözünü dışlıyor', () => {
    const pool = QUOTES.filter((q) => q.tags.includes('reckoning') || q.tags.includes('discipline'));
    const log: SosLogEntry[] = pool
      .slice(0, 20)
      .map((q, i) => ({ at: Date.now() - i, quoteId: q.id }));
    const excludedIds = new Set(log.map((e) => e.quoteId));

    for (let i = 0; i < 100; i++) {
      const q = pickSosQuote(log);
      expect(excludedIds.has(q.id)).toBe(false);
    }
  });

  it("sosLog'daki 20'den ESKİ kayıtları dışlamıyor (yalnızca son-20 penceresi)", () => {
    const pool = QUOTES.filter((q) => q.tags.includes('reckoning') || q.tags.includes('discipline'));
    // İlk 20 kayıt hariç TÜMÜNÜ (havuzun geri kalanını) log'a ekleyip, dışlamanın
    // yalnızca dizinin BAŞINDAKİ (en yeni) 20 kayda uygulandığını doğruluyoruz —
    // 20. sıradan sonraki kayıtlar dışlanmamalı, seçilebilir kalmalı.
    const stale = pool.slice(20).map((q, i) => ({ at: Date.now() - 1000 - i, quoteId: q.id }));
    const staleIds = new Set(stale.map((e) => e.quoteId));
    let sawStale = false;
    for (let i = 0; i < 200; i++) {
      if (staleIds.has(pickSosQuote(stale).id)) {
        sawStale = true;
        break;
      }
    }
    expect(sawStale).toBe(true);
  });

  it('dışlama havuzu tamamen boşaltırsa dışlamayı yok sayıp yine seçim yapar', () => {
    // Gerçek 492'lik havuzda "hepsi dışlı" pratikte imkansız — bu yüzden
    // `getQuotesByThemes`'i yapay olarak küçük bir havuza sabitleyip fonksiyonun
    // GÜVENLİK dalını (`filtered.length > 0 ? filtered : pool`) doğrudan tetikliyoruz.
    const tinyPool = [makeQuote(9001), makeQuote(9002)];
    const spy = jest.spyOn(quotesModule, 'getQuotesByThemes').mockReturnValue(tinyPool);
    try {
      const log: SosLogEntry[] = tinyPool.map((q, i) => ({ at: Date.now() - i, quoteId: q.id }));
      const result = pickSosQuote(log);
      // İkisi de dışlanmış olsa da (dışlama yok sayıldığı için) sonuç yine havuzdan gelir.
      expect(tinyPool.some((q) => q.id === result.id)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('logSosOpen', () => {
  it('yeni kaydı en başa ekler', () => {
    const log: SosLogEntry[] = [{ at: 1, quoteId: 1 }];
    const next = logSosOpen(log, 2);
    expect(next[0]).toEqual({ at: expect.any(Number), quoteId: 2 });
    expect(next[1]).toEqual({ at: 1, quoteId: 1 });
  });

  it(`${SOS_LOG_CAP}'de kırpar`, () => {
    // Dizide index 0 EN YENİ kayıt (proje kuralı); en sonda duran kayıt en eski —
    // kırpma en sondakini (burada quoteId 99) atmalı.
    const log: SosLogEntry[] = Array.from({ length: SOS_LOG_CAP }, (_, i) => ({
      at: SOS_LOG_CAP - i,
      quoteId: i,
    }));
    const next = logSosOpen(log, 9999);
    expect(next.length).toBe(SOS_LOG_CAP);
    expect(next[0].quoteId).toBe(9999);
    // en eski kayıt (dizinin sonundaki, quoteId 99) budandı
    expect(next.some((e) => e.quoteId === SOS_LOG_CAP - 1)).toBe(false);
    expect(next.some((e) => e.quoteId === 0)).toBe(true);
  });
});
