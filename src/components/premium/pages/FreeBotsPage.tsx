import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getCurrentSiteConfig } from '@/config/site-registry';
import { load, save_types } from '@/external/bot-skeleton';
import { ungzip } from 'pako';
import { getTemplateDomain } from '../domain-brand';
import { DownloadIcon } from '../icons';
import { SHARP_OFFLINE_MODE } from '@/config/runtime-mode';
import { decodeManagedBotXml, readManagedBots } from '@/utils/managed-bot-library';

type DomainBot = {
    id?: string;
    name?: string;
    title?: string;
    file: string;
    asset?: string;
    encoding?: 'gzip-base64';
    description?: string;
    emoji?: string;
    is_premium?: boolean;
    priority?: number;
    guide?: string;
    badge?: string;
    category?: string;
    accent?: string;
    imageUrl?: string;
    imageBase64?: string;
    videoUrl?: string;
    xmlBase64?: string;

    surface?: string;
    text?: string;
};

const SHARED_BOT_LIBRARY = {
    title: 'Free Bots',
    manifest_url: '/free-bots/bots.json',
    base_url: '/free-bots',
};

const GITHUB_RAW_BOT_LIBRARY = 'https://raw.githubusercontent.com/DukeNyamasege/nnn/main/public/free-bots';

const waitForWorkspace = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace) return workspace;
        await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    throw new Error('Bot Builder workspace is not ready. Open Bot Builder and try again.');
};

