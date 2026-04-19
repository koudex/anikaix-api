// server.js
const express = require('express');
const cors = require('cors');
const animekai = require('./animekai');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_SERVERLESS = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;

app.use(cors());
app.use(express.json());

// Helper to wrap responses
function sendResult(res, result) {
  if (result && result.error) {
    return res.status(500).json({ success: false, error: result.error });
  }
  return res.json({ success: true, ...result });
}

// Standardized response format
const createResponse = (success, data = null, error = null, meta = {}) => {
  const response = { success, timestamp: new Date().toISOString() };
  if (success && data !== null) response.data = data;
  if (!success && error) response.error = { message: error.message || error, code: error.code || 'UNKNOWN_ERROR', status: error.status || 500 };
  if (Object.keys(meta).length > 0) response.meta = meta;
  return response;
};

// ==================== API DOCUMENTATION ====================
const API_DOCS = {
  title: "Anime Kai REST API",
  version: "2.0.0",
  description: "Comprehensive REST API for anime streaming data - Scrapes anikai.to",
  baseUrl: "/api",
  deployment: {
    vercel: "One-click deploy with vercel.json",
    netlify: "One-click deploy with netlify.toml",
    local: "Run with 'npm start' or 'node server.js'"
  },
  services: {
    core: {
      name: "Core Endpoints",
      endpoints: [
        { method: "GET", path: "/", description: "API information and available endpoints", parameters: [], example: "/api/" },
        { method: "GET", path: "/home", description: "Get banner, latest updates, and trending anime", parameters: [], example: "/api/home" },
        { method: "GET", path: "/most-searched", description: "Get most-searched anime keywords", parameters: [], example: "/api/most-searched" },
        { method: "GET", path: "/trending", description: "Get currently trending anime", parameters: [], example: "/api/trending" },
        { method: "GET", path: "/popular", description: "Get most popular anime this week", parameters: [], example: "/api/popular" },
        { method: "GET", path: "/schedule", description: "Get weekly airing schedule", parameters: [], example: "/api/schedule" },
        { method: "GET", path: "/random", description: "Get a random anime", parameters: [], example: "/api/random" },
        { method: "GET", path: "/genre", description: "Get list of all genres", parameters: [], example: "/api/genre" },
        { method: "GET", path: "/az-list", description: "Get anime alphabetically", parameters: [], example: "/api/az-list" }
      ]
    },
    search: {
      name: "Search & Discovery",
      endpoints: [
        { method: "GET", path: "/search", description: "Search for anime by keyword", parameters: [{ name: "keyword", type: "string", required: true, description: "Search query" }, { name: "page", type: "number", required: false, default: 1, description: "Page number" }], example: "/api/search?keyword=naruto&page=1" },
        { method: "GET", path: "/filter", description: "Filter anime by criteria", parameters: [{ name: "type", type: "string", required: false, description: "TV, Movie, OVA, etc." }, { name: "genre", type: "string", required: false, description: "Genre name" }, { name: "year", type: "string", required: false, description: "Release year" }], example: "/api/filter?type=TV&year=2024" },
        { method: "GET", path: "/subbed-anime", description: "Get subbed anime list", parameters: [{ name: "page", type: "number", required: false, default: 1 }], example: "/api/subbed-anime?page=1" },
        { method: "GET", path: "/dubbed-anime", description: "Get dubbed anime list", parameters: [{ name: "page", type: "number", required: false, default: 1 }], example: "/api/dubbed-anime?page=1" },
        { method: "GET", path: "/recently-added", description: "Get recently added anime", parameters: [{ name: "page", type: "number", required: false, default: 1 }], example: "/api/recently-added?page=1" }
      ]
    },
    anime: {
      name: "Anime Information",
      endpoints: [
        { method: "GET", path: "/anime/:slug", description: "Get detailed anime information including ani_id", parameters: [{ name: "slug", type: "string", required: true, description: "Anime slug from search or home" }], example: "/api/anime/naruto" },
        { method: "GET", path: "/episodes/:ani_id", description: "Get episode list with encrypted tokens", parameters: [{ name: "ani_id", type: "string", required: true, description: "Anime ID from anime details" }], example: "/api/episodes/12345" },
        { method: "GET", path: "/servers/:ep_token", description: "Get available servers for an episode", parameters: [{ name: "ep_token", type: "string", required: true, description: "Episode token from episodes endpoint" }], example: "/api/servers/encrypted_token_here" },
        { method: "GET", path: "/source/:link_id", description: "Get direct m3u8 stream URL and skip times", parameters: [{ name: "link_id", type: "string", required: true, description: "Link ID from servers endpoint" }], example: "/api/source/abc123" }
      ]
    },
    categories: {
      name: "Categories & Types",
      endpoints: [
        { method: "GET", path: "/ona", description: "Get Original Net Animation list", parameters: [], example: "/api/ona" },
        { method: "GET", path: "/ova", description: "Get OVA list", parameters: [], example: "/api/ova" },
        { method: "GET", path: "/movie", description: "Get anime movies", parameters: [], example: "/api/movie" },
        { method: "GET", path: "/specials", description: "Get specials", parameters: [], example: "/api/specials" },
        { method: "GET", path: "/events", description: "Get events", parameters: [], example: "/api/events" }
      ]
    }
  },
  workflow: {
    steps: [
      "Search or browse: Use /api/search or /api/home",
      "Get anime details: Use the slug with /api/anime/:slug to get ani_id",
      "Fetch episodes: Use ani_id with /api/episodes/:ani_id to get episode tokens",
      "Get servers: Use episode token with /api/servers/:ep_token to get link_id",
      "Get stream: Use link_id with /api/source/:link_id to get m3u8 URL"
    ]
  },
  commonResponses: {
    success: { description: "Successful response", example: { success: true, timestamp: "2024-01-01T00:00:00.000Z", data: "..." } },
    error: { description: "Error response", example: { success: false, timestamp: "2024-01-01T00:00:00.000Z", error: { message: "Error description", code: "ERROR_CODE", status: 500 } } }
  }
};

