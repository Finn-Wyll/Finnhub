/**
 * End-to-end smoke test against the offline TMDB mock.
 *
 * Needs three processes running first (see docs/HANDOFF.md):
 *   node scripts/mock-tmdb.mjs                                        (port 4010)
 *   VITE_TMDB_API_BASE=http://localhost:4010/3 VITE_TMDB_IMAGE_BASE=http://localhost:4010/img \
 *     VITE_TMDB_API_KEY=mock npx vite --port 5173                     (app with key)
 *   VITE_TMDB_API_BASE=http://localhost:4010/3 VITE_TMDB_IMAGE_BASE=http://localhost:4010/img \
 *     npx vite --port 5174                                            (app without key, for onboarding)
 * Then: node scripts/e2e.cjs
 *
 * Playwright is not a project dependency; it is pre-installed in the cloud
 * sandbox. Elsewhere run `npx playwright install chromium` and `npm i -D playwright`.
 * The mock rejects the key "bad" and accepts anything else.
 */
const { chromium } = require('playwright');
// Stand-in for vidfast.vc that behaves like the real embed (read from its shipped
// code): it autoplays on load, honours startAt (where 0 means "unset"), answers only
// getStatus (other commands are recorded and ignored), posts PLAYER_EVENT and
// MEDIA_DATA on its own, and posts { event: 'status', data: 404 } for movie 1002.
// It counts clicks, which must never reach it (real clicks there open ads).
const FAKE_VIDFAST = `<!doctype html><body style="margin:0;background:#000"><script>
  const q = new URLSearchParams(location.search);
  const [, type, id, s, e] = location.pathname.split('/');
  let t = parseFloat(q.get('startAt')) || 0, d = 1800, playing = false;
  window.commands = []; window.clicks = 0;
  addEventListener('pointerdown', () => window.clicks++, true);
  addEventListener('click', () => window.clicks++, true);
  // Time updates go out as JSON strings and everything else as objects, so both payload forms stay covered.
  const ev = (event) => {
    const msg = { type: 'PLAYER_EVENT', data: { event, currentTime: t, duration: d, tmdbId: +id, mediaType: type, playing } };
    parent.postMessage(event === 'timeupdate' ? JSON.stringify(msg) : msg, '*');
  };
  addEventListener('message', ({ data }) => {
    if (!data || !data.command) return;
    window.commands.push(data.command);
    if (data.command === 'getStatus') ev('playerstatus');
  });
  if (id === '1002') parent.postMessage({ event: 'status', data: 404 }, '*');
  else {
    setTimeout(() => { playing = true; ev('play'); }, 300);
    setInterval(() => { if (playing) { t += 1; ev('timeupdate'); } }, 1000);
    // MEDIA_DATA: its whole progress store. The fake reports 10:00 watched of whatever is open.
    setTimeout(() => {
      const now = Date.now(), progress = { watched: 600, duration: d };
      const entry = { id: +id, type, title: 'Fake ' + id, poster_path: null, backdrop_path: null, progress, last_updated: now };
      if (type === 'tv') Object.assign(entry, { last_season_watched: +s, last_episode_watched: +e, show_progress: { ['s' + s + 'e' + e]: { season: +s, episode: +e, progress, last_updated: now } } });
      parent.postMessage({ type: 'MEDIA_DATA', data: { [(type === 'tv' ? 't' : 'm') + id]: entry } }, '*');
    }, 800);
  }
</script></body>`;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  // Onboarding (no env key)
  const p0 = await b.newPage(); p0.on('pageerror', e => errs.push(e.message));
  await p0.goto((process.env.KEYLESS_URL || 'http://localhost:5174') + '/'); await p0.waitForTimeout(800);
  assert(await p0.getByRole('heading', { name: /Films and series/ }).isVisible(), 'onboarding shown without key');
  await p0.getByRole('button', { name: /Start Browsing/ }).click();
  assert(await p0.getByText('Paste your TMDB API key').isVisible(), 'empty key error');
  await p0.getByLabel(/TMDB API key/).fill('bad'); await p0.getByRole('button', { name: /Start Browsing/ }).click(); await p0.waitForTimeout(800);
  assert(await p0.getByText('TMDB did not accept that key').isVisible(), 'bad key rejected');
  await p0.screenshot({ path: require('os').tmpdir() + '/finnhub-onboarding.png' });
  await p0.getByLabel(/TMDB API key/).fill('goodkey'); await p0.getByRole('button', { name: /Start Browsing/ }).click(); await p0.waitForTimeout(1500);
  assert(await p0.getByRole('tablist', { name: /featured/i }).isVisible(), 'home loads after valid key');
  await p0.reload(); await p0.waitForTimeout(1000);
  assert(await p0.getByRole('tablist', { name: /featured/i }).isVisible(), 'key persisted across reload');

  const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.route('https://vidfast.vc/**', (r) => r.fulfill({ contentType: 'text/html', body: FAKE_VIDFAST }));
  const embed = () => p.frames().find((f) => f.url().startsWith('https://vidfast.vc/'));
  const embedSrc = () => p.locator('iframe').getAttribute('src');
  const base = process.env.BASE_URL || 'http://localhost:5173';
  // Watchlist
  await p.goto(base + '/title/movie/1005'); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: 'Watchlist', exact: true }).click();
  assert(await p.getByRole('button', { name: 'In Watchlist' }).getAttribute('aria-pressed') === 'true', 'watchlist toggle on');
  await p.goto(base + '/watchlist'); await p.waitForTimeout(800);
  assert((await p.locator('main a[href="/title/movie/1005"]').count()) === 1, 'watchlist page lists saved title');
  await p.goto(base + '/'); await p.waitForTimeout(1200);
  assert(await p.getByRole('heading', { name: 'Your Watchlist' }).isVisible(), 'home shows watchlist rail');
  // Browse filters
  await p.goto(base + '/movies'); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: 'Horror' }).click(); await p.waitForTimeout(800);
  assert(p.url().includes('genre=27'), 'genre filter in URL');
  assert(await p.getByRole('heading', { name: 'Horror films' }).isVisible(), 'genre heading');
  await p.getByLabel('Sort').selectOption('vote_average.desc'); await p.waitForTimeout(500);
  assert(p.url().includes('sort=vote_average.desc'), 'sort in URL');
  // Infinite scroll
  await p.getByRole('button', { name: 'All' }).click(); await p.waitForTimeout(800);
  const before = await p.locator('main a[href^="/title/"]').count();
  await p.mouse.wheel(0, 6000); await p.waitForTimeout(1200);
  const after = await p.locator('main a[href^="/title/"]').count();
  assert(after > before, `infinite scroll loads more (${before} -> ${after})`);
  // Search
  await p.goto(base + '/search'); await p.waitForTimeout(500);
  await p.getByLabel(/Search films, series and people/).fill('golden'); await p.waitForTimeout(1200);
  assert(p.url().includes('q=golden'), 'search query in URL');
  assert((await p.locator('main a[href^="/title/"]').count()) > 0, 'search results');
  await p.getByLabel(/Search films, series and people/).fill('zzzzqq'); await p.waitForTimeout(1200);
  assert(await p.getByText('No results for').isVisible(), 'search empty state');
  // Slash shortcut
  await p.goto(base + '/tv'); await p.waitForTimeout(600); await p.keyboard.press('/'); await p.waitForTimeout(400);
  assert(p.url().endsWith('/search'), '/ shortcut opens search');
  // TV seasons + episode link
  await p.goto(base + '/title/tv/3003'); await p.waitForTimeout(1200);
  await p.getByLabel('Season').selectOption('2'); await p.waitForTimeout(800);
  assert(p.url().includes('season=2'), 'season in URL');
  await p.locator('a[href="/watch/tv/3003/2/3"]').click(); await p.waitForTimeout(1200);
  assert(await p.getByText('S2 E3').first().isVisible(), 'player opened on S2E3');
  // Player: the embed ignores commands, so our controls drive it by reloading it at the right second
  const startAt = async () => Number(new URL(await embedSrc()).searchParams.get('startAt'));
  assert((await embedSrc()).startsWith('https://vidfast.vc/tv/3003/2/3?autoPlay=true'), 'player embeds vidfast episode URL');
  await p.waitForTimeout(1800);
  assert(await p.locator('button[aria-label="Pause"]').first().isVisible(), 'embed autoplays and the controls show Pause');
  assert(await p.locator('iframe').evaluate((f) => getComputedStyle(f).pointerEvents === 'none' && f.tabIndex === -1), 'embed can never receive clicks or focus');
  await p.mouse.click(640, 300); await p.waitForTimeout(500);
  assert((await p.locator('iframe').count()) === 0 && await p.locator('button[aria-label="Play"]').first().isVisible(), 'clicking the stage pauses by unloading the embed');
  await p.keyboard.press('k'); await p.waitForTimeout(500);
  const resumedAt = await startAt();
  assert(resumedAt >= 1 && await p.locator('button[aria-label="Pause"]').first().isVisible(), 'k plays again from the paused second: ' + resumedAt);
  await p.waitForTimeout(1200);
  await p.keyboard.press('l'); await p.waitForTimeout(1000);
  const skippedTo = await startAt();
  assert(skippedTo - resumedAt >= 10 && skippedTo - resumedAt <= 13, `l reloads the embed 10s later (${resumedAt} -> ${skippedTo})`);
  assert((await embed().evaluate(() => window.clicks)) === 0, 'no click ever reached the embed');
  await p.getByRole('button', { name: 'Subtitles' }).click(); await p.waitForTimeout(400);
  await p.getByRole('radio', { name: 'Spanish' }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  assert(/[?&]sub=es(&|$)/.test(await embedSrc()) && (await startAt()) >= skippedTo, 'subtitles reload the embed with sub=es at the current time');
  await p.keyboard.press('e'); await p.waitForTimeout(600);
  assert(await p.getByRole('button', { name: 'Episodes', exact: true }).getAttribute('aria-expanded') === 'true', 'e opens episode sheet');
  await p.keyboard.press('e'); await p.waitForTimeout(400);
  await p.keyboard.press('n'); await p.waitForTimeout(1000);
  assert(p.url().endsWith('/watch/tv/3003/2/4') && (await embedSrc()).startsWith('https://vidfast.vc/tv/3003/2/4?') && /[?&]sub=es(&|$)/.test(await embedSrc()), 'n goes to next episode, keeping subtitles');
  await p.getByRole('button', { name: 'Exit player' }).click(); await p.waitForTimeout(800);
  assert(p.url().includes('/title/tv/3003'), 'back returns to title');
  // Film embed
  await p.goto(base + '/watch/movie/1001'); await p.waitForTimeout(800);
  assert((await embedSrc()).startsWith('https://vidfast.vc/movie/1001?autoPlay=true'), 'player embeds vidfast film URL');
  // Resume watching from MEDIA_DATA progress (the fake sends 10:00 watched shortly after load)
  await p.waitForTimeout(1200);
  await p.goto(base + '/'); await p.waitForTimeout(1200);
  assert(await p.getByRole('heading', { name: 'Continue Watching' }).isVisible() && (await p.locator('a[href="/watch/movie/1001"]').count()) === 1, 'home shows Continue Watching');
  await p.getByRole('button', { name: 'Remove Fake 1001 from Continue Watching' }).click({ force: true }); await p.waitForTimeout(300);
  assert((await p.locator('a[href="/watch/movie/1001"]').count()) === 0, 'remove from Continue Watching');
  await p.goto(base + '/watch/movie/1001'); await p.waitForTimeout(1500);
  await p.goto(base + '/title/movie/1001'); await p.waitForTimeout(1000);
  assert(await p.getByRole('link', { name: 'Resume', exact: true }).isVisible() && await p.getByText('10:00 of 30:00').isVisible(), 'title page offers Resume with progress');
  await p.getByRole('link', { name: 'Resume', exact: true }).click(); await p.waitForTimeout(1500);
  assert((await startAt()) === 600 && await p.getByText('Resumed at').isVisible(), 'player resumes at the saved time');
  await p.getByRole('button', { name: 'Start Over' }).click(); await p.waitForTimeout(500);
  assert(new URL(await embedSrc()).searchParams.get('startAt') === '0.1' && !(await p.getByText('Resumed at').isVisible()), 'Start Over reloads from the beginning (startAt=0.1, as 0 means unset)');
  // Unavailable title
  await p.goto(base + '/watch/movie/1002'); await p.waitForTimeout(1200);
  assert(await p.getByText('Not Available Right Now', { exact: true }).isVisible() && await p.getByRole('button', { name: 'Try Again' }).isVisible(), 'unavailable title shows a clear message');
  // Trailer dialog
  await p.goto(base + '/title/movie/1001'); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: 'Watch trailer' }).click(); await p.waitForTimeout(500);
  assert(await p.locator('dialog[open]').count() === 1, 'trailer dialog opens');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  assert(await p.locator('dialog[open]').count() === 0, 'Esc closes trailer');
  // Theme
  await p.goto(base + '/settings'); await p.waitForTimeout(500);
  await p.getByRole('radio', { name: 'Light' }).click();
  assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', 'theme toggle');
  await p.getByRole('radio', { name: 'System' }).click();
  // 404
  await p.goto(base + '/title/movie/99999'); await p.waitForTimeout(1000);
  assert(await p.getByRole('heading', { name: 'This Page Is Not Here' }).isVisible(), '404 for unknown title');
  console.log('page errors:', errs);
  await b.close();
})();