const joinUrl = (base: string, file: string) =>
    `${base.replace(/\/$/, '')}/${file.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;

const githubRawUrlForLocalPath = (url: string): string => {
    if (url === '/free-bots') return GITHUB_RAW_BOT_LIBRARY;
    if (!url.startsWith('/free-bots/')) return '';
    return joinUrl(GITHUB_RAW_BOT_LIBRARY, url.slice('/free-bots/'.length));
};

const fetchTextWithFallback = async (urls: string[], label: string): Promise<string> => {
    let lastError = '';

    for (const url of Array.from(new Set(urls.filter(Boolean)))) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) return response.text();
            lastError = `HTTP ${response.status}`;
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    throw new Error(`${label} could not be loaded${lastError ? ` (${lastError})` : ''}.`);
};

const decodeGzipBase64 = (encoded: string): string => {
    const binary = window.atob(encoded.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return ungzip(bytes, { to: 'string' });
};

const FreeBotsPage = ({ openBotBuilder }: { openBotBuilder?: () => void }) => {
    const site = getCurrentSiteConfig();
    const domain = getTemplateDomain();
    const configuredLibrary = site.bot_library;
    const domainManifestUrl = `/free-bots/domains/${encodeURIComponent(site.id)}.json`;
    const configuredManifestUrl = configuredLibrary?.manifest_url;
    const usesManagedDomainManifest = !configuredManifestUrl || configuredManifestUrl === SHARED_BOT_LIBRARY.manifest_url;
    const manifestUrl = usesManagedDomainManifest ? domainManifestUrl : configuredManifestUrl;
    const baseUrl =
        configuredLibrary?.base_url ||
        (configuredManifestUrl && !usesManagedDomainManifest
            ? configuredManifestUrl.replace(/\/[^/]*$/, '')
            : SHARED_BOT_LIBRARY.base_url);
    const manifestFallbacks = [manifestUrl, githubRawUrlForLocalPath(manifestUrl)];

    if (usesManagedDomainManifest) {
        manifestFallbacks.push(
            SHARED_BOT_LIBRARY.manifest_url,
            githubRawUrlForLocalPath(SHARED_BOT_LIBRARY.manifest_url)
        );
    }

    const [bots, setBots] = useState<DomainBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyFile, setBusyFile] = useState('');
    const [error, setError] = useState('');
    const [riskBot, setRiskBot] = useState<DomainBot | null>(null);

    useEffect(() => {
        let alive = true;
        const loadManifest = async () => {
            setLoading(true);
            setError('');
            try {
                const localBots = readManagedBots();
                if (SHARP_OFFLINE_MODE) {
                    if (alive) {
                        setBots(localBots.map(bot => ({ ...bot })));
                        setError('');
                    }
                    return;
                }
                const manifestPayload = await fetchTextWithFallback(manifestFallbacks, 'Bot manifest');
                const manifest = JSON.parse(manifestPayload);
                const items = Array.isArray(manifest) ? manifest : Array.isArray(manifest?.bots) ? manifest.bots : [];
                const clean = items
                    .filter((item: any) => item && typeof item.file === 'string')
                    .map((item: any) => ({ ...item, priority: Number(item.priority ?? 999) }))
                    .sort((a: DomainBot, b: DomainBot) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
                const localBots = readManagedBots().filter(bot => bot.published !== false).map(bot => ({ ...bot }));
                if (alive) setBots([...localBots, ...clean.filter((item: DomainBot) => !localBots.some(local => local.id === item.id))]);
            } catch (err) {
                const localBots = readManagedBots().filter(bot => bot.published !== false).map(bot => ({ ...bot }));
                if (alive) {
                    setBots(localBots);
                    if (!localBots.length) setError(err instanceof Error ? err.message : String(err));
                }
            } finally {
                if (alive) setLoading(false);
            }
        };
        void loadManifest();
        const refresh = () => setBots(readManagedBots().map(bot => ({ ...bot })));
        window.addEventListener('sharp-managed-bots-updated', refresh);
        return () => {
            alive = false;
            window.removeEventListener('sharp-managed-bots-updated', refresh);
        };
    }, [manifestUrl]);

    const loadBot = async (bot: DomainBot) => {
        if (!openBotBuilder || !baseUrl) return;
        setBusyFile(bot.file);
        setError('');
        try {
            const xml = bot.xmlBase64
                ? decodeManagedBotXml(bot.xmlBase64)
                : (() => {
                    const assetFile = bot.asset || bot.file;
                    const localAssetUrl = joinUrl(baseUrl, assetFile);
                    const rawAssetBase = githubRawUrlForLocalPath(baseUrl);
                    return fetchTextWithFallback(
                        [localAssetUrl, rawAssetBase ? joinUrl(rawAssetBase, assetFile) : ''],
                        bot.name || bot.file
                    );
                })();
            const resolvedXml = typeof xml === 'string' ? xml : await xml;
            const decodedXml = bot.encoding === 'gzip-base64' ? decodeGzipBase64(resolvedXml) : resolvedXml;
            if (!/<xml[\s>]/i.test(decodedXml) && !/<block[\s>]/i.test(decodedXml)) {
                throw new Error(`${bot.file} is not a Blockly XML bot.`);
            }

            openBotBuilder();
            const workspace = await waitForWorkspace();
            await load({
                block_string: decodedXml,
                file_name: bot.file,
                workspace,
                from: save_types.LOCAL,
                drop_event: {},
                strategy_id: null,
                showIncompatibleStrategyDialog: false,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyFile('');
            setRiskBot(null);
        }
    };

    const confirmRisk = () => {
        if (!riskBot) return;
        void loadBot(riskBot);
    };

    return (
        <div className='prodb-free-bots prodb-free-bots--app'>
            <header className='prodb-free-bots__header'>
                <div>
                    <span>ELISY254 SHARP</span>
                    <h1>Free Bots</h1>
                    <p>Ready-made Blockly bots. Upload an XML bot to the library and it will appear here automatically.</p>
                </div>
                <div className='prodb-free-bots__count'><strong>{bots.length}</strong><small>AVAILABLE</small></div>
            </header>

            <div className='prodb-risk-banner'>
                <div className='prodb-risk-banner__icon'>⚠️</div>
                <div>
                    <strong>Risk disclaimer</strong>
                    <span>Automated trading can open trades without manual intervention. Test a strategy on a demo account first and only trade funds you can afford to lose.</span>
                </div>
                <button type='button' onClick={() => setRiskBot(bots[0] || null)} disabled={!bots.length}>Read before run</button>
            </div>

            {loading && <div className='prodb-live-empty'>Loading bots…</div>}
            {error && <div className='prodb-live-error'>{error}</div>}

            {!loading && !error && bots.length === 0 && (
                <section className='prodb-free-bots-empty'>
                    <div className='prodb-free-bots-empty__icon'>🤖</div>
                    <span>BOT LIBRARY</span>
                    <h2>No bots uploaded yet</h2>
                    <p>Add your XML bots inside <code>public/free-bots/</code> and list them in <code>public/free-bots/bots.json</code>. They will appear here after the next deploy.</p>
                </section>
            )}

            {!loading && !error && bots.length > 0 && (
                <div className='prodb-bot-grid prodb-bot-grid--imported prodb-bot-grid--app'>
                    {bots.map((bot, index) => {
                        const name = bot.name || bot.title || bot.file.replace(/\.xml$/i, '');
                        const tag = bot.badge || (bot.is_premium ? 'PREMIUM' : 'SPECIAL BOT');
                        return (
                            <article className={`prodb-bot-card prodb-bot-card--imported prodb-bot-card--app prodb-bot-card--tone-${index % 6}`} key={bot.id || bot.file} style={{ '--bot-accent': bot.accent || '', '--bot-surface': bot.surface || '', '--bot-text': bot.text || '' } as CSSProperties}>
                                <div className='prodb-bot-card__top'>
                                    <button type='button' aria-label={`Favorite ${name}`}>☆</button>
                                    <span>{tag}</span>
                                </div>
                                <div className='prodb-bot-card__badge'>
                                    {bot.imageBase64 || bot.imageUrl ? <img src={bot.imageBase64 || bot.imageUrl} alt='' /> : (bot.emoji || '🤖')}
                                </div>
                                <small>{domain}</small>
                                <h2>{name}</h2>
                                <p>{bot.description || 'Ready to load into the existing Bot Builder workspace.'}</p>
                                <div className='prodb-bot-card__actions'>
                                    {bot.guide && baseUrl && (
                                        <a className='prodb-source-guide' href={joinUrl(baseUrl, bot.guide)} target='_blank' rel='noreferrer'>GUIDE</a>
                                    )}
                                    <button className='prodb-load-bot' disabled={Boolean(busyFile)} onClick={() => setRiskBot(bot)}>
                                        {busyFile === bot.file ? 'LOADING…' : 'LOAD BOT'} <DownloadIcon />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {riskBot && (
                <div className='prodb-risk-modal' role='dialog' aria-modal='true' aria-labelledby='prodb-risk-title'>
                    <button className='prodb-risk-modal__backdrop' type='button' aria-label='Close risk disclaimer' onClick={() => setRiskBot(null)} />
                    <section className='prodb-risk-modal__card'>
                        <button className='prodb-risk-modal__close' type='button' aria-label='Close' onClick={() => setRiskBot(null)}>×</button>
                        <div className='prodb-risk-modal__icon'>⚠️</div>
                        <span>BEFORE RUNNING A BOT</span>
                        <h2 id='prodb-risk-title'>Risk Disclaimer</h2>
                        <p>Trading can result in the loss of your invested funds. Automated execution can open and close trades without manual intervention, and market conditions can change quickly.</p>
                        <p>Review the bot strategy, test it on a demo account first, and monitor it while running.</p>
                        <div className='prodb-risk-modal__bot'>
                            <span>{riskBot.emoji || '🤖'}</span>
                            <div><strong>{riskBot.name || riskBot.title || riskBot.file}</strong><small>{riskBot.file}</small></div>
                        </div>
                        <button className='prodb-risk-modal__confirm' type='button' onClick={confirmRisk} disabled={Boolean(busyFile)}>
                            I UNDERSTAND — LOAD BOT
                        </button>
                        <button className='prodb-risk-modal__cancel' type='button' onClick={() => setRiskBot(null)}>Cancel</button>
                    </section>
                </div>
            )}
        </div>
    );
};

export default FreeBotsPage;
