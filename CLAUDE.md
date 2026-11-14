# social-maester

Separate tool from PathMaester (never import its code). Posts up to 3 selected jobs/scholarships at once to
X, Facebook Page, LinkedIn, Telegram (picture card) and Instagram Reels, TikTok (slideshow video + music).

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

**Commands:** `pnpm dev` (port 3011) · `pnpm typecheck` · `pnpm seed`. Launch config `social-maester`.

**Current focus (2026-11-09):** reads live PathMaester jobs (720 open), posts link to PathMaester pages; 10 Mixkit
tracks in data/music (credits in README). Before that (2026-11-08): "Share myself" mode added and verified (tabs/downloads stubbed in tests).
No login on the tool yet: needed before public hosting. Earlier (2026-11-02): v1 + Connect buttons for all 6 platforms, verified in dry run and with fake
app keys (login URLs, Meta page picker). No real account connected yet: the user must create the developer
apps. User will host it (no tunnel): TikTok gets connected on the hosted https site. Hosting needs a
long-running server with a disk + ffmpeg (SQLite, data/ files, in-process worker) — not Netlify functions.
Ideas: YouTube Shorts, scheduling, PathMaester DB.
