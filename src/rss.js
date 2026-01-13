/**
 * RSS Generation Module - Multi-Feed Support
 * Reads cached articles from KV and generates podcast RSS XML
 * Includes token-based auth and UA restriction
 */
import { getFeedByToken } from './admin.js';
import { getCachedArticles, fetchAndCacheLatest } from './scraper.js';

// Check if UA is allowed
function checkUA(request, feed) {
    const allowedUA = feed.allowedUA || ['*'];

    // If wildcard, allow all
    if (allowedUA.includes('*')) return true;

    const clientUA = request.headers.get('User-Agent') || '';

    // Check if any allowed keyword is in the UA
    for (const allowed of allowedUA) {
        if (clientUA.toLowerCase().includes(allowed.toLowerCase())) {
            return true;
        }
    }

    return false;
}

// Generate RSS XML string
function generateRssXml(feed, articles) {
    const escapeXml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.title || 'My Podcast')}</title>
    <description>${escapeXml(feed.description || 'Auto-generated podcast feed')}</description>
    <link>${escapeXml(feed.homepage || '')}</link>
    <language>zh-cn</language>`;

    if (feed.coverImage) {
        xml += `
    <itunes:image href="${escapeXml(feed.coverImage)}" />
    <image>
      <url>${escapeXml(feed.coverImage)}</url>
      <title>${escapeXml(feed.title || 'My Podcast')}</title>
      <link>${escapeXml(feed.homepage || '')}</link>
    </image>`;
    }

    for (const article of articles) {
        xml += `
    <item>
      <title>${escapeXml(article.title)}</title>
      <description><![CDATA[${article.description || ''}]]></description>
      <link>${escapeXml(article.link)}</link>
      <guid isPermaLink="true">${escapeXml(article.link)}</guid>
      <pubDate>${article.pubDate}</pubDate>`;

        if (article.audioUrl) {
            xml += `
      <enclosure url="${escapeXml(article.audioUrl)}" type="${article.mimeType || 'audio/mpeg'}" length="0" />`;
        }

        xml += `
    </item>`;
    }

    xml += `
  </channel>
</rss>`;

    return xml;
}

// Handle RSS request with token
export async function handleRss(request, env, ctx, token) {
    // Find feed by token
    const feed = await getFeedByToken(env, token);

    if (!feed) {
        return new Response('Invalid token', { status: 404 });
    }

    // Check UA restriction
    if (!checkUA(request, feed)) {
        return new Response('Forbidden - User-Agent not allowed', { status: 403 });
    }

    // Get cached articles
    let articles = await getCachedArticles(env, feed.id);

    // If no cached articles, auto-fetch latest (lazy scrape on first access)
    if (articles.length === 0) {
        try {
            await fetchAndCacheLatest(env, feed.id, feed);
            articles = await getCachedArticles(env, feed.id);
        } catch (e) {
            // Ignore fetch errors, will return empty feed
            console.error('Auto-fetch failed:', e.message);
        }
    }

    // Generate RSS
    const xml = generateRssXml(feed, articles);

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
        }
    });
}
