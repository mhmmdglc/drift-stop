/// <reference types="jest" />
import { GOAL_MAX_LENGTH, normalizeGoal } from '../settings';

/**
 * `normalizeGoal` iki yüzeyin (onboarding + ayarlar) ortak doğruluk noktası:
 * `maxLength` yapıştırma/IME uç durumlarında platforma göre değişebildiği için
 * asıl kırpma kayıt anında burada yapılır.
 */
describe('normalizeGoal', () => {
  it('baş/son boşlukları atar', () => {
    expect(normalizeGoal('  sigara  ')).toBe('sigara');
  });

  it('boş ve yalnızca-boşluk girdiyi null yapar (hedefi silmenin tek yolu)', () => {
    expect(normalizeGoal('')).toBeNull();
    expect(normalizeGoal('   ')).toBeNull();
  });

  it('üst sınırı aşan girdiyi GOAL_MAX_LENGTH karaktere kırpar', () => {
    const long = 'a'.repeat(GOAL_MAX_LENGTH + 10);
    expect(normalizeGoal(long)).toHaveLength(GOAL_MAX_LENGTH);
  });

  it('tam sınırdaki girdiye dokunmaz', () => {
    const exact = 'b'.repeat(GOAL_MAX_LENGTH);
    expect(normalizeGoal(exact)).toBe(exact);
  });
});
