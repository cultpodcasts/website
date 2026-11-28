import { isGuidText } from './guid-text';

describe('isGuidText', () => {
  it('accepts a GUID in either case and rejects a name, a GUID with extra text, and blank or missing text', () => {
    expect(isGuidText('9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d')).toBe(true);
    expect(isGuidText('9A8B7C6D-5E4F-4A3B-9C2D-1E0F2A3B4C5D')).toBe(true);
    expect(isGuidText('Synthetic Show')).toBe(false);
    expect(isGuidText('9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d extra')).toBe(false);
    expect(isGuidText('')).toBe(false);
    expect(isGuidText(null)).toBe(false);
    expect(isGuidText(undefined)).toBe(false);
  });
});