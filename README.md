# Social Maester

Social media posting tool for PathMaester jobs and scholarships. Select up to **3** at once, pick platforms,
then either share them yourself from prepared tabs or auto-post through the APIs:

- **Picture posts** (X, Facebook Page, LinkedIn, Telegram channel): an auto-made 4:5 card + caption.
- **Video posts** (Instagram Reels, TikTok): a 9:16 slideshow (vertical card + any extra pictures) with
  **background music** you upload, choosing the start point and volume. "Preview video" shows the exact result first.

Captions are generated for each platform (X fits 280 chars) and can be edited before posting.

- Created: 2026-11-02
- Status: active
- Separate tool from PathMaester: reads its jobs/scholarships (read-only); its own data (history, music) is in SQLite (`data/social.db`).

## Run

```bash
pnpm install
cp .env.example .env     # DRY_RUN=1 by default: media is made, nothing is sent
pnpm seed                # sample jobs/scholarships
pnpm dev                 # http://localhost:3011
```

Needs **ffmpeg** on PATH (or `FFMPEG_PATH` in `.env`) for the videos. Settings page shows what's set up.

## Share myself (no API keys needed)

Choose **Share myself** on the Post page, then **Prepare**. On the next page, **Open all platforms** opens
X, Facebook, LinkedIn, Telegram, WhatsApp, Instagram and TikTok each in its own tab with the post prepared,
downloads the picture/video, and copies the caption that can't be prefilled. Attach the file, click Post,
then tick **Shared**.

- Allow pop-ups for the app's address once, or the browser opens only the first tab.
- Text is prefilled on X, LinkedIn, Telegram and WhatsApp. Facebook, Instagram and TikTok don't allow it,
  so paste the copied caption. No platform lets another site attach a file.
- Once hosted on https (`APP_URL`), post links go to the public page `/s/<id>`, so link previews show the card.
  The tool itself has no login yet: add one before hosting it publicly.

## Auto-post (going live)

Open **Accounts** (http://127.0.0.1:3011/settings). For each platform:

1. Create your own developer app (steps + link on the page) and register the callback URL shown there.
2. Put the app's client id/secret in `.env`, restart.
3. Click **Connect** and log in (Telegram: paste bot token + channel), then **Test**.

Set `DRY_RUN=0` to post for real. Account tokens are saved in `data/social.db` (gitignored); app secrets stay in `.env`.

- X: posting needs a paid API plan. Use `127.0.0.1`, not `localhost` (X rejects localhost callbacks).
- Instagram: professional account linked to the Facebook Page; one Meta login covers both.
- TikTok: login callbacks must be https, so set `APP_URL` to a tunnel or the deployed site. Posts stay
  private (SELF_ONLY) until TikTok audits the app.
- LinkedIn: tokens last 60 days; the page shows when to reconnect.

## PathMaester connection

Jobs and scholarships come live from PathMaester's database (`PATHMAESTER_DATABASE_URL`, the same Neon DB
job-scraper uses). The tool only reads: every query runs in a READ ONLY transaction, so the database rejects
any write. It shows what PathMaester shows publicly (PUBLIC, not deleted, deadline today or later).
Posts link to the PathMaester page (`PATHMAESTER_URL` + `/jobs|/scholarships/<slug>--<id>`) with
`utm_source=<platform>&utm_medium=social&utm_campaign=social-maester`, so Analytics shows visits per platform.
Leave `PATHMAESTER_DATABASE_URL` empty to use the local sample jobs (`pnpm seed`).

## Music library

Background tracks live in `data/music/` (gitignored) and are added from the Post page (Upload music).
Added 2026-11-09 from [Mixkit](https://mixkit.co/free-stock-music/), Mixkit Stock Music Free License
(free for social media/ads/YouTube, no attribution). Keep this list in case a platform ever claims a track:

| Track | Artist | Source file |
|---|---|---|
| Driving Ambition | Ahjay Stelino | https://assets.mixkit.co/music/32/32.mp3 |
| Dreaming Big | Ahjay Stelino | https://assets.mixkit.co/music/31/31.mp3 |
| Raising Me Higher | Ahjay Stelino | https://assets.mixkit.co/music/34/34.mp3 |
| Motivating Mornings | Ahjay Stelino | https://assets.mixkit.co/music/33/33.mp3 |
| Running Out of Time | Ahjay Stelino | https://assets.mixkit.co/music/77/77.mp3 |
| Better Times are Coming | Alejandro Magaña | https://assets.mixkit.co/music/173/173.mp3 |
| Happy Times | Alejandro Magaña | https://assets.mixkit.co/music/158/158.mp3 |
| Digital Clouds | Alejandro Magaña | https://assets.mixkit.co/music/175/175.mp3 |
| Close Up | Michael Ramir C. | https://assets.mixkit.co/music/1167/1167.mp3 |
| Tears of Joy | Michael Ramir C. | https://assets.mixkit.co/music/839/839.mp3 |
