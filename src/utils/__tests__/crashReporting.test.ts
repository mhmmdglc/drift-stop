/// <reference types="jest" />
const mockInit = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe('crashReporting', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    jest.clearAllMocks();
  });

  it('does not initialize Sentry when no DSN is configured', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initCrashReporting } = require('../crashReporting');

    initCrashReporting();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes Sentry when a DSN is configured', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initCrashReporting } = require('../crashReporting');

    initCrashReporting();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://example@sentry.io/1' })
    );
  });

  it('does not report errors when no DSN is configured', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reportError } = require('../crashReporting');

    reportError(new Error('boom'));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('reports errors with context when a DSN is configured', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reportError } = require('../crashReporting');

    const error = new Error('boom');
    reportError(error, { componentStack: 'at Foo' });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      extra: { componentStack: 'at Foo' },
    });
  });
});
