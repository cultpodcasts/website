import { SUBJECT_COLORS, subjectColor, subjectColorKey } from './subject-color';

/** Flix page background behind a chip. */
const PAGE_BACKGROUND = '#141414';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hexHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) {
    return 0;
  }
  const d = max - min;
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  return Math.round(h * 60);
}

describe('subjectColor', () => {
  it('gives a subject the same colour every time it is asked', () => {
    const first = subjectColor('Scientology');
    for (let i = 0; i < 50; i++) {
      expect(subjectColor('Scientology')).toEqual(first);
    }
  });

  it('pins known subjects to fixed palette entries so colours survive rebuilds and deploys', () => {
    // Changing the hash or the palette order would break these — that is the point:
    // a subject people have learned must not change colour between releases.
    expect(subjectColor('Scientology').name).toBe('chartreuse');
    expect(subjectColor('NXIVM').name).toBe('mint');
    expect(subjectColor('Jehovah\'s Witnesses').name).toBe('orchid');
    expect(subjectColor('Peoples Temple').name).toBe('indigo');
    expect(subjectColor('Manson Family').name).toBe('magenta');
  });

  it('separates different subjects across the palette rather than clustering them', () => {
    const subjects = [
      'Scientology', 'NXIVM', 'Peoples Temple', 'Branch Davidians', 'Manson Family',
      'Children Of God', 'FLDS Church', 'Aum Shinrikyo', 'Unification Church',
      'Heaven\'s Gate', 'Amish', 'Hare Krishnas', 'Oneida Community',
      'Geelong Revival Centre', 'Twelve Tribes', 'The Family International',
    ];

    const distinct = new Set(subjects.map((s) => subjectColor(s).name));

    expect(distinct.size).toBeGreaterThan(subjects.length / 2);
    expect(subjectColor('Scientology')).not.toEqual(subjectColor('NXIVM'));
  });

  it('treats case, surrounding whitespace, whitespace runs and apostrophe style as the same subject', () => {
    const canonical = subjectColor('Jehovah\'s Witnesses');

    expect(subjectColor('jehovah\'s witnesses')).toEqual(canonical);
    expect(subjectColor('  JEHOVAH\'S   WITNESSES  ')).toEqual(canonical);
    expect(subjectColor('Jehovah\u2019s Witnesses')).toEqual(canonical);
    expect(subjectColor('Jehovahs Witnesses')).toEqual(canonical);

    expect(subjectColorKey('  Ramtha\u2019s   School Of Enlightenment ')).toBe(
      'ramthas school of enlightenment'
    );
  });

  it('always returns a real palette entry, including for empty or missing names', () => {
    const inputs = ['Scientology', '', '   ', '_hidden', 'a', 'ümlaut Sekte', undefined, null];

    for (const input of inputs) {
      const color = subjectColor(input);
      expect(SUBJECT_COLORS).toContain(color);
      expect(color.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.border).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.text).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps every palette pair readable in the dark UI', () => {
    expect(SUBJECT_COLORS.length).toBeGreaterThan(1);

    for (const color of SUBJECT_COLORS) {
      // WCAG AAA for normal text — chip labels are small.
      expect(contrastRatio(color.text, color.background)).toBeGreaterThanOrEqual(7);
      // Chip text stays readable even if the background is overdrawn by the page.
      expect(contrastRatio(color.text, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
      // Backgrounds are muted, not bright fills competing with cover art.
      expect(relativeLuminance(color.background)).toBeLessThan(0.06);
    }
  });

  it('spreads palette hues around the wheel rather than clustering in a narrow band', () => {
    const hues = SUBJECT_COLORS.map((c) => hexHue(c.background)).sort((a, b) => a - b);
    expect(SUBJECT_COLORS.length).toBeGreaterThanOrEqual(16);

    const gaps: number[] = [];
    for (let i = 1; i < hues.length; i++) {
      gaps.push(hues[i] - hues[i - 1]);
    }
    gaps.push(360 - (hues[hues.length - 1] - hues[0]));

    // Even spacing around 360°/n — allow some character variation, forbid big empty arcs.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(40);
    expect(hues[hues.length - 1] - hues[0]).toBeGreaterThan(280);
  });

  it('uses palette names that are unique, so a name identifies one colour', () => {
    const names = SUBJECT_COLORS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
