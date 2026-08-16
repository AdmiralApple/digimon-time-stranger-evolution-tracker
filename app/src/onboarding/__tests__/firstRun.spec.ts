import { describe, expect, it } from 'vitest';
import { hasAppBrowserData } from '../browserState';

function storageWith(keys: string[]): Pick<Storage, 'length' | 'key'> {
  return {
    length: keys.length,
    key: (index: number) => keys[index] ?? null,
  };
}

describe('first-run detection', () => {
  it('shows onboarding when the browser has no stored data', () => {
    expect(hasAppBrowserData(storageWith([]))).toBe(false);
  });

  it.each(['tst:prefs', 'tst:discovery', 'tst.theme', 'tst.codex.advanced', 'tst:onboarding'])(
    'recognises %s as existing app data',
    (key) => expect(hasAppBrowserData(storageWith([key]))).toBe(true),
  );

  it('ignores unrelated sites and libraries', () => {
    expect(hasAppBrowserData(storageWith(['vite:debug', 'another-app']))).toBe(false);
  });
});
