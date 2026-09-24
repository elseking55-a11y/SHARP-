import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { generateOAuthURL } from '@/components/shared';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import ManualTradingPage from '@/pages/manual-trading';
import DcirclePage from './pages/DcirclePage';
import TradingViewPage from '@/pages/tradingview';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import BottomStatusBar from './BottomStatusBar';
import { getTemplateDomain } from './domain-brand';
import GlobalAIScannerV2 from './GlobalAIScannerV2';
import GlobalContractBridge from './GlobalContractBridge';
import LandingPage from './LandingPage';
import CoreStoreProvider from '@/app/CoreStoreProvider';
import PremiumHeader from './PremiumHeader';
import PremiumLoader from './PremiumLoader';
import BulkTraderPage from './pages/BulkTraderPage';
import CalculatorPage from './pages/CalculatorPage';
import DashboardHome from './pages/DashboardHome';
import FreeBotsPage from './pages/FreeBotsPage';
import {
    AdvancedManualTradingPage,
    AutoTraderPage,
    BotIdeasPage,
    DTraderPage,
    ProAIPage,
    QuickBotPage,
    SignalAIPage,
    SourceAnalysisToolsPage,
} from './pages/ImportedFeaturePages';
import { ChartsPage } from './pages/LiveTradingPages';
import PatCopyTradingPage from './pages/PatCopyTradingPage';
import { isCustomizableSection, useSiteCustomization } from './site-customization';
import { getStoredDerivApiToken, SHARP_OFFLINE_MODE } from '@/config/runtime-mode';
import { writeManagedBots, type ManagedBot } from '@/utils/managed-bot-library';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import type { PremiumSection } from './types';
import './premium-base.scss';
import './premium-app.scss';
import './premium-live.scss';
import './premium-imported.scss';
import './premium-imported-library.scss';
import './premium-token-panel.scss';
import './premium-native-bot-builder.scss';
import './premium-bot-builder-polish.scss';
import './premium-account.scss';
import './premium-global-trading.scss';
import './premium-mobile-shell.scss';
import './premium-run-panel-right.scss';
import './premium-run-panel-mobile-history.scss';
import './premium-ai-scanner.scss';
import './premium-ai-scanner-override.scss';
import './premium-batch-trader.scss';
import './premium-speed-bot.scss';
import './premium-ai-scanner-v2.scss';
import './premium-execution-fixes.scss';
import './premium-calculator.scss';
import './premium-dcircle.scss';
import './premium-wallet.scss';
import RunPanel from '@/components/run-panel';
import './premium-site-theme.scss';

const validSections: PremiumSection[] = [
    'dashboard', 'bot_ideas', 'quick_bot', 'bot_builder', 'free_bots', 'signal_ai',
    'manual_trading', 'dcircle', 'bulk_trader', 'copy_trading', 'calculator', 'pro_ai',
    'analysis_hub', 'charts', 'tradingview', 'dtrader',
];

