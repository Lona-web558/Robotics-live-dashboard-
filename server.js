const express = require('express');
const fetch = require('node-fetch');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_CACHE_MS = 15 * 60 * 1000;
const NEWS_CACHE_MS = 10 * 60 * 1000;

const TOPICS = ['robotics', 'ros', 'ros2', 'arduino-robot', 'drone', 'slam'];
const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'RoboticsDashboard/1.0',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

const FEEDS = [
  { id: 'ieee', name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss' },
  { id: 'robotreport', name: 'The Robot Report', url: 'https://www.therobotreport.com/feed/' },
  { id: 'robohub', name: 'Robohub', url: 'https://robohub.org/feed/' },
  { id: 'mit', name: 'MIT News', url: 'https://news.mit.edu/rss/topic/robotics' },
  { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/category/robotics/feed/' }
];
const rssParser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'RoboticsDashboard/1.0' } });
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

let githubCache = { time: 0, data: null, failed: [] };
let newsCache = { time: 0, data: null, failed: [] };

async function fetchGithub() {
  const results = await Promise.allSettled(TOPICS.map(topic =>
    fetch(`https://api.github.com/search/repositories?q=topic:${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=20`, { headers: GITHUB_HEADERS })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  ));

  const failed = [];
  const byId = new Map();
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') { failed.push(TOPICS[i]); return; }
    (r.value.items || []).forEach(item => {
      if (!byId.has(item.id)) {
        byId.set(item.id, {
          name: item.full_name,
          url: item.html_url,
          stars: item.stargazers_count,
          language: item.language || 'Other'
        });
      }
    });
  });

  const repos = [...byId.values()];
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const langCounts = {};
  repos.forEach(r => { langCounts[r.language] = (langCounts[r.language] || 0) + 1; });

  githubCache = {
    time: Date.now(),
    failed,
    data: {
      totalRepos: repos.length,
      totalStars,
      avgStars: repos.length ? Math.round(totalStars / repos.length) : 0,
      topRepos: repos.sort((a, b) => b.stars - a.stars).slice(0, 8),
      languageBreakdown: Object.entries(langCounts).sort((a, b) => b[1] - a[1]).map(([language, count]) => ({ language, count }))
    }
  };
}

async function fetchNews() {
  const results = await Promise.allSettled(FEEDS.map(f => rssParser.parseURL(f.url)));
  const failed = [];
  const articles = [];

  results.forEach((r, i) => {
    const feed = FEEDS[i];
    if (r.status !== 'fulfilled') { failed.push(feed.name); return; }
    r.value.items.forEach(item => {
      if (!item.link || !item.title) return;
      const date = new Date(item.isoDate || item.pubDate || Date.now());
      articles.push({
        title: stripHtml(item.title),
        link: item.link,
        source: feed.name,
        date: isNaN(date) ? new Date().toISOString() : date.toISOString()
      });
    });
  });

  const seen = new Set();
  const unique = articles.filter(a => (seen.has(a.link) ? false : seen.add(a.link)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const perSourceMap = {};
  unique.forEach(a => { perSourceMap[a.source] = (perSourceMap[a.source] || 0) + 1; });

  newsCache = {
    time: Date.now(),
    failed,
    data: {
      totalArticles: unique.length,
      perSource: Object.entries(perSourceMap).map(([source, count]) => ({ source, count })),
      latest: unique.slice(0, 8)
    }
  };
}

app.get('/api/dashboard', async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    const jobs = [];
    if (force || !githubCache.data || Date.now() - githubCache.time > GITHUB_CACHE_MS) jobs.push(fetchGithub());
    if (force || !newsCache.data || Date.now() - newsCache.time > NEWS_CACHE_MS) jobs.push(fetchNews());
    if (jobs.length) await Promise.all(jobs);

    res.json({
      github: githubCache.data,
      githubFailed: githubCache.failed,
      githubFetchedAt: new Date(githubCache.time).toISOString(),
      news: newsCache.data,
      newsFailed: newsCache.failed,
      newsFetchedAt: new Date(newsCache.time).toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load dashboard data. Try again shortly.' });
  }
});

const PUBLIC_DIR = path.join(__dirname);
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => console.log(`Robotics dashboard running on http://localhost:${PORT}`));
