import { useEffect, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { getSavedWorkspaces, timeSince } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import type { PremiumSection } from '../types';
import { SHARP_OFFLINE_MODE } from '@/config/runtime-mode';

type FreeBotPreview = { id?: string; name?: string; title?: string; file: string; description?: string; emoji?: string };
type SavedBot = { id: string; name?: string; timestamp?: number; save_type?: string };

const shortcuts: { icon: string; label: string; section: PremiumSection; tone: string }[] = [
    { icon: '＋', label: 'Bot Builder', section: 'bot_builder', tone: 'blue' },
    { icon: '🤖', label: 'Free Bots', section: 'free_bots', tone: 'purple' },
    { icon: '⚡', label: 'Auto Trades', section: 'auto_trader', tone: 'green' },
    { icon: '✋', label: 'Manual Trading', section: 'manual_trading', tone: 'orange' },
    { icon: '⇄', label: 'Copy Trading', section: 'copy_trading', tone: 'gold' },
    { icon: '▥', label: 'Analysis Tool', section: 'analysis_tools', tone: 'cyan' },
    { icon: '▦', label: 'Bulk Trader', section: 'bulk_trader', tone: 'violet' },
    { icon: '▤', label: 'Charts', section: 'charts', tone: 'slate' },
    { icon: '🛡️', label: 'Admin Panel', section: 'admin', tone: 'red' },
];

const DashboardHome = ({ openBotBuilder, openSection }: { openBotBuilder: () => void; openSection?: (section: PremiumSection) => void }) => {
    const store = useStore();
    const [freeBots, setFreeBots] = useState<FreeBotPreview[]>([]);
    const [savedBots, setSavedBots] = useState<SavedBot[]>([]);

    useEffect(() => {
        let alive = true;
        fetch('/free-bots/bots.json', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : Promise.reject(new Error('free bots unavailable')))
            .then(payload => {
                const items = Array.isArray(payload) ? payload : Array.isArray(payload?.bots) ? payload.bots : [];
                if (alive) setFreeBots(items.filter((item: any) => item?.file).slice(0, 6));
            })
            .catch(() => alive && setFreeBots([]));

        void getSavedWorkspaces()
            .then((items: any[]) => alive && setSavedBots((items || []).slice(0, 6).map(item => ({
                id: String(item.id),
                name: item.name || 'Untitled Bot',
                timestamp: Number(item.timestamp || Date.now()),
                save_type: item.save_type,
            }))))
            .catch(() => alive && setSavedBots([]));

        return () => { alive = false; };
    }, []);

    const launch = (section: PremiumSection) => {
        if (section === 'bot_builder') {
            store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER);
            store?.run_panel?.toggleDrawer(true);
            openBotBuilder();
            return;
        }
        openSection?.(section);
    };

    const openSavedBot = async (bot: SavedBot) => {
        try {
            store?.load_modal?.setSelectedStrategyId(bot.id);
            await store?.load_modal?.loadFileFromRecent();
            store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER);
            openBotBuilder();
        } catch {
            openBotBuilder();
        }
    };

    const workspaceStatus = SHARP_OFFLINE_MODE ? 'Offline workspace' : 'Live Deriv connection';

    return (
        <div className='prodb-dashboard-page'>
            <section className='prodb-dashboard-hero'>
                <div className='prodb-dashboard-hero-copy'>
                    <span className='prodb-dashboard-kicker'>ELISY254 SHARP • TRADING WORKSPACE</span>
                    <h1>Everything you need, in one app.</h1>
                    <p>Build bots, open saved strategies and move directly into your trading tools.</p>
                    <div className='prodb-dashboard-hero-actions'>
                        <button type='button' onClick={() => launch('bot_builder')}>＋ Build Bot</button>
                        <button type='button' className='secondary' onClick={() => launch('free_bots')}>🤖 Free Bots</button>
                    </div>
                </div>
                <div className='prodb-dashboard-balance'>
                    <span>WORKSPACE STATUS</span>
                    <strong>{workspaceStatus}</strong>
                    <small>{SHARP_OFFLINE_MODE ? 'Live account connection is disabled' : 'Deriv account connected'}</small>
                </div>
            </section>

            <section className='prodb-dashboard-block prodb-dashboard-tools-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>SHORTCUTS</span><h2>Trading tools</h2></div>
                    <span className='block-hint'>Tap any tool</span>
                </div>
                <div className='prodb-dashboard-tools prodb-dashboard-tools--grid'>
                    {shortcuts.map(item => (
                        <button key={item.label} className={`prodb-dashboard-tool-card prodb-dashboard-tool-card--${item.tone}`} type='button' onClick={() => launch(item.section)}>
                            <span>{item.icon}</span>
                            <strong>{item.label}</strong>
                        </button>
                    ))}
                </div>
            </section>

            <section className='prodb-dashboard-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>YOUR WORKSPACE</span><h2>Imported bots</h2></div>
                    <button className='text-button' type='button' onClick={() => launch('bot_builder')}>Open Builder →</button>
                </div>
                <div className='prodb-imported-bots'>
                    {savedBots.length ? savedBots.map((bot, index) => (
                        <article className={`prodb-imported-bot prodb-imported-bot--${index % 4}`} key={bot.id}>
                            <div className='prodb-imported-bot-icon'>XML</div>
                            <div className='prodb-imported-bot-info'>
                                <strong>{bot.name || 'Untitled Bot'}</strong>
                                <small>{bot.timestamp ? `saved · ${timeSince(bot.timestamp)}` : 'saved bot'}</small>
                            </div>
                            <button type='button' onClick={() => void openSavedBot(bot)}>OPEN</button>
                        </article>
                    )) : (
                        <div className='prodb-imported-empty'>
                            <span>XML</span>
                            <div><strong>No imported bots yet</strong><small>Save or import a bot in Bot Builder and it will appear here.</small></div>
                            <button type='button' onClick={() => launch('bot_builder')}>BUILD</button>
                        </div>
                    )}
                </div>
            </section>

section>

            <section className='prodb-dashboard-block prodb-freebots-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>READY TO LOAD</span><h2>Free Bots</h2></div>
                    <button className='text-button' type='button' onClick={() => launch('free_bots')}>View all →</button>
                </div>
                <div className='prodb-freebot-grid'>
                    {freeBots.length ? freeBots.map((bot, index) => (
                        <button className={`prodb-freebot-card prodb-freebot-card--${index % 4}`} type='button' key={bot.id || bot.file} onClick={() => launch('free_bots')}>
                            <span className='bot-card-icon'>{bot.emoji || '🤖'}</span>
                            <span><small>FREE BOT</small><strong>{bot.name || bot.title || bot.file.replace(/\.xml$/i, '')}</strong><em>{bot.description || 'Ready to load into Bot Builder.'}</em></span>
                            <b>OPEN</b>
                        </button>
                    )) : (
                        <button className='prodb-freebot-card' type='button' onClick={() => launch('free_bots')}>
                            <span className='bot-card-icon'>🤖</span>
                            <span><small>FREE BOTS</small><strong>Open Free Bots Library</strong><em>Add your XML bots from Admin Panel.</em></span>
                            <b>OPEN</b>
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default DashboardHome;