// ==================== GENERATE DOCS HTML ====================
const generateDocsHTML = () => {
  const endpointRows = (endpoints, baseRoute) => endpoints.map(ep => `
    <tr>
      <td><span class="method method-${ep.method.toLowerCase()}">${ep.method}</span></td>
      <td><code>${baseRoute}${ep.path}</code></td>
      <td>${ep.description}</td>
      <td>${ep.parameters.length > 0 ? `<ul class="params-list">${ep.parameters.map(p => `<li><code>${p.name}</code> (${p.type})${p.required ? ' <span class="required">required</span>' : ''}${p.default !== undefined ? ` <span class="default">default: ${p.default}</span>` : ''}<br><span class="param-desc">${p.description}</span></li>`).join('')}</ul>` : '<span class="none">None</span>'}</td>
      <td><code class="example">${ep.example}</code></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${API_DOCS.title} | Documentation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.5;
      color: #e0e0e0;
      background: #0a0a0a;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 16px;
    }

    /* Header Styles */
    header {
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
      border: 1px solid rgba(0, 217, 255, 0.2);
      border-radius: 20px;
      padding: 32px 20px;
      text-align: center;
      margin-bottom: 24px;
    }

    header h1 {
      font-size: 1.8rem;
      margin-bottom: 12px;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    header p {
      opacity: 0.85;
      font-size: 0.95rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .version {
      background: rgba(0, 217, 255, 0.15);
      border: 1px solid rgba(0, 217, 255, 0.3);
      padding: 6px 16px;
      border-radius: 30px;
      display: inline-block;
      margin-top: 16px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #00d9ff;
    }

    .deploy-badges {
      margin-top: 20px;
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .deploy-badge {
      background: #1a1a1a;
      border: 1px solid #333;
      padding: 8px 16px;
      border-radius: 10px;
      color: #e0e0e0;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .deploy-badge:hover {
      border-color: #00d9ff;
      background: #222;
      transform: translateY(-1px);
    }

    /* Service Cards */
    .service {
      background: #111;
      border: 1px solid #222;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .service h2 {
      color: #00d9ff;
      margin-bottom: 12px;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .service-badge {
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      color: #0a0a0a;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    /* Table Styles - Responsive */
    .table-wrapper {
      overflow-x: auto;
      margin: 16px 0;
      border-radius: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      min-width: 600px;
    }

    th, td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid #222;
      vertical-align: top;
    }

    th {
      background: #1a1a1a;
      font-weight: 600;
      color: #00d9ff;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    tr:hover {
      background: #161616;
    }

    /* Method Badges */
    .method {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: bold;
      text-transform: uppercase;
      display: inline-block;
    }

    .method-get {
      background: rgba(0, 255, 136, 0.15);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.3);
    }

    /* Code Styles */
    code {
      background: #1a1a1a;
      padding: 2px 6px;
      border-radius: 5px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.75rem;
      color: #00d9ff;
      word-break: break-all;
    }

    .example {
      background: #1a1a1a;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.7rem;
      display: inline-block;
      word-break: break-all;
      color: #00ff88;
      border: 1px solid #222;
      font-family: monospace;
    }

    /* Parameters List */
    .params-list {
      list-style: none;
      font-size: 0.7rem;
    }

    .params-list li {
      margin-bottom: 8px;
      padding: 6px;
      background: #0a0a0a;
      border-radius: 6px;
      border-left: 2px solid #00d9ff;
    }

    .params-list code {
      font-size: 0.7rem;
      background: #222;
    }

    .required {
      color: #ff4757;
      font-weight: bold;
      font-size: 0.65rem;
    }

    .default {
      color: #ffa502;
      font-size: 0.65rem;
    }

    .param-desc {
      display: block;
      color: #888;
      margin-top: 4px;
      font-size: 0.65rem;
    }

    .none {
      color: #666;
      font-size: 0.7rem;
    }

    /* Response Format Section */
    .response-format {
      background: #111;
      border: 1px solid #222;
      padding: 20px;
      border-radius: 16px;
      margin-top: 20px;
    }

    .response-format h3 {
      color: #00d9ff;
      margin-bottom: 16px;
      font-size: 1.2rem;
    }

    .response-format h4 {
      color: #00ff88;
      margin: 16px 0 8px 0;
      font-size: 0.9rem;
    }

    .response-format pre {
      background: #0a0a0a;
      color: #00ff88;
      padding: 16px;
      border-radius: 10px;
      overflow-x: auto;
      border: 1px solid #222;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.7rem;
      line-height: 1.5;
    }

    /* Workflow Section */
    .workflow {
      background: #111;
      border: 1px solid #222;
      padding: 20px;
      border-radius: 16px;
      margin-top: 20px;
    }

    .workflow h3 {
      color: #00d9ff;
      margin-bottom: 16px;
      font-size: 1.2rem;
    }

    .workflow ol {
      margin-left: 20px;
      line-height: 1.8;
    }

    .workflow li {
      margin-bottom: 8px;
      font-size: 0.85rem;
    }

    .workflow code {
      font-size: 0.75rem;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 24px;
      color: #666;
      font-size: 0.75rem;
      border-top: 1px solid #222;
      margin-top: 24px;
    }

    footer a {
      color: #00d9ff;
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    /* Mobile First Adjustments */
    @media (max-width: 768px) {
      .container {
        padding: 12px;
      }

      header {
        padding: 24px 16px;
      }

      header h1 {
        font-size: 1.5rem;
      }

      .service {
        padding: 16px;
      }

      .service h2 {
        font-size: 1.1rem;
      }

      th, td {
        padding: 10px 8px;
      }

      .params-list li {
        font-size: 0.7rem;
      }

      .response-format pre {
        font-size: 0.65rem;
        padding: 12px;
      }

      .deploy-badge {
        padding: 6px 12px;
        font-size: 0.75rem;
      }
    }

    /* Small devices */
    @media (max-width: 480px) {
      .service-badge {
        font-size: 0.6rem;
        padding: 3px 10px;
      }

      th {
        font-size: 0.65rem;
      }

      td {
        font-size: 0.7rem;
      }

      .example {
        font-size: 0.6rem;
        padding: 4px 8px;
      }
    }

    /* Smooth scrolling */
    html {
      scroll-behavior: smooth;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${API_DOCS.title}</h1>
      <p>${API_DOCS.description}</p>
      <span class="version">Version ${API_DOCS.version}</span>
      <div class="deploy-badges">
        <a href="https://vercel.com/new/clone?repository-url=https://github.com/koudex/anikaix-api.git" class="deploy-badge" target="_blank">
          <svg width="16" height="16" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
          Deploy to Vercel
        </a>
        <a href="https://app.netlify.com/start/deploy?repository=https://github.com/koudex/anikaix-api.git" class="deploy-badge" target="_blank">
          <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0z"/></svg>
          Deploy to Netlify
        </a>
      </div>
    </header>

    ${Object.entries(API_DOCS.services).map(([key, service]) => `
      <section class="service">
        <h2>${service.name}<span class="service-badge">/api${service.endpoints[0]?.path?.startsWith('/') ? '' : '/'}${service.endpoints[0]?.path?.split('/')[1] || ''}</span></h2>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
                <th>Parameters</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              ${endpointRows(service.endpoints, '/api')}
            </tbody>
          </table>
        </div>
      </section>
    `).join('')}

    <section class="workflow">
      <h3>Streaming Workflow</h3>
      <ol>
        ${API_DOCS.workflow.steps.map(step => `<li>${step.replace(/(\/api\/[^\s]+)/g, '<code>$1</code>')}</li>`).join('')}
      </ol>
    </section>

    <section class="response-format">
      <h3>Response Format</h3>
      <h4>Success Response</h4>
      <pre>${JSON.stringify(API_DOCS.commonResponses.success.example, null, 2)}</pre>
      <h4>Error Response</h4>
      <pre>${JSON.stringify(API_DOCS.commonResponses.error.example, null, 2)}</pre>
    </section>

    <footer>
      <p><a href="/docs/json">JSON Documentation</a> | <a href="/">API Status</a></p>
      <p style="margin-top: 8px;">&copy; 2026 anikaix-api</p>
    </footer>
  </div>
</body>
</html>`;
};

// ==================== ORIGINAL ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json(createResponse(true, {
    name: "Anime Kai REST API",
    version: API_DOCS.version,
    description: API_DOCS.description,
    documentation: "/docs",
    endpoints: {
      home: "/api/home",
      search: "/api/search?keyword=...",
      anime: "/api/anime/:slug",
      episodes: "/api/episodes/:ani_id",
      servers: "/api/servers/:ep_token",
      source: "/api/source/:link_id",
      trending: "/api/trending",
      popular: "/api/popular",
      schedule: "/api/schedule"
    }
  }));
});

