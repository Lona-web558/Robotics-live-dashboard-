const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const AUTO_REFRESH_MS = 60 * 1000;

let langChart, sourceChart;

const palette = ['#3dd6d0', '#e8b931', '#7c9cff', '#ff7b72', '#b892ff', '#63d68e', '#f2a65a', '#5fb4d9'];

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  kids.forEach(k => node.append(k));
  return node;
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return Math.max(mins, 1) + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  return Math.floor(mins / 1440) + 'd ago';
}

function baseChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#e6edf3', font: { family: 'JetBrains Mono', size: 11 } } } },
    scales: {
      x: { ticks: { color: '#8a9aa8' }, grid: { color: '#24323d' } },
      y: { ticks: { color: '#8a9aa8' }, grid: { color: '#24323d' }, beginAtZero: true }
    },
    ...extra
  };
}

function renderLangChart(breakdown) {
  const ctx = document.getElementById('langChart');
  const data = {
    labels: breakdown.map(b => b.language),
    datasets: [{ data: breakdown.map(b => b.count), backgroundColor: palette }]
  };
  if (langChart) { langChart.data = data; langChart.update(); return; }
  langChart = new Chart(ctx, { type: 'doughnut', data, options: baseChartOptions({ scales: {} }) });
}

function renderSourceChart(perSource) {
  const ctx = document.getElementById('sourceChart');
  const data = {
    labels: perSource.map(s => s.source),
    datasets: [{ label: 'Articles', data: perSource.map(s => s.count), backgroundColor: '#3dd6d0' }]
  };
  if (sourceChart) { sourceChart.data = data; sourceChart.update(); return; }
  sourceChart = new Chart(ctx, { type: 'bar', data, options: baseChartOptions({ plugins: { legend: { display: false } } }) });
}

function renderTopRepos(repos) {
  const list = document.getElementById('topRepos');
  list.replaceChildren(...repos.map(r => el('li', {},
    el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', textContent: r.name }),
    el('span', { className: 'meta', textContent: `★ ${r.stars.toLocaleString()} · ${r.language}` })
  )));
}

function renderLatestNews(articles) {
  const list = document.getElementById('latestNews');
  list.replaceChildren(...articles.map(a => el('li', {},
    el('a', { href: a.link, target: '_blank', rel: 'noopener noreferrer', textContent: a.title }),
    el('span', { className: 'meta', textContent: `${a.source} · ${timeAgo(a.date)}` })
  )));
}

async function load(force = false) {
  statusEl.className = 'status';
  statusEl.textContent = 'Loading dashboard...';
  try {
    const res = await fetch('/api/dashboard' + (force ? '?refresh=1' : ''));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    document.getElementById('statRepos').textContent = data.github.totalRepos.toLocaleString();
    document.getElementById('statStars').textContent = data.github.totalStars.toLocaleString();
    document.getElementById('statAvg').textContent = data.github.avgStars.toLocaleString();
    document.getElementById('statArticles').textContent = data.news.totalArticles.toLocaleString();

    renderLangChart(data.github.languageBreakdown);
    renderSourceChart(data.news.perSource);
    renderTopRepos(data.github.topRepos);
    renderLatestNews(data.news.latest);

    const notes = [];
    if (data.githubFailed.length) notes.push(`GitHub topics unreachable: ${data.githubFailed.join(', ')}`);
    if (data.newsFailed.length) notes.push(`News sources unreachable: ${data.newsFailed.join(', ')}`);
    statusEl.textContent = `GitHub data updated ${timeAgo(data.githubFetchedAt)} · News updated ${timeAgo(data.newsFetchedAt)}.` +
      (notes.length ? ' ' + notes.join('. ') + '.' : '');
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = err.message + ' Check your connection and press Refresh now.';
  }
}

refreshBtn.addEventListener('click', () => load(true));
setInterval(() => load(false), AUTO_REFRESH_MS);
load();
