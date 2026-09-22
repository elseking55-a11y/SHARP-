import { useEffect, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { getSavedWorkspaces, timeSince } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { readManagedBots, type ManagedBot } from '@/utils/managed-bot-library';
import type { PremiumSection } from '../types';

type SavedBot = { id: string; name?: string; timestamp?: number; save_type?: string };
const shortcuts: { icon: string; label: string; section: PremiumSection; tone: string }[] = [
    { icon: '＋', label: 'Bot Builder', section: 'bot_builder', tone: 'blue' }, { icon: '🤖', label: 'Free Bots', section: 'free_bots', tone: 'purple' },
    { icon: '⚡', label: 'Auto Trades', section: 'auto_trader', tone: 'green' }, { icon: '✋', label: 'Manual Trading', section: 'manual_trading', tone: 'orange' },
    { icon: '⇄', label: 'Copy Trading', section: 'copy_trading', tone: 'gold' }, { icon: '▥', label: 'Analysis Tool', section: 'analysis_tools', tone: 'cyan' },
    { icon: '▦', label: 'Bulk Trader', section: 'bulk_trader', tone: 'violet' }, { icon: '▤', label: 'Charts', section: 'charts', tone: 'slate' },
];

const DashboardHome = ({ openBotBuilder, openSection }: { openBotBuilder: () => void; openSection?: (section: PremiumSection) => void }) => {
    const store = useStore();
    const [freeBots, setFreeBots] = useState<ManagedBot[]>([]);
    const [savedBots, setSavedBots] = useState<SavedBot[]>([]);
    useEffect(() => {
        let alive = true;
        const refresh = () => alive && setFreeBots(readManagedBots().filter(bot => bot.published !== false && !bot.comingSoon));
        refresh();
        window.addEventListener('sharp-managed-bots-updated', refresh);
        void getSavedWorkspaces().then((items: any[]) => alive && setSavedBots((items || []).slice(0, 6).map(item => ({ id: String(item.id), name: item.name || 'Untitled Bot', timestamp: Number(item.timestamp || Date.now()), save_type: item.save_type })))).catch(() => alive && setSavedBots([]));
        return () => { alive = false; window.removeEventListener('sharp-managed-bots-updated', refresh); };
    }, []);
    const launch = (section: PremiumSection) => {
        if (section === 'bot_builder') { store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER); store?.run_panel?.toggleDrawer(true); openBotBuilder(); return; }
        openSection?.(section);
    };
    const openSavedBot = async (bot: SavedBot) => { try { store?.load_modal?.setSelectedStrategyId(bot.id); await store?.load_modal?.loadFileFromRecent(); store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER); openBotBuilder(); } catch { openBotBuilder(); } };
    return <div className='prodb-dashboard-page'>
        <section className='prodb-dashboard-block prodb-dashboard-tools-block'><div className='prodb-dashboard-block-head'><div><span>SHORTCUTS</span><h2>Trading tools</h2></div><span className='block-hint'>Tap any tool</span></div><div className='prodb-dashboard-tools prodb-dashboard-tools--grid'>{shortcuts.map(item => <button key={item.label} className={`prodb-dashboard-tool-card prodb-dashboard-tool-card--${item.tone}`} type='button' onClick={() => launch(item.section)}><span>{item.icon}</span><strong>{item.label}</strong></button>)}</div></section>
        <section className='prodb-dashboard-block'><div className='prodb-dashboard-block-head'><div><span>YOUR WORKSPACE</span><h2>Imported bots</h2></div><button className='text-button' type='button' onClick={() => launch('bot_builder')}>Open Builder →</button></div><div className='prodb-imported-bots'>{savedBots.length ? savedBots.map((bot, index) => <article className={`prodb-imported-bot prodb-imported-bot--${index % 4}`} key={bot.id}><div className='prodb-imported-bot-icon'>XML</div><div className='prodb-imported-bot-info'><strong>{bot.name || 'Untitled Bot'}</strong><small>{bot.timestamp ? `saved · ${timeSince(bot.timestamp)}` : 'saved bot'}</small></div><button type='button' onClick={() => void openSavedBot(bot)}>OPEN</button></article>) : <div className='prodb-imported-empty'><span>XML</span><div><strong>—</strong></div><button type='button' onClick={() => launch('bot_builder')}>BUILD</button></div>}</div></section>
        <section className='prodb-dashboard-block prodb-freebots-block'><div className='prodb-dashboard-block-head'><div><span>READY TO LOAD</span><h2>Free Bots</h2></div><button className='text-button' type='button' onClick={() => launch('free_bots')}>View all →</button></div><div className='prodb-freebot-grid'>{freeBots.length ? freeBots.map((bot, index) => <button className={`prodb-freebot-card prodb-freebot-card--${index % 4}`} type='button' key={bot.id} onClick={() => launch('free_bots')}><span className='bot-card-icon'>{bot.emoji || '🤖'}</span><span><small>FREE BOT</small><strong>{bot.name}</strong><em>{bot.description || 'Uploaded bot ready for Bot Builder.'}</em></span><b>OPEN</b></button>) : <div className='prodb-freebot-card prodb-freebot-card--empty'><span className='bot-card-icon'>🤖</span><span><small>FREE BOTS</small><strong>No uploaded bots</strong><em>No bots are available yet</em></span><b>EMPTY</b></div>}</div></section>
    </div>;
};
export default DashboardHome;
