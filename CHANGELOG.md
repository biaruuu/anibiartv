# Changelog

## 1.35.0

- **Live photo length fixed**: the clip is now recorded frame by frame (`requestFrame`), so a picture that does not move is recorded for the full 5-60 seconds instead of ending after about 3 seconds, and a refresh of your lists no longer restarts the recording.
- **Profile effect intro redone**, much closer to Discord's: a full-profile blood-red web of glowing cracks grows across the whole profile from two points, glossy blood beads form in the cells and black ink creeps in from the edges. It plays when the profile opens, melts into a soft shimmering loop, and plays again every 14 seconds. Animated WebP (smaller than APNG, keeps transparency); also in the Share picture and Live clip.
- **Profile frame** now sits on top of the banner only and no longer changes the page layout.

## 1.34.0

- Exclusive "Blood War" profile art (original Bleach: Thousand-Year Blood War-inspired artwork, rendered with Python + headless Chromium in `scripts/gen_profile_art.py`):
  - **Profile effect intro**: a full-profile animation that plays when the profile opens (black ink surge, red cracks of light, a crescent slash), then a soft loop of ash, embers and black flames stays on top. Shown on the profile, the Edit profile preview, the Share picture and the Live clip.
  - **Profile frame**: an animated thorn-and-blood-moon frame drawn around the profile card (9-slice, so it fits every screen size).
  - Both are pickable in Edit profile. They live in Supabase (`profile_art`; `profiles.intro` and `profiles.frame`), are served by `/api/profile-art` and cached in Upstash Redis.
- Sharper, smaller avatar: 96px (was 112px) on phones, a thin 4px ring around the picture like Discord, a crisper effect ring, high-quality scaling in the share picture. Decorations keep the same fit.

## 1.33.0

- New exclusive avatar decoration, "Reiatsu": an original Bleach: Thousand-Year Blood War-inspired spirit-pressure aura. A crimson ring with black flame tongues, a sweeping black-and-white crescent slash, moth-like spirit butterflies and drifting reishi motes. Original artwork (no characters, logos or anime frames), rendered with Python + headless Chromium like the other generated decorations, and shown on the profile, Edit profile preview, Share picture and Live clip.

## 1.32.0

- 7 more animated avatar decorations from your files: Violet flames, Neon ring, Butterflies, Sunburst, Droplets, Lightning and Hearts (13 in total with Cat ears, Bunny, Halo, Crown, Flames, Frost). Same Discord fit (1.2x the avatar picture), same Supabase list (`avatar_decorations`) and Redis cache.
- The picker uses a small still preview of each decoration (`*.thumb.png`) so opening Edit profile does not download every animation. The share sprite sheets are 256-colour PNGs (about 14 MB of decoration files in total instead of 25 MB).

## 1.31.0

- Avatar decorations now use real animated artwork instead of SVG shapes. Your supplied animated cat-ears file (60-frame APNG) is the "Cat ears" decoration, fitted the way Discord does it: drawn 1.2x the avatar picture, centred on it and on top of it. Five more were rendered with Python + headless Chromium (`scripts/gen_decorations.py`): Bunny, Halo, Crown, Flames, Frost.
- The list lives in Supabase (`avatar_decorations`, public read; `profiles.decoration` references it), is served by `/api/decorations` and cached in Upstash Redis, with a built-in copy as a fallback.
- Page: animated PNG. Share picture / Live clip: a sprite sheet of the same frames, so the decoration moves in the Live clip too. The name is redrawn each frame so big decorations never smear it.

## 1.30.0

- Avatar decorations, separate from the profile effect: Cat, Bunny, Halo and Crown. They are drawn from SVG paths (original artwork, animated: ears twitch, halo floats, jewels sparkle), pickable in Edit profile (new `profiles.decoration` column), shown on the profile, and included in the Share picture and Live clip.

## 1.29.0

- 6 more animated profile effects (9 in total): Lanterns, Fireworks, Koi, Rain, Watercolor and Lofi notes, each with its own spinning ring colours. They run on the profile page, in the Edit profile preview, in the Share picture and in the Live clip. Pick one in Edit profile.
- The two uploaded Lofi / Lunar New Year `.css` files only work inside Discord's own app (they target Discord's page classes and load Discord's artwork from its servers), so they are not copied in; these are original effects in the same spirit.

## 1.28.0

