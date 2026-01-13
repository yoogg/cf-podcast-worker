/**
 * Scraper Module - Multi-Feed Support
 * Handles login, fetching latest article, and updating KV cache per feed
 */
import * as cheerio from 'cheerio';
import { getFeedById } from './admin.js';

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1';
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg'];
const MIME_TYPES = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
};

// Login and return cookies (follows redirects to gather all session cookies)
async function login(feed) {
    const loginUrl = feed.loginUrl;
    const homepage = feed.homepage;

    // Step 1: GET login page to grab initial cookies (test cookie, etc.)
    const initResp = await fetch(loginUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual'
    });
    let cookies = extractCookies(initResp.headers);

    // Step 2: POST credentials
    const formData = new URLSearchParams({
        'log': feed.username,
        'pwd': feed.password,
        'rememberme': 'forever',
        'wp-submit': 'Log In',
        'redirect_to': homepage,
        'testcookie': '1'
    });

    let resp = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': loginUrl,
            'Cookie': cookies
        },
        body: formData.toString(),
        redirect: 'manual'
    });
    cookies = mergeCookies(cookies, extractCookies(resp.headers));

    // Step 3: Follow up to 5 redirects to accumulate all cookies
    for (let i = 0; i < 5; i++) {
        const location = resp.headers.get('location');
        if (!location) break;
        resp = await fetch(location, {
            headers: { 'User-Agent': USER_AGENT, 'Cookie': cookies },
            redirect: 'manual'
        });
        cookies = mergeCookies(cookies, extractCookies(resp.headers));
    }

    if (cookies.includes('wordpress_logged_in')) {
        return cookies;
    }

    throw new Error('Login failed: wordpress_logged_in cookie not found');
}

function extractCookies(headers) {
    const setCookies = headers.getAll ? headers.getAll('set-cookie') : [headers.get('set-cookie')].filter(Boolean);
    const cookieParts = [];
    for (const sc of setCookies) {
        if (sc) {
            const match = sc.match(/^([^;]+)/);
            if (match) cookieParts.push(match[1]);
        }
    }
    return cookieParts.join('; ');
}

function mergeCookies(existing, newCookies) {
    const cookieMap = {};
    for (const c of existing.split('; ').filter(Boolean)) {
        const [name] = c.split('=');
        cookieMap[name] = c;
    }
    for (const c of newCookies.split('; ').filter(Boolean)) {
        const [name] = c.split('=');
        cookieMap[name] = c;
    }
    return Object.values(cookieMap).join('; ');
}

async function getLatestArticleLink(feed, cookies) {
    const resp = await fetch(feed.homepage, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookies }
    });

    const html = await resp.text();
    const $ = cheerio.load(html);

    let link = null;
    const selectors = ['article h2 a', 'article h3 a', '.entry-title a', '.post h2 a'];

    for (const selector of selectors) {
        const el = $(selector).first();
        if (el.length) {
            link = el.attr('href');
            break;
        }
    }

    return link;
}

async function parseArticle(url, cookies) {
    const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookies }
    });

    const html = await resp.text();
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, article h1, .post-title').first().text().trim() || 'Untitled';

    let pubDate = new Date().toUTCString();
    const timeEl = $('time.entry-date.published');
    if (timeEl.length && timeEl.attr('datetime')) {
        try {
            pubDate = new Date(timeEl.attr('datetime')).toUTCString();
        } catch { }
    }

    let audioUrl = null;
    const audioTag = $('audio');
    if (audioTag.length) {
        audioUrl = audioTag.find('source').attr('src') || audioTag.attr('src');
    }

    if (!audioUrl) {
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && AUDIO_EXTENSIONS.some(ext => href.toLowerCase().includes(ext))) {
                audioUrl = href;
                return false;
            }
        });
    }

    if (audioUrl && audioUrl.includes('?')) {
        audioUrl = audioUrl.split('?')[0];
    }

    let content = '';
    const contentEl = $('.entry-content, .post-content, article').first();
    if (contentEl.length) {
        content = contentEl.text().trim();
        if (content.includes('Podcast (vip):')) {
            content = content.split('Podcast (vip):')[0].trim();
        }
        if (audioUrl && content.includes(audioUrl)) {
            content = content.replace(audioUrl, '').trim();
        }
        content = content.split('\n').map(l => l.trim()).filter(l => l).join('\n');
    }

    let mimeType = 'audio/mpeg';
    if (audioUrl) {
        for (const ext of Object.keys(MIME_TYPES)) {
            if (audioUrl.toLowerCase().endsWith(ext)) {
                mimeType = MIME_TYPES[ext];
                break;
            }
        }
    }

    return { title, link: url, description: content, pubDate, audioUrl, mimeType };
}

// Get cached articles for a specific feed
export async function getCachedArticles(env, feedId) {
    const dataStr = await env.PODCAST_KV.get('FEED_DATA:' + feedId);
    if (!dataStr) return [];
    try {
        return JSON.parse(dataStr);
    } catch {
        return [];
    }
}

// Save cached articles for a specific feed
export async function saveCachedArticles(env, feedId, articles, maxItems = 10) {
    const limit = Number.isFinite(Number(maxItems)) && Number(maxItems) > 0 ? Number(maxItems) : 10;
    const trimmed = articles.slice(0, limit);
    await env.PODCAST_KV.put('FEED_DATA:' + feedId, JSON.stringify(trimmed));
}

/**
 * Fetch latest article and cache it (used by RSS lazy-load and manual update)
 * @param {object} env - Worker env bindings
 * @param {string} feedId - Feed ID
 * @param {object} feed - Feed config object (optional, will fetch from KV if not provided)
 * @returns {object} - { added: boolean, article?: object, cached: number }
 */
export async function fetchAndCacheLatest(env, feedId, feed = null) {
    if (!feed) {
        feed = await getFeedById(env, feedId);
    }
    if (!feed) {
        throw new Error('Feed not found');
    }
    if (!feed.username || !feed.password) {
        throw new Error('Login credentials not configured');
    }

    const cookies = await login(feed);
    const latestLink = await getLatestArticleLink(feed, cookies);

    if (!latestLink) {
        throw new Error('No articles found on homepage');
    }

    const cached = await getCachedArticles(env, feedId);
    const alreadyExists = cached.some(a => a.link === latestLink);

    if (alreadyExists) {
        return { added: false, cached: cached.length };
    }

    const article = await parseArticle(latestLink, cookies);

    if (!article.audioUrl) {
        throw new Error('Latest article has no audio');
    }

    cached.unshift(article);
    const maxItems = Number.isFinite(Number(feed.cacheLimit)) && Number(feed.cacheLimit) > 0 ? Number(feed.cacheLimit) : 10;
    await saveCachedArticles(env, feedId, cached, maxItems);

    return { added: true, article, cached: cached.length };
}

// Handle update for a specific feed (HTTP endpoint wrapper)
export async function handleUpdate(request, env, feedId) {
    try {
        const result = await fetchAndCacheLatest(env, feedId);

        if (result.added) {
            return new Response(JSON.stringify({
                message: 'New article added',
                article: result.article.title,
                totalCached: result.cached
            }), { headers: { 'Content-Type': 'application/json' } });
        } else {
            return new Response(JSON.stringify({
                message: 'Already up to date',
                totalCached: result.cached
            }), { headers: { 'Content-Type': 'application/json' } });
        }
    } catch (error) {
        const status = error.message.includes('not found') ? 404 : 
                       error.message.includes('credentials') ? 400 : 500;
        return new Response(JSON.stringify({ error: error.message }), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
