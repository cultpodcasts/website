/**
 * Episode/layout fixtures for homepage-hero geometry e2e (HERO-SCR-* / HERO-SUB-* / HERO-DSC-*).
 * HTML mirrors the billboard copy structure in homepage-hero.component.html, including the
 * description expander (wrap, fade, chevron) for expandable cases. All data is synthetic.
 */

export type HeroLayoutCaseId =
  | "short-title-no-desc"
  | "short-title-with-desc"
  | "long-title-with-desc"
  | "empty-desc-with-subjects"
  | "many-subjects-with-desc"
  | "many-subjects-no-desc"
  | "very-long-desc-with-urls";

export interface HeroLayoutCase {
  id: HeroLayoutCaseId;
  /** HERO-* ids this case primarily guards. */
  reqs: string[];
  episodeTitle: string;
  episodeDescription: string;
  subjects: string[];
  releaseLabel: string;
  durationLabel: string;
  podcastName: string;
  /**
   * The description overflows its clamp, so the hero renders the chevron expander
   * (HERO-DSC-001) and the harness can expand it (HERO-DSC-002..004).
   */
  expandable?: boolean;
}

const MANY_SUBJECTS = Array.from({ length: 12 }, (_, i) => `Topic ${i + 1}`);

/**
 * Show-notes style description: many paragraphs and long unbroken URLs (query strings,
 * path segments without breaks), like the real feeds that showed the HERO-DSC-003 bugs.
 * Synthetic: example.test hosts only.
 */
export const VERY_LONG_DESC_WITH_URLS = [
  "Invented show notes for the hero harness. Follow along at https://notes.example.test/invented/episode-33/show-notes-with-a-very-long-path-segment-that-never-breaks-on-its-own?utm_source=harness&utm_medium=synthetic&utm_campaign=hero_desc_overflow_check_value",
  "Support line: if you are affected by any of the invented issues in this synthetic episode, see https://support.example.test/Join or https://help.example.test/gb/basics/invented-topic/invented-topic-prevention-resources-and-a-very-long-path-segment-without-breaks for more.",
  ...Array.from(
    { length: 14 },
    (_, i) =>
      `Invented paragraph ${i + 1} with more synthetic notes at https://news.example.test/invented/story-${i + 1}?ref=hero&campaign=synthetic_long_value_${i}_${"x".repeat(24)}.`
  ),
  "Closing line of the synthetic description.",
].join(" ");

export const heroLayoutCases: HeroLayoutCase[] = [
  {
    id: "short-title-no-desc",
    reqs: ["HERO-SCR-004", "HERO-SCR-005"],
    episodeTitle: "The Rulo Farm",
    episodeDescription: "",
    subjects: [],
    releaseLabel: "8 Aug 2026",
    durationLabel: "0:18:47",
    podcastName: "Heinous Beliefs",
  },
  {
    id: "short-title-with-desc",
    reqs: ["HERO-SCR-002", "HERO-SCR-005"],
    episodeTitle: "The Rulo Farm",
    episodeDescription:
      "HEINOUS BELIEFS — SEASON 2, EPISODE 2. Short description for reserved-height checks.",
    subjects: ["Michael W. Ryan"],
    releaseLabel: "8 Aug 2026",
    durationLabel: "0:18:47",
    podcastName: "Heinous Beliefs",
  },
  {
    id: "long-title-with-desc",
    reqs: ["HERO-SCR-002"],
    episodeTitle:
      "Anonymous ExMuslim YouTuber Apostate Aladdin Opens up on Sex in Islam and Related Topics That Span Multiple Lines",
    episodeDescription:
      "A longer episode description that fills about two lines of the hero copy panel for clamp checks.",
    subjects: [],
    releaseLabel: "8 Aug 2026",
    durationLabel: "0:00:48",
    podcastName: "Cults To Consciousness Clips",
  },
  {
    id: "empty-desc-with-subjects",
    reqs: ["HERO-SCR-004", "HERO-SUB-002"],
    episodeTitle: "Clip Title",
    episodeDescription: "",
    subjects: ["Subject One", "Subject Two", "Subject Three"],
    releaseLabel: "8 Aug 2026",
    durationLabel: "0:01:00",
    podcastName: "Clip Show",
  },
  {
    id: "many-subjects-with-desc",
    reqs: ["HERO-SUB-001", "HERO-SUB-002"],
    episodeTitle: "Crowded Subject Episode",
    episodeDescription: "Description present with a full subject chip wrap.",
    subjects: MANY_SUBJECTS,
    releaseLabel: "8 Aug 2026",
    durationLabel: "1:05:00",
    podcastName: "Crowded Show",
  },
  {
    id: "many-subjects-no-desc",
    reqs: ["HERO-SUB-001", "HERO-SUB-002", "HERO-SCR-004"],
    episodeTitle: "Crowded Subjects No Desc",
    episodeDescription: "",
    subjects: MANY_SUBJECTS,
    releaseLabel: "8 Aug 2026",
    durationLabel: "0:45:00",
    podcastName: "Crowded Show",
  },
  {
    id: "very-long-desc-with-urls",
    reqs: ["HERO-DSC-001", "HERO-DSC-002", "HERO-DSC-003", "HERO-DSC-004"],
    episodeTitle: "Ep 33 - The Inventor: Synthetic Playbook",
    episodeDescription: VERY_LONG_DESC_WITH_URLS,
    subjects: ["Invented subject", "Another subject"],
    releaseLabel: "27 Oct 2026",
    durationLabel: "0:51:17",
    podcastName: "Invented Show",
    expandable: true,
  },
];

