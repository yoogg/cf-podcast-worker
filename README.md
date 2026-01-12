# Podcast RSS Generator (Cloudflare Worker)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yoogg/cf-podcast-worker)

A Cloudflare Worker that scrapes audio articles from a WordPress site and generates a valid Podcast RSS feed. Features a multi-feed management system with token-based authentication and User-Agent restrictions.

这是一个运行在 Cloudflare Worker 上的播客 RSS 生成器。它可以抓取 WordPress 网站的音频文章并生成标准的播客 RSS Feed。支持多订阅源管理、Token 鉴权以及 User-Agent 访问限制。

---

## 🇬🇧 English Documentation

### Features

- **Multi-Site Support**: Manage multiple podcast feeds from a single worker.
- **Incremental Scraping**: Fetches only the latest article to minimize resource usage.
- **Token Authentication**: Secure RSS feeds with unique, refreshable tokens (`/rss/:token`).
- **User-Agent Filtering**: Restrict access to specific podcast clients (e.g., Apple Podcasts, iTunes).
- **Admin UI**: Built-in web interface for easy configuration.
- **KV Storage**: Uses Cloudflare KV for caching articles and storing configuration.

### Setup & Deployment

#### 1. Prerequisites
- A Cloudflare account.
- `npm` and `node` installed locally.
- `wrangler` CLI installed (`npm install -g wrangler`).

#### 2. Configuration
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a KV Namespace in Cloudflare Dashboard:
   - Go to **Workers & Pages** -> **KV**.
   - Create a namespace (e.g., `PODCAST_DB`).
   - Note the **ID**.
4. Update `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "PODCAST_KV"
   id = "YOUR_KV_NAMESPACE_ID"        # Replace with your KV ID
   preview_id = "YOUR_PREVIEW_KV_ID"  # Optional, for local dev
   ```

#### 3. Local Development
```bash
npm run dev
```
Visit `http://localhost:8787/admin`.

#### 4. Deployment
```bash
npm run deploy
```

### Admin Interface

The worker comes with a built-in admin interface at `/admin`.
Default access requires a password parameter: `/admin?password=admin123`.

**Environment Variable:**
To change the admin password, set the `ADMIN_PASSWORD` variable in your Worker settings or `wrangler.toml`.

#### Managing Feeds
1. **Login Configuration**: Enter the WordPress login URL, homepage, username, and password.
2. **Podcast Metadata**: Set the Title, Description, and Cover Image for the podcast.
3. **Access Control**: Configure allowed User-Agents (e.g., `Overcast, Apple CoreMedia` to restrict access).

### API Endpoints

- `GET /admin?password=...`: Admin Dashboard.
- `GET /rss/:token`: The podcast RSS feed.
- `POST /update/:feedId`: Manually trigger a scrape for the latest article.

---

## 🇨🇳 中文文档

### 功能特性

- **多站点支持**：在一个 Worker 中管理多个不同的播客订阅源。
- **增量抓取**：仅抓取最新发布的文章，最小化资源消耗。
- **Token 鉴权**：通过唯一的 Token 保护 RSS Feed (`/rss/:token`)，支持刷新 Token。
- **User-Agent 过滤**：限制特定的播客客户端（如 Apple Podcasts, iTunes）访问。
- **管理界面**：内置 Web 管理界面，轻松配置和管理。
- **KV 存储**：使用 Cloudflare KV 缓存文章和存储配置信息。

### 安装与部署

#### 1. 前置要求
- 一个 Cloudflare 账户。
- 本地已安装 `npm` 和 `node`。
- 已安装 `wrangler` CLI (`npm install -g wrangler`)。

#### 2. 配置
1. 克隆本项目。
2. 安装依赖：
   ```bash
   npm install
   ```
3. 在 Cloudflare 控制台创建 KV 命名空间：
   - 进入 **Workers & Pages** -> **KV**。
   - 创建一个新的命名空间（例如 `PODCAST_DB`）。
   - 记录下 **ID**。
4. 更新 `wrangler.toml` 配置文件：
   ```toml
   [[kv_namespaces]]
   binding = "PODCAST_KV"
   id = "YOUR_KV_NAMESPACE_ID"        # 替换为你的 KV ID
   preview_id = "YOUR_PREVIEW_KV_ID"  # 可选，用于本地开发
   ```

#### 3. 本地开发
```bash
npm run dev
```
访问 `http://localhost:8787/admin` (默认密码: `admin123`)。

#### 4. 部署
```bash
npm run deploy
```

### 管理界面

项目内置了管理界面，路径为 `/admin`。
默认访问需要带上密码参数：`/admin?password=admin123`。

**环境变量：**
如需修改管理密码，请在 Worker 设置或 `wrangler.toml` 中设置 `ADMIN_PASSWORD` 变量。

#### 管理订阅源 (Feed)
1. **登录配置**：输入 WordPress 的登录地址、首页地址、用户名和密码。
2. **播客元数据**：设置播客的标题、简介和封面图片。
3. **访问控制**：配置允许访问的 User-Agent 白名单（例如 `Overcast, Apple CoreMedia`）。

### API 接口

- `GET /admin?password=...`: 管理后台。
- `GET /rss/:token`: 获取播客 RSS Feed。
- `POST /update/:feedId`: 手动触发抓取最新文章。

## License
MIT
