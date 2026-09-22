const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'dist');
const BRAND_CONFIG_PATH = path.join(__dirname, 'brand.config.json');

const brandConfig = JSON.parse(fs.readFileSync(BRAND_CONFIG_PATH, 'utf8'));
const sites = brandConfig.sites?.entries || [];

const send = (res, status, body, contentType = 'application/json; charset=utf-8') => {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
};

const readBody = req =>
    new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });

const exchangeToken = async (req, res) => {
    try {
        const raw = await readBody(req);
        const params = JSON.parse(raw || '{}');
        const runtimeClientId = String(
            process.env.DERIV_CLIENT_ID ||
            process.env.VITE_DERIV_CLIENT_ID ||
            ''
        ).trim();
        const runtimeRedirectUri = String(
            process.env.DERIV_REDIRECT_URI ||
            process.env.VITE_DERIV_REDIRECT_URI ||
            'https://sharp-mz3h.onrender.com/callback'
        ).trim();

        const site = sites.find(entry => entry.id === params.site_id) || (
            params.site_id === 'sharp-render' && runtimeClientId
                ? {
                    id: 'sharp-render',
                    client_id: runtimeClientId,
                    redirect_uri: runtimeRedirectUri,
                }
                : null
        );

        if (!site) {
            return send(res, 400, JSON.stringify({
                error: 'site_not_configured',
                error_description: 'Unknown OAuth site configuration.',
            }));
        }

        const form = new URLSearchParams({
            grant_type: params.grant_type || 'authorization_code',
            client_id: site.client_id,
            code: params.code || '',
            code_verifier: params.code_verifier || '',
            redirect_uri: site.redirect_uri,
        });

        // Some Deriv OAuth clients are configured with a client secret.
        // Keep it server-side only; never expose it to the browser.
        const clientSecret = String(process.env.DERIV_CLIENT_SECRET || '').trim();
        if (clientSecret) form.set('client_secret', clientSecret);

        if (params.grant_type === 'refresh_token') {
            form.delete('code');
            form.delete('code_verifier');
            form.set('refresh_token', params.refresh_token || '');
        }

        const response = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: form,
        });

        const text = await response.text();

        res.writeHead(response.status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        });
        res.end(text);
    } catch (error) {
        console.error('[OAuth proxy]', error);
        send(res, 502, JSON.stringify({
            error: 'oauth_proxy_error',
            error_description: error instanceof Error ? error.message : 'Unable to reach Deriv OAuth.',
        }));
    }
};


const getOAuthConfig = (req, res) => {
    const clientId = String(process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || '').trim();
    const redirectUri = String(
        process.env.DERIV_REDIRECT_URI ||
        process.env.VITE_DERIV_REDIRECT_URI ||
        'https://sharp-mz3h.onrender.com/callback'
    ).trim();

    if (!clientId) {
        return send(res, 503, JSON.stringify({
            configured: false,
            error: 'oauth_not_configured',
            error_description: 'DERIV_CLIENT_ID is not configured on the server.',
        }));
    }

    return send(res, 200, JSON.stringify({
        configured: true,
        client_id: clientId,
        redirect_uri: redirectUri,
        site_id: 'sharp-render',
        scopes: ['trade', 'application_read'],
    }));
};