/** Same id the component gives the description (aria-controls target). */
export const HERO_LAYOUT_DESC_ID = "hero-layout-desc";

export function renderBillboardHtml(c: HeroLayoutCase): string {
  const hasDesc = c.episodeDescription.trim().length > 0;
  const hasSubjects = c.subjects.length > 0;
  const hasCopyBody = hasDesc || hasSubjects;

  const subjectsHtml = hasSubjects
    ? `<div class="billboard__subjects" aria-label="Subjects">${c.subjects
        .map(
          (s) =>
            `<span class="hero-layout-chip" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</span>`
        )
        .join("")}</div>`
    : "";

  // Expandable: fade + chevron like the component (HERO-DSC-001); the harness script toggles
  // the expanded state (see build-harness.ts, which mirrors HomepageHeroComponent.toggleDesc).
  const toggleHtml = c.expandable
    ? `<span class="billboard__desc-fade" aria-hidden="true"></span>` +
      `<button type="button" class="billboard__desc-toggle" aria-label="Expand description" ` +
      `aria-expanded="false" aria-controls="${HERO_LAYOUT_DESC_ID}"><span class="mat-icon" aria-hidden="true">&#x2304;</span></button>`
    : "";
  const descHtml = hasDesc
    ? `<div class="billboard__desc-wrap"><p class="billboard__desc" id="${HERO_LAYOUT_DESC_ID}">${escapeHtml(c.episodeDescription)}</p>${toggleHtml}</div>`
    : "";

  const copyBodyHtml = hasCopyBody
    ? `<div class="billboard__copy-body${hasDesc ? " has-desc" : ""}">${descHtml}${subjectsHtml}</div>`
    : "";

  return `
<section class="billboard has-art-aspect" aria-roledescription="carousel" aria-label="Featured episodes" data-case="${c.id}">
  <div class="billboard__stages" aria-hidden="true">
    <div class="billboard__stage is-active" style="--hero-art-aspect: 1.777">
      <div class="billboard__stage-motion">
        <div class="billboard__stage-focus-slot">
          <div class="billboard__stage-focus" style="background:linear-gradient(135deg,#5a4630,#c9b08a)"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="billboard__grain" aria-hidden="true"></div>
  <div class="billboard__scrim" aria-hidden="true"></div>
  <div class="billboard__vignette" aria-hidden="true"></div>
  <div class="billboard__art-hover" aria-hidden="true"></div>
  <div class="billboard__content">
    <div class="billboard__feature">
      <div class="billboard__copy">
        <p class="billboard__eyebrow"><span class="billboard__live" aria-hidden="true"></span> Now featuring</p>
        <p class="hero-show"><span class="hero-pill">${escapeHtml(c.podcastName)}</span></p>
        <h1 class="billboard__title"><a class="billboard__title-link" href="#">${escapeHtml(c.episodeTitle)}</a></h1>
        <p class="hero-meta">
          <span>${escapeHtml(c.releaseLabel)}</span>
          <span class="hero-meta__dot" aria-hidden="true">·</span>
          <span>${escapeHtml(c.durationLabel)}</span>
        </p>
        ${copyBodyHtml}
      </div>
      <div class="billboard__actions">
        <button type="button" class="billboard__play">Watch</button>
        <app-queue-button class="billboard__queue"><button type="button" class="queue-button queue-button--pill" aria-pressed="false">Add to Queue</button></app-queue-button>
      </div>
    </div>
  </div>
  <div class="billboard__controls">
    <div class="billboard__pager">
      <button type="button" class="billboard__nav billboard__nav--prev" aria-label="Previous">‹</button>
      <div class="billboard__dots-viewport">
        <div class="billboard__dots" role="tablist" aria-label="Featured episodes">
          <button type="button" class="billboard__dot is-active" role="tab" aria-selected="true">
            <span class="billboard__dot-fill is-running"></span>
          </button>
          <button type="button" class="billboard__dot" role="tab" aria-selected="false">
            <span class="billboard__dot-fill"></span>
          </button>
        </div>
      </div>
      <button type="button" class="billboard__nav billboard__nav--next" aria-label="Next">›</button>
    </div>
  </div>
</section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Mock stats strip (app-homepage-catalogue) under the hero: the real component's Sass is
 * compiled into the harness, so its -28px overlap and z-index match production (HERO-DSC-004).
 */
export function renderStatsStripHtml(): string {
  const stat = (label: string, value: string, hero = false) =>
    `<div class="catalogue__stat${hero ? " catalogue__stat--hero" : ""} is-active" role="group" aria-label="${label}">` +
    `<p class="catalogue__value">${value}</p><p class="catalogue__label">${label}</p></div>`;
  return `
<app-homepage-catalogue>
  <section class="catalogue" aria-label="Catalogue scale">
    <div class="catalogue__viewport">
      <div class="catalogue__inner">
        ${stat("New this week", "123")}${stat("Episodes in the index", "45,678", true)}${stat("Days of listening", "1234")}
      </div>
    </div>
  </section>
</app-homepage-catalogue>
<div class="hero-layout-rails" aria-label="Rails (mock)">
  ${Array.from({ length: 3 }, (_, i) => `<div class="hero-layout-rail">Rail ${i + 1}</div>`).join("")}
</div>`;
}
