import { FormControl } from '@angular/forms';
import { RegexPresetsService } from './regex-presets.service';

describe('RegexPresetsService', () => {
  const service = new RegexPresetsService();
  const presetName = 'Episode title prefix removal';

  it('includes the episode-title-prefix removal description preset', () => {
    const preset = service.loadRegexPresets().description.find(x => x.name === presetName);
    expect(preset).toBeDefined();
    expect(preset!.pattern).toBe('^\\s*{episode-title}\\s*[-\u2013\u2014:|]?\\s*(?<body>.*)$');
  });

  it('applies the preset with the {episode-title} token left for the API to resolve per episode', () => {
    const preset = service.loadRegexPresets().description.find(x => x.name === presetName)!;
    const control = new FormControl<string>('', { nonNullable: true });

    // Synthetic, generated name with regex-significant characters; never real podcast data.
    const podcastName = `Example Podcast & Co. (${Math.random().toString(36).slice(2, 8)})`;

    service.applyDescriptionRegexPreset(preset.pattern, control, podcastName);

    expect(control.value).toBe(preset.pattern);
    expect(control.value).toContain('{episode-title}');
  });

  it('still resolves the client-side {podcastName} placeholder', () => {
    expect(service.resolveRegexPlaceholders('^{podcastName} {episode-title}$', 'My Pod'))
      .toBe('^My Pod {episode-title}$');
  });

  it('every description preset compiles as a JS regex after normalising .NET-only syntax (smoke check; .NET validity is covered by RPP DescriptionRegexTokens tests)', () => {
    for (const preset of service.loadRegexPresets().description) {
      const pattern = preset.pattern
        .replaceAll('{episode-title}', 'Title')
        .replaceAll('{podcast-name}', 'Podcast')
        // .NET-only constructs JavaScript does not support
        .replaceAll("(?'body'", '(?<body>')
        .replaceAll('\\z', '$');
      expect(() => new RegExp(pattern, 's')).not.toThrow();
    }
  });

  it('includes the Introducing / You Might Also Like exclude preset for episode include-title', () => {
    const preset = service.loadRegexPresets().includeTitle.find(
      x => x.name === 'Exclude Introducing / You Might Also Like'
    );
    expect(preset).toBeDefined();
    expect(preset!.pattern).toBe('^(?!(Introducing|You Might Also Like):).+');
  });

  it('applies the include-title preset unchanged (no client-side tokens)', () => {
    const preset = service.loadRegexPresets().includeTitle.find(
      x => x.name === 'Exclude Introducing / You Might Also Like'
    )!;
    const control = new FormControl<string>('', { nonNullable: true });
    const podcastName = `Example Podcast (${Math.random().toString(36).slice(2, 8)})`;

    service.applyIncludeTitleRegexPreset(preset.pattern, control, podcastName);

    expect(control.value).toBe(preset.pattern);
  });

  it('every include-title preset compiles as a JS regex with IgnoreCase like the indexer', () => {
    for (const preset of service.loadRegexPresets().includeTitle) {
      expect(() => new RegExp(preset.pattern, 'i')).not.toThrow();
      const re = new RegExp(preset.pattern, 'i');
      expect(re.test('Introducing: Other Show')).toBe(false);
      expect(re.test('You Might Also Like: Other Show')).toBe(false);
      expect(re.test('Real Episode About Something')).toBe(true);
    }
  });
});