const validateDerivPat = async (req, res) => {
    try {
        const raw = await readBody(req);
        const params = JSON.parse(raw || '{}');
        const token = String(params.token || '').trim();
        if (!token) return send(res, 400, JSON.stringify({ valid: false, error_description: 'API token is required.' }));
        const appId = String(process.env.DERIV_APP_ID || process.env.VITE_DERIV_APP_ID || '').trim();
        if (!appId) return send(res, 500, JSON.stringify({ valid: false, error_description: 'DERIV_APP_ID is not configured on the server.' }));
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`);
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('Deriv API validation timed out.')); }, 15000);
            ws.addEventListener('open', () => ws.send(JSON.stringify({ authorize: token })));
            ws.addEventListener('message', event => {
                try {
                    const data = JSON.parse(String(event.data));
                    if (data.error) { clearTimeout(timer); try { ws.close(); } catch {} reject(new Error(data.error.message || 'Deriv rejected the API token.')); return; }
                    if (data.msg_type === 'authorize') { clearTimeout(timer); try { ws.close(); } catch {} resolve({ account_id: data.authorize?.loginid || null, currency: data.authorize?.currency || null }); }
                } catch (error) { clearTimeout(timer); try { ws.close(); } catch {} reject(error); }
            });
            ws.addEventListener('error', () => { clearTimeout(timer); try { ws.close(); } catch {} reject(new Error('Unable to reach the Deriv API.')); });
        });
        return send(res, 200, JSON.stringify({ valid: true, ...result }));
    } catch (error) {
        return send(res, 401, JSON.stringify({ valid: false, error_description: error instanceof Error ? error.message : 'Invalid Deriv API token.' }));
    }
};


const crypto = require('node:crypto');

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD || 'change-me').trim();
const GITHUB_TOKEN = String(process.env.GITHUB_TOKEN || '').trim();
const GITHUB_REPO = String(process.env.GITHUB_REPO || 'elseking55-a11y/SHARP-').trim();
const GITHUB_BRANCH = String(process.env.GITHUB_BRANCH || 'main').trim();
const ADMIN_COOKIE = 'sharp_admin_session';

const parseRepo = repo => {
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new Error('GITHUB_REPO must look like owner/repository.');
    return { owner, name };
};

const signAdminSession = () => {
    const payload = `admin.${Date.now() + 8 * 60 * 60 * 1000}`;
    const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
};

const hasAdminSession = req => {
    const header = String(req.headers.cookie || '');
    const token = header.split(';').map(item => item.trim()).find(item => item.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'admin') return false;
    const expires = Number(parts[1]);
    if (!Number.isFinite(expires) || expires < Date.now()) return false;
    const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(`${parts[0]}.${parts[1]}`).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected)); } catch { return false; }
};

const requireAdmin = (req, res) => {
    if (hasAdminSession(req)) return true;
    send(res, 401, JSON.stringify({ error: 'admin_auth_required' }));
    return false;
};

const githubFetch = async (method, pathname, body) => {
    if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured on the server.');
    const response = await fetch(`https://api.github.com${pathname}`, {
        method,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'SHARP-Admin',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!response.ok) throw new Error(data.message || `GitHub API HTTP ${response.status}`);
    return data;
};