app.get('/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(generateDocsHTML());
});

app.get('/docs/json', (req, res) => {
  res.json(createResponse(true, API_DOCS));
});

app.get('/health', (req, res) => {
  res.json(createResponse(true, { status: "healthy", uptime: process.uptime(), serverless: IS_SERVERLESS }));
});

// ==================== API ENDPOINTS ====================
app.get('/api/most-searched', async (req, res) => {
  const result = await animekai.mostSearched();
  sendResult(res, { results: result, count: Array.isArray(result) ? result.length : 0 });
});

app.get('/api/search', async (req, res) => {
  const keyword = req.query.keyword?.trim();
  if (!keyword) return res.status(400).json({ success: false, error: 'Keyword is required' });
  const result = await animekai.searchAnime(keyword);
  sendResult(res, { keyword, count: Array.isArray(result) ? result.length : 0, results: result });
});

app.get('/api/home', async (req, res) => {
  const result = await animekai.scrapeHome();
  sendResult(res, result);
});

app.get('/api/anime/:slug', async (req, res) => {
  const result = await animekai.scrapeAnimeInfo(req.params.slug);
  sendResult(res, result);
});

app.get('/api/episodes/:ani_id', async (req, res) => {
  const result = await animekai.fetchEpisodes(req.params.ani_id);
  sendResult(res, { ani_id: req.params.ani_id, count: Array.isArray(result) ? result.length : 0, episodes: result });
});

