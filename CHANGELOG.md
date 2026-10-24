# Changelog

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
