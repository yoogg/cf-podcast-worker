/**
 * Cloudflare Worker - Podcast RSS Generator (Multi-Feed)
 * Main entry point with routing
 */
import { handleAdminList, handleAdminFeed, handleRefreshToken, handleDeleteFeed } from './admin.js';
import { handleRss } from './rss.js';
import { handleUpdate } from './scraper.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Admin routes
        if (path === '/admin' && method === 'GET') {
            return handleAdminList(request, env);
        }
        // Admin feed editor (GET renders the form, POST saves)
        if (path === '/admin/feed' && method === 'GET') {
            return handleAdminList(request, env);
        }
        if (path === '/admin/feed' && method === 'POST') {
            return handleAdminFeed(request, env);
        }
        if (path.match(/^\/admin\/feed\/([^/]+)\/refresh-token$/) && method === 'POST') {
            const feedId = path.split('/')[3];
            return handleRefreshToken(request, env, feedId);
        }
        if (path.match(/^\/admin\/feed\/([^/]+)$/) && method === 'DELETE') {
            const feedId = path.split('/')[3];
            return handleDeleteFeed(request, env, feedId);
        }

        // RSS route: /rss/:token
        if (path.match(/^\/rss\/([^/]+)$/)) {
            const token = path.split('/')[2];
            return handleRss(request, env, ctx, token);
        }

        // Update route: /update/:feedId
        if (path.match(/^\/update\/([^/]+)$/)) {
            const feedId = path.split('/')[2];
            return handleUpdate(request, env, feedId);
        }

        // Root redirect to admin
        if (path === '/') {
            return Response.redirect(url.origin + '/admin', 302);
        }

        return new Response('Not Found', { status: 404 });
    }
};
