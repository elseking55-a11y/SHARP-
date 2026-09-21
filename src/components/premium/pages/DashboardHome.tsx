import { useEffect, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { useApiBase } from '@/hooks/useApiBase';
import type { PremiumSection } from '../types';

type FreeBotPreview = { id?: string; name?: string; title?: string; file: string; description?: string; emoji?: string };

const shortcuts: { icon: string; label: string; section: PremiumSection }[] = [
    { icon: '⚙️', label: 'Bot Builder', section: 'bot_builder' },
    { icon: '🤖', label: 'Free Bots', section: 'free_bots' },
    { icon: '⚡', label: 'Auto Trades', section: 'auto_trader' },
    { icon: '✋', label: 'Manual', section: 'manual_trading' },
    { icon: '⇄', label: 'Copy Trading', section: 'copy_trading' },
    { icon: '▥', label: 'Analysis', section: 'analysis_tools' },
    { icon: '▦', label: 'Bulk Trader', section: 'bulk_trader' },
    { icon: '▤', label: 'Charts', section: 'charts' },
];

const markets = [
    { symbol: '1HZ100V', name: 'Volatility 100', accent: 'green' },
    { symbol: '1HZ50V', name: 'Volatility 50', accent: 'blue' },
    { symbol: '1HZ10V', name: 'Volatility 10', accent: 'purple' },
    { symbol: 'R_100', name: 'Volatility 100', accent: 'orange' },
];

const DashboardHome = ({ openBotBuilder, openSection }: { openBotBuilder: () => void; openSection?: (section: PremiumSection) => void }) => {
    const { authData } = useApiBase();
    const store = useStore();
    const [freeBots, setFreeBots] = useState<FreeBotPreview[]>([]);
    const [marketQuotes, setMarketQuotes] = useState<Record<string, string>>({});

    useEffect(() => {
        let alive = true;
        fetch('/free-bots/bots.json', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : Promise.reject(new Error('free bots unavailable')))
            .then(payload => {
                const items = Array.isArray(payload) ? payload : Array.isArray(payload?.bots) ? payload.bots : [];
                if (alive) setFreeBots(items.filter((item: any) => item?.file).slice(0, 4));
            })
            .catch(() => alive && setFreeBots([]));
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
        const onMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data?.tick?.symbol && data?.tick?.quote !== undefined) {
                    setMarketQuotes(previous => ({ ...previous, [data.tick.symbol]: Number(data.tick.quote).toFixed(data.tick.pip_size ?? 2) }));
                }
                if (data?.active_symbols) {
                    const symbols = data.active_symbols.filter((item: any) => markets.some(m => m.symbol === (item.underlying_symbol || item.symbol)));
                    symbols.forEach((item: any) => {
                        const symbol = item.underlying_symbol || item.symbol;
                        if (symbol) ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                    });
                }
            } catch { /* public ticker is visual only */ }
        };
        ws.addEventListener('message', onMessage);
        ws.addEventListener('open', () => ws.send(JSON.stringify({ active_symbols: 'brief' })));
        return () => ws.close();
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

    const balance = Number(authData?.balance || 0);
    const currency = authData?.currency || 'USD';

    return (
        <div className='prodb-dashboard-page'>
            <section className='prodb-dashboard-hero'>
                <div>
                    <span className='prodb-dashboard-kicker'>ELISY254 SHARP</span>
                    <h1>Your trading workspace</h1>
                    <p>Markets, bots and trading tools — organised in one clean workspace.</p>
                    <div className='prodb-dashboard-hero-actions'>
                        <button type='button' onClick={() => launch('bot_builder')}>⚙️ Open Bot Builder</button>
                        <button type='button' className='secondary' onClick={() => launch('free_bots')}>🤖 Free Bots</button>
                    </div>
                </div>
                <div className='prodb-dashboard-balance'>
                    <span>AVAILABLE BALANCE</span>
                    <strong>{balance.toFixed(2)} {currency}</strong>
                    <small>{authData?.loginid || 'Deriv account connected'}</small>
                </div>
            </section>

            <section className='prodb-dashboard-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>LIVE MARKET WATCH</span><h2>Markets</h2></div>
                    <span className='live-dot'>● LIVE</span>
                </div>
                <div className='prodb-market-grid'>
                    {markets.map((market, index) => (
                        <div className={\`prodb-market-card prodb-market-card--\${market.accent}\`} key={market.symbol}>
                            <div><span>{index + 1}</span><small>{market.name}</small></div>
                            <strong>{marketQuotes[market.symbol] || '—'}</strong>
                            <em>{market.symbol}</em>
                        </div>
                    ))}
                </div>
            </section>

            <section className='prodb-dashboard-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>TOOLS</span><h2>Quick access</h2></div>
                    <span className='block-hint'>Swipe to explore</span>
                </div>
                <div className='prodb-dashboard-tools'>
                    {shortcuts.map(item => (
                        <button key={item.label} type='button' onClick={() => launch(item.section)}>
                            <span>{item.icon}</span>
                            <strong>{item.label}</strong>
                        </button>
                    ))}
                </div>
            </section>

            <section className='prodb-dashboard-block prodb-freebots-block'>
                <div className='prodb-dashboard-block-head'>
                    <div><span>READY TO LOAD</span><h2>Free Bots</h2></div>
                    <button className='text-button' type='button' onClick={() => launch('free_bots')}>View all →</button>
                </div>
                <div className='prodb-freebot-grid'>
                    {freeBots.length ? freeBots.map((bot, index) => (
                        <button className='prodb-freebot-card' type='button' key={bot.id || bot.file} onClick={() => launch('free_bots')}>
                            <span className={\`bot-card-icon bot-card-icon--\${index % 4}\`}>{bot.emoji || '🤖'}</span>
                            <span><small>FREE BOT</small><strong>{bot.name || bot.title || bot.file.replace(/\.xml$/i, '')}</strong><em>{bot.description || 'Ready to load into Bot Builder.'}</em></span>
                            <b>OPEN</b>
                        </button>
                    )) : (
                        <button className='prodb-freebot-card' type='button' onClick={() => launch('free_bots')}>
                            <span className='bot-card-icon'>🤖</span>
                            <span><small>FREE BOTS</small><strong>Open Free Bots Library</strong><em>Add your XML bots to /public/free-bots/</em></span>
                            <b>OPEN</b>
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default DashboardHome;
