// server.js
const express = require('express');
const cors = require('cors');
const animekai = require('./animekai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper to wrap responses
function sendResult(res, result) {
  if (result && result.error) {
    return res.status(500).json({ success: false, error: result.error });
  }
  return res.json({ success: true, ...result });
}

// ---------------------- ORIGINAL ENDPOINTS ----------------------
app.get('/', (req, res) => {
  res.json({
    success: true,
    api: 'Anime Kai REST API',
    version: '2.0.0',
    author: 'AnimeKai Scraper',
    endpoints: {
      '/api/': 'API documentation',
      '/api/home': 'Get banner, latest updates, and trending',
      '/api/most-searched': 'Get most-searched anime keywords',
      '/api/search?keyword=...': 'Search anime',
      '/api/anime/:slug': 'Get anime details and ani_id',
      '/api/episodes/:ani_id': 'Get episode list and ep tokens',
      '/api/servers/:ep_token': 'Get available servers for an episode',
      '/api/source/:link_id': 'Get direct m3u8 stream and skip times',
      '/api/trending': 'Get currently trending anime',
      '/api/popular': 'Get most popular anime this week',
      '/api/schedule': 'Get weekly airing schedule',
      '/api/random': 'Get a random anime',
      '/api/genre': 'Get list of all genres',
      '/api/az-list': 'Get anime alphabetically',
      '/api/subbed-anime': 'Get subbed anime list',
      '/api/dubbed-anime': 'Get dubbed anime list',
      '/api/ona': 'Get ONA (Original Net Animation) list',
      '/api/ova': 'Get OVA list',
      '/api/movie': 'Get anime movies',
      '/api/specials': 'Get specials',
      '/api/events': 'Get events',
      '/api/recently-added': 'Get recently added anime',
      '/api/filter': 'Filter anime (type, genre, year) - basic',
      '/api/episode-srcs': 'Get streaming sources (query: id, server, category)',
      '/docs': 'Interactive API playground',
    },
  });
});

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

// ---------------------- ADDITIONAL ENDPOINTS ----------------------
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

// API Playground HTML
app.get('/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Anime Kai API Playground</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          color: #e0e0e0;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        h1 { 
          color: #ff6b6b; 
          font-size: 2.5rem; 
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        h1 small { font-size: 1rem; color: #888; margin-left: 10px; }
        h2 { color: #ff9f43; margin: 1.5rem 0 1rem 0; font-size: 1.5rem; border-bottom: 2px solid #ff9f43; padding-bottom: 0.5rem; }
        h3 { color: #54a0ff; margin: 1rem 0; font-size: 1.2rem; }
        .subtitle { color: #aaa; margin-bottom: 2rem; }
        
        .card { 
          background: rgba(255,255,255,0.05); 
          border-radius: 12px; 
          padding: 1.5rem; 
          margin-bottom: 1.5rem; 
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
        }
        
        .endpoint-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          background: rgba(0,0,0,0.3);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        
        .method-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
          min-width: 60px;
          text-align: center;
        }
        .method-get { background: #10ac84; color: white; }
        
        input, select, button {
          padding: 10px 15px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.3);
          color: white;
          font-size: 0.95rem;
          transition: all 0.3s;
        }
        input:focus, select:focus { outline: none; border-color: #ff6b6b; background: rgba(0,0,0,0.5); }
        input { flex: 1; min-width: 250px; }
        input::placeholder { color: #888; }
        
        button {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          color: white;
          border: none;
          cursor: pointer;
          font-weight: 600;
          padding: 10px 20px;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(255,107,107,0.3); }
        button.secondary { background: linear-gradient(135deg, #54a0ff 0%, #5f27cd 100%); }
        button.small { padding: 6px 12px; font-size: 0.85rem; }
        
        .quick-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 15px 0;
        }
        
        pre {
          background: #0a0a0a;
          padding: 1.5rem;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 0.9rem;
          line-height: 1.5;
          border: 1px solid #333;
          max-height: 500px;
          overflow-y: auto;
        }
        code { font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
        
        .response-section { margin-top: 20px; }
        .response-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 10px;
        }
        
        .example-box {
          background: rgba(84, 160, 255, 0.1);
          border-left: 4px solid #54a0ff;
          padding: 15px;
          border-radius: 0 8px 8px 0;
          margin: 15px 0;
        }
        .example-box h4 { color: #54a0ff; margin-bottom: 10px; }
        
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .endpoint-group {
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          padding: 15px;
        }
        
        .loading { color: #ff9f43; }
        .error { color: #ff6b6b; }
        .success { color: #10ac84; }
        
        .tab-container { margin: 20px 0; }
        .tabs { display: flex; gap: 5px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .tab { 
          padding: 8px 16px; 
          background: transparent; 
          border: none; 
          color: #aaa; 
          cursor: pointer;
          border-radius: 8px 8px 0 0;
        }
        .tab.active { background: #ff6b6b; color: white; }
        .tab-content { display: none; padding: 20px 0; }
        .tab-content.active { display: block; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>
          🎬 Anime Kai API 
          <small>v2.0.0</small>
        </h1>
        <p class="subtitle">Comprehensive REST API for anime streaming data - Scrapes anikai.to</p>
        
        <div class="card">
          <h3>🚀 API Request Tester</h3>
          <div class="endpoint-row">
            <span class="method-badge method-get">GET</span>
            <input type="text" id="endpointInput" placeholder="/api/home" value="/api/home" style="flex: 2;">
            <button onclick="callApi()">▶ Send Request</button>
            <button class="secondary" onclick="clearResponse()">🗑 Clear</button>
          </div>
          
          <div class="quick-links">
            <span style="color: #aaa; margin-right: 10px;">Quick:</span>
            <button class="small" onclick="loadEndpoint('/api/')">API Info</button>
            <button class="small" onclick="loadEndpoint('/api/home')">Home</button>
            <button class="small" onclick="loadEndpoint('/api/trending')">Trending</button>
            <button class="small" onclick="loadEndpoint('/api/popular')">Popular</button>
            <button class="small" onclick="loadEndpoint('/api/most-searched')">Most Searched</button>
            <button class="small" onclick="loadEndpoint('/api/schedule')">Schedule</button>
            <button class="small" onclick="loadEndpoint('/api/genre')">Genres</button>
            <button class="small" onclick="loadEndpoint('/api/random')">Random</button>
          </div>
          
          <div class="response-section">
            <div class="response-header">
              <h3>📋 Response</h3>
              <span id="responseStatus"></span>
            </div>
            <pre id="responseArea">{
  "success": true,
  "api": "Anime Kai REST API",
  "version": "2.0.0",
  "author": "AnimeKai Scraper"
}

// Click any endpoint button to test the API
// Use the search form below to test parameterized endpoints</pre>
          </div>
        </div>
        
        <div class="tab-container">
          <div class="tabs">
            <button class="tab active" onclick="switchTab('examples')">📚 Examples</button>
            <button class="tab" onclick="switchTab('endpoints')">🔗 All Endpoints</button>
            <button class="tab" onclick="switchTab('workflow')">🔄 Workflow Guide</button>
          </div>
          
          <div id="tab-examples" class="tab-content active">
            <div class="grid-2">
              <div class="endpoint-group">
                <h3>🔍 Search Anime</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <input type="text" id="searchKeyword" placeholder="e.g., naruto, one piece" value="naruto">
                  <button onclick="searchAnime()">Search</button>
                </div>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "keyword": "naruto",
  "count": 10,
  "results": [{
    "title": "Naruto",
    "japanese_title": "ナルト",
    "slug": "naruto",
    "url": "https://anikai.to/watch/naruto",
    "poster": "https://...",
    "sub_episodes": "220",
    "dub_episodes": "220",
    "total_episodes": "220",
    "year": "2002",
    "type": "TV",
    "rating": "7.9"
  }]
}</pre>
                </div>
              </div>
              
              <div class="endpoint-group">
                <h3>📺 Get Anime Details</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <input type="text" id="animeSlug" placeholder="e.g., naruto" value="naruto">
                  <button onclick="getAnimeInfo()">Get Info</button>
                </div>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "ani_id": "12345",
  "title": "Naruto",
  "japanese_title": "ナルト",
  "description": "Naruto Uzumaki...",
  "poster": "https://...",
  "banner": "https://...",
  "sub_episodes": "220",
  "dub_episodes": "220",
  "type": "TV",
  "rating": "7.9",
  "mal_score": "8.0",
  "detail": {
    "status": "Completed",
    "studio": "Pierrot",
    "genres": ["Action", "Adventure"]
  },
  "seasons": [...]
}</pre>
                </div>
              </div>
              
              <div class="endpoint-group">
                <h3>📝 Get Episodes</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <input type="text" id="aniIdInput" placeholder="Anime ID from /api/anime/:slug">
                  <button onclick="getEpisodes()">Get Episodes</button>
                </div>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "ani_id": "12345",
  "count": 220,
  "episodes": [{
    "number": "1",
    "slug": "naruto-episode-1",
    "title": "Enter: Naruto Uzumaki!",
    "japanese_title": "参上!うずまきナルト",
    "token": "encrypted_token_here",
    "has_sub": true,
    "has_dub": true
  }]
}</pre>
                </div>
              </div>
              
              <div class="endpoint-group">
                <h3>🖥 Get Servers</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <input type="text" id="epTokenInput" placeholder="Episode token from episodes">
                  <button onclick="getServers()">Get Servers</button>
                </div>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "watching": "You are watching Naruto Episode 1",
  "servers": {
    "sub": [{
      "name": "Server 1",
      "server_id": "1",
      "episode_id": "123",
      "link_id": "abc123"
    }],
    "dub": [...]
  }
}</pre>
                </div>
              </div>
              
              <div class="endpoint-group">
                <h3>🎬 Get Stream Source</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <input type="text" id="linkIdInput" placeholder="Link ID from servers">
                  <button onclick="getSource()">Get Source</button>
                </div>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "embed_url": "https://...",
  "skip": {
    "intro": [0, 90],
    "outro": [1320, 1410]
  },
  "sources": [{
    "file": "https://.../playlist.m3u8",
    "type": "hls",
    "label": "1080p"
  }],
  "tracks": [...],
  "download": "https://..."
}</pre>
                </div>
              </div>
              
              <div class="endpoint-group">
                <h3>📅 Weekly Schedule</h3>
                <button onclick="loadEndpoint('/api/schedule')" style="margin-bottom: 15px;">Get Schedule</button>
                <div class="example-box">
                  <h4>Expected Response:</h4>
                  <pre style="font-size: 0.8rem; padding: 10px;">{
  "success": true,
  "schedule": [{
    "day": "Monday",
    "animeList": [{
      "title": "Anime Name",
      "time": "12:00",
      "episode": "Episode 5",
      "url": "https://..."
    }]
  }]
}</pre>
                </div>
              </div>
            </div>
          </div>
          
          <div id="tab-endpoints" class="tab-content">
            <h2>All Available Endpoints</h2>
            <div style="display: grid; gap: 10px;">
              ${[
                ['GET /api/', 'API information and endpoints list'],
                ['GET /api/home', 'Banner, latest updates, and trending anime'],
                ['GET /api/most-searched', 'Most searched anime keywords'],
                ['GET /api/search?keyword=:query', 'Search anime by keyword'],
                ['GET /api/anime/:slug', 'Detailed anime information'],
                ['GET /api/episodes/:ani_id', 'Episode list with tokens'],
                ['GET /api/servers/:ep_token', 'Available streaming servers'],
                ['GET /api/source/:link_id', 'Direct stream URL and sources'],
                ['GET /api/trending', 'Currently trending anime'],
                ['GET /api/popular', 'Most popular this week'],
                ['GET /api/schedule', 'Weekly airing schedule'],
                ['GET /api/random', 'Random anime details'],
                ['GET /api/genre', 'All available genres'],
                ['GET /api/az-list', 'Anime organized A-Z'],
                ['GET /api/subbed-anime', 'Subbed anime list'],
                ['GET /api/dubbed-anime', 'Dubbed anime list'],
                ['GET /api/ona', 'Original Net Animation list'],
                ['GET /api/ova', 'OVA list'],
                ['GET /api/movie', 'Anime movies'],
                ['GET /api/specials', 'Special episodes'],
                ['GET /api/events', 'Anime events'],
                ['GET /api/recently-added', 'Recently added anime'],
                ['GET /api/filter?type=&genre=&year=', 'Filter anime by criteria'],
                ['GET /api/episode-srcs?id=', 'Alternative source endpoint']
              ].map(([endpoint, desc]) => `
                <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 15px;">
                  <code style="color: #10ac84; min-width: 250px;">${endpoint}</code>
                  <span style="color: #aaa;">${desc}</span>
                  <button class="small" style="margin-left: auto;" onclick="loadEndpoint('${endpoint.split(' ')[1]}')">Test</button>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div id="tab-workflow" class="tab-content">
            <h2>🔄 Complete Streaming Workflow</h2>
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
              <ol style="line-height: 2; margin-left: 20px;">
                <li><strong>Search or Browse:</strong> Use <code>/api/search?keyword=anime</code> or <code>/api/home</code></li>
                <li><strong>Get Anime Details:</strong> Use the slug from search results with <code>/api/anime/:slug</code></li>
                <li><strong>Fetch Episodes:</strong> Use the <code>ani_id</code> from details with <code>/api/episodes/:ani_id</code></li>
                <li><strong>Get Streaming Servers:</strong> Use an episode's <code>token</code> with <code>/api/servers/:ep_token</code></li>
                <li><strong>Get Video Source:</strong> Use a server's <code>link_id</code> with <code>/api/source/:link_id</code></li>
                <li><strong>Play Video:</strong> Use the <code>sources[].file</code> URL in your video player</li>
              </ol>
              
              <div class="example-box" style="margin-top: 20px;">
                <h4>📝 Example Code (JavaScript):</h4>
                <pre style="font-size: 0.85rem;">// Complete workflow example
async function streamAnime(animeName, episodeNum) {
  // 1. Search for anime
  const searchRes = await fetch('/api/search?keyword=' + animeName);
  const searchData = await searchRes.json();
  const anime = searchData.results[0];
  
  // 2. Get anime details
  const infoRes = await fetch('/api/anime/' + anime.slug);
  const infoData = await infoRes.json();
  
  // 3. Get episodes
  const epsRes = await fetch('/api/episodes/' + infoData.ani_id);
  const epsData = await epsRes.json();
  const episode = epsData.episodes.find(e => e.number == episodeNum);
  
  // 4. Get servers
  const servRes = await fetch('/api/servers/' + episode.token);
  const servData = await servRes.json();
  const server = servData.servers.sub[0];
  
  // 5. Get video source
  const srcRes = await fetch('/api/source/' + server.link_id);
  const srcData = await srcRes.json();
  
  // 6. Play video
  return srcData.sources[0].file; // m3u8 URL
}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        let currentEndpoint = '/api/home';
        
        async function callApi() {
          const endpoint = document.getElementById('endpointInput').value;
          currentEndpoint = endpoint;
          const statusEl = document.getElementById('responseStatus');
          const responseEl = document.getElementById('responseArea');
          
          statusEl.innerHTML = '<span class="loading">⏳ Loading...</span>';
          responseEl.innerHTML = 'Loading...';
          
          try {
            const startTime = Date.now();
            const res = await fetch(endpoint);
            const data = await res.json();
            const duration = Date.now() - startTime;
            
            statusEl.innerHTML = \`<span class="success">✓ \${res.status} OK</span> <span style="color: #888;">(\${duration}ms)</span>\`;
            responseEl.innerHTML = JSON.stringify(data, null, 2);
          } catch (err) {
            statusEl.innerHTML = '<span class="error">✗ Error</span>';
            responseEl.innerHTML = 'Error: ' + err.message;
          }
        }
        
        function loadEndpoint(ep) {
          document.getElementById('endpointInput').value = ep;
          callApi();
        }
        
        function clearResponse() {
          document.getElementById('responseArea').innerHTML = '// Response cleared';
          document.getElementById('responseStatus').innerHTML = '';
        }
        
        async function searchAnime() {
          const kw = document.getElementById('searchKeyword').value;
          if (!kw) return alert('Enter a keyword');
          loadEndpoint('/api/search?keyword=' + encodeURIComponent(kw));
        }
        
        async function getAnimeInfo() {
          const slug = document.getElementById('animeSlug').value;
          if (!slug) return alert('Enter an anime slug');
          loadEndpoint('/api/anime/' + encodeURIComponent(slug));
        }
        
        async function getEpisodes() {
          const aniId = document.getElementById('aniIdInput').value;
          if (!aniId) return alert('Enter an anime ID (get from /api/anime/:slug)');
          loadEndpoint('/api/episodes/' + encodeURIComponent(aniId));
        }
        
        async function getServers() {
          const token = document.getElementById('epTokenInput').value;
          if (!token) return alert('Enter an episode token');
          loadEndpoint('/api/servers/' + encodeURIComponent(token));
        }
        
        async function getSource() {
          const linkId = document.getElementById('linkIdInput').value;
          if (!linkId) return alert('Enter a link ID');
          loadEndpoint('/api/source/' + encodeURIComponent(linkId));
        }
        
        function switchTab(tabName) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
          document.getElementById(\`tab-\${tabName}\`).classList.add('active');
        }
        
        // Load API info on page load
        window.addEventListener('load', () => {
          callApi();
        });
      </script>
    </body>
    </html>
  `);
});

// Run the server locally if not in a serverless production environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`🎬 Anime Kai API running on port ${PORT}`);
  });
}

// Export the app for serverless deployment (Vercel/Netlify)
module.exports = app;