const githubContent = async filePath => {
    const { owner, name } = parseRepo(GITHUB_REPO);
    try {
        return await githubFetch('GET', `/repos/${owner}/${name}/contents/${filePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
    } catch (error) {
        if (/HTTP 404|Not Found/i.test(error.message)) return null;
        throw error;
    }
};

const githubPutFile = async (filePath, contentBase64, message, sha) => {
    const { owner, name } = parseRepo(GITHUB_REPO);
    return githubFetch('PUT', `/repos/${owner}/${name}/contents/${filePath}`, {
        message,
        content: contentBase64,
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
    });
};

const githubDeleteFile = async (filePath, sha, message) => {
    const { owner, name } = parseRepo(GITHUB_REPO);
    return githubFetch('DELETE', `/repos/${owner}/${name}/contents/${filePath}`, {
        message,
        sha,
        branch: GITHUB_BRANCH,
    });
};

const ADMIN_MANIFEST_PATH = 'public/free-bots/bots.json';

const readAdminManifest = async () => {
    const remote = await githubContent(ADMIN_MANIFEST_PATH);
    if (!remote) return [];
    const decoded = Buffer.from(String(remote.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    const payload = JSON.parse(decoded || '[]');
    return Array.isArray(payload) ? payload : Array.isArray(payload?.bots) ? payload.bots : [];
};

const writeAdminManifest = async bots => {
    const remote = await githubContent(ADMIN_MANIFEST_PATH);
    const payload = JSON.stringify(bots, null, 2) + '\n';
    await githubPutFile(
        ADMIN_MANIFEST_PATH,
        Buffer.from(payload, 'utf8').toString('base64'),
        'Admin: update free bot library',
        remote?.sha
    );
    const runtimePath = path.join(ROOT, 'free-bots', 'bots.json');
    try {
        fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
        fs.writeFileSync(runtimePath, payload);
    } catch (error) {
        console.warn('[Admin] Runtime manifest cache failed:', error.message);
    }
};

const adminLogin = async (req, res) => {
    try {
        if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return send(res, 503, JSON.stringify({ error: 'admin_not_configured' }));
        const body = JSON.parse(await readBody(req) || '{}');
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return send(res, 401, JSON.stringify({ error: 'invalid_admin_credentials' }));
        }
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Set-Cookie': `${ADMIN_COOKIE}=${signAdminSession()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`,
        });
        return res.end(JSON.stringify({ authenticated: true }));
    } catch (error) {
        return send(res, 400, JSON.stringify({ error: error.message }));
    }
};

const adminBots = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        if (!GITHUB_TOKEN) return send(res, 503, JSON.stringify({ error: 'github_storage_not_configured', message: 'Add GITHUB_TOKEN to Render environment variables.' }));
        const bots = await readAdminManifest();
        return send(res, 200, JSON.stringify({ bots }));
    } catch (error) {
        return send(res, 502, JSON.stringify({ error: 'admin_storage_error', message: error.message }));
    }
};

const adminSaveBot = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        if (!GITHUB_TOKEN) return send(res, 503, JSON.stringify({ error: 'github_storage_not_configured', message: 'Add GITHUB_TOKEN to Render environment variables.' }));
        const body = JSON.parse(await readBody(req) || '{}');
        const name = String(body.name || '').trim();
        const xmlBase64 = String(body.xmlBase64 || '').trim();
        if (!name) return send(res, 400, JSON.stringify({ error: 'bot_name_required' }));

        const bots = await readAdminManifest();
        const requestedId = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '-');
        const old = requestedId ? bots.find(bot => String(bot.id) === requestedId) : null;
        if (requestedId && !old) return send(res, 404, JSON.stringify({ error: 'bot_not_found' }));

        const safeFile = String(body.fileName || old?.file?.split('/').pop() || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bot'}-${Date.now()}.xml`)
            .replace(/[^a-zA-Z0-9._-]/g, '-');
        if (!safeFile.toLowerCase().endsWith('.xml')) return send(res, 400, JSON.stringify({ error: 'xml_file_required' }));

        let xml = '';
        if (xmlBase64) {
            xml = Buffer.from(xmlBase64, 'base64').toString('utf8');
            if (!/<xml[\\s>]/i.test(xml) && !/<block[\\s>]/i.test(xml)) return send(res, 400, JSON.stringify({ error: 'invalid_blockly_xml' }));
            if (Buffer.byteLength(xml, 'utf8') > 5 * 1024 * 1024) return send(res, 413, JSON.stringify({ error: 'bot_too_large' }));
        } else if (!old) {
            return send(res, 400, JSON.stringify({ error: 'xml_file_required' }));
        }
        const id = requestedId || `bot-${Date.now()}`;
        const bot = {
            id,
            name,
            description: String(body.description || 'Ready to load into Bot Builder.').trim(),
            emoji: String(body.emoji || '🤖').trim().slice(0, 4),
            badge: String(body.badge || 'SPECIAL BOT').trim().slice(0, 30),
            category: String(body.category || 'Free Bots').trim().slice(0, 40),
            accent: String(body.accent || '#20b98d').trim(),
            surface: String(body.surface || '#0d2135').trim(),
            text: String(body.text || '#ffffff').trim(),
            file: `/free-bots/${safeFile}`,
            priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : (old?.priority ?? bots.length + 1),
        };

        const filePath = `public/free-bots/${safeFile}`;
        if (xmlBase64) {
            const remoteXml = await githubContent(filePath);
            await githubPutFile(filePath, xmlBase64, `Admin: add/update bot ${name}`, remoteXml?.sha);
        }

        const next = bots.filter(item => String(item.id) !== id);
        next.push(bot);
        next.sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
        await writeAdminManifest(next);

        try {
            if (xmlBase64) {
                const runtimeDir = path.join(ROOT, 'free-bots');
                fs.mkdirSync(runtimeDir, { recursive: true });
                fs.writeFileSync(path.join(runtimeDir, safeFile), xml);
            }
        } catch (error) {
            console.warn('[Admin] Runtime bot cache failed:', error.message);
        }

        return send(res, 200, JSON.stringify({ saved: true, bot }));
    } catch (error) {
        console.error('[Admin save bot]', error);
        return send(res, 502, JSON.stringify({ error: 'admin_save_failed', message: error.message }));
    }
};

const adminDeleteBot = async (req, res, botId) => {
    if (!requireAdmin(req, res)) return;
    try {
        if (!GITHUB_TOKEN) return send(res, 503, JSON.stringify({ error: 'github_storage_not_configured', message: 'Add GITHUB_TOKEN to Render environment variables.' }));
        const bots = await readAdminManifest();
        const bot = bots.find(item => String(item.id) === botId);
        if (!bot) return send(res, 404, JSON.stringify({ error: 'bot_not_found' }));
        const filePath = String(bot.file || '').replace(/^\//, '');
        const remote = await githubContent(filePath);
        if (remote?.sha) await githubDeleteFile(filePath, remote.sha, `Admin: delete bot ${bot.name || botId}`);
        const next = bots.filter(item => String(item.id) !== botId);
        await writeAdminManifest(next);
        try { fs.rmSync(path.join(ROOT, filePath.replace(/^public\//, '')), { force: true }); } catch {}
        return send(res, 200, JSON.stringify({ deleted: true }));
    } catch (error) {
        return send(res, 502, JSON.stringify({ error: 'admin_delete_failed', message: error.message }));
    }
};

const adminLogout = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${ADMIN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    });
    res.end(JSON.stringify({ authenticated: false }));
};

const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const serveFile = (res, pathname) => {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(ROOT, safePath));

    if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
        return send(res, 403, JSON.stringify({ error: 'forbidden' }));
    }

    fs.readFile(filePath, (error, data) => {
        if (!error) {
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': mime[ext] || 'application/octet-stream',
                'Cache-Control': ['.html', '.json', '.css', '.js', '.mjs'].includes(ext) ? 'no-store, max-age=0, must-revalidate' : 'public, max-age=31536000, immutable',
                'Pragma': 'no-cache',
            });
            return res.end(data);
        }

        // React Router callback/deep links must return the SPA entry point.
        fs.readFile(path.join(ROOT, 'index.html'), (indexError, indexData) => {
            if (indexError) return send(res, 404, JSON.stringify({ error: 'not_found' }));
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
            });
            res.end(indexData);
        });
    });
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/api/admin/login') return adminLogin(req, res);
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') return adminLogout(req, res);
    if (req.method === 'GET' && url.pathname === '/api/admin/session') {
        return send(res, 200, JSON.stringify({ authenticated: hasAdminSession(req), configured: Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && GITHUB_TOKEN) }));
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/bots') return adminBots(req, res);
    if (req.method === 'POST' && url.pathname === '/api/admin/bots') return adminSaveBot(req, res);
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/bots/')) {
        return adminDeleteBot(req, res, decodeURIComponent(url.pathname.slice('/api/admin/bots/'.length)));
    }

    if (req.method === 'POST' && url.pathname === '/api/oauth/token') {
        return exchangeToken(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/deriv/oauth-config') {
        return getOAuthConfig(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/deriv/pat/validate') {
        return validateDerivPat(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    }

    return serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log(`SHARP production server listening on ${HOST}:${PORT}`);
});
