/**
 * RSS Generation Module - Multi-Feed Support
 * Reads cached articles from KV and generates podcast RSS XML
 * Includes token-based auth and UA restriction
 */
import { getFeedByToken } from './admin.js';
import { getCachedArticles, fetchAndCacheLatest } from './scraper.js';

function copyAndOpenPodcastHtml(pageUrl) {
        const escapedUrl = String(pageUrl).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>正在订阅播客</title>
    <style>
        body { margin: 0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background: #0b1220; color: #e5e7eb; }
        .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card { width: 100%; max-width: 520px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; text-align: center; }
        .btn { display: inline-block; width: 100%; padding: 14px 16px; border-radius: 12px; border: 0; cursor: pointer; font-size: 16px; font-weight: 600; background: #3a7bd5; color: #fff; }
        .url { margin: 12px 0 16px; word-break: break-all; font-size: 12px; color: #cbd5e1; }
        .hint { margin-top: 12px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div style="font-size:18px;font-weight:700;margin-bottom:8px;">订阅播客</div>
            <div class="hint">复制当前 RSS 链接，并跳转播客</div>
            <div class="url">${escapedUrl}</div>
            <button class="btn" id="go">复制并跳转</button>
            <div class="hint" id="status"></div>
        </div>
    </div>
    <script>
        const url = ${JSON.stringify(String(pageUrl))};
        const status = document.getElementById('status');

        async function copyText(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
            } catch (_) {}

            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                return ok;
            } catch (_) {
                return false;
            }
        }

        function openPodcast() {
            location.href = 'podcast://';
        }

        async function doAll() {
            const ok = await copyText(url);
            status.textContent = ok ? '已复制链接，正在跳转…' : '复制失败，请手动复制上方链接后打开播客 App。';
            openPodcast();
        }

        document.getElementById('go').addEventListener('click', doAll);
    </script>
</body>
</html>`;
}

function copyRssLinkHtml(rssUrl) {
        const escapedUrl = String(rssUrl).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RSS 链接</title>
    <style>
        body { margin: 0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background: #0b1220; color: #e5e7eb; }
        .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card { width: 100%; max-width: 520px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; text-align: center; }
        .btn { display: inline-block; width: 100%; padding: 14px 16px; border-radius: 12px; border: 0; cursor: pointer; font-size: 16px; font-weight: 600; background: #3a7bd5; color: #fff; }
        .url { margin: 12px 0 16px; word-break: break-all; font-size: 12px; color: #cbd5e1; }
        .hint { margin-top: 12px; font-size: 12px; color: #94a3b8; }
        a { color: #93c5fd; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div style="font-size:18px;font-weight:700;margin-bottom:8px;">RSS 链接（可复制）</div>
            <div class="url">${escapedUrl}</div>
            <button class="btn" id="copy">复制链接</button>
            <div class="hint" id="status"></div>
            <div class="hint" style="margin-top:8px;">也可直接打开：<a href="${escapedUrl}">${escapedUrl}</a></div>
        </div>
    </div>
    <script>
        const url = ${JSON.stringify(String(rssUrl))};
        const status = document.getElementById('status');

        async function copyText(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
            } catch (_) {}

            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                return ok;
            } catch (_) {
                return false;
            }
        }

        document.getElementById('copy').addEventListener('click', async () => {
            const ok = await copyText(url);
            status.textContent = ok ? '已复制到剪贴板' : '复制失败，请手动复制上方链接';
        });
    </script>
</body>
</html>`;
}

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
        return new Response(copyAndOpenPodcastHtml(request.url), {
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
    }

    const url = new URL(request.url);
    const accept = request.headers.get('Accept') || '';
    const wantHtml = url.searchParams.get('copy') === '1' || accept.includes('text/html');

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

    // In browsers, return a copy-friendly page instead of raw XML
    if (wantHtml) {
        const rssUrl = new URL(request.url);
        rssUrl.searchParams.delete('copy');
        return new Response(copyRssLinkHtml(rssUrl.toString()), {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store'
            }
        });
    }

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
        }
    });
}
