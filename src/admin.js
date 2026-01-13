/**
 * Admin UI Handler - Multi-Feed Support
 * Manages multiple podcast feeds with tokens and UA restrictions
 */

// Generate random token
function generateToken(length = 32) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// Generate short feed ID
function generateFeedId() {
    return generateToken(8);
}

// Get all feeds from KV
async function getFeeds(env) {
    const feedsStr = await env.PODCAST_KV.get('FEEDS');
    if (!feedsStr) return {};
    try {
        return JSON.parse(feedsStr);
    } catch {
        return {};
    }
}

// Save all feeds to KV
async function saveFeeds(env, feeds) {
    await env.PODCAST_KV.put('FEEDS', JSON.stringify(feeds));
}

// Get single feed by ID
async function getFeedById(env, feedId) {
    const feeds = await getFeeds(env);
    return feeds[feedId] || null;
}

// Get feed by token
async function getFeedByToken(env, token) {
    const feeds = await getFeeds(env);
    for (const [id, feed] of Object.entries(feeds)) {
        if (feed.token === token) {
            return { id, ...feed };
        }
    }
    return null;
}

// Check admin password
function checkAuth(request, env) {
    const url = new URL(request.url);
    const providedPassword = url.searchParams.get('password');
    const adminPassword = env.ADMIN_PASSWORD || 'admin123';
    return providedPassword === adminPassword;
}

