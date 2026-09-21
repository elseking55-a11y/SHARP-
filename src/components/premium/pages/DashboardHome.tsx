import { useEffect, useMemo, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { PremiumDerivApiService } from '@/services/premium-deriv-api.service';
import { useDevice } from '@deriv-com/ui';
import { getTemplateDomain } from '../domain-brand';
import type { PremiumSection } from '../types';

type LauncherItem = { icon: string; label: string; section?: PremiumSection; action?: 'local-file' };
type FreeBotPreview = { id?: string; name?: string; title?: string; file: string; description?: string; emoji?: string };

const launcherItems: LauncherItem[] = [
    { icon: '▰', label: 'My computer', action: 'local-file' },
    { icon: '⚙', label: 'Bot Builder', section: 'bot_builder' },
    { icon: '🤖', label: 'Free Bots', section: 'free_bots' },
    { icon: '⚡', label: 'Auto Trades', section: 'auto_trader' },
    { icon: '✋', label: 'Manual Trading', section: 'manual_trading' },
    { icon: '⇄', label: 'Copy Trading', section: 'copy_trading' },
    { icon: '▥', label: 'Analysis Tool', section: 'analysis_tools' },
    { icon: '▦', label: 'Bulk Trader', section: 'bulk_trader' },
];

const DashboardHome = ({ openBotBuilder, openSection }: { openBotBuilder: () => void; openSection?: (section: PremiumSection) => void }) => {
    const { authData } = useApiBase();
    const store = useStore();
    const { isDesktop } = useDevice();
    const domain = getTemplateDomain();
    const [marketCount, setMarketCount] = useState(0);
    const [openContracts, setOpenContracts] = useState(0);
    const [history, setHistory] = useState<any[]>([]);
    const [freeBots, setFreeBots] = useState<FreeBotPreview[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.allSettled([
            PremiumDerivApiService.activeSymbols(),
            PremiumDerivApiService.portfolio(),
            PremiumDerivApiService.profitTable(20),
        ]).then(([symbols, portfolio, profit]) => {
            if (symbols.status === 'fulfilled') setMarketCount(symbols.value.length);
            if (portfolio.status === 'fulfilled') setOpenContracts(Array.isArray(portfolio.value.contracts) ? portfolio.value.contracts.length : 0);
            if (profit.status === 'fulfilled') setHistory(Array.isArray(profit.value.transactions) ? profit.value.transactions : []);
            if ([symbols, portfolio, profit].every(item => item.status === 'rejected')) setError('Unable to read the current Deriv session.');
        });
    }, [authData?.loginid]);

    useEffect(() => {
        let alive = true;
        fetch('/free-bots/bots.json', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : Promise.reject(new Error(\`Free Bots HTTP \${response.status}\`)))
            .then(payload => {
                const items = Array.isArray(payload) ? payload : Array.isArray(payload?.bots) ? payload.bots : [];
                if (alive) setFreeBots(items.filter((item: any) => item?.file).slice(0, 4));
            })
            .catch(() => {
                if (alive) setFreeBots([]);
            });
        return () => { alive = false; };
    }, []);

    const pnl = useMemo(() => history.reduce((sum, item) => sum + (Number(item.sell_price || 0) - Number(item.buy_price || 0)), 0), [history]);
    const currency = authData?.currency || 'USD';

    const openNativeBotBuilder = () => {
        store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER);
        store?.run_panel?.toggleDrawer(true);
        openBotBuilder();
    };

    const openLocalBot = () => {
        try {
            store?.dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER);
            store?.load_modal?.setActiveTabIndex(isDesktop ? 1 : 0);
            store?.load_modal?.toggleLoadModal();
            store?.run_panel?.toggleDrawer(true);
            openBotBuilder();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not open the bot file loader.');
        }
    };

    const launch = (item: LauncherItem) => {
        setError('');
        if (item.action === 'local-file') return openLocalBot();
        if (!item.section) return;
        if (item.section === 'bot_builder') return openNativeBotBuilder();
        openSection?.(item.section);
    };

    return (
        <div className='prodb-dashboard-page'>
            <div className='prodb-dashboard-candles' />
            <section className='prodb-dashboard-main'>
                <div className='prodb-dashboard-heading'>
                    <div>
                        <span className='prodb-dashboard-eyebrow'>ELISY254 SHARP • LIVE TRADING</span>
                        <h1>Trading Dashboard</h1>
                        <p>Everything you need is one tap away. Your Deriv account is connected to this workspace.</p>
                    </div>
                    <div className='prodb-dashboard-connection'><i /> CONNECTED</div>
                </div>

                <div className='prodb-dashboard-api-strip'>
                    <div><small>DERIV ACCOUNT</small><strong>{authData?.loginid || 'Connected'}</strong></div>
                    <div><small>LIVE BALANCE</small><strong>{Number(authData?.balance || 0).toFixed(2)} {currency}</strong></div>
                    <div><small>ACTIVE MARKETS</small><strong>{marketCount}</strong></div>
                    <div><small>OPEN CONTRACTS</small><strong>{openContracts}</strong></div>
                    <div><small>LAST 20 NET</small><strong className={pnl >= 0 ? 'is-positive' : 'is-negative'}>{pnl.toFixed(2)} {currency}</strong></div>
                </div>

                <div className='prodb-dashboard-shortcuts'>
                    <div className='prodb-dashboard-shortcuts__head'><strong>Quick shortcuts</strong><span>Tap any tool to open it</span></div>
                    <div className='prodb-dashboard-shortcuts__track'>
                        {launcherItems.map((item, index) => (
                            <button key={item.label} type='button' onClick={() => launch(item)}>
                                <span className={\`launcher-icon launcher-icon--\${index}\`}>{item.icon}</span>
                                <strong>{item.label}</strong>
                            </button>
                        ))}
                    </div>
                </div>

                <div className='prodb-dashboard-section-head'>
                    <div><span>READY TO USE</span><h2>Free Bots</h2></div>
                    <button type='button' onClick={() => openSection?.('free_bots')}>View all free bots →</button>
                </div>

                <div className='prodb-dashboard-freebots'>
                    {freeBots.length > 0 ? freeBots.map((bot, index) => (
                        <button key={bot.id || bot.file} type='button' onClick={() => openSection?.('free_bots')} className='prodb-dashboard-freebot'>
                            <span className={\`prodb-dashboard-freebot__icon prodb-dashboard-freebot__icon--\${index % 4}\`}>{bot.emoji || '🤖'}</span>
                            <span>
                                <small>FREE BOT</small>
                                <strong>{bot.name || bot.title || bot.file.replace(/\\.xml$/i, '')}</strong>
                                <em>{bot.description || 'Ready to load into Bot Builder.'}</em>
                            </span>
                            <b>OPEN</b>
                        </button>
                    )) : (
                        <button type='button' className='prodb-dashboard-freebot prodb-dashboard-freebot--empty' onClick={() => openSection?.('free_bots')}>
                            <span className='prodb-dashboard-freebot__icon'>🤖</span>
                            <span><small>FREE BOTS</small><strong>Open Free Bots Library</strong><em>Browse and load your available bots.</em></span>
                            <b>OPEN</b>
                        </button>
                    )}
                </div>

                {error && <div className='prodb-live-error'>{error}</div>}
            </section>

            <aside className='prodb-help-panel'>
                <article className='prodb-help-panel__welcome'>
                    <div className='prodb-help-line' />
                    <span className='prodb-help-icon'>🧠</span>
                    <h2>Welcome to {domain}</h2>
                    <p>Your connected Deriv workspace. Use the shortcuts above to move between trading tools without leaving the app.</p>
                </article>
                <article className='prodb-help-card prodb-help-card--green'><span>🤖</span><div><h3>Free Bots</h3><p>Open the library, choose a bot and load it into the existing Bot Builder.</p></div></article>
                <article className='prodb-help-card prodb-help-card--blue'><span>⚡</span><div><h3>Live tools</h3><p>Auto Trades, Manual Trading, Charts, Analysis and Copy Trading remain available from the app navigation.</p></div></article>
            </aside>
        </div>
    );
};

export default DashboardHome;
