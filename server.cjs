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

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    }

    return serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log(`SHARP production server listening on ${HOST}:${PORT}`);
});