app.get('/api/servers/:ep_token', async (req, res) => {
  const result = await animekai.fetchServers(req.params.ep_token);
  sendResult(res, result);
});

app.get('/api/source/:link_id', async (req, res) => {
  const result = await animekai.resolveSource(req.params.link_id);
  sendResult(res, result);
});

app.get('/api/trending', async (req, res) => {
  const result = await animekai.getTrending();
  sendResult(res, { trending: result });
});

app.get('/api/popular', async (req, res) => {
  const result = await animekai.getPopular();
  sendResult(res, { popular: result });
});

app.get('/api/schedule', async (req, res) => {
  const result = await animekai.getSchedule();
  sendResult(res, { schedule: result });
});

app.get('/api/random', async (req, res) => {
  const result = await animekai.getRandomAnime();
  sendResult(res, result);
});

app.get('/api/genre', async (req, res) => {
  const result = await animekai.getGenres();
  sendResult(res, { genres: result });
});

app.get('/api/az-list', async (req, res) => {
  const result = await animekai.getAzList();
  sendResult(res, { az_list: result });
});

app.get('/api/subbed-anime', async (req, res) => {
  const result = await animekai.getSubbedAnime();
  sendResult(res, { subbed_anime: result });
});

app.get('/api/dubbed-anime', async (req, res) => {
  const result = await animekai.getDubbedAnime();
  sendResult(res, { dubbed_anime: result });
});

app.get('/api/ona', async (req, res) => {
  const result = await animekai.getAnimeByType('ona');
  sendResult(res, { ona: result });
});

app.get('/api/ova', async (req, res) => {
  const result = await animekai.getAnimeByType('ova');
  sendResult(res, { ova: result });
});

app.get('/api/movie', async (req, res) => {
  const result = await animekai.getAnimeByType('movie');
  sendResult(res, { movies: result });
});

app.get('/api/specials', async (req, res) => {
  const result = await animekai.getAnimeByType('specials');
  sendResult(res, { specials: result });
});

app.get('/api/events', async (req, res) => {
  const result = await animekai.getAnimeByType('events');
  sendResult(res, { events: result });
});

app.get('/api/recently-added', async (req, res) => {
  const result = await animekai.getRecentlyAdded();
  sendResult(res, { recently_added: result });
});

app.get('/api/filter', async (req, res) => {
  const { type, genre, year } = req.query;
  const home = await animekai.scrapeHome();
  if (home.error) return sendResult(res, home);
  let results = home.latest_updates || [];
  if (type) results = results.filter(anime => anime.type?.toLowerCase() === type.toLowerCase());
  if (year) results = results.filter(anime => anime.year === year);
  sendResult(res, { filters: { type, genre, year }, count: results.length, results });
});

app.get('/api/episode-srcs', async (req, res) => {
  const { id, server, category } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'Missing id (link_id)' });
  const source = await animekai.resolveSource(id);
  if (source.error) return sendResult(res, source);
  sendResult(res, { link_id: id, server, category, ...source });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json(createResponse(false, null, {
    message:`Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
    status: 404
  }));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json(createResponse(false, null, {
    message: err.message || 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    status: 500
  }));
});

// Run the server locally if not in a serverless production environment
if (!IS_SERVERLESS && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ANIME KAI REST API                        ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║  Documentation:     http://localhost:${PORT}/docs              ║
║  Health Check:      http://localhost:${PORT}/health            ║
╠════════════════════════════════════════════════════════════╣
║  API Endpoints:                                            ║
║    - /api/home       (Latest updates & trending)           ║
║    - /api/search     (Search anime)                        ║
║    - /api/anime/:slug (Anime details)                      ║
║    - /api/episodes/:ani_id (Episode list)                  ║
║    - /api/servers/:ep_token (Streaming servers)            ║
║    - /api/source/:link_id (Direct m3u8 source)             ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

// Export for serverless deployment
module.exports = app;
