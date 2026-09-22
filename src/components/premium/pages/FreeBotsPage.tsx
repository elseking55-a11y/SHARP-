import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getTemplateDomain } from '../domain-brand';
import { DownloadIcon } from '../icons';
import { decodeManagedBotXml, readManagedBots, type ManagedBot } from '@/utils/managed-bot-library';

type DomainBot = ManagedBot;

const waitForWorkspace = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace) return workspace;
        await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    throw new Error('Bot Builder workspace is not ready. Open Bot Builder and try again.');
};

const FreeBotsPage = ({ openBotBuilder }: { openBotBuilder?: () => void }) => {
    const domain = getTemplateDomain();
    const [bots, setBots] = useState<DomainBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyFile, setBusyFile] = useState('');
    const [error, setError] = useState('');
    const [riskBot, setRiskBot] = useState<DomainBot | null>(null);

    const refresh = () => setBots(readManagedBots().filter(bot => bot.published !== false && !bot.comingSoon));

    useEffect(() => {
        refresh();
        setLoading(false);
        const handler = () => refresh();
        window.addEventListener('sharp-managed-bots-updated', handler);
        return () => window.removeEventListener('sharp-managed-bots-updated', handler);
    }, []);

    const loadBot = async (bot: DomainBot) => {
        if (!openBotBuilder) return;
        setBusyFile(bot.file);
        setError('');
        try {
            const decodedXml = decodeManagedBotXml(bot.xmlBase64);
            if (!/<xml[\\s>]/i.test(decodedXml) && !/<block[\\s>]/i.test(decodedXml)) {
                throw new Error('This uploaded file is not valid Blockly XML.');
            }
            // Store the selected XML before switching sections. The native
            // Deriv Bot Builder consumes this only after Blockly is ready.
            sessionStorage.setItem(
                'sharp_pending_free_bot_xml',
                JSON.stringify({ xml: decodedXml, fileName: bot.file, botId: bot.id, botName: bot.name })
            );
            sessionStorage.removeItem('sharp_loaded_free_bot');
            openBotBuilder();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyFile('');
            setRiskBot(null);
        }
    };

    return (
        <div className='prodb-free-bots prodb-free-bots--app'>
            <header className='prodb-free-bots__header'>
                <div><h1>Free Bots</h1><p>Select a published bot to open it directly inside Bot Builder. Edit the blocks there, then use Deriv's Run control.</p></div>
                <div className='prodb-free-bots__count'><strong>{bots.length}</strong><small>AVAILABLE</small></div>
            </header>

            {bots.length > 0 && <div className='prodb-risk-banner'>
                <div className='prodb-risk-banner__icon'>⚠️</div>
                <div><strong>Risk disclaimer</strong><span>Automated trading can open trades without manual intervention. Test a strategy on a demo account first and only trade funds you can afford to lose.</span></div>
            </div>}
            {loading && <div className='prodb-live-empty'>Checking uploaded bots…</div>}
            {error && <div className='prodb-live-error'>{error}</div>}

            {!loading && !bots.length && !error && <section className='prodb-free-bots-empty'>
                <div className='prodb-free-bots-empty__icon'>🤖</div>
                <h2>No free bots uploaded</h2>
                <p>Free Bots stays empty until you upload a Blockly XML bot in Admin Panel → Bot Management.</p>
            </section>}

            {!loading && bots.length > 0 && <div className='prodb-bot-grid prodb-bot-grid--imported prodb-bot-grid--app'>
                {bots.map((bot, index) => {
                    const name = bot.name || bot.file.replace(/\\.xml$/i, '');
                    return <article className={`prodb-bot-card prodb-bot-card--imported prodb-bot-card--app prodb-bot-card--tone-${index % 6}`} key={bot.id} style={{ '--bot-accent': bot.accent || '', '--bot-surface': bot.surface || '', '--bot-text': bot.text || '' } as CSSProperties}>
                        <div className='prodb-bot-card__top'><span>{bot.badge || 'FREE BOT'}</span></div>
                        <div className='prodb-bot-card__badge'>{bot.imageBase64 || bot.imageUrl ? <img src={bot.imageBase64 || bot.imageUrl} alt='' /> : (bot.emoji || '🤖')}</div>
                        <small>{domain}</small><h2>{name}</h2><p>{bot.description || 'Uploaded Blockly strategy ready for Bot Builder.'}</p>
                        <div className='prodb-bot-card__actions'><button className='prodb-load-bot' disabled={Boolean(busyFile)} onClick={() => setRiskBot(bot)}>{busyFile === bot.file ? 'LOADING…' : 'EDIT IN BOT BUILDER'} <DownloadIcon /></button></div>
                    </article>;
                })}
            </div>}

            {riskBot && <div className='prodb-risk-modal' role='dialog' aria-modal='true' aria-labelledby='prodb-risk-title'>
                <button className='prodb-risk-modal__backdrop' type='button' aria-label='Close risk disclaimer' onClick={() => setRiskBot(null)} />
                <section className='prodb-risk-modal__card'>
                    <button className='prodb-risk-modal__close' type='button' aria-label='Close' onClick={() => setRiskBot(null)}>×</button>
                    <div className='prodb-risk-modal__icon'>⚠️</div><span>BEFORE RUNNING A BOT</span><h2 id='prodb-risk-title'>Risk Disclaimer</h2>
                    <p>Trading can result in the loss of your invested funds. Automated execution can open and close trades without manual intervention.</p>
                    <div className='prodb-risk-modal__bot'><span>{riskBot.emoji || '🤖'}</span><div><strong>{riskBot.name}</strong><small>{riskBot.file}</small></div></div>
                    <button className='prodb-risk-modal__confirm' type='button' onClick={() => void loadBot(riskBot)} disabled={Boolean(busyFile)}>I UNDERSTAND — LOAD BOT</button>
                    <button className='prodb-risk-modal__cancel' type='button' onClick={() => setRiskBot(null)}>Cancel</button>
                </section>
            </div>}
        </div>
    );
};

export default FreeBotsPage;
