import { displayCatalogName } from './display-catalog-name';

describe('displayCatalogName', () => {
  it('aliases Hustler\'s University spelling variants to Andrew Tate', () => {
    expect(displayCatalogName("Hustler's University")).toBe('Andrew Tate');
    expect(displayCatalogName('Hustlers University')).toBe('Andrew Tate');
    expect(displayCatalogName("  hustler's   university  ")).toBe('Andrew Tate');
  });

  it('passes through other names unchanged', () => {
    expect(displayCatalogName('Scientology')).toBe('Scientology');
    expect(displayCatalogName('')).toBe('');
  });
});
