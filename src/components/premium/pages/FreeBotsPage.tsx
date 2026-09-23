import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { DownloadIcon } from '../icons';
import { decodeManagedBotXml, readManagedBots, type ManagedBot } from '@/utils/managed-bot-library';

type DomainBot = ManagedBot;

const FreeBotsPage = ({ openBotBuilder }: { openBotBuilder?: () => void }) => {
    const [bots, setBots] = useState<DomainBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyFile, setBusyFile] = useState('');
    const [error, setError] = useState('');

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
            const decodedXml = bot.xmlBase64
                ? decodeManagedBotXml(bot.xmlBase64)
                : bot.xmlUrl
                  ? await fetch(bot.xmlUrl).then(response => {
                        if (!response.ok) throw new Error('Unable to load this free bot.');
                        return response.text();
                    })
                  : '';

            if (!/<xml[\s>]/i.test(decodedXml) && !/<block[\s>]/i.test(decodedXml)) {
                throw new Error('This uploaded file is not valid Blockly XML.');
            }

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
        }
    };

    return (
        <div className='prodb-free-bots prodb-free-bots--app'>
            {loading && <div className='prodb-live-empty'>Checking uploaded bots…</div>}
            {error && <div className='prodb-live-error'>{error}</div>}

            {!loading && bots.length > 0 && (
                <div className='prodb-bot-grid prodb-bot-grid--imported prodb-bot-grid--app'>
                    {bots.map((bot, index) => {
                        const name = bot.name || bot.file.replace(/\.xml$/i, '');
                        return (
                            <article
                                className={`prodb-bot-card prodb-bot-card--imported prodb-bot-card--app prodb-bot-card--tone-${index % 6}`}
                                key={bot.id}
                                style={
                                    {
                                        '--bot-accent': bot.accent || '',
                                        '--bot-surface': bot.surface || '',
                                        '--bot-text': bot.text || '',
                                    } as CSSProperties
                                }
                            >
                                {bot.splash !== false && <div style={{ minHeight: 76, borderRadius: 14, display: 'grid', placeItems: 'center', marginBottom: 10, background: `linear-gradient(135deg, ${bot.splashColor || bot.accent || '#2563eb'}, ${bot.surface || '#071521'})`, color: bot.text || '#fff', fontWeight: 900, letterSpacing: 1.2, boxShadow: `0 12px 28px ${bot.splashColor || bot.accent || '#2563eb'}55` }}>{bot.splashText || 'SHARP MIND'}</div>}
                                <div className='prodb-bot-card__badge'>
                                    {bot.imageBase64 || bot.imageUrl ? <img src={bot.imageBase64 || bot.imageUrl} alt='' /> : (bot.emoji || '🤖')}
                                </div>
                                <h2>{name}</h2>
                                {bot.description && <p style={{ color: bot.text || '#fff', opacity: .72, margin: '4px 0 10px' }}>{bot.description}</p>}
                                <div className='prodb-bot-card__actions'>
                                    <button
                                        className='prodb-load-bot'
                                        disabled={Boolean(busyFile)}
                                        onClick={() => void loadBot(bot)}
                                        type='button'
                                    >
                                        {busyFile === bot.file ? 'LOADING…' : 'LOAD'}
                                        <DownloadIcon />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FreeBotsPage;
