import { describe, expect, it } from 'vitest';
import { isEnglishLanguage } from './sentiment';

describe('sentiment language eligibility', () => {
  it('accepts English BCP 47 tags', () => {
    expect(isEnglishLanguage('en')).toBe(true);
    expect(isEnglishLanguage('en-US')).toBe(true);
  });

  it('does not treat other or missing language tags as English', () => {
    expect(isEnglishLanguage('es')).toBe(false);
    expect(isEnglishLanguage('unknown')).toBe(false);
    expect(isEnglishLanguage(undefined)).toBe(false);
  });
});