// Render Admin List Page
function renderAdminListPage(feeds, baseUrl, message = '') {
    const feedList = Object.entries(feeds).map(([id, feed]) => `
    <div class="feed-card">
      <div class="feed-header">
        <h3>${escapeHtml(feed.title || 'Untitled')}</h3>
        <span class="feed-id">${id}</span>
      </div>
      <div class="feed-info">
        <p><strong>网站:</strong> ${escapeHtml(feed.homepage || '-')}</p>
        <p><strong>RSS:</strong> <code>/rss/${escapeHtml(feed.token)}</code></p>
        <p><strong>UA限制:</strong> ${feed.allowedUA?.join(', ') || '*'}</p>
      </div>
      <div class="feed-actions">
        <a href="/admin/feed?id=${id}&password=${new URL(baseUrl).searchParams.get('password')}" class="btn btn-edit">编辑</a>
        <button onclick="refreshToken('${id}')" class="btn btn-warning">刷新Token</button>
        <button onclick="deleteFeed('${id}')" class="btn btn-danger">删除</button>
      </div>
    </div>
  `).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podcast RSS 管理</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      text-align: center;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .message {
      padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;
      background: rgba(46, 204, 113, 0.2); color: #2ecc71;
    }
    .feed-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      backdrop-filter: blur(10px);
    }
    .feed-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .feed-header h3 { margin: 0; color: #00d2ff; }
    .feed-id { font-size: 12px; color: #888; }
    .feed-info { font-size: 14px; color: #aaa; }
    .feed-info p { margin: 5px 0; }
    .feed-info code {
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .feed-actions { margin-top: 15px; display: flex; gap: 10px; }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      display: inline-block;
    }
    .btn-primary { background: linear-gradient(90deg, #00d2ff, #3a7bd5); color: #fff; }
    .btn-edit { background: #3a7bd5; color: #fff; }
    .btn-warning { background: #f39c12; color: #fff; }
    .btn-danger { background: #e74c3c; color: #fff; }
    .add-btn {
      display: block;
      width: 100%;
      padding: 15px;
      text-align: center;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      color: #fff;
      border-radius: 12px;
      text-decoration: none;
      font-weight: bold;
      margin-top: 20px;
    }
    .add-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎙️ Podcast RSS 管理</h1>
    ${message ? `<div class="message">${message}</div>` : ''}
    ${feedList || '<p style="text-align:center;color:#888;">暂无 Feed，点击下方按钮添加</p>'}
    <a href="/admin/feed?password=${new URL(baseUrl).searchParams.get('password')}" class="add-btn">➕ 添加新 Feed</a>
  </div>
  <script>
    const password = new URLSearchParams(window.location.search).get('password');
    async function refreshToken(id) {
      if (!confirm('确定刷新此 Feed 的 Token？旧链接将失效')) return;
      await fetch('/admin/feed/' + id + '/refresh-token?password=' + password, { method: 'POST' });
      location.reload();
    }
    async function deleteFeed(id) {
      if (!confirm('确定删除此 Feed？')) return;
      await fetch('/admin/feed/' + id + '?password=' + password, { method: 'DELETE' });
      location.reload();
    }
  </script>
</body>
</html>`;
}

// Render Feed Edit Page
function renderFeedEditPage(feed, feedId, baseUrl, message = '') {
    const isNew = !feedId;
  const cacheLimit = Number.isFinite(Number(feed?.cacheLimit)) && Number(feed?.cacheLimit) > 0 ? Number(feed.cacheLimit) : 10;
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isNew ? '添加' : '编辑'} Feed</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 30px;
      backdrop-filter: blur(10px);
    }
    h1 {
      text-align: center;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .section { margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .section:last-child { border-bottom: none; }
    .section h3 { margin: 0 0 15px 0; color: #00d2ff; font-size: 14px; text-transform: uppercase; }
    label { display: block; margin-bottom: 5px; font-size: 14px; color: #aaa; }
    input, textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 14px;
      margin-bottom: 15px;
    }
    input:focus, textarea:focus { outline: none; border-color: #00d2ff; }
    textarea { resize: vertical; min-height: 80px; }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
    }
    button:hover { opacity: 0.9; }
    .back-link { display: block; text-align: center; margin-top: 20px; color: #00d2ff; }
    .message { padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
    .help { font-size: 12px; color: #666; margin-top: -10px; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎙️ ${isNew ? '添加' : '编辑'} Feed</h1>
    ${message ? `<div class="message">${message}</div>` : ''}
    <form method="POST" action="/admin/feed?password=${new URL(baseUrl).searchParams.get('password')}">
      <input type="hidden" name="feedId" value="${feedId || ''}">
      <div class="section">
        <h3>🔐 登录配置</h3>
        <label>登录地址</label>
        <input type="url" name="loginUrl" value="${escapeHtml(feed?.loginUrl || '')}" placeholder="https://example.com/wp-login.php">
        <label>首页地址</label>
        <input type="url" name="homepage" value="${escapeHtml(feed?.homepage || '')}" placeholder="https://example.com/">
        <label>用户名</label>
        <input type="text" name="username" value="${escapeHtml(feed?.username || '')}" placeholder="your_username">
        <label>密码</label>
        <input type="password" name="password" value="${escapeHtml(feed?.password || '')}" placeholder="your_password">
      </div>
      <div class="section">
        <h3>🎧 播客信息</h3>
        <label>播客名称</label>
        <input type="text" name="title" value="${escapeHtml(feed?.title || '')}" placeholder="My Podcast">
        <label>播客简介</label>
        <textarea name="description" placeholder="这是一个自动生成的播客...">${escapeHtml(feed?.description || '')}</textarea>
        <label>封面图 URL</label>
        <input type="url" name="coverImage" value="${escapeHtml(feed?.coverImage || '')}" placeholder="https://example.com/cover.jpg">

        <label>缓存节目上限</label>
        <input type="number" name="cacheLimit" value="${cacheLimit}" min="1" step="1" placeholder="10">
        <p class="help">默认 10；超过后仅保留最新 N 期，避免 KV 缓存过大</p>
      </div>
      <div class="section">
        <h3>🔒 访问控制</h3>
        <label>UA 白名单 (逗号分隔, * 表示允许所有)</label>
        <input type="text" name="allowedUA" value="${escapeHtml((feed?.allowedUA || ['*']).join(', '))}" placeholder="Podcast, iTunes, *">
        <p class="help">客户端 UA 必须包含白名单中的任一关键词才能访问 RSS</p>
      </div>
      <button type="submit">💾 保存</button>
    </form>
    <a href="/admin?password=${new URL(baseUrl).searchParams.get('password')}" class="back-link">← 返回列表</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Handle Admin List
export async function handleAdminList(request, env) {
    if (!checkAuth(request, env)) {
        return new Response('Unauthorized. Add ?password=YOUR_PASSWORD to the URL.', { status: 401 });
    }

    const url = new URL(request.url);
    const feedId = url.searchParams.get('id');

    // If ID provided, show edit form
    if (url.pathname === '/admin/feed' || feedId) {
        const feed = feedId ? await getFeedById(env, feedId) : null;
        const html = renderFeedEditPage(feed, feedId, request.url);
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const feeds = await getFeeds(env);
    const html = renderAdminListPage(feeds, request.url);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Handle Feed Create/Update
export async function handleAdminFeed(request, env) {
    if (!checkAuth(request, env)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const feedId = formData.get('feedId') || generateFeedId();
    const feeds = await getFeeds(env);

    const isNew = !feeds[feedId];

    const allowedUAStr = formData.get('allowedUA') || '*';
    const allowedUA = allowedUAStr.split(',').map(s => s.trim()).filter(Boolean);

    let cacheLimit = parseInt(formData.get('cacheLimit') || '10', 10);
    if (!Number.isFinite(cacheLimit) || cacheLimit <= 0) cacheLimit = 10;

    feeds[feedId] = {
        token: feeds[feedId]?.token || generateToken(),
        loginUrl: formData.get('loginUrl') || '',
        homepage: formData.get('homepage') || '',
        username: formData.get('username') || '',
        password: formData.get('password') || '',
        title: formData.get('title') || 'My Podcast',
        description: formData.get('description') || '',
        coverImage: formData.get('coverImage') || '',
      allowedUA,
      cacheLimit
    };

    await saveFeeds(env, feeds);

    const password = new URL(request.url).searchParams.get('password');
    return Response.redirect(new URL(request.url).origin + '/admin?password=' + password + '&msg=' + (isNew ? 'created' : 'updated'), 302);
}

// Handle Token Refresh
export async function handleRefreshToken(request, env, feedId) {
    if (!checkAuth(request, env)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const feeds = await getFeeds(env);
    if (!feeds[feedId]) {
        return new Response('Feed not found', { status: 404 });
    }

    feeds[feedId].token = generateToken();
    await saveFeeds(env, feeds);

    return new Response(JSON.stringify({ success: true, newToken: feeds[feedId].token }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Handle Feed Delete
export async function handleDeleteFeed(request, env, feedId) {
    if (!checkAuth(request, env)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const feeds = await getFeeds(env);
    if (!feeds[feedId]) {
        return new Response('Feed not found', { status: 404 });
    }

    delete feeds[feedId];
    await saveFeeds(env, feeds);

    // Also delete cached data for this feed
    await env.PODCAST_KV.delete('FEED_DATA:' + feedId);

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export { getFeeds, getFeedById, getFeedByToken };
