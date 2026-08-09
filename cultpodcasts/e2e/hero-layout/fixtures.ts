/**
 * Episode/layout fixtures for homepage-hero geometry e2e (HERO-SCR-* / HERO-SUB-*).
 * HTML mirrors the billboard copy structure in homepage-hero.component.html.
 */

export type HeroLayoutCaseId =
  | "short-title-no-desc"
  | "short-title-with-desc"
  | "long-title-with-desc"
  | "empty-desc-with-subjects"
  | "many-subjects-with-desc"
  | "many-subjects-no-desc";

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
}

const MANY_SUBJECTS = Array.from({ length: 12 }, (_, i) => `Topic ${i + 1}`);

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
];

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

  const descHtml = hasDesc
    ? `<p class="billboard__desc">${escapeHtml(c.episodeDescription)}</p>`
    : "";

  const copyBodyHtml = hasCopyBody
    ? `<div class="billboard__copy-body${hasDesc ? " has-desc" : ""}">${descHtml}${subjectsHtml}</div>`
    : "";

  return `
<section class="billboard has-art-aspect" aria-label="Featured episodes" data-case="${c.id}">
  <div class="billboard__stages" aria-hidden="true">
    <div class="billboard__stage is-active" style="--hero-art-aspect: 1.777">
      <div class="billboard__stage-motion">
        <div class="billboard__stage-focus-slot">
          <div class="billboard__stage-focus" style="background:#333"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="billboard__grain" aria-hidden="true"></div>
  <div class="billboard__scrim" aria-hidden="true"></div>
  <div class="billboard__vignette" aria-hidden="true"></div>
  <div class="billboard__content">
    <div class="billboard__feature">
      <div class="billboard__copy">
        <p class="billboard__eyebrow"><span class="billboard__live" aria-hidden="true"></span> Now featuring</p>
        <p class="hero-show"><span class="hero-pill">${escapeHtml(c.podcastName)}</span></p>
        <h1 class="billboard__title">${escapeHtml(c.episodeTitle)}</h1>
        <p class="hero-meta">
          <span>${escapeHtml(c.releaseLabel)}</span>
          <span class="hero-meta__dot" aria-hidden="true">·</span>
          <span>${escapeHtml(c.durationLabel)}</span>
        </p>
        ${copyBodyHtml}
      </div>
      <div class="billboard__actions">
        <button type="button" class="billboard__play">Watch</button>
        <a class="billboard__more" href="#">More info</a>
      </div>
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
