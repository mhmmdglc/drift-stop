/// <reference types="jest" />
jest.mock('@/utils/crashReporting', () => ({
  reportError: jest.fn(),
}));

import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ErrorBoundary } from '../ErrorBoundary';
import { reportError } from '@/utils/crashReporting';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <Text>ok content</Text>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error to console.error — expected noise, silence it for this suite.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when there is no error', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('ok content')).toBeTruthy();
  });

  it('renders a fallback screen instead of crashing when a child throws', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(screen.queryByText('ok content')).toBeNull();
  });

  it('reports the caught error for crash visibility', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.anything()
    );
  });

  it('offers a retry action', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByLabelText('Tekrar dene')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Tekrar dene'));
    // Retrying re-mounts the same subtree; since Bomb still throws, the
    // boundary must catch it again rather than leaving a blank screen.
    expect(screen.getByText('Bir şeyler ters gitti')).toBeTruthy();
  });
});
