#!/usr/bin/env node
/**
 * Offline stand-in for the TMDB v3 API, for UI development without network
 * access or an API key. Serves deterministic sample data and generated SVG
 * artwork. Start with `npm run dev:mock`. Not used in production.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4010);

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const MOVIE_GENRES = [
  [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'],
  [18, 'Drama'], [14, 'Fantasy'], [27, 'Horror'], [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'], [53, 'Thriller'],
].map(([id, name]) => ({ id, name }));
const TV_GENRES = [
  [10759, 'Action & Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'],
  [9648, 'Mystery'], [10765, 'Sci-Fi & Fantasy'], [10768, 'War & Politics'],
].map(([id, name]) => ({ id, name }));

const W1 = ['Silent', 'Northern', 'Glass', 'Last', 'Hollow', 'Iron', 'Paper', 'Midnight', 'Salt', 'Burning', 'Quiet', 'Velvet', 'Distant', 'Copper', 'Wild', 'Lunar', 'Broken', 'Golden', 'Shallow', 'Electric'];
const W2 = ['Harbour', 'Signal', 'Orchard', 'Frontier', 'Tide', 'Kingdom', 'Archive', 'Meridian', 'Lantern', 'Summit', 'Canyon', 'Relay', 'Garden', 'Horizon', 'Engine', 'Atlas', 'Season', 'Theory', 'Divide', 'Rivers'];
const FIRST = ['Ama', 'Thabo', 'Ines', 'Kenji', 'Marta', 'Oluwaseun', 'Freya', 'Mateo', 'Priya', 'Lars', 'Noor', 'Callum', 'Zanele', 'Hugo', 'Mei', 'Rafael', 'Siobhan', 'Tomasz', 'Yara', 'Dev'];
const LAST = ['Okafor', 'Lindqvist', 'Moreau', 'Nakamura', 'Van Wyk', 'Castellanos', 'Brennan', 'Haddad', 'Mokoena', 'Kowalski', 'Ferreira', 'Iyer', 'Sato', 'Dlamini', 'Achterberg'];
const OVERVIEWS = [
  'A cartographer stranded on a remote island discovers the maps she drew are rewriting the coastline.',
  'Two estranged brothers inherit a failing ferry company and one impossible final voyage.',
  'When the city grid fails for a week, a night-shift engineer becomes the only person who knows why.',
  'A retired detective is pulled back for one case that mirrors the one she never solved.',
  'An orchestra on its farewell tour learns that its conductor has been hiding a second life.',
  'A young climber attempts a solo route that has claimed everyone who tried it before.',
  'In a near future without seasons, a botanist smuggles the last orchard seeds across a border.',
  'A radio operator picks up a distress call from a ship that sank forty years ago.',
];

const people = Array.from({ length: 40 }, (_, i) => ({
  id: 5000 + i,
  name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
  profile_path: `/p${5000 + i}.svg`,
  known_for_department: i % 9 === 0 ? 'Directing' : 'Acting',
}));

const hue = (id) => (id * 47) % 360;

function makeTitle(id, type) {
  const name = `${pick(W1)} ${pick(W2)}`;
  const year = 2000 + Math.floor(rnd() * 26);
  const date = `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
  const genres = type === 'movie' ? MOVIE_GENRES : TV_GENRES;
  const g = [pick(genres).id, pick(genres).id].filter((v, i, a) => a.indexOf(v) === i);
  const base = {
    id,
    overview: pick(OVERVIEWS),
    poster_path: `/${type[0]}${id}p.svg`,
    backdrop_path: `/${type[0]}${id}b.svg`,
    vote_average: Math.round((5.6 + rnd() * 3.4) * 10) / 10,
    vote_count: Math.floor(200 + rnd() * 18000),
    genre_ids: g,
    popularity: rnd() * 1000,
    media_type: type,
  };
  return type === 'movie' ? { ...base, title: name, release_date: date } : { ...base, name, first_air_date: date };
}

const movies = Array.from({ length: 90 }, (_, i) => makeTitle(1000 + i, 'movie'));
const shows = Array.from({ length: 60 }, (_, i) => makeTitle(3000 + i, 'tv'));
const names = new Map([...movies, ...shows].map((t) => [`${t.media_type}${t.id}`, t.title ?? t.name]));

function list(items, page = 1, per = 20) {
  const p = Math.max(1, page);
  return { page: p, total_pages: Math.ceil(items.length / per), total_results: items.length, results: items.slice((p - 1) * per, p * per) };
}

function detail(type, id) {
  const src = (type === 'movie' ? movies : shows).find((t) => t.id === id);
  if (!src) return null;
  const all = type === 'movie' ? movies : shows;
  const genres = (type === 'movie' ? MOVIE_GENRES : TV_GENRES).filter((g) => src.genre_ids.includes(g.id));
  const cast = Array.from({ length: 12 }, (_, i) => {
    const p = people[(id + i * 3) % people.length];
    return { ...p, character: `${pick(['Captain', 'Dr.', 'Agent', ''])} ${pick(LAST)}`.trim(), order: i };
  });
  const director = people[(id * 3) % people.length];
  const d = {
    ...src,
    genres,
    tagline: id % 3 ? 'Every map leads somewhere.' : '',
    status: type === 'movie' ? 'Released' : id % 2 ? 'Returning Series' : 'Ended',
    original_language: 'en',
    credits: { cast, crew: [{ id: director.id, name: director.name, job: 'Director' }, { id: people[5].id, name: people[5].name, job: 'Screenplay' }] },
    videos: {
      results: [
        { key: 'aqz-KE-bpKQ', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true, published_at: '2024-02-01T00:00:00Z' },
        { key: 'YE7VzlLtp-4', name: 'Teaser', site: 'YouTube', type: 'Teaser', official: true, published_at: '2023-11-01T00:00:00Z' },
        { key: 'eRsGyueVLvQ', name: 'Behind the Scenes', site: 'YouTube', type: 'Featurette', official: true, published_at: '2024-03-01T00:00:00Z' },
      ],
    },
    images: { logos: id % 2 ? [{ file_path: `/${type[0]}${id}l.svg`, iso_639_1: 'en', vote_average: 5, aspect_ratio: 3 }] : [], backdrops: [] },
    recommendations: list(all.filter((t) => t.id !== id).slice((id % 20), (id % 20) + 14)),
    similar: list([]),
    production_companies: [{ name: 'Lowveld Pictures' }, { name: 'Northlight Studio' }],
  };
  if (type === 'movie') {
    Object.assign(d, {
      runtime: 92 + (id % 60),
      budget: 40_000_000 + (id % 9) * 11_000_000,
      revenue: 120_000_000 + (id % 13) * 37_000_000,
      imdb_id: `tt${1000000 + id}`,
      release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: pick(['PG', 'PG-13', 'R']), type: 3 }] }] },
    });
  } else {
    const seasons = 1 + (id % 4);
    Object.assign(d, {
      episode_run_time: [42 + (id % 18)],
      number_of_seasons: seasons,
      number_of_episodes: seasons * 8,
      networks: [{ name: pick(['Meridian+', 'Channel South', 'Halcyon']) }],
      created_by: [{ id: director.id, name: director.name }],
      seasons: Array.from({ length: seasons }, (_, s) => ({ season_number: s + 1, name: `Season ${s + 1}`, episode_count: 8, air_date: src.first_air_date, poster_path: src.poster_path })),
      aggregate_credits: { cast: cast.map((c) => ({ id: c.id, name: c.name, profile_path: c.profile_path, roles: [{ character: c.character }] })) },
      content_ratings: { results: [{ iso_3166_1: 'US', rating: pick(['TV-14', 'TV-MA', 'TV-PG']) }] },
      external_ids: { imdb_id: `tt${2000000 + id}` },
    });
  }
  return d;
}

function season(id, n) {
  const titles = ['Pilot', 'The Crossing', 'Low Tide', 'Signals', 'The Archive', 'Northbound', 'Ashes', 'Homecoming'];
  return {
    season_number: n,
    episodes: titles.map((name, i) => ({
      id: id * 1000 + n * 100 + i,
      season_number: n,
      episode_number: i + 1,
      name,
      overview: pick(OVERVIEWS),
      still_path: `/e${id}-${n}-${i + 1}.svg`,
      air_date: '2024-0' + (1 + (i % 9)) + '-12',
      runtime: 41 + ((id + i) % 17),
      vote_average: 7 + (i % 3) / 2,
    })),
  };
}

function svg(file, size) {
  const m = file.match(/^\/([a-z])(\d+)([pbl])?(?:-(\d+)-(\d+))?\.svg$/);
  const kind = m?.[1] ?? 'x';
  const id = Number(m?.[2] ?? 0);
  const role = m?.[3];
  const h = hue(id + (m?.[5] ? Number(m[5]) * 13 : 0));
  const label = kind === 'p' ? people.find((p) => p.id === id)?.name ?? '' : names.get(`${kind === 'm' ? 'movie' : 'tv'}${id}`) ?? '';
  const isPoster = role === 'p' || kind === 'p';
  const isLogo = role === 'l';
  const [w, hgt] = isLogo ? [900, 300] : isPoster ? [500, 750] : [1280, 720];
  if (isLogo) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}"><text x="0" y="200" font-family="Georgia, serif" font-size="150" font-weight="700" fill="#fff" textLength="${w}" lengthAdjust="spacingAndGlyphs">${label.toUpperCase()}</text></svg>`;
  }
  const text = kind === 'e' ? `Episode ${m?.[5]}` : label;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 55% 38%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360} 50% 12%)"/></linearGradient>
<radialGradient id="r" cx="0.7" cy="0.3" r="0.7"><stop offset="0" stop-color="hsl(${(h + 30) % 360} 80% 70% / 0.55)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
<circle cx="${w * 0.72}" cy="${hgt * 0.38}" r="${Math.min(w, hgt) * 0.22}" fill="hsl(${(h + 200) % 360} 60% 60% / 0.25)"/>
${isPoster ? `<text x="36" y="${hgt - 60}" font-family="system-ui, sans-serif" font-size="46" font-weight="700" fill="#fff">${text}</text>` : ''}
</svg>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization, accept');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (p.startsWith('/img/')) {
    const [, , size, ...rest] = p.split('/');
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' });
    return res.end(svg(`/${rest.join('/')}`, size));
  }

  const key = url.searchParams.get('api_key') ?? (req.headers.authorization ?? '').replace('Bearer ', '');
  if (key === 'bad') {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status_message: 'Invalid API key' }));
  }

  const page = Number(url.searchParams.get('page') ?? 1);
  const json = (body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const route = p.replace(/^\/3/, '');
  let m;
  setTimeout(() => {
    if (route === '/configuration') return json({ images: {} });
    if ((m = route.match(/^\/trending\/(all|movie|tv)\/(day|week)$/))) {
      const items = m[1] === 'movie' ? movies : m[1] === 'tv' ? shows : movies.slice(0, 30).flatMap((mv, i) => [mv, shows[i]]);
      return json(list(m[2] === 'day' ? [...items].reverse() : items, page));
    }
    if ((m = route.match(/^\/movie\/(popular|top_rated|now_playing|upcoming)$/))) {
      const sorted = m[1] === 'top_rated' ? [...movies].sort((a, b) => b.vote_average - a.vote_average) : movies.slice(m[1].length % 7);
      return json(list(sorted, page));
    }
    if ((m = route.match(/^\/tv\/(popular|top_rated|on_the_air|airing_today)$/))) {
      const sorted = m[1] === 'top_rated' ? [...shows].sort((a, b) => b.vote_average - a.vote_average) : shows.slice(m[1].length % 5);
      return json(list(sorted, page));
    }
    if ((m = route.match(/^\/discover\/(movie|tv)$/))) {
      let items = m[1] === 'movie' ? movies : shows;
      const genre = Number(url.searchParams.get('with_genres'));
      if (genre) items = items.filter((t) => t.genre_ids.includes(genre));
      const sort = url.searchParams.get('sort_by') ?? '';
      if (sort.startsWith('vote_average')) items = [...items].sort((a, b) => b.vote_average - a.vote_average);
      if (sort.includes('date')) items = [...items].sort((a, b) => (b.release_date ?? b.first_air_date).localeCompare(a.release_date ?? a.first_air_date));
      return json(list(items, page));
    }
    if ((m = route.match(/^\/genre\/(movie|tv)\/list$/))) return json({ genres: m[1] === 'movie' ? MOVIE_GENRES : TV_GENRES });
    if ((m = route.match(/^\/tv\/(\d+)\/season\/(\d+)$/))) return json(season(Number(m[1]), Number(m[2])));
    if ((m = route.match(/^\/(movie|tv)\/(\d+)$/))) {
      const d = detail(m[1], Number(m[2]));
      return d ? json(d) : json({ status_message: 'Not found' }, 404);
    }
    if (route === '/search/multi') {
      const q = (url.searchParams.get('query') ?? '').toLowerCase();
      const hits = [
        ...people.filter((pp) => pp.name.toLowerCase().includes(q)).map((pp) => ({ ...pp, media_type: 'person' })),
        ...[...movies, ...shows].filter((t) => (t.title ?? t.name).toLowerCase().includes(q)),
      ];
      return json(list(hits, page));
    }
    if ((m = route.match(/^\/person\/(\d+)$/))) {
      const person = people.find((pp) => pp.id === Number(m[1]));
      if (!person) return json({ status_message: 'Not found' }, 404);
      return json({
        ...person,
        biography: `${person.name} began on stage before moving to screen work.\n\nTheir roles span independent drama and large-scale adventure, and they have worked with several of the directors in this catalogue more than once.`,
        birthday: '1984-06-14',
        place_of_birth: 'Durban, South Africa',
        combined_credits: { cast: [...movies.slice(person.id % 30, (person.id % 30) + 8), ...shows.slice(person.id % 20, (person.id % 20) + 4)], crew: [] },
      });
    }
    json({ status_message: 'Unknown route' }, 404);
  }, 120 + Math.random() * 200);
});

server.listen(PORT, () => console.log(`Mock TMDB on http://localhost:${PORT}/3`));
