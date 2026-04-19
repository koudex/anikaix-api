// animekai.js
const axios = require('axios');
const cheerio = require('cheerio');

const ANIMEKAI_URL = 'https://anikai.to/';
const ANIMEKAI_HOME_URL = 'https://anikai.to/home';
const ANIMEKAI_SEARCH_URL = 'https://anikai.to/ajax/anime/search';
const ANIMEKAI_EPISODES_URL = 'https://anikai.to/ajax/episodes/list';
const ANIMEKAI_SERVERS_URL = 'https://anikai.to/ajax/links/list';
const ANIMEKAI_LINKS_VIEW_URL = 'https://anikai.to/ajax/links/view';

const ENCDEC_URL = 'https://enc-dec.app/api/enc-kai';
const ENCDEC_DEC_KAI = 'https://enc-dec.app/api/dec-kai';
const ENCDEC_DEC_MEGA = 'https://enc-dec.app/api/dec-mega';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://anikai.to/',
};

const AJAX_HEADERS = {
  ...HEADERS,
  'X-Requested-With': 'XMLHttpRequest',
};

async function encodeToken(text) {
  try {
    const res = await axios.get(ENCDEC_URL, { params: { text }, timeout: 15000 });
    if (res.data.status === 200) return res.data.result;
    return null;
  } catch {
    return null;
  }
}

async function decodeKai(text) {
  try {
    const res = await axios.post(ENCDEC_DEC_KAI, { text }, { timeout: 15000 });
    if (res.data.status === 200) return res.data.result;
    return null;
  } catch {
    return null;
  }
}

async function decodeMega(text) {
  try {
    const res = await axios.post(ENCDEC_DEC_MEGA, { text, agent: HEADERS['User-Agent'] }, { timeout: 15000 });
    if (res.data.status === 200) return res.data.result;
    return null;
  } catch {
    return null;
  }
}

function parseInfoSpans(infoEl) {
  let sub = '', dub = '', type = '';
  if (!infoEl || !infoEl.length) return { sub, dub, type };
  infoEl.find('span').each((_, span) => {
    const $span = cheerio.load(span)('span').first() || cheerio.load(`<span>${span}</span>`)('span');
    const cls = $(span).attr('class') || '';
    if (cls.includes('sub')) sub = $(span).text().trim();
    else if (cls.includes('dub')) dub = $(span).text().trim();
    else if ($(span).find('b').length) type = $(span).text().trim();
  });
  return { sub, dub, type };
}