- Whole site recoloured to Discord's Onyx dark theme: pure black base, near-black cards, grey text (#949ba4), Discord-style borders; blurple (#5865f2) for the active profile tab and Edit profile.
- Profile effects: 3 animated looks (Neon sparkles, Sakura petals, Ember) = spinning colour ring around the avatar plus particles over the banner. Pick one (or None) in Edit profile; saved in `profiles.effect` (new column). They also show on the Share picture and move in the Live clip.
- Tab counters removed from the profile and the share picture. The share picture/Live show the first 3 items only; Full page removed.

## 1.27.0

- Share: Video and Record my screen are removed. Modes are Screenshot and Live.
- Live now includes every item (it scrolls down through the whole list like a screen recording, so 4 favorites show all 4), keeps GIFs moving, and you pick the length: 5, 10, 20 (default), 30 or 60 seconds.
- Screenshot has a new Full page size that puts every item on one tall picture.
- Upstash Redis now backs the account data: `/api/me/library` returns the profile, History, Favorites and Watchlist from Redis (rebuilt from Supabase when missing), writes refresh the cache and move a per-account version, and open pages check that version every 6 seconds (and on focus) so changes from another device appear without a reload. Without Redis it falls back to Supabase directly.

## 1.26.0

- Share video is now a plain recording of only the tab you picked (no tab switching, zoom or fades). GIF banners and avatars now keep moving in the video (GIFs are decoded frame by frame in `lib/gif.ts`).
- New Live mode, like an iPhone Live Photo: a 3 second looping clip with a LIVE badge, saved as a short video. Share modes are Screenshot, Live and Video (8 seconds).

## 1.25.0

- Share now lets you choose Screenshot or Video. Video is made automatically in the browser: your profile tabs play one after another (slow zoom and crossfade) as a vertical MP4 (WebM where MP4 is not supported), with a progress bar, preview, Save video and native Share.
- "Record my screen instead" on browsers that support screen capture (desktop): records the screen with a floating Stop button, then previews and saves it.

## 1.24.2

- Share picture is now a true copy of the profile screen: same sizes and fonts as the page on a phone, 3 poster cards per row, tab counts, and no footer logo or site name.
- Defaults to My screen (the shape of the device's own screen); Story 9:16 and Post 4:5 still available. If a shape is too short it enlarges the canvas, then drops Member Since / Bio so at least one full row of cards shows.

## 1.24.1

- Share picture now looks like the profile page: banner, avatar, name, @username, Bio, Member Since (with the logo), the History / Favorites / Watchlist tab bar with the active underline, and that tab's list.
- Picture size picker: Story 9:16, Post 4:5 or My screen (matches the shape of the device's own screen). Layout scales so everything fits each size.

## 1.24.0

- Share button on the profile: a 9:16 (1080 x 1920) story picture of your profile (banner, avatar, name, username, bio and your History, Favorites or Watchlist, whichever tab you pick) with Save image and Share (native share sheet where the phone supports it). Made in the browser; images go through `/api/img` (allow-listed hosts) so they can be drawn.
- Edit profile button is smaller.

## 1.23.0

- Bottom navigation bar on phones and tablets: Home, Search, Profile (your avatar) and Settings. Hidden on the profile, settings, login and watch pages.
- Profile shows your display name and your @username (the email is no longer shown there). Usernames are unique and stored in Supabase (`profiles.handle`).
- New Settings page (`/settings`) styled like Discord's account screen, with Account Information: Username, Display Name and Email, each editable. Settings is also in the top menu on desktop.

## 1.22.3

- Fixed the avatar being drawn underneath the banner (it looked cut off / glassy). It now sits fully on top, with a solid ring, like Discord.

## 1.22.2

- Profile page has no site header or footer, so the banner is fully visible; a close (X) button in the corner goes back. Bio and Member Since (long date like January 20, 2021, with the AniBiar logo) are laid out like a Discord profile.
- Tabs are now History / Favorites / Watchlist (My List renamed), with no icons.

## 1.22.1

- Profile page redesigned like a Discord profile: full-width banner under the header, large avatar overlapping it, name, email and joined-date chips, About me (bio), full-width Edit profile button, and underlined tabs History / Favorites / My List.
- New Favorites list (heart button on the watch page) stored in Supabase; bio field.
- Fixed "That image could not be read": avatar and banner now upload as-is (PNG, JPG, WebP, GIF up to 8 MB) instead of being re-drawn in the browser.

## 1.22.0

- New profile page (`/profile`): avatar, Discord-style banner (PNG, JPG, WebP or animated GIF, up to 8 MB) and display name you can change, with History and My List as switchable tabs. Images are stored in Supabase Storage (`profiles` bucket, each user can only change their own files).
- Menu now has Profile, Home and Search; History, My List and the test Video player entries were removed. `/library` redirects to the profile page.
- Removed the old `/watch` demo page. The anime watch page and its video player (`/watch/:id`) are unchanged.

## 1.21.4

- When a phone's browser is stuck in "Desktop site" mode, a notice explains how to switch it off (a website cannot do that itself).

## 1.21.3

- Explicit mobile viewport and no sideways overflow, so pages stay in mobile layout after signing in; sign-in redirect is now a no-store 303.

## 1.21.2

- Direct Google / Discord sign-in on your own domain is back (needs the Vercel environment variables). Falls back to the Supabase-hosted sign-in if they are missing.

## 1.21.1

- Reverted direct Google / Discord sign-in. Login uses Supabase only, no extra environment variables needed.

## 1.21.0

- Google and Discord sign-in now go straight from your own domain (`/auth/start/<provider>` and `/auth/callback/<provider>`), so the consent screens no longer say "continue to ...supabase.co". Needs `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID/SECRET` and `DISCORD_CLIENT_SECRET`; until they are set it falls back to the Supabase-hosted sign-in.

## 1.20.3

- New app logo (glassy white "A" with a play button, transparent background) used as the favicon, home-screen icon and in the footer. The header logo is unchanged.

## 1.20.2

- Login / sign up restyled to match the rest of the site (flat dark card, white buttons, no gradients or glows).
- New `/privacy` (Privacy Policy) and `/terms` (Terms of Service) pages, linked in the footer and on the login page. Optional `NEXT_PUBLIC_CONTACT_EMAIL` adds a contact address to both.

## 1.20.1

- Redesigned login / sign up page: site header with the logo, glass card, sliding tabs, Google and Discord side by side, icons in the fields, responsive layout. "Back to home" removed.
- Sign-in always returns to the site you signed in on; a stray `?code=` link is finished automatically.

## 1.20.0

- Accounts with Supabase: log in / sign up with Google, Discord or email and password (`/login`).
- Database tables `profiles`, `watch_history` and `my_list`, protected by row-level security.
- Continue Watching row on the home page (resumes where you stopped); works signed out (this device) and signed in (every device). History and My List page at `/library`.
- Home "Dub" tab now only lists latest episodes that really have an English dub on the servers.
- New Miruro-style menu with profile, History, My List, Search and login / logout.

## 1.19.1

- Skip intro / outro now shows on every server: when a server has no timings, a backup list (AniSkip) is used, cached in Redis. Times are ignored if the video length differs a lot.
- The "Auto skip intro/outro" setting shows "No data" when an episode has no timings.
- Smaller subtitles (default size reduced).

## 1.19.0

### Added
- Skip intro / outro. While playback is inside an intro or outro, a white "Skip Intro" / "Skip Outro" button appears bottom right. With "Auto skip intro/outro" on (a row in the player settings, on by default) the player skips by itself and shows "Intro skipped" / "Outro skipped" with an Undo button for 5 seconds. An outro that runs to the end of the video jumps to the end, so Auto next episode starts the next one. Scrubbing into a range, or pressing Undo, never triggers another auto skip.
- The times come from each server's own copy of the episode (the Nova/Lyra-type servers that provide them); a server without times simply shows no Skip button.

### Changed
- The centre play / pause and ±10 second buttons are about 15% smaller, with slightly smaller icons.

## 1.18.0

### Fixed
- Captions no longer move when the controls appear or hide. They used to jump up into the middle of the video and sit under the play and seek buttons, especially in small players. They now stay in one place just above the seek bar, centred.

### Changed
- Easier to read captions: a bit larger (Small is now 0.9, Medium 1.1, Large 1.4 of the base size), bold with a thicker round outline and a soft shadow, balanced line breaks so two lines are about equal, and a narrower maximum width. The Dark box style has a slightly softer shadow.
- Open Sans is bundled as the fallback after Trebuchet MS, so phones and Linux, which have no Trebuchet, get a similar look instead of the system default.

## 1.17.2

### Changed
- Stream and subtitle links are now sealed into one opaque encrypted token instead of carrying the real video host name in the address, so no provider or video site name shows in the browser's network list. Tampered or foreign tokens are refused.

## 1.17.1

### Added
- `/api/health` shows whether Redis is connected (it writes and reads back a test value and reports the time), and whether the streaming address and TMDB key are set. It never shows keys.

### Fixed
- Cast: the old button used the browser's Remote Playback, which cannot cast a video played through hls.js. It now uses Google's Cast sender (Chrome, Edge and other Chromium browsers) and sends the TV the stream address and your current position; Safari falls back to AirPlay.
- Autoplay: the player now starts the video itself once it can play (the HTML autoplay attribute is unreliable with hls.js and when the source changes). If the browser blocks autoplay with sound, it starts muted and tells you to tap the volume button.
- Auto next episode: some streams never fire the "ended" event. The player now also treats the last quarter second as the end, so the next episode starts.

## 1.17.0

### Added
- Redis cache (Upstash, no extra package): episode lists, stream sources, AniList answers and TMDB artwork are shared between all visitors and served from Redis, with an older copy used when the source fails. AniList now goes through `/api/anilist` first and the browser only asks AniList directly if that can't answer. TMDB goes through `/api/tmdb`, which also keeps the TMDB key off the browser (use `TMDB_KEY`). Works without Redis too, with a short memory cache.
- Quality in the player settings: Auto or a fixed height (1080p, 720p...), remembered between videos. It shows when the stream offers more than one quality.

### Changed
- Player settings: Loop, Subtitle delay and Picture in picture are removed. Subtitles never have a delay.
- English is always the default caption (the first English track, otherwise the first track).
- HLS plays with hls.js whenever the browser supports it (native HLS only as a fallback), which also gives quality control.

### Fixed
- The site switched to another server while the current one was working. It now only moves to the next server if the current one fails before playback has started. A hiccup during playback is retried on the same server (network errors up to 4 times, decode errors up to 3), and the server you choose stays selected from episode to episode.
- Captions could show the previous episode's lines, because caption files were cached under an id that repeated for every episode.

## 1.16.0

### Changed
- Server names are invented (Nova, Orion, Lyra, Atlas, Comet...). Real provider and site names are no longer sent to the browser or shown anywhere: the API returns opaque ids and our own names, and error messages are generic.
- The Audio and Server menus now fit any screen: on phones they open at the full width of the row, on larger screens they size to their content, and long lists scroll.
- The three-dot menu is gone. Autoplay and Auto next episode are now rows in the video player's own settings menu.
- Seasons use the start year when AniList has no season year.

### Fixed
- Volume boost: the limiter used to sit at -6 dB and cancelled most of the boost. It now sits just under 0 dB, and the steps are 0%, 100%, 200% and 300%.

## 1.15.0

### Changed
- Streaming now uses several Anivexa providers at once instead of only `anipm` (ani.pm blocks Vercel-hosted servers, so every title failed). Defaults are `anikoto` (HLS, soft subtitles), `aniwaves` (HLS) and `animegg` (MP4), the ones that returned real streams on your API. Set `ANIVEXA_PROVIDERS` to change them.
- Episode lists from all providers are merged by episode number. The Server menu lists every working server for the episode (HD-1, Vidstream-1, Vidplay, Animegg...) with s-sub / h-sub badges.
- If a server fails to play, the next one is tried automatically.
- Subtitle thumbnail tracks (seek-bar previews) are no longer offered as captions.
- Watch and episode data are no longer cached on the server, so a temporary provider error can't stick.

## 1.14.1

### Changed
- When the Anivexa API answers "could not confidently map", the watch page now explains that ani.pm is blocking the server that hosts the API (as happens on Vercel) and what to do, instead of the bare provider error.

## 1.14.0

### Added
- New watch page at `/watch/:anilistId` in Miruro's layout: edge-to-edge player, episode number, date and title, Audio (Sub/Dub), Server and Playback menus, previous / Episodes / next bar, anime card with synopsis toggle and My List button, Seasons grid (built from AniList PREQUEL/SEQUEL links), and an episode list with thumbnails, synopses, air dates, reverse, hide synopses and grid view. On phones the list opens under the player; on desktop it is a sticky side panel.
- Streaming through the `anipm` provider of Anivexa-API: `/api/anime/:id/episodes`, `/api/anime/:id/watch` and a signed `/api/proxy` that adds the required Referer, rewrites HLS playlists and serves subtitles with CORS. Needs `ANIVEXA_API_URL` (see README).
- The video player plays HLS (`.m3u8`) with hls.js, or natively on Safari. It stays mounted between episodes so auto-next keeps fullscreen.

### Changed
- Subtitles use Trebuchet MS (bold, outlined) like Miruro instead of Poppins.
- Watch buttons on the home and info pages open the new watch page.

## 1.13.0

### Changed
- Site font is now Karla (variable), the font Miruro uses, replacing Kumbh Sans. The video player still uses Poppins.
- Colours follow Miruro's styleguide: background #121113, text #eeeef0, secondary text #b5b2bc, softer borders. The accent colour is not used. Page titles use weight 800 like their h1.

## 1.12.1

### Fixed
- Search results: the status (Finished, Airing) dropped to a second line even when there was room, and a separator dot could be left at the end of a line. The details row is now smaller and tighter and each item brings its own separator, so it stays on one line whenever it fits and wraps cleanly otherwise.

## 1.12.0

### Changed
- Site font is now Kumbh Sans (the look of Miruro). The video player keeps Poppins for its captions, menus and labels.
- Search rows follow Miruro: smaller bar and input, format, year, total episodes, a captions badge with the episodes you can watch now (aired so far for a running show), score and status (Finished, Airing, Upcoming). The CC icon is the captions icon used across the site.

### Fixed
- Trending (shown when the search box is empty) was missing score and status.
- A running show showed its total episode count in the captions badge instead of the episodes aired so far.

## 1.11.2

### Fixed
- The page could not be scrolled while search was open. The page behind the search now scrolls normally (the dim layer lets touches through); tapping outside the panel or pressing back closes search.
- The search panel now sizes to its results instead of covering the whole screen.

### Changed
- Search results show the same data as Miruro: format as AniList reports it (TV, OVA, ONA, MOVIE, TV_SHORT), year, episodes, score and status (Finished, Airing, Upcoming).
- Skeleton rows while search results and trending are loading.
- Slightly stronger glass on the header.

## 1.11.1

### Fixed
- "Failed to fetch" and "AniList is busy" errors. AniList allows about 90 requests a minute and the app was sending too many at once (and the browser reports a rate-limited response as "Failed to fetch"). All requests now go through one layer that caches results (memory and session), shares identical in-flight requests, limits how many run at once, and retries with a short backoff. If a request still fails but older data exists, that is shown instead.
- Characters load the first 25 right away and fetch the rest only when you press Show all.
- Every list now has a Try again button when it can't load (featured, Top Airing, Upcoming, info page).

### Changed
- Search is now a glass panel over the dimmed page, like Miruro's.
- Smart search: results update as you type (about 0.2 s), exact and starting-with title matches come first (English, romaji, native and alternate titles) with popularity as the tie-breaker, the typed letters are bold in each title, and if nothing matches the last word is dropped and tried again. Up and down arrows move through results and Enter opens one.
- Empty search shows your recent searches and what is trending.
- The header has a light glass blur once you scroll, like Miruro's.

## 1.11.0

### Fixed
- Characters showed "500" for every anime. AniList caps its character total at 500, so the number was meaningless. The page now loads every character page (25 at a time) and shows the real count.
- Show (franchise) is now built only from AniList data: the whole relation graph is walked, entries are ordered by their real start date (year, month, day), Prequel / Sequel come from PREQUEL / SEQUEL links relative to the current entry, and side stories, spin-offs and summaries use the relation AniList lists. Story order places each special after the season it belongs to.

### Changed
- New search like Miruro's: a full-width bar with a back arrow, outlined input with clear and search buttons, a result list with poster, format, year, episodes, score and status, and "See all results".
- New results page (`/search?q=`) with a poster grid and Load more.

## 1.10.1

### Fixed
- Characters failed with a server error (500) because one AniList request asked for every voice language of every character. Characters now have their own small request per voice language, with a retry button, and more load on demand.
- The Show section only listed the current entry and its direct sequel. It now walks the whole franchise (all seasons, movies, OVAs and specials), labelled Season 1, 2, 3, Movie and Specials.
- Text, chips, buttons and rows on the info page were too large on phones. Everything is smaller and scales up from tablet width.

### Changed
- Dropdowns (sort order, voice language, artwork type) are now custom menus like Miruro's: a glass panel under the button, a check mark on the selected row and counts for artwork types, instead of the browser's radio-style list.
- Show, Related and More like this are horizontal rows with a peek of the next poster.
- Show sort: Story order (seasons, then movies, then specials) or Release order.

## 1.10.0

### Added
- Anime info page (`/anime/[id]`) styled after Miruro's: blurred artwork hero with poster, title, season, score, format and runtime, Watch Now and Add to List, expandable description; About this anime (status, episodes, scores, aired, popularity, native title, genres, studios, external links); Trailer; Show (franchise) with sort; Related; Characters with voice actor language picker; Artwork & Posters; More like this. Data from AniList (artwork from TMDB when a key is set).
- Cards on the home screen, search results and the Top Airing / Upcoming lists now open the info page. Watch Now opens the player.

### Changed
- Header, search and footer are shared components used by every page.

## 1.9.0

### Added
- Top Airing and Upcoming panels on the home screen, styled like Miruro: bordered panels with poster rows, a green or orange status dot, format, year, episode and score badges, and a faint grayscale artwork behind each row. Show more with the chevron. Data from AniList. Side by side on large screens, stacked on phones.

## 1.8.1

### Fixed
- The hero artwork no longer covers the whole page. It fills the hero only and fades into the plain dark page background, so Latest Episodes sits on the normal dark background like Miruro.

## 1.8.0

### Changed
- Home hero now works like Miruro: the featured artwork is a fixed layer behind the page. It stays visible, dimmed more and more, while the Latest Episodes list scrolls over it. The header is slightly see-through.

### Added
- Anime title logos in the hero instead of plain text. They come from TMDB, so set `NEXT_PUBLIC_TMDB_KEY` (see `.env.example`) in Vercel and redeploy. Without a key the plain text title is used.

## 1.7.1

### Fixed
- Home screen was far too large on phones: the heading was cut to "L...", EP labels wrapped, badges and buttons were oversized. Type, spacing and controls are now sized like Miruro (3 posters per row, small badges, compact header and pager).
- Text no longer gets enlarged by Android's font boost (`text-size-adjust`).

### Changed
- Removed the strong glass from the home page. The header is flat (transparent, solid on scroll), the hero chips are subtle and the Details and + buttons are flat.
- Sub/Dub switch is white when selected instead of purple.
- Header has search and menu icons; the menu links to Home and the video player.
- The home page uses Poppins.

## 1.7.0

### Added
- Anime streaming home screen, styled after the reference: full-bleed featured hero (rotating trending anime, glass chips, Watch Now / Details / +), Latest Episodes grid with Sub/Dub switch and 1/5 pager, glass search and header buttons. Data comes from the AniList GraphQL API.
- Search (AniList) from the header.
- The AniBiar TV logo (transparent, text only) in the header.
- /watch page keeps the glass video player. Cards and buttons open it with the anime title and episode; the video itself is a demo until streaming servers are connected.
- Volume boost is now the first row in the player settings (0%, 50%, 100%, 200%) and always visible, with an explanation if a host blocks it.

### Changed
- The site is dark only, to match the reference and the white logo.
- The player page has a Home button and the logo.

## 1.6.0

### Added
- Volume boost (Settings → Volume boost): 150%, 200% or 300%, with a soft limiter against distortion.

### Changed
- The site is now called AniBiar.
- The time and title in the player are plain text with no pill, outline or glass.
- Restyled the page with shadcn/ui: richer header, "Now playing" title card, numbered playlist with a count badge, softer card shadows and a new footer.
- Videos now request CORS access (needed for volume boost). If a host refuses, the player retries without it and hides the boost option.

## 1.5.0

### Changed
- The settings menu is now a glass bubble: a frosted panel with a notch pointing at the settings button, and every row (Captions, Subtitle delay, Caption style, Speed, Loop, Picture in picture) is its own glass capsule. It scales with the player width and scrolls inside the player in short landscape views.
- The time and title pill is outline only (no glass fill).
- Thinner glass everywhere: lighter fill, less blur, hairline edge, slimmer buttons and pills.
- Captions now default to Small size with the Outline background. Older saved caption choices are ignored once so the new defaults apply.

## 1.4.0

### Changed
- Glass bubble redesign of the player controls, matching the reference photos: a frosted-glass pill at the top left (volume, cast) and top right (screenshot, download, captions, settings); glass circles for skip back 10, play/pause and skip forward 10 at 25%, 50% and 75%; a glass time pill (with the video title on wider players) and a glass fullscreen button above a thin progress bar.
- Sizes follow the proportions in the reference at both phone and fullscreen widths. The screenshot and download buttons are now always visible.
- The dim layer over the video is lighter, since the glass provides the contrast.
- The settings menu uses a stronger frosted-glass background.
- Captions sit higher while controls are visible so they never touch the new bottom row.

## 1.3.0

### Fixed
- The page was wider than the phone screen and the player was cut off on the left. The playlist's scroll area stretched the layout to the width of its longest text. The grid now has an explicit single column, the scroll area keeps its width, and the page clips any stray overflow.
- On short landscape screens the 16:9 player is capped to the screen height instead of running off the bottom.

### Changed
- The 10-second skip buttons now sit well to the left and right of the play button (Netflix style) instead of beside it.
- Captions are bolder and larger, with a per-line dark box, and the size scales with the player.
- Website icons now use Lucide; Vidstack icons are used only inside the video player.

### Added
- Caption style menu (Settings → Caption style): Small / Medium / Large, and a Dark box or Outline background. Remembered in the browser.
- "Autoplay next video" switch.
- shadcn Switch and Skeleton components; poster thumbnails show a skeleton while loading.

### Removed
- Previous and next buttons from the player controls.

## 1.2.0

### Removed
- The Dynamic Island pill. Quick feedback (screenshot saved, caption load errors) now uses a small plain notice, and double-tap or arrow-key seeking shows a seek icon.

### Changed
- Tapping or clicking the picture no longer pauses the video. It shows the controls, and tapping again hides them. Pause with the centre button or Space / K. Controls stay visible while paused and auto-hide after 3 seconds of playback.
- Touch screens no longer re-show the controls right after a tap hides them (emulated mouse events are ignored).
- The play button and every other control are smaller and now scale with the player's width instead of fixed pixel sizes.
- Captions scale with the player and use proportional padding.
- The time row shows the video title next to the duration on wider players.
- The player is always 16:9 (except in fullscreen, where it fills the screen) and works at every width.

### Added
- Add subtitles from a link in the Upload tab. Thumbnail preview tracks like `thumbnails.vtt` are detected and rejected with a clear message.
- Agent 327 sample video with real subtitles in English, Spanish, French, German, Italian and Russian, shown first in the playlist.

## 1.1.0

### Added
- Dynamic Island style pill at the top of the player. It rests as a small capsule and springs open for play/pause, seeking, volume, speed, captions, subtitle delay, loop, screenshot, download and "now playing" messages. Responsive: hidden on phones until something happens.
- Drag and drop videos and subtitle files onto the player.
- Subtitle delay control in the settings menu.
- New shadcn/ui components: Tabs, Alert, Label, ScrollArea, Kbd, Spinner.
- Upload tab with a drop zone, a list of added subtitles (with remove buttons) and a link field.

### Changed
- All icons are now Vidstack media-icons (MIT), inlined as SVG components. `lucide-react` is no longer a dependency.
- Restyled the page: soft background, Tabs for "Up next" and "Upload", info card under the player.
- The player no longer depends on the browser's `<track>` support. Captions use their own parser and are timed every frame.

### Fixed
- Adding subtitles failed for most files because the picker only accepted `.vtt`. SRT, VTT, ASS and SSA are now supported, including older text encodings.
- Opening a video file: the picker now lists MKV, MOV, AVI and others, accepts drag and drop, and shows a clear message when a file can't be played or read.
- Duration stayed at 0:00 if the video loaded before the page finished hydrating.
- Playback state could get out of sync when a new local file started playing immediately.

## 1.0.1

### Changed
- New player layout: volume and cast on the top left; screenshot, download, captions and settings on the top right.
- Large round play/pause button in the centre, with previous and next beside it for playlists.
- Time and fullscreen button now sit directly above a thin progress bar that also shows how much is buffered.
- The bottom button row (play/pause, volume, settings and so on) is gone.
- Settings is now a menu with Captions, Speed, Loop and Picture in picture.
- Switching videos no longer exits fullscreen.

### Added
- Fullscreen automatically rotates to landscape on supported devices (Android and other browsers with the Screen Orientation API). It unlocks again when you leave fullscreen.
- Screenshot button (saves the current frame as a PNG).
- Download button.
- Cast button (shown where the browser supports casting).

## 1.0.0

- Initial release: Next.js + shadcn/ui video player with Poppins captions, playlist, and play-your-own link or file.
