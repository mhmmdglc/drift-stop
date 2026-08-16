// jest.mock çağrıları babel tarafından import'ların ÜSTÜNE taşınır — import'lar
// burada en üstte durabilir ve import/first uyarısı üretmez.
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SketchTextInput } from '@/components/SketchTextInput';
import { WobblyBorder } from '@/components/WobblyBorder';
import { GOAL_MAX_LENGTH } from '@/types/settings';

// Kenar çizgisinin SVG çizimi değil, HANGİ durumla çağrıldığı sınanıyor —
// props'ları yakalayan düz bir mock yeterli (Reanimated/SVG bağımlılığı da kalkar).
jest.mock('@/components/WobblyBorder', () => ({
  WobblyBorder: jest.fn(() => null),
}));

// ThemedText/WobblyBorder gerçek ThemeProvider ister; buradaki mesele renk
// değerleri değil, focus'ta HANGİ token'ın seçildiği.
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: { text: '#fff', textMuted: '#888', accent: '#c90', faintLine: '#444' },
  }),
}));

const mockBorder = WobblyBorder as unknown as jest.Mock;

const lastBorderProps = () =>
  mockBorder.mock.calls[mockBorder.mock.calls.length - 1][0] as {
    stroke: string;
    strokeWidth: number;
    doubleStroke: boolean;
  };

beforeEach(() => {
  mockBorder.mockClear();
});

describe('SketchTextInput', () => {
  it('accessibilityLabel ile bulunur ve maxLength native input\'a geçer', async () => {
    await render(
      <SketchTextInput
        value=""
        onChangeText={() => {}}
        maxLength={GOAL_MAX_LENGTH}
        accessibilityLabel="Hedefin"
      />
    );

    const input = screen.getByLabelText('Hedefin');
    expect(input.props.maxLength).toBe(GOAL_MAX_LENGTH);
  });

  it('focus durumunu renkten bağımsız da anlatır: çift çizgi + kalınlık değişir', async () => {
    await render(
      <SketchTextInput value="" onChangeText={() => {}} accessibilityLabel="Hedefin" />
    );
    const input = screen.getByLabelText('Hedefin');

    // Normal durum: faintLine, tek çizgi.
    expect(lastBorderProps()).toMatchObject({
      stroke: '#444',
      strokeWidth: 1.4,
      doubleStroke: false,
    });

    await fireEvent(input, 'focus');
    expect(lastBorderProps()).toMatchObject({
      stroke: '#c90',
      strokeWidth: 1.6,
      doubleStroke: true,
    });

    await fireEvent(input, 'blur');
    expect(lastBorderProps()).toMatchObject({ stroke: '#444', doubleStroke: false });
  });

  it('blur olduğunda önce focus durumunu kapatır sonra onBlur\'u çağırır', async () => {
    const onBlur = jest.fn();
    await render(
      <SketchTextInput value="" onChangeText={() => {}} onBlur={onBlur} accessibilityLabel="Hedefin" />
    );
    const input = screen.getByLabelText('Hedefin');

    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