const sectionFromHash = (hash: string): PremiumSection => {
    const value = hash.replace(/^#\/?/, '').split('?')[0] as PremiumSection;
    return validSections.includes(value) ? value : 'dashboard';
};

const isLocalDevelopmentHost = () => ['localhost', '127.0.0.1'].includes(window.location.hostname);

const PremiumLayout = observer(() => {
    const { activeLoginid, isAuthorizing, setIsAuthorizing } = useApiBase();
    const store = useStore();
    const { client, dashboard, run_panel } = store ?? {};
    const location = useLocation();
    const navigate = useNavigate();
    const customization = useSiteCustomization();
    const [section, setSection] = useState<PremiumSection>(() => sectionFromHash(location.hash));
    const [, setAuthProbe] = useState(0);
    const [authError, setAuthError] = useState<string | null>(null);
    const hasBootstrappedSession = useRef(false);

    const params = new URLSearchParams(window.location.search);
    const isOAuthCallback = Boolean(params.get('code') && params.get('state'));
    const hasStoredAuth = OAuthTokenExchangeService.isAuthenticated();
    const runtimeAuthenticated = Boolean(activeLoginid || client?.is_logged_in);
    const isAuthenticated = Boolean(SHARP_OFFLINE_MODE || runtimeAuthenticated || hasStoredAuth || isLocalDevelopmentHost() || Boolean(getStoredDerivApiToken()));

    useEffect(() => { document.title = getTemplateDomain(); }, []);

    useEffect(() => {
        // Restore a user-supplied Deriv API token after refresh when Real/Demo
        // mode is selected. No fake account or balance is created.
        const token = getStoredDerivApiToken();
        if (!token || hasStoredAuth || runtimeAuthenticated || SHARP_OFFLINE_MODE) return;

        let cancelled = false;
        void (async () => {
            try {
                await api_base.init(true);
                const api = api_base.api as any;
                if (!api) throw new Error('Deriv API connection is unavailable.');
                await new Promise<void>((resolve, reject) => {
                    if (api.connection?.readyState === WebSocket.OPEN) return resolve();
                    const timeout = window.setTimeout(() => reject(new Error('Deriv connection timed out.')), 10000);
                    const onOpen = () => { window.clearTimeout(timeout); api.connection.removeEventListener('open', onOpen); resolve(); };
                    api.connection.addEventListener('open', onOpen);
                });
                const result = await api.authorize(token);
                if (result?.error) throw new Error(result.error.message || 'Deriv API token authorization failed.');
                api_base.token = token;
                await api_base.authorizeAndSubscribe();
                if (!cancelled) setAuthProbe(value => value + 1);
            } catch (error) {
                console.warn('[SHARP] Saved Deriv API token could not be restored:', error);
            }
        })();

        return () => { cancelled = true; };
    }, [hasStoredAuth, runtimeAuthenticated]);

    useEffect(() => {
        setSection(sectionFromHash(location.hash));
    }, [location.hash]);
    useEffect(() => {
        if (SHARP_OFFLINE_MODE) return;
        if (hasBootstrappedSession.current || isOAuthCallback || !hasStoredAuth || runtimeAuthenticated) return;
        hasBootstrappedSession.current = true;
        setIsAuthorizing(true);

        void OAuthTokenExchangeService.restoreSession()
            .then(restored => {
                if (!restored) {
                    hasBootstrappedSession.current = false;
                    setAuthProbe(value => value + 1);
                }
            })
            .catch(error => {
                hasBootstrappedSession.current = false;
                console.error('Failed to restore authenticated Deriv session:', error);
                setAuthProbe(value => value + 1);
            })
            .finally(() => setIsAuthorizing(false));
    }, [hasStoredAuth, isOAuthCallback, runtimeAuthenticated, setIsAuthorizing]);

    useEffect(() => {
        if ((!isOAuthCallback && !isAuthorizing) || runtimeAuthenticated) return;
        const timer = window.setInterval(() => setAuthProbe(value => value + 1), 500);
        return () => window.clearInterval(timer);
    }, [runtimeAuthenticated, isOAuthCallback, isAuthorizing]);

    const activateNativeBotBuilder = useCallback(() => {
        dashboard?.setActiveTab(DBOT_TABS.BOT_BUILDER);
    }, [dashboard]);

    useEffect(() => {
        if (!isAuthenticated || section !== 'bot_builder') return;

        activateNativeBotBuilder();
        const frame = window.requestAnimationFrame(activateNativeBotBuilder);
        const retry = window.setTimeout(activateNativeBotBuilder, 120);
        const resize = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 220);

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(retry);
            window.clearTimeout(resize);
        };
    }, [activateNativeBotBuilder, isAuthenticated, section]);

    const startOAuth = useCallback(async (prompt?: string) => {
        try {
            setAuthError(null);
            setIsAuthorizing(true);
            const url = await generateOAuthURL(prompt);
            if (!url) {
                setIsAuthorizing(false);
                setAuthError('Deriv login is not configured yet. Check the OAuth client ID and redirect URL on Render.');
                return;
            }
            window.location.assign(url);
        } catch (error) {
            console.error('OAuth redirect failed:', error);
            setIsAuthorizing(false);
            setAuthError(error instanceof Error ? error.message : 'Unable to open Deriv login.');
        }
    }, [setIsAuthorizing]);

    const changeSection = useCallback((requested: PremiumSection) => {
        const requiredNavigation: PremiumSection[] = ['dashboard', 'manual_trading', 'dcircle'];
        const next = isCustomizableSection(requested) &&
            !customization.navigation.includes(requested) &&
            !requiredNavigation.includes(requested)
            ? 'dashboard'
            : requested;

        setSection(next);
        navigate(
            {
                pathname: location.pathname,
                search: location.search,
                hash: `#${next}`,
            },
            { replace: true }
        );

        if (next === 'bot_builder') activateNativeBotBuilder();
    }, [activateNativeBotBuilder, customization.navigation, location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!customization.loaded) return;
        if (isCustomizableSection(section) && !customization.navigation.includes(section)) {
            changeSection('dashboard');
        }
    }, [changeSection, customization.loaded, customization.navigation, section]);

    // A successful OAuth exchange stores the Bearer token before the Deriv
    // WebSocket/account observable finishes initializing. Do not send the user
    // back to the landing page (or keep them on a loader) during that handoff.
    // The restoreSession effect below completes the live Deriv connection.
    if (!SHARP_OFFLINE_MODE && !runtimeAuthenticated && isOAuthCallback && !hasStoredAuth) return <PremiumLoader />;
    const [publicAppearance, setPublicAppearance] = useState<{
        siteName?: string;
        primary?: string;
        secondary?: string;
        navBackground?: string;
        navText?: string;
        headerBackground?: string;
        cardBackground?: string;
    } | null>(null);

    useEffect(() => {
        if (!activeLoginid) return;
        const accountType = String(localStorage.getItem('account_type') || '').toLowerCase() === 'demo' ? 'DEMO' : 'REAL';
        void fetch('/api/sharp/user', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ loginid: activeLoginid, accountType }),
        }).catch(() => undefined);
    }, [activeLoginid]);

    useEffect(() => {
        let alive = true;
        fetch('/api/public-config', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : null)
            .then(config => {
                if (!alive || !config) return;
                if (config.clientId) localStorage.setItem('sharp_deriv_client_id', String(config.clientId));
                if (Array.isArray(config.managedBots)) writeManagedBots(config.managedBots as ManagedBot[]);
                if (config.appearance) setPublicAppearance(config.appearance);
                if (config.appearance?.siteName) document.title = String(config.appearance.siteName);
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);

    if (!isAuthenticated) return <LandingPage onDerivLogin={startOAuth} busy={isAuthorizing} error={authError} />;

    const openBotBuilder = () => changeSection('bot_builder');
    const renderSection = () => {
        switch (section) {
            case 'dashboard': return <DashboardHome openBotBuilder={openBotBuilder} openSection={changeSection} />;
            case 'bot_ideas': return <BotIdeasPage openBotBuilder={openBotBuilder} />;
            case 'quick_bot': return <QuickBotPage openBotBuilder={openBotBuilder} openSection={changeSection} />;
            case 'bot_builder': return null;
            case 'free_bots': return <FreeBotsPage openBotBuilder={openBotBuilder} />;
            case 'signal_ai': return <SignalAIPage />;
            case 'manual_trading': return <ManualTradingPage />;
            case 'dcircle': return <DcirclePage />;
            case 'bulk_trader': return <BulkTraderPage />;
            case 'copy_trading': return <PatCopyTradingPage />;
            case 'calculator': return <CalculatorPage />;
            case 'pro_ai': return <ProAIPage />;
            case 'analysis_hub': return <SourceAnalysisToolsPage />;
            case 'charts': return <ChartsPage />;
            case 'tradingview': return <TradingViewPage />;
            case 'dtrader': return <DTraderPage />;
            default: return null;
        }
    };

    const isBotBuilder = section === 'bot_builder';
    const isRunPanelOpen = Boolean(run_panel?.is_drawer_open);
    const themeStyle = {
        '--site-primary': publicAppearance?.primary || customization.colors.primary,
        '--site-secondary': publicAppearance?.secondary || customization.colors.secondary,
        '--site-nav-background': publicAppearance?.navBackground || customization.colors.nav_background,
        '--site-nav-text': publicAppearance?.navText || customization.colors.nav_text,
        '--site-header-background': publicAppearance?.headerBackground || customization.colors.header_background,
        '--sharp-card-background': publicAppearance?.cardBackground || '#091a2b',
        '--sharp-button-background': publicAppearance?.primary || customization.colors.primary,
        '--sharp-icon-color': publicAppearance?.secondary || customization.colors.secondary,
    } as CSSProperties;

    return <CoreStoreProvider>
        <div
        className={`prodb-premium-shell ${isBotBuilder ? 'prodb-premium-shell--builder' : ''} ${isRunPanelOpen ? 'prodb-premium-shell--run-open' : ''}`}
        style={themeStyle}
    >
        {!SHARP_OFFLINE_MODE && <GlobalContractBridge />}
        <PremiumHeader active={section} navigation={customization.navigation} onChange={changeSection} />
        <main className='prodb-premium-content'>
            {!isBotBuilder && renderSection()}
            <div className={`prodb-bot-builder-host ${isBotBuilder ? 'is-active' : 'is-hidden'}`} data-premium-builder-active={isBotBuilder ? 'true' : 'false'} aria-hidden={!isBotBuilder}>
                <Outlet />
            </div>
        </main>
        {!SHARP_OFFLINE_MODE && <GlobalAIScannerV2 openBotBuilder={openBotBuilder} />}
        {!SHARP_OFFLINE_MODE && <BottomStatusBar />}
        {/* Keep one shared transaction drawer mounted on every premium section.
            Bot Builder owns its native panel, so the global copy is only mounted
            on Dashboard, Free Bots, Manual Trading, Dcircle, Charts, etc. */}
        {!isBotBuilder && <RunPanel />}
        </div>
    </CoreStoreProvider>;
});

export default PremiumLayout;
