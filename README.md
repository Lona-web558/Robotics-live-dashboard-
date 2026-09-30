# Live Robotics Dashboard

A single dashboard combining GitHub project activity and news headlines for the robotics ecosystem, with auto-refreshing charts.

**Stack:** HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js, Node.js, Express.js

## Features

- **Stat cards:** repos tracked, total stars, average stars per repo, articles in the current window
- **Repos by language:** doughnut chart from GitHub topic search across robotics, ROS, ROS2, Arduino robots, drones and SLAM
- **Articles by source:** bar chart from five robotics RSS feeds (IEEE Spectrum, The Robot Report, Robohub, MIT News, TechCrunch)
- **Top repositories:** ranked list by star count, linked to GitHub
- **Latest headlines:** ranked list of the newest articles, linked to the source
- Auto-refreshes every 60 seconds using cached data; a "Refresh now" button forces a live refetch
- If a GitHub topic or news source is unreachable, the rest still loads and the status line says which one failed

## Project structure

```
robotics-dashboard/
├── server.js          Express server: GitHub + RSS aggregation and caching
├── package.json
└── public/
    ├── index.html     Page markup
    ├── style.css      Styles
    └── app.js         Frontend logic, Chart.js rendering, auto-refresh
```

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000

## How the data is combined

- GitHub data is cached for 15 minutes (GitHub Search API allows 10 unauthenticated requests/minute).
- News data is cached for 10 minutes.
- `GET /api/dashboard` returns whichever is stale and refetches only that half, so a request never blocks on both sources unnecessarily.
- `GET /api/dashboard?refresh=1` forces both to refetch immediately — this is what the "Refresh now" button calls.

## Raise the GitHub rate limit

Unauthenticated GitHub Search requests are capped at 10/minute. If you shorten the cache window or add topics, create a personal access token (no special scopes needed) and set it as an environment variable:

```
GITHUB_TOKEN=your_token_here
```

On Render, add this under your service's **Environment** tab.

## Customise

- **GitHub topics:** edit the `TOPICS` array in `server.js`.
- **News feeds:** edit the `FEEDS` array in `server.js`.
- **Auto-refresh interval:** edit `AUTO_REFRESH_MS` in `public/app.js` (default 60 seconds; this only re-polls the cache, it doesn't force a refetch).
- **Cache windows:** edit `GITHUB_CACHE_MS` and `NEWS_CACHE_MS` in `server.js`.

## Deploy to Render

1. Push the project to a GitHub repository.
2. Create a new **Web Service** on Render and connect the repository.
3. Set these options:
   - **Root directory:** the folder containing `server.js` and `package.json`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - (Optional) **Environment variable:** `GITHUB_TOKEN`
4. Deploy. Render sets the `PORT` variable automatically.

## Troubleshooting

- **Blank page or "Cannot GET /":** check that `index.html`, `style.css` and `app.js` are inside a `public/` folder next to `server.js`.
- **Charts don't render:** open the browser console — this usually means the Chart.js CDN script didn't load, often blocked by an ad blocker or restrictive network.
- **All repo/article counts show 0:** likely a rate limit or a feed URL that changed. Check the status line under the header for which source failed.

## Ideas for next steps

- Historical trend lines (store daily snapshots instead of only the latest fetch)
- WebSocket push instead of polling, for truly live updates
- Job listings panel once a public jobs API or feed is wired in
