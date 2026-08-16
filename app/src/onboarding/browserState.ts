export const ONBOARDING_KEY = 'tst:onboarding';

export type OnboardingChoice = 'save' | 'all';

/**
 * Returning users should never be interrupted by onboarding. Treat any key
 * owned by this app as evidence that the browser has been here before — even a
 * theme, panel, or sorting preference is enough.
 */
export function hasAppBrowserData(storage: Pick<Storage, 'length' | 'key'>): boolean {
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('tst:') || key?.startsWith('tst.')) return true;
  }
  return false;
}

export function needsFirstRunChoice(): boolean {
  try {
    return !hasAppBrowserData(window.localStorage);
  } catch {
    // If storage is unavailable, keep the safe default for this session. The
    // component still closes locally after the user chooses.
    return true;
  }
}

export function rememberFirstRunChoice(choice: OnboardingChoice): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, choice);
  } catch {
    // Private / restricted browsing may reject writes. The in-memory gate is
    // still dismissed, so the user is not trapped in the welcome screen.
  }
}
