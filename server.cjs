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
        const site = sites.find(entry => entry.id === params.site_id) || (params.site_id === 'sharp-render' && process.env.DERIV_CLIENT_ID ? {
            id: 'sharp-render',
            client_id: String(process.env.DERIV_CLIENT_ID).trim(),
            redirect_uri: String(process.env.DERIV_REDIRECT_URI || 'https://sharp-mz3h.onrender.com/callback').trim(),
        } : null);

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
                'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
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

    if (req.method === 'POST' && url.pathname === '/api/oauth/token') {
        return exchangeToken(req, res);
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
