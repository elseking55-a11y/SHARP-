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
            <header className='prodb-free-bots__header'>
                <div>
                    <h1>Free Bots</h1>
                    <p>Select a published bot to open it directly inside Bot Builder. Edit the blocks there, then use Deriv's Run control.</p>
                </div>
            </header>

            {loading && <div className='prodb-live-empty'>Checking uploaded bots…</div>}
            {error && <div className='prodb-live-error'>{error}</div>}

            {!loading && !bots.length && !error && (
                <section className='prodb-free-bots-empty'>
                    <div className='prodb-free-bots-empty__icon'>🤖</div>
                    <h2>No free bots uploaded</h2>
                    <p>Free Bots stays empty until you upload a Blockly XML bot in Admin Panel → Bot Management.</p>
                </section>
            )}

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
                                <div className='prodb-bot-card__badge'>
                                    {bot.imageBase64 || bot.imageUrl ? (
                                        <img src={bot.imageBase64 || bot.imageUrl} alt='' />
                                    ) : (
                                        bot.emoji || '🤖'
                                    )}
                                </div>
                                <h2>{name}</h2>
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
