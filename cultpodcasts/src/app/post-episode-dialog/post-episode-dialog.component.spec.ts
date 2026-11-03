import { HttpClient } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { FeatureSwitchService } from '../feature-switch-service';
import { ApiEpisode } from '../api-episode.interface';
import { PostEpisodeDialogComponent } from './post-episode-dialog.component';

const episodeId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('PostEpisodeDialogComponent kind-aware title', () => {
  function create(
    contentKind: string | null | undefined,
    getEpisode: ApiEpisode
  ): { component: PostEpisodeDialogComponent; httpGet: ReturnType<typeof vi.fn> } {
    const httpGet = vi.fn(() => of(getEpisode));
    const auth = {
      authService: {
        getAccessTokenSilently: () => of('synthetic-token')
      }
    };
    const component = new PostEpisodeDialogComponent(
      auth as unknown as AuthServiceWrapper,
      { get: httpGet } as unknown as HttpClient,
      { IsEnabled: () => false } as unknown as FeatureSwitchService,
      { close: vi.fn() } as unknown as MatDialogRef<PostEpisodeDialogComponent, any>,
      { episodeId, contentKind }
    );
    return { component, httpGet };
  }

  it('sets Post Film from dialog data before the episode GET returns', () => {
    const { component } = create(CataloguePlayableKind.Film, {
      id: episodeId,
      title: 'Synthetic Film',
      contentKind: CataloguePlayableKind.NewsReport,
      posted: false,
      tweeted: false,
      bluesky: false,
      ignored: false,
      removed: false
    } as ApiEpisode);

    expect(component.dialogTitle()).toBe('Post Film');
  });

  it('updates the title from the episode GET contentKind after load', async () => {
    const { component } = create(CataloguePlayableKind.Film, {
      id: episodeId,
      title: 'Synthetic Report',
      contentKind: CataloguePlayableKind.NewsReport,
      posted: false,
      tweeted: false,
      bluesky: false,
      ignored: false,
      removed: false
    } as ApiEpisode);

    expect(component.dialogTitle()).toBe('Post Film');

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.dialogTitle()).toBe('Post News Report');
  });
});
