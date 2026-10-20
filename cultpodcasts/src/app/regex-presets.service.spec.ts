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

    service.applyDescriptionRegexPreset(preset.pattern, control, 'Cultimatum-The Culture of Cults & Human Trafficking');

    expect(control.value).toBe(preset.pattern);
    expect(control.value).toContain('{episode-title}');
  });

  it('still resolves the client-side {podcastName} placeholder', () => {
    expect(service.resolveRegexPlaceholders('^{podcastName} {episode-title}$', 'My Pod'))
      .toBe('^My Pod {episode-title}$');
  });

  it('every description preset is a valid regex once server-side tokens are substituted', () => {
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
});