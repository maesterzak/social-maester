# social-maester

Separate tool from PathMaester (never import its code). Posts up to 3 selected jobs/scholarships at once to
X, Facebook Page, LinkedIn, Telegram (picture card) and Instagram Reels, TikTok, YouTube Shorts (slideshow video + music).

**Stack:** Next.js 16.4 (App Router; pages call `await connection()`), React 19, zod v4, built-in `node:sqlite`
(`data/social.db`), `@resvg/resvg-js` (SVG → PNG cards), ffmpeg via PATH/`FFMPEG_PATH`, plain CSS, pnpm.
Credentials only in `.env`; `DRY_RUN=1` makes media but sends nothing.

**Entry points**
- Data: `src/lib/db.ts` (own SQLite: campaigns, music, connections; `all/get/run` copy rows to plain objects),
  `opportunities.ts` (ONLY reader of jobs, async): PathMaester `public.opportunities` via `pathmaester-db.ts`
  (pg pool, every query in `BEGIN READ ONLY`) when PATHMAESTER_DATABASE_URL is set, else SQLite samples.
  Public = PUBLIC + del_flg 'N' (+ open deadline for the list), same as PathMaester. `pathmaester-links.ts` is
  ported from PathMaester `lib/opportunities/public-path.ts` (keep in step); `linkFor(o, platform)` adds UTM.
- Posting: `campaigns.ts` (zod input, max 3, create/retry), `worker.ts` (in-process queue started from
  `src/instrumentation.ts`; renders media per item then posts one by one; `recover()` marks interrupted posts failed)
- Platforms: `lib/platforms/index.ts` (registry, env keys, dry run) + `x.ts` (OAuth 1.0a), `meta.ts`
  (FB photos, IG Reels resumable upload), `tiktok.ts` (refresh token → kv `tiktok_tokens`), `linkedin.ts`, `telegram.ts`
- Accounts: `connections.ts` (table `connections`, data keyed by .env names; `setting()` = connection → .env;
  OAuth state in kv), `lib/connect/{x,meta,linkedin,tiktok,telegram}.ts` (start/callback/test) + `index.ts`
  (setup steps). Routes `api/connect/[id]/{start,callback,test}`; UI `settings/page.tsx` + `account-card.tsx`.
  APP_URL (default http://127.0.0.1:3011) builds callbacks; TikTok needs https.
- Share myself (campaigns.mode 'manual', migration in db.ts `COLUMNS`): worker renders media, posts → 'ready';
  `share-links.ts` (prefill URL per platform), `components/share-kit.tsx` (Open all = copy caption first, then tabs;
  `openTab` without noopener), `markPost` + `api/posts/[id]/mark`. WhatsApp is manual-only. Public `/s/[id]`
  page (OG tags) outside the `(admin)` route group; `linkFor` uses it when APP_URL is https.
- Media: `media/card.ts` (feed 1080x1350 / story 1080x1920, no emoji), `media/video.ts` (xfade slideshow,
  blurred fill, looped+faded music), `media/ffmpeg.ts`; captions `caption.ts`, lengths `text-length.ts`
- UI (route group `app/(admin)/`, own layout with nav): `page.tsx` → `components/composer.tsx` (+ `item-editor.tsx`, `music-panel.tsx`),
  `campaigns/[id]` → `campaign-view.tsx` (polls), `settings`; files served by `api/files/[...path]`

- Audiences: `lib/segments.ts` (pure, used by server and browser) `classify(o)` → DIGITAL / PHYSICAL work style,
  STARTER (level NONE or ENTRY), SCHOLARSHIP (+ study levels, funded). Drives the hub in `composer.tsx` (smart sets,
  audience tabs, sub-filters, weekday theme `WEEK_THEMES`), `caption.ts` (`audienceHeadline`, "Best for" line, hashtags),
  the card pill (`media/card.ts`) and music auto pick (`lib/catalog.ts` `PICKS`). "NO EXPERIENCE NEEDED" is only
  written when the listing says so (`noExperienceStated`); otherwise "EASY-ENTRY JOB".
- Music catalog: `lib/catalog.ts` (43 Mixkit tracks) + `api/music/catalog` (download into data/music) + `music-panel.tsx`.
- YouTube Shorts: `platforms/youtube.ts` (resumable upload, refresh token → kv `youtube_token`), `connect/youtube.ts` (Google OAuth).
- Share kit: Safari opens one tab per click, so blocked tabs go to an "Open next" queue; video platforms download the video once.

- Intelligence (`lib/intel.ts`, pure rules, runs in the browser, no AI service): `parseIntent` (ask bar → audience/sub/
  remote/soon/fresh + leftover text; composer relaxes the timing words when nothing matches), `reachScore` (0–99 with
  reasons, default sort), `hookLines` (alternative opening lines, item-editor "New opening line"), `BEST_TIMES` (rules of thumb).
- Maester's pick (`intel.ts` `maesterPick`/`drawScore`/`PLATFORM_CROWD`): reach + who can apply (audience is worldwide: unrestricted
  remote and scholarships gain, country-bound jobs lose points) + average fit with the ticked platforms' crowds. Composer pre-selects it once on load.
- Who can apply: `lib/eligibility.ts` `whoCanApply(o)` reads eligibility lines/summary/location → scope WORLD / REGION /
  COUNTRY / UNKNOWN + an "Open to: …" label (on Segment as `scope`/`scopeLabel`). Used by the pick score (audience is
  worldwide), the "Open worldwide" filter + badges, and the caption line. COUNTRY quotes the listing's own line.
- Hub flow ("Broadcast Studio", `composer.tsx`): mission bar (streak / weekly goal / audience balance / prime-time
  countdown; data from `lib/mission.ts` `missionStats`, client clock via `intel.ts` `nextPrime`) → Act 1 Scout
  (Tonight's lineup = Maester's pick, smart-set strip, ask bar, filters, Deck or List) → Act 2 Craft (How/Where/Sound,
  `phone-preview.tsx` live phone per platform, `item-editor.tsx` with controlled `tab`) → floating `.dock` with the
  3 slots and the main button. `deck.tsx`: ←/J skip, →/K add, Backspace back. Cards cached 10 min in memory
  (`api/card`); `api/files` streams with a pull-based ReadableStream (Readable.toWeb crashed on aborted ranges).
- Top 5 digests (campaigns.kind 'digest' + title, migration in db.ts `COLUMNS`): one post per platform listing 2–5
  opportunities. All items are campaign_items; posts hang on the FIRST item, which also holds the digest media
  (`worker.ts` `renderDigest`: `card.ts` `writeDigestCard` TOP-N picture + `writeDigestSlides` cover + one story slide
  each). Captions `caption.ts` `buildDigestCaption` (X/Telegram: one link to PathMaester /jobs or /scholarships via
  `digestLink`; others a link per item). `SENT_ITEMS_SQL` in campaigns.ts counts every digest item as posted (postedTo,
  mission). UI: composer format switch, `lib/digest-themes.ts` ideas (titles are promises: rules need evidence),
  `digest-editor.tsx`, routes `api/digest` (captions) and `api/digest/card` (picture).
- Link in bio (TikTok, Instagram Reels, YouTube Shorts can't make caption links tappable; only the profile link is):
  `lib/bio.ts` `bioLink()` = saved kv `bio_url` / BIO_URL → else `${APP_URL}/bio` when https → else PathMaester home
  (its /jobs has `?q=` search). Captions on linksDead platforms say "tap the link in our bio, then search “<searchTerm>”"
  (`caption.ts` `bioLine`). Public `app/bio/page.tsx` + `components/bio-list.tsx` lists `recentlyShared()` campaigns
  (ready/done, not dry run, still open) with Apply buttons; `?from=` sets utm_source, `?q=` pre-fills search.
  Accounts page `bio-card.tsx` (+ `api/bio`); share kit shows a "Copy bio link" reminder on video platforms.
- Look: `globals.css` — Studio (dark, default) / Paper (light) via `data-theme="paper"` on <html>, set before paint
  by the inline script in `app/layout.tsx` from localStorage `sm-theme`; toggle `theme-toggle.tsx` in the rail.
  Volt accent #d4ff3a; one colour per audience via `.a-<AUDIENCE>` (`--a`/`--a-soft`); aurora tinted by today's theme.

**Commands:** `pnpm dev` (port 3011) · `pnpm typecheck` · `pnpm seed`. Launch config `social-maester`.

**Current focus (2026-11-16):** opportunity hub (audience sorting, smart sets), YouTube Shorts, music catalog, Safari share fix. Not yet tested with a real YouTube account. Earlier (2026-11-09): reads live PathMaester jobs (720 open), posts link to PathMaester pages; 10 Mixkit
tracks in data/music (credits in README). Before that (2026-11-08): "Share myself" mode added and verified (tabs/downloads stubbed in tests).
No login on the tool yet: needed before public hosting. Earlier (2026-11-02): v1 + Connect buttons for all 6 platforms, verified in dry run and with fake
app keys (login URLs, Meta page picker). No real account connected yet: the user must create the developer
apps. User will host it (no tunnel): TikTok gets connected on the hosted https site. Hosting needs a
long-running server with a disk + ffmpeg (SQLite, data/ files, in-process worker) — not Netlify functions.
Ideas: YouTube Shorts, scheduling, PathMaester DB.
