import { HttpClient } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { FeatureSwitchService } from '../feature-switch-service';
import { ApiEpisode } from '../api-episode.interface';
import { environment } from '../../environments/environment';
import { PostEpisodeDialogComponent } from './post-episode-dialog.component';

const episodeId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const api = (path: string) => new URL(path, environment.api).toString();

describe('PostEpisodeDialogComponent kind-aware title', () => {
  function create(
    contentKind: string | null | undefined,
    getEpisode: ApiEpisode,
    httpPost: ReturnType<typeof vi.fn> = vi.fn(() => of({ tweeted: true }))
  ): {
    component: PostEpisodeDialogComponent;
    httpGet: ReturnType<typeof vi.fn>;
    httpPost: ReturnType<typeof vi.fn>;
    dialogRef: { close: ReturnType<typeof vi.fn> };
  } {
    const httpGet = vi.fn(() => of(getEpisode));
    const auth = {
      authService: {
        getAccessTokenSilently: () => of('synthetic-token')
      }
    };
    const dialogRef = { close: vi.fn() };
    const component = new PostEpisodeDialogComponent(
      auth as unknown as AuthServiceWrapper,
      { get: httpGet, post: httpPost } as unknown as HttpClient,
      { IsEnabled: () => false } as unknown as FeatureSwitchService,
      dialogRef as unknown as MatDialogRef<PostEpisodeDialogComponent, any>,
      { episodeId, contentKind }
    );
    return { component, httpGet, httpPost, dialogRef };
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

  it('onSubmit POSTs /film/{id}/publish after a Film load', async () => {
    const httpPost = vi.fn(() => of({ tweeted: true }));
    const { component } = create(
      CataloguePlayableKind.Film,
      {
        id: episodeId,
        title: 'Synthetic Film',
        contentKind: CataloguePlayableKind.Film,
        posted: false,
        tweeted: false,
        bluesky: false,
        ignored: false,
        removed: false
      } as ApiEpisode,
      httpPost
    );

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    component.form!.controls.tweet.setValue(true);
    component.onSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(httpPost).toHaveBeenCalledWith(
      api(`/film/${episodeId}/publish`),
      { tweet: true },
      expect.objectContaining({ headers: expect.anything() })
    );
  });

  it('onSubmit POSTs /episode/publish/{id} after a podcast Episode load', async () => {
    const httpPost = vi.fn(() => of({ tweeted: true }));
    const { component } = create(
      CataloguePlayableKind.Episode,
      {
        id: episodeId,
        title: 'Synthetic Episode',
        contentKind: CataloguePlayableKind.Episode,
        posted: false,
        tweeted: false,
        bluesky: false,
        ignored: false,
        removed: false
      } as ApiEpisode,
      httpPost
    );

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    component.form!.controls.tweet.setValue(true);
    component.onSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(httpPost).toHaveBeenCalledWith(
      api(`/episode/publish/${episodeId}`),
      { tweet: true },
      expect.objectContaining({ headers: expect.anything() })
    );
  });
});