async function mostSearched() {
  try {
    const { data } = await axios.get(ANIMEKAI_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const mostSearchedDiv = $('div.most_searched, div.most-searched').first();
    if (!mostSearchedDiv.length) return { error: 'Could not find most-searched section' };
    const results = [];
    mostSearchedDiv.find('a').each((_, el) => {
      const $a = $(el);
      const name = $a.text().trim();
      const href = $a.attr('href') || '';
      let keyword = '';
      if (href.includes('keyword=')) keyword = href.split('keyword=')[1].replace(/\+/g, ' ');
      if (name) results.push({ name, keyword, search_url: ANIMEKAI_URL.replace(/\/$/, '') + href });
    });
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

async function searchAnime(keyword) {
  try {
    const { data } = await axios.get(ANIMEKAI_SEARCH_URL, { params: { keyword }, headers: AJAX_HEADERS, timeout: 15000 });
    const html = data.result?.html || '';
    if (!html) return [];
    const $ = cheerio.load(html);
    const results = [];
    $('a.aitem').each((_, el) => {
      const $item = $(el);
      const titleTag = $item.find('h6.title');
      const title = titleTag.text().trim();
      const japaneseTitle = titleTag.attr('data-jp') || '';
      const poster = $item.find('.poster img').attr('src') || '';
      const href = $item.attr('href') || '';
      const slug = href.replace('/watch/', '');
      let sub = '', dub = '', type = '', year = '', rating = '', totalEps = '';
      $item.find('.info span').each((_, span) => {
        const $span = $(span);
        const cls = $span.attr('class') || '';
        if (cls.includes('sub')) sub = $span.text().trim();
        else if (cls.includes('dub')) dub = $span.text().trim();
        else if (cls.includes('rating')) rating = $span.text().trim();
        else {
          const text = $span.text().trim();
          if ($span.find('b').length) {
            if (text.match(/^\d+$/)) totalEps = text;
            else type = text;
          } else year = text;
        }
      });
      if (title) {
        results.push({
          title,
          japanese_title: japaneseTitle,
          slug,
          url: ANIMEKAI_URL.replace(/\/$/, '') + href,
          poster,
          sub_episodes: sub,
          dub_episodes: dub,
          total_episodes: totalEps,
          year,
          type,
          rating,
        });
      }
    });
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

async function scrapeHome() {
  try {
    const { data } = await axios.get(ANIMEKAI_HOME_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const banner = [];
    $('.swiper-slide').each((_, slide) => {
      const $slide = $(slide);
      const style = $slide.attr('style') || '';
      let bgImage = '';
      const match = style.match(/url\(([^)]+)\)/);
      if (match) bgImage = match[1];
      const titleTag = $slide.find('p.title');
      const title = titleTag.text().trim();
      const japaneseTitle = titleTag.attr('data-jp') || '';
      const description = $slide.find('p.desc').text().trim();
      
      const infoEl = $slide.find('.info');
      let sub = '', dub = '', type = '';
      infoEl.find('span').each((_, span) => {
        const $span = $(span);
        const cls = $span.attr('class') || '';
        if (cls.includes('sub')) sub = $span.text().trim();
        else if (cls.includes('dub')) dub = $span.text().trim();
        else if ($span.find('b').length) type = $span.text().trim();
      });
      
      let genres = '';
      infoEl.find('span').each((_, span) => {
        const $span = $(span);
        if (!$span.attr('class') && !$span.find('b').length) {
          const text = $span.text().trim();
          if (text && !text.match(/^\d+$/)) genres = text;
        }
      });
      
      let rating = '', release = '', quality = '';
      const mics = $slide.find('.mics');
      mics.find('> div').each((_, div) => {
        const $div = $(div);
        const label = $div.find('div').first().text().trim().toLowerCase();
        const value = $div.find('span').first().text().trim();
        if (label === 'rating') rating = value;
        else if (label === 'release') release = value;
        else if (label === 'quality') quality = value;
      });
      
      const watchBtn = $slide.find('a.watch-btn');
      const url = watchBtn.length ? ANIMEKAI_URL.replace(/\/$/, '') + watchBtn.attr('href') : '';
      
      if (title) {
        banner.push({
          title,
          japanese_title: japaneseTitle,
          description,
          poster: bgImage,
          url,
          sub_episodes: sub,
          dub_episodes: dub,
          type,
          genres,
          rating,
          release,
          quality,
        });
      }
    });
    
    const latest = [];
    $('.aitem-wrapper.regular .aitem').each((_, el) => {
      const $item = $(el);
      const titleTag = $item.find('a.title');
      const hrefPoster = $item.find('a.poster').attr('href') || '';
      let episode = '';
      if (hrefPoster.includes('#ep=')) {
        episode = hrefPoster.split('#ep=')[1];
      }
      const cleanHref = hrefPoster.split('#ep=')[0];
      
      const infoEl = $item.find('.info');
      let sub = '', dub = '', type = '';
      infoEl.find('span').each((_, span) => {
        const $span = $(span);
        const cls = $span.attr('class') || '';
        if (cls.includes('sub')) sub = $span.text().trim();
        else if (cls.includes('dub')) dub = $span.text().trim();
        else if ($span.find('b').length) type = $span.text().trim();
      });
      
      if (titleTag.length) {
        latest.push({
          title: titleTag.text().trim(),
          japanese_title: titleTag.attr('data-jp') || '',
          poster: $item.find('img.lazyload').attr('data-src') || '',
          url: ANIMEKAI_URL.replace(/\/$/, '') + cleanHref,
          current_episode: episode,
          sub_episodes: sub,
          dub_episodes: dub,
          type,
        });
      }
    });
    
    const trending = {};
    const tabs = { trending: 'NOW', day: 'DAY', week: 'WEEK', month: 'MONTH' };
    for (const [tabId, label] of Object.entries(tabs)) {
      const container = $(`.aitem-col.top-anime[data-id='${tabId}']`);
      if (!container.length) continue;
      const items = [];
      container.find('a.aitem').each((_, el) => {
        const $item = $(el);
        const style = $item.attr('style') || '';
        let poster = '';
        const match = style.match(/url\(([^)]+)\)/);
        if (match) poster = match[1];
        
        const infoEl = $item.find('.info');
        let sub = '', dub = '', type = '';
        infoEl.find('span').each((_, span) => {
          const $span = $(span);
          const cls = $span.attr('class') || '';
          if (cls.includes('sub')) sub = $span.text().trim();
          else if (cls.includes('dub')) dub = $span.text().trim();
          else if ($span.find('b').length) type = $span.text().trim();
        });
        
        const rank = $item.find('.num').text().trim();
        const detailTitle = $item.find('.detail .title');
        const title = detailTitle.text().trim();
        const japaneseTitle = detailTitle.attr('data-jp') || '';
        
        items.push({
          rank,
          title,
          japanese_title: japaneseTitle,
          poster,
          url: ANIMEKAI_URL.replace(/\/$/, '') + ($item.attr('href') || ''),
          sub_episodes: sub,
          dub_episodes: dub,
          type,
        });
      });
      trending[label] = items;
    }
    
    return { banner, latest_updates: latest, top_trending: trending };
  } catch (err) {
    return { error: err.message };
  }
}

async function scrapeAnimeInfo(slug) {
  try {
    const url = `${ANIMEKAI_URL}watch/${slug}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    
    let aniId = '';
    const syncScript = $('#syncData').html();
    if (syncScript) {
      try {
        const syncJson = JSON.parse(syncScript);
        aniId = syncJson.anime_id || '';
      } catch {}
    }
    
    const infoEl = $('.main-entity .info');
    let sub = '', dub = '', type = '';
    infoEl.find('span').each((_, span) => {
      const $span = $(span);
      const cls = $span.attr('class') || '';
      if (cls.includes('sub')) sub = $span.text().trim();
      else if (cls.includes('dub')) dub = $span.text().trim();
      else if ($span.find('b').length) type = $span.text().trim();
    });
    
    const detail = {};
    $('.detail > div > div').each((_, div) => {
      const $div = $(div);
      const text = $div.text().split('|').map(s => s.trim()).join('|');
      if (text.includes(':')) {
        const [keyRaw, ...valueParts] = text.split(':');
        const key = keyRaw.trim().toLowerCase().replace(/ /g, '_').replace(':', '');
        const value = valueParts.join(':').trim().replace(/\|/g, '');
        const links = $div.find('span a');
        if (links.length) {
          detail[key] = links.map((_, a) => $(a).text().trim()).get();
        } else {
          detail[key] = value;
        }
      }
    });
    
    const seasons = [];
    $('.swiper-wrapper.season .aitem').each((_, el) => {
      const $item = $(el);
      const isActive = $item.hasClass('active');
      const detailDiv = $item.find('.detail');
      const title = detailDiv.find('span').first().text().trim();
      const episodes = detailDiv.find('.btn').text().trim();
      const poster = $item.find('img').attr('src') || '';
      const seasonUrl = $item.find('a.poster').attr('href') || '';
      seasons.push({
        title,
        episodes,
        poster,
        url: ANIMEKAI_URL.replace(/\/$/, '') + seasonUrl,
        active: isActive,
      });
    });
    
    const bgEl = $('.watch-section-bg');
    let banner = '';
    if (bgEl.length) {
      const bgStyle = bgEl.attr('style') || '';
      const match = bgStyle.match(/url\(([^)]+)\)/);
      if (match) banner = match[1];
    }
    
    return {
      ani_id: aniId,
      title: $('h1.title').first().text().trim(),
      japanese_title: $('h1.title').first().attr('data-jp') || '',
      description: $('.desc').first().text().trim(),
      poster: $('.poster img[itemprop="image"]').attr('src') || '',
      banner,
      sub_episodes: sub,
      dub_episodes: dub,
      type,
      rating: infoEl.find('.rating').first().text().trim(),
      mal_score: $('.rate-box .value').first().text().trim(),
      detail,
      seasons,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function fetchEpisodes(aniId) {
  try {
    const encoded = await encodeToken(aniId);
    if (!encoded) return { error: 'Token encryption failed' };
    const { data } = await axios.get(ANIMEKAI_EPISODES_URL, { params: { ani_id: aniId, _: encoded }, headers: AJAX_HEADERS, timeout: 15000 });
    const html = data.result || '';
    if (!html) return [];
    const $ = cheerio.load(html);
    const episodes = [];
    $('.eplist a').each((_, el) => {
      const $ep = $(el);
      const langs = $ep.attr('langs') || '0';
      episodes.push({
        number: $ep.attr('num') || '',
        slug: $ep.attr('slug') || '',
        title: $ep.find('span').first().text().trim(),
        japanese_title: $ep.find('span').first().attr('data-jp') || '',
        token: $ep.attr('token') || '',
        has_sub: !!(parseInt(langs) & 1),
        has_dub: !!(parseInt(langs) & 2),
      });
    });
    return episodes;
  } catch (err) {
    return { error: err.message };
  }
}

async function fetchServers(epToken) {
  try {
    const encoded = await encodeToken(epToken);
    if (!encoded) return { error: 'Token encryption failed' };
    const { data } = await axios.get(ANIMEKAI_SERVERS_URL, { params: { token: epToken, _: encoded }, headers: AJAX_HEADERS, timeout: 15000 });
    const html = data.result || '';
    const $ = cheerio.load(html);
    const servers = {};
    $('.server-items').each((_, group) => {
      const lang = $(group).attr('data-id') || 'unknown';
      servers[lang] = [];
      $(group).find('.server').each((_, srv) => {
        const $srv = $(srv);
        servers[lang].push({
          name: $srv.text().trim(),
          server_id: $srv.attr('data-sid') || '',
          episode_id: $srv.attr('data-eid') || '',
          link_id: $srv.attr('data-lid') || '',
        });
      });
    });
    const watching = $('.server-note p').first().text().trim();
    return { watching, servers };
  } catch (err) {
    return { error: err.message };
  }
}

async function resolveSource(linkId) {
  try {
    const encoded = await encodeToken(linkId);
    if (!encoded) return { error: 'Token encryption failed' };
    const { data } = await axios.get(ANIMEKAI_LINKS_VIEW_URL, { params: { id: linkId, _: encoded }, headers: AJAX_HEADERS, timeout: 15000 });
    const encryptedResult = data.result || '';
    const embedData = await decodeKai(encryptedResult);
    if (!embedData || !embedData.url) return { error: 'Embed decryption failed' };
    const embedUrl = embedData.url;
    const videoId = embedUrl.replace(/\/$/, '').split('/').pop();
    const embedBase = embedUrl.includes('/e/') ? embedUrl.split('/e/')[0] : embedUrl.split('/').slice(0, -1).join('/');
    const mediaRes = await axios.get(`${embedBase}/media/${videoId}`, { headers: HEADERS, timeout: 15000 });
    const encryptedMedia = mediaRes.data.result || '';
    const finalData = await decodeMega(encryptedMedia);
    if (!finalData) return { error: 'Media decryption failed' };
    return {
      embed_url: embedUrl,
      skip: embedData.skip || {},
      sources: finalData.sources || [],
      tracks: finalData.tracks || [],
      download: finalData.download || '',
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Additional endpoints

async function getTrending() {
  const home = await scrapeHome();
  if (home.error) return home;
  return home.top_trending?.NOW || [];
}

async function getPopular() {
  const home = await scrapeHome();
  if (home.error) return home;
  return home.top_trending?.WEEK || [];
}

async function getSchedule() {
  try {
    const { data } = await axios.get(`${ANIMEKAI_URL}schedule`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const schedule = [];
    $('.schedule-day').each((_, dayDiv) => {
      const $day = $(dayDiv);
      const dayName = $day.find('.day-name').text().trim();
      const animeList = [];
      $day.find('.anime-item').each((__, item) => {
        const $item = $(item);
        animeList.push({
          title: $item.find('.title').text().trim(),
          time: $item.find('.time').text().trim(),
          episode: $item.find('.episode').text().trim(),
          url: ANIMEKAI_URL.replace(/\/$/, '') + ($item.attr('href') || ''),
        });
      });
      schedule.push({ day: dayName, animeList });
    });
    return schedule;
  } catch (err) {
    return { error: err.message };
  }
}

async function getGenres() {
  try {
    const { data } = await axios.get(ANIMEKAI_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const genres = [];
    $('.genre-list a, .genres a').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) genres.push(genre);
    });
    return [...new Set(genres)];
  } catch (err) {
    return { error: err.message };
  }
}

async function getRandomAnime() {
  const home = await scrapeHome();
  if (home.error) return home;
  const all = home.latest_updates || [];
  if (!all.length) return { error: 'No anime found' };
  const random = all[Math.floor(Math.random() * all.length)];
  const slug = random.url.split('/watch/')[1]?.split('/')[0] || '';
  return await scrapeAnimeInfo(slug);
}

async function getAzList() {
  try {
    const { data } = await axios.get(`${ANIMEKAI_URL}az-list`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const az = {};
    $('.az-letter').each((_, letterDiv) => {
      const letter = $(letterDiv).find('.letter').text().trim();
      const animes = [];
      $(letterDiv).find('.anime-item').each((__, item) => {
        animes.push({
          title: $(item).find('.title').text().trim(),
          url: ANIMEKAI_URL.replace(/\/$/, '') + ($(item).attr('href') || ''),
        });
      });
      if (animes.length) az[letter] = animes;
    });
    return az;
  } catch (err) {
    return { error: err.message };
  }
}

async function getSubbedAnime() {
  try {
    const { data } = await axios.get(`${ANIMEKAI_URL}subbed-anime`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const results = [];
    $('.anime-item').each((_, el) => {
      results.push({
        title: $(el).find('.title').text().trim(),
        url: ANIMEKAI_URL.replace(/\/$/, '') + ($(el).attr('href') || ''),
      });
    });
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

async function getDubbedAnime() {
  try {
    const { data } = await axios.get(`${ANIMEKAI_URL}dubbed-anime`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const results = [];
    $('.anime-item').each((_, el) => {
      results.push({
        title: $(el).find('.title').text().trim(),
        url: ANIMEKAI_URL.replace(/\/$/, '') + ($(el).attr('href') || ''),
      });
    });
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

async function getAnimeByType(type) {
  try {
    const { data } = await axios.get(`${ANIMEKAI_URL}${type}`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const results = [];
    $('.anime-item').each((_, el) => {
      results.push({
        title: $(el).find('.title').text().trim(),
        url: ANIMEKAI_URL.replace(/\/$/, '') + ($(el).attr('href') || ''),
      });
    });
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

async function getRecentlyAdded() {
  const home = await scrapeHome();
  if (home.error) return home;
  return home.latest_updates || [];
}

module.exports = {
  mostSearched,
  searchAnime,
  scrapeHome,
  scrapeAnimeInfo,
  fetchEpisodes,
  fetchServers,
  resolveSource,
  getTrending,
  getPopular,
  getSchedule,
  getGenres,
  getRandomAnime,
  getAzList,
  getSubbedAnime,
  getDubbedAnime,
  getAnimeByType,
  getRecentlyAdded,
};