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
        const runtimeRedirectUri = getRuntimeRedirectUri(req);

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


const getRuntimeRedirectUri = req => {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/^www\./, '');
    if (host === 'elisy.site') return 'https://elisy.site/callback';
    return String(
        process.env.DERIV_REDIRECT_URI ||
        process.env.VITE_DERIV_REDIRECT_URI ||
        'https://sharp-mz3h.onrender.com/callback'
    ).trim();
};

const getOAuthConfig = (req, res) => {
    const clientId = String(process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || '').trim();
    const redirectUri = getRuntimeRedirectUri(req);

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
    if (!hasAdminSession(req)) return send(res, 401, JSON.stringify({ valid: false, error_description: 'Admin login required.' }));
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

const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || '').trim().toLowerCase();
const APP_LOGIN_PASSWORD = String(process.env.APP_LOGIN_PASSWORD || '');
const APP_SESSION_SECRET = String(process.env.APP_SESSION_SECRET || APP_LOGIN_PASSWORD || '').trim();
const APP_COOKIE = 'sharp_app_session';

const signAppSession = () => {
    const payload = `user.${Date.now() + 8 * 60 * 60 * 1000}`;
    const signature = crypto.createHmac('sha256', APP_SESSION_SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
};

const hasAppSession = req => {
    if (!APP_SESSION_SECRET) return false;
    const header = String(req.headers.cookie || '');
    const token = header.split(';').map(item => item.trim()).find(item => item.startsWith(`${APP_COOKIE}=`))?.slice(APP_COOKIE.length + 1);
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'user') return false;
    const expires = Number(parts[1]);
    if (!Number.isFinite(expires) || expires < Date.now()) return false;
    const expected = crypto.createHmac('sha256', APP_SESSION_SECRET).update(`${parts[0]}.${parts[1]}`).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected)); } catch { return false; }
};

const appLogin = async (req, res) => {
    try {
        if (!APP_LOGIN_EMAIL || !APP_LOGIN_PASSWORD || !APP_SESSION_SECRET) {
            return send(res, 503, JSON.stringify({ authenticated: false, error: 'login_not_configured', error_description: 'Set APP_LOGIN_EMAIL, APP_LOGIN_PASSWORD and APP_SESSION_SECRET in the Render environment.' }));
        }
        const body = JSON.parse(await readBody(req) || '{}');
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (email !== APP_LOGIN_EMAIL || password !== APP_LOGIN_PASSWORD) {
            return send(res, 401, JSON.stringify({ authenticated: false, error: 'invalid_credentials', error_description: 'Incorrect email or password.' }));
        }
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Set-Cookie': `${APP_COOKIE}=${signAppSession()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`,
        });
        return res.end(JSON.stringify({ authenticated: true }));
    } catch (error) {
        return send(res, 400, JSON.stringify({ authenticated: false, error: 'invalid_request', error_description: error.message }));
    }
};

const appLogout = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${APP_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    });
    res.end(JSON.stringify({ authenticated: false }));
};



const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD || '').trim();
const ADMIN_COOKIE = 'sharp_admin_session';

const ADMIN_CONFIG_PATH = process.env.SHARP_ADMIN_CONFIG_PATH || '/data/sharp-admin-config.json';
const EPHEMERAL_ADMIN_CONFIG_PATH = path.join('/tmp', 'sharp-admin-config.json');

const ensureConfigPath = () => {
    const candidates = [ADMIN_CONFIG_PATH, EPHEMERAL_ADMIN_CONFIG_PATH];
    for (const candidate of candidates) {
        try {
            fs.mkdirSync(path.dirname(candidate), { recursive: true });
            fs.accessSync(path.dirname(candidate), fs.constants.W_OK);
            return candidate;
        } catch {}
    }
    return null;
};

const ACTIVE_ADMIN_CONFIG_PATH = ensureConfigPath() || ADMIN_CONFIG_PATH;
const ADMIN_CONFIG_IS_PERSISTENT = ACTIVE_ADMIN_CONFIG_PATH === ADMIN_CONFIG_PATH;

const defaultPublicConfig = {
    managedBots: [],
    users: [],
    environmentMapping: { realLabel: 'REAL', demoLabel: 'DEMO' },
    websiteDisplayLoginIds: { real: 'ROT92654805', demo: 'DOT94513037' },
    websiteDisplayBalances: { real: 0, demo: 0 },
    clientId: String(process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || '').trim(),
    appearance: {
        siteName: String(process.env.SHARP_SITE_NAME || 'ELISY254'),
        primary: String(process.env.SHARP_PRIMARY || '#00a884'),
        secondary: String(process.env.SHARP_SECONDARY || '#ffffff'),
        navBackground: String(process.env.SHARP_NAV_BACKGROUND || '#071521'),
        navText: String(process.env.SHARP_NAV_TEXT || '#ffffff'),
        headerBackground: String(process.env.SHARP_HEADER_BACKGROUND || '#06111c'),
        cardBackground: String(process.env.SHARP_CARD_BACKGROUND || '#091a2b'),
    },
};

const loadPublicConfig = () => {
    try {
        if (!fs.existsSync(ACTIVE_ADMIN_CONFIG_PATH)) return structuredClone(defaultPublicConfig);
        const saved = JSON.parse(fs.readFileSync(ACTIVE_ADMIN_CONFIG_PATH, 'utf8'));
        return {
            ...defaultPublicConfig,
            ...saved,
            environmentMapping: { ...defaultPublicConfig.environmentMapping, ...(saved.environmentMapping || {}) },
            websiteDisplayLoginIds: { ...defaultPublicConfig.websiteDisplayLoginIds, ...(saved.websiteDisplayLoginIds || {}) },
            websiteDisplayBalances: { ...defaultPublicConfig.websiteDisplayBalances, ...(saved.websiteDisplayBalances || {}) },
            appearance: { ...defaultPublicConfig.appearance, ...(saved.appearance || {}) },
            managedBots: Array.isArray(saved.managedBots) ? saved.managedBots : [],
            users: Array.isArray(saved.users) ? saved.users : [],
        };
    } catch (error) {
        console.warn('[Admin config] Could not load persistent config:', error.message);
        return structuredClone(defaultPublicConfig);
    }
};

const publicConfig = loadPublicConfig();

const savePublicConfig = () => {
    try {
        const targetPath = ensureConfigPath();
        if (!targetPath) throw new Error('No writable config path is available.');
        const tempPath = targetPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(publicConfig, null, 2), 'utf8');
        fs.renameSync(tempPath, targetPath);
        return true;
    } catch (error) {
        console.error('[Admin config] Could not save persistent config:', error);
        return false;
    }
};

const signAdminSession = () => {
    const payload = 'admin.' + String(Date.now() + 8 * 60 * 60 * 1000);
    const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
    return payload + '.' + signature;
};

const hasAdminSession = req => {
    if (!ADMIN_SESSION_SECRET) return false;
    const header = String(req.headers.cookie || '');
    const token = header.split(';').map(item => item.trim()).find(item => item.startsWith(ADMIN_COOKIE + '='))?.slice(ADMIN_COOKIE.length + 1);
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'admin') return false;
    const expires = Number(parts[1]);
    if (!Number.isFinite(expires) || expires < Date.now()) return false;
    const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(parts[0] + '.' + parts[1]).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected)); } catch { return false; }
};

const adminLogin = async (req, res) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
        return send(res, 503, JSON.stringify({ authenticated: false, error_description: 'Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Render.' }));
    }
    try {
        const body = JSON.parse(await readBody(req) || '{}');
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return send(res, 401, JSON.stringify({ authenticated: false, error_description: 'Incorrect admin email or password.' }));
        }
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Set-Cookie': ADMIN_COOKIE + '=' + signAdminSession() + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800',
        });
        return res.end(JSON.stringify({ authenticated: true }));
    } catch (error) {
        return send(res, 400, JSON.stringify({ authenticated: false, error_description: error.message }));
    }
};

const adminLogout = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': ADMIN_COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    });
    res.end(JSON.stringify({ authenticated: false }));
};

const adminConfig = (req, res) => {
    if (!hasAdminSession(req)) return send(res, 401, JSON.stringify({ error: 'admin_required' }));
    return send(res, 200, JSON.stringify(publicConfig));
};

const saveAdminConfig = async (req, res) => {
    if (!hasAdminSession(req)) return send(res, 401, JSON.stringify({ error: 'admin_required' }));
    try {
        const body = JSON.parse(await readBody(req) || '{}');
        const appearance = body.appearance || {};
        publicConfig.clientId = String(body.clientId || '').trim();
        if (Array.isArray(body.managedBots)) {
            publicConfig.managedBots = body.managedBots
                .filter(bot => bot && typeof bot === 'object' && typeof bot.id === 'string' && typeof bot.name === 'string' && typeof bot.file === 'string' && typeof bot.xmlBase64 === 'string')
                .slice(0, 50)
                .map(bot => ({
                    id: String(bot.id).slice(0, 120),
                    name: String(bot.name).slice(0, 120),
                    description: String(bot.description || '').slice(0, 300),
                    emoji: String(bot.emoji || '🤖').slice(0, 12),
                    file: String(bot.file).slice(0, 180),
                    accent: String(bot.accent || '').slice(0, 20),
                    surface: String(bot.surface || '').slice(0, 20),
                    text: String(bot.text || '').slice(0, 20),
                    published: bot.published !== false,
                    comingSoon: bot.comingSoon === true,
                    xmlBase64: String(bot.xmlBase64),
                    splash: bot.splash !== false,
                    splashColor: String(bot.splashColor || bot.accent || '#2563eb').slice(0, 20),
                    splashText: String(bot.splashText || '').slice(0, 80),
                    updatedAt: Number(bot.updatedAt || Date.now()),
                }));
        }
        if (Array.isArray(body.users)) {
            publicConfig.users = body.users.filter(user => user && typeof user === 'object' && typeof user.id === 'string').slice(0, 1000).map(user => ({ id: String(user.id).slice(0, 160), loginid: String(user.loginid || '').slice(0, 80), accountType: user.accountType === 'DEMO' ? 'DEMO' : 'REAL', displayMode: ['REAL','DEMO','AUTO'].includes(String(user.displayMode || '').toUpperCase()) ? String(user.displayMode).toUpperCase() : 'AUTO', lastSeen: Number(user.lastSeen || Date.now()) }));
        }
        if (body.websiteDisplayLoginIds && typeof body.websiteDisplayLoginIds === 'object') {
            const real = String(body.websiteDisplayLoginIds.real || '').trim().slice(0, 80);
            const demo = String(body.websiteDisplayLoginIds.demo || '').trim().slice(0, 80);
            if (real) publicConfig.websiteDisplayLoginIds.real = real;
            if (demo) publicConfig.websiteDisplayLoginIds.demo = demo;
        }
        if (body.websiteDisplayBalances && typeof body.websiteDisplayBalances === 'object') {
            const real = Number(body.websiteDisplayBalances.real);
            const demo = Number(body.websiteDisplayBalances.demo);
            if (Number.isFinite(real) && real >= 0) publicConfig.websiteDisplayBalances.real = Math.min(real, 1000000000);
            if (Number.isFinite(demo) && demo >= 0) publicConfig.websiteDisplayBalances.demo = Math.min(demo, 1000000000);
        }
        if (body.environmentMapping && typeof body.environmentMapping === 'object') {
            const realLabel = String(body.environmentMapping.realLabel || '').trim().toUpperCase();
            const demoLabel = String(body.environmentMapping.demoLabel || '').trim().toUpperCase();
            if (['REAL', 'DEMO'].includes(realLabel)) publicConfig.environmentMapping.realLabel = realLabel;
            if (['REAL', 'DEMO'].includes(demoLabel)) publicConfig.environmentMapping.demoLabel = demoLabel;
        }
        for (const key of ['siteName', 'primary', 'secondary', 'navBackground', 'navText', 'headerBackground', 'cardBackground']) {
            if (typeof appearance[key] === 'string' && appearance[key].trim()) {
                publicConfig.appearance[key] = appearance[key].trim();
            }
        }
        const persisted = savePublicConfig();
        return send(res, persisted ? 200 : 507, JSON.stringify({
            saved: persisted,
            error_description: persisted ? undefined : 'No writable config path is available on the Render service.',
            warning: persisted && !ADMIN_CONFIG_IS_PERSISTENT ? 'Saved on the current Render instance. Mount a persistent disk at /data or set SHARP_ADMIN_CONFIG_PATH to a persistent writable path to keep this setting after redeploys.' : undefined,
            ...publicConfig,
        }));
    } catch (error) {
        return send(res, 400, JSON.stringify({ saved: false, error_description: error.message }));
    }
};

const publicConfigEndpoint = (req, res) => {
    const userId = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('sharp_user_id='))?.slice('sharp_user_id='.length) || '';
    const user = publicConfig.users.find(item => item.id === userId);
    const environmentMapping = { ...publicConfig.environmentMapping };
    const websiteDisplayLoginIds = { ...publicConfig.websiteDisplayLoginIds };
    if (user?.displayMode === 'REAL') { environmentMapping.realLabel = 'REAL'; environmentMapping.demoLabel = 'REAL'; }
    if (user?.displayMode === 'DEMO') { environmentMapping.realLabel = 'DEMO'; environmentMapping.demoLabel = 'DEMO'; }
    const safe = { ...publicConfig, users: undefined, environmentMapping, websiteDisplayLoginIds }; delete safe.users; return send(res, 200, JSON.stringify(safe));
};

const registerSharpUser = async (req, res) => {
    try {
        const body = JSON.parse(await readBody(req) || '{}');
        const loginid = String(body.loginid || '').trim().slice(0, 80);
        if (!loginid) return send(res, 400, JSON.stringify({ registered: false, error_description: 'Deriv login ID is required.' }));
        const id = crypto.createHash('sha256').update(loginid).digest('hex').slice(0, 32);
        const accountType = String(body.accountType || '').toUpperCase() === 'DEMO' ? 'DEMO' : 'REAL';
        const existing = publicConfig.users.find(item => item.id === id);
        const user = existing || { id, loginid, accountType, displayMode: 'AUTO', lastSeen: Date.now() };
        user.loginid = loginid; user.accountType = accountType; user.lastSeen = Date.now();
        if (!existing) publicConfig.users.push(user);
        savePublicConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': `sharp_user_id=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` });
        return res.end(JSON.stringify({ registered: true, user: { id, loginid, accountType, displayMode: user.displayMode } }));
    } catch (error) { return send(res, 400, JSON.stringify({ registered: false, error_description: error.message })); }
};

const adminUsers = (req, res) => { if (!hasAdminSession(req)) return send(res, 401, JSON.stringify({ error: 'admin_required' })); return send(res, 200, JSON.stringify({ users: publicConfig.users })); };
const saveAdminUsers = async (req, res) => {
    if (!hasAdminSession(req)) return send(res, 401, JSON.stringify({ error: 'admin_required' }));
    try {
        const body = JSON.parse(await readBody(req) || '{}');
        const id = String(body.id || '').trim(); const displayMode = String(body.displayMode || 'AUTO').toUpperCase();
        if (!id || !['AUTO','REAL','DEMO'].includes(displayMode)) return send(res, 400, JSON.stringify({ error: 'invalid_user_setting' }));
        const user = publicConfig.users.find(item => item.id === id); if (!user) return send(res, 404, JSON.stringify({ error: 'user_not_found' }));
        user.displayMode = displayMode; user.lastSeen = Date.now(); const persisted = savePublicConfig();
        return send(res, persisted ? 200 : 507, JSON.stringify({ saved: persisted, user }));
    } catch (error) { return send(res, 400, JSON.stringify({ saved: false, error_description: error.message })); }
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

        // Never return index.html for missing JS/CSS/image/font assets.
        // Returning HTML with HTTP 200 makes the browser fail to start the bundle.
        const ext = path.extname(String(pathname).split('?')[0]).toLowerCase();
        if (ext && ext !== '.html') {
            return send(res, 404, JSON.stringify({ error: 'asset_not_found', path: pathname }));
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
            res.end(indexData);
        });
    });
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/api/admin/login') return adminLogin(req, res);
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') return adminLogout(req, res);
    if (req.method === 'GET' && url.pathname === '/api/admin/session') return send(res, 200, JSON.stringify({ authenticated: hasAdminSession(req), configured: Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_SESSION_SECRET) }));
    if (req.method === 'GET' && url.pathname === '/api/admin/config') return adminConfig(req, res);
    if (req.method === 'GET' && url.pathname === '/api/admin/users') return adminUsers(req, res);
    if (req.method === 'POST' && url.pathname === '/api/admin/users') return saveAdminUsers(req, res);
    if (req.method === 'POST' && url.pathname === '/api/admin/config') return saveAdminConfig(req, res);
    if (req.method === 'GET' && url.pathname === '/api/public-config') return publicConfigEndpoint(req, res);
    if (req.method === 'POST' && url.pathname === '/api/sharp/user') return registerSharpUser(req, res);

    if (req.method === 'POST' && url.pathname === '/api/auth/login') return appLogin(req, res);
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') return appLogout(req, res);
    if (req.method === 'GET' && url.pathname === '/api/auth/session') {
        return send(res, 200, JSON.stringify({
            authenticated: hasAppSession(req),
            configured: Boolean(APP_LOGIN_EMAIL && APP_LOGIN_PASSWORD && APP_SESSION_SECRET),
        }));
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

    // Always serve the SPA entry for the private admin route, including /admin/.
    // This prevents a static-server 404 when the browser opens the route directly.
    if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/admin' || url.pathname === '/admin/')) {
        return serveFile(res, '/admin');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    }

    return serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log(`SHARP production server listening on ${HOST}:${PORT}`);
});
