import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    CurrencyAudIcon,
    CurrencyBtcIcon,
    CurrencyDemoIcon,
    CurrencyEthIcon,
    CurrencyEurIcon,
    CurrencyGbpIcon,
    CurrencyLtcIcon,
    CurrencyNoneIcon,
    CurrencyUsdIcon,
    CurrencyUsdtIcon,
} from '@deriv/quill-icons';
import { observer } from 'mobx-react-lite';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { DerivWSAccountsService, type DerivAccount } from '@/services/derivws-accounts.service';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { SHARP_OFFLINE_MODE } from '@/config/runtime-mode';

const money = (value: string | number, currency = 'USD') => {
    const amount = Number(value);
    return `${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} ${currency}`;
};

const currencyIconMap = {
    usd: CurrencyUsdIcon,
    eur: CurrencyEurIcon,
    gbp: CurrencyGbpIcon,
    aud: CurrencyAudIcon,
    btc: CurrencyBtcIcon,
    eth: CurrencyEthIcon,
    ltc: CurrencyLtcIcon,
    ust: CurrencyUsdtIcon,
    usdt: CurrencyUsdtIcon,
    demo: CurrencyDemoIcon,
};

type EnvironmentMapping = { realLabel: 'REAL' | 'DEMO'; demoLabel: 'REAL' | 'DEMO' };

const getVisualAccountType = (account: DerivAccount | undefined, mapping: EnvironmentMapping): 'REAL' | 'DEMO' => {
    if (!account) return 'DEMO';
    if (account.account_type === 'real') return mapping.realLabel;
    return mapping.demoLabel;
};

// Website-only presentation mapping. It never changes account_type, loginid,
// balance source, token, OTP, WebSocket endpoint, or the trading account.
const DEFAULT_ENVIRONMENT_MAPPING: EnvironmentMapping = { realLabel: 'REAL', demoLabel: 'DEMO' };
type WebsiteDisplayBalances = { real: number; demo: number };
type WebsiteDisplayLoginIds = { real: string; demo: string };

type MenuPosition = {
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
};

const AccountIcon = ({ account, mapping = DEFAULT_ENVIRONMENT_MAPPING }: { account?: DerivAccount; mapping?: EnvironmentMapping }) => {
    // Admin can swap ONLY the presentation: REAL <-> DEMO.
    // The underlying Deriv account object is never mutated.
    const visualType = getVisualAccountType(account, mapping);
    const adminOverride = mapping.realLabel !== 'REAL' || mapping.demoLabel !== 'DEMO';
    const currencyKey = adminOverride
        ? (visualType === 'REAL' ? 'usd' : 'demo')
        : (account?.account_type === 'demo' ? 'demo' : (account?.currency || '').toLowerCase());
    const IconComponent = currencyIconMap[currencyKey as keyof typeof currencyIconMap] || CurrencyNoneIcon;

    return (
        <span className={`prodb-api-account-icon ${visualType === 'REAL' ? 'is-real' : 'is-demo'}`} aria-hidden='true'>
            <IconComponent iconSize='sm' />
        </span>
    );
};

const LivePremiumAccountSwitcher = observer(() => {

    const { activeLoginid, accountList, connectionStatus, isAuthorized } = useApiBase();
    const { client } = useStore() ?? {};
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const [accounts, setAccounts] = useState<DerivAccount[]>(() => DerivWSAccountsService.getStoredAccounts() || []);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [environmentMapping, setEnvironmentMapping] = useState<EnvironmentMapping>(DEFAULT_ENVIRONMENT_MAPPING);
    const [websiteDisplayBalances, setWebsiteDisplayBalances] = useState<WebsiteDisplayBalances>({ real: 0, demo: 0 });
    const [websiteDisplayLoginIds, setWebsiteDisplayLoginIds] = useState<WebsiteDisplayLoginIds>({ real: 'ROT92654805', demo: 'DOT94513037' });
    const [, refreshRealFlag] = useState(0);

    useEffect(() => {
        const refresh = () => refreshRealFlag(value => value + 1);
        window.addEventListener('sharp-admin-real-flag-updated', refresh);
        return () => window.removeEventListener('sharp-admin-real-flag-updated', refresh);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadWebsiteMapping = async () => {
            try {
                const response = await fetch('/api/public-config', { credentials: 'include', cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                const mapping = data?.environmentMapping;
                if (!cancelled && mapping && (mapping.realLabel === 'REAL' || mapping.realLabel === 'DEMO') && (mapping.demoLabel === 'REAL' || mapping.demoLabel === 'DEMO')) {
                    setEnvironmentMapping({ realLabel: mapping.realLabel, demoLabel: mapping.demoLabel });
                }
                const loginIds = data?.websiteDisplayLoginIds;
                if (!cancelled && loginIds) {
                    setWebsiteDisplayLoginIds({ real: String(loginIds.real || 'ROT92654805'), demo: String(loginIds.demo || 'DOT94513037') });
                }
                const balances = data?.websiteDisplayBalances;
                if (!cancelled && balances) {
                    setWebsiteDisplayBalances({ real: Number(balances.real) >= 0 ? Number(balances.real) : 0, demo: Number(balances.demo) >= 0 ? Number(balances.demo) : 0 });
                }
            } catch {
                // Keep the real Deriv labels if the website config endpoint is unavailable.
            }
        };
        void loadWebsiteMapping();
        const refresh = () => void loadWebsiteMapping();
        window.addEventListener('sharp-admin-real-flag-updated', refresh);
        return () => {
            cancelled = true;
            window.removeEventListener('sharp-admin-real-flag-updated', refresh);
        };
    }, []);

    const activeId = activeLoginid || client?.loginid || localStorage.getItem('active_loginid') || '';
    const active = useMemo(() => accounts.find(account => account.account_id === activeId) || accounts[0], [accounts, activeId]);
    const activeAccounts = useMemo(
        () => accounts.filter(account => !account.status || account.status === 'active'),
        [accounts]
    );
    const choices = useMemo(() => {
        const activeReal = active?.account_type === 'real' ? active : undefined;
        const activeDemo = active?.account_type === 'demo' ? active : undefined;
        const real = activeReal || activeAccounts.find(account => account.account_type === 'real');
        const demo = activeDemo || activeAccounts.find(account => account.account_type === 'demo');
        return [real, demo].filter((account): account is DerivAccount => Boolean(account));
    }, [active, activeAccounts]);

    const closeMenu = useCallback(() => {
        setOpen(false);
        setMenuPosition(null);
    }, []);

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger || typeof window === 'undefined') return;

        const rect = trigger.getBoundingClientRect();
        const margin = 8;
        const gap = 6;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const width = Math.max(160, Math.min(258, viewportWidth - margin * 2));
        const maxLeft = Math.max(margin, viewportWidth - width - margin);
        const left = Math.min(Math.max(margin, rect.right - width), maxLeft);
        const roomBelow = Math.max(0, viewportHeight - rect.bottom - gap - margin);
        const roomAbove = Math.max(0, rect.top - gap - margin);

        if (roomBelow >= 190 || roomBelow >= roomAbove) {
            setMenuPosition({
                top: rect.bottom + gap,
                left,
                width,
                maxHeight: Math.max(96, roomBelow),
            });
            return;
        }

        setMenuPosition({
            bottom: viewportHeight - rect.top + gap,
            left,
            width,
            maxHeight: Math.max(96, roomAbove),
        });
    }, []);

    useEffect(() => {
        const handler = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            closeMenu();
        };
        const keyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };

        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler, { passive: true });
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [closeMenu]);

    useEffect(() => {
        if (!open) return;

        updateMenuPosition();
        const frame = window.requestAnimationFrame(updateMenuPosition);
        const reposition = () => updateMenuPosition();
        window.addEventListener('resize', reposition);
        window.addEventListener('orientationchange', reposition);
        window.addEventListener('scroll', reposition, true);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('orientationchange', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [open, updateMenuPosition]);

    useEffect(() => {
        if (!open) return;
        const token = OAuthTokenExchangeService.getAccessToken();
        if (!token) return;
        DerivWSAccountsService.refreshAccounts(token)
            .then(setAccounts)
            .catch(err => setError(err instanceof Error ? err.message : String(err)));
    }, [open, accountList?.length]);

    const activeBalance = client?.balance ?? active?.balance ?? 0;
    const activeCurrency = client?.currency || active?.currency || 'USD';
    const connected = String(connectionStatus).toLowerCase().includes('open') || isAuthorized;
    const lastKnownRealBalance = localStorage.getItem('sharp_last_real_balance') || '';
    const lastKnownRealCurrency = localStorage.getItem('sharp_last_real_currency') || activeCurrency || 'USD';
    const visualActiveType = getVisualAccountType(active, environmentMapping);
    const websiteDisplayBalance = visualActiveType === 'REAL' ? websiteDisplayBalances.real : websiteDisplayBalances.demo;
    const websiteDisplayLoginId = visualActiveType === 'REAL' ? websiteDisplayLoginIds.real : websiteDisplayLoginIds.demo;
    const hasWebsiteDisplayBalance = Number.isFinite(websiteDisplayBalance) && websiteDisplayBalance > 0;
    const displayBalance = connected ? (hasWebsiteDisplayBalance ? money(websiteDisplayBalance, activeCurrency) : money(activeBalance, activeCurrency)) : lastKnownRealBalance ? money(lastKnownRealBalance, lastKnownRealCurrency) : '— USD';
    const displayLoginId = websiteDisplayLoginId || activeId || '—';

    // Keep only the last confirmed Deriv real balance locally so the header can
    // display a clearly labelled last-known value while the WebSocket is offline.
    useEffect(() => {
        const numericBalance = Number(activeBalance);
        if (!activeId || !Number.isFinite(numericBalance) || active?.account_type === 'demo') return;
        localStorage.setItem('sharp_last_real_balance', String(numericBalance));
        localStorage.setItem('sharp_last_real_currency', activeCurrency || 'USD');
        window.dispatchEvent(new Event('sharp-real-balance-updated'));
    }, [activeBalance, activeCurrency, activeId, active?.account_type]);

    useEffect(() => {
        if (!activeId) return;

        setAccounts(current =>
            current.map(account =>
                account.account_id === activeId
                    ? {
                          ...account,
                          balance: activeBalance,
                          currency: activeCurrency || account.currency,
                      }
                    : account
            )
        );
    }, [activeBalance, activeCurrency, activeId]);

    const selectAccount = async (account: DerivAccount) => {
        if (account.account_id === activeId || busy) {
            closeMenu();
            return;
        }
        setBusy(account.account_id);
        setError('');
        try {
            localStorage.setItem('active_loginid', account.account_id);
            localStorage.setItem('account_type', account.account_type);
            await client?.regenerateWebSocket?.();
            setAccounts(current => current.map(item => item.account_id === account.account_id ? { ...item, balance: account.balance } : item));
            closeMenu();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy('');
        }
    };

    const balanceFor = (account: DerivAccount) => {
        const visualType = getVisualAccountType(account, environmentMapping);
        const configured = visualType === 'REAL' ? websiteDisplayBalances.real : websiteDisplayBalances.demo;
        return Number.isFinite(configured) && configured > 0 ? configured : (account.account_id === activeId ? activeBalance : account.balance);
    };

    const menu = open && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
                id={menuId}
                ref={menuRef}
                className='prodb-api-account__menu prodb-api-account__menu--portal'
                role='listbox'
                aria-label='Choose Deriv account'
                style={{
                    position: 'fixed',
                    top: menuPosition.top,
                    bottom: menuPosition.bottom,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                }}
            >
                {choices.length === 0 && <div className='prodb-api-account__empty'>No Deriv Options account available.</div>}
                {choices.map(account => {
                    const selected = account.account_id === activeId;
                    return (
                        <button
                            type='button'
                            role='option'
                            aria-selected={selected}
                            key={account.account_id}
                            className={`prodb-api-account__choice ${selected ? 'is-active' : ''}`}
                            disabled={Boolean(busy)}
                            onClick={() => selectAccount(account)}
                        >
                            <AccountIcon account={account} mapping={environmentMapping} />
                            <span className='prodb-api-account__choice-copy'>
                                <strong>{getVisualAccountType(account, environmentMapping) === 'REAL' ? 'Real' : 'Demo'}</strong>
                                <small>{account.account_id}</small>
                            </span>
                            <b>{money(balanceFor(account), account.currency || 'USD')}</b>
                            {selected && <span className='prodb-api-account__selected-mark'>✓</span>}
                        </button>
                    );
                })}
                {error && <div className='prodb-api-account__error'>{error}</div>}
            </div>,
            document.body
        )
        : null;

    return (
        <div className='prodb-api-account' ref={rootRef}>
            <button
                ref={triggerRef}
                type='button'
                className='prodb-api-account__trigger'
                onClick={() => {
                    setOpen(value => !value);
                    if (open) setMenuPosition(null);
                }}
                aria-expanded={open}
                aria-haspopup='listbox'
                aria-controls={open ? menuId : undefined}
            >
                <AccountIcon account={active} mapping={environmentMapping} />
                <span className='prodb-api-account__current'>
                    <small>{connected ? (getVisualAccountType(active, environmentMapping) === 'REAL' ? 'Real' : 'Demo') : 'OFFLINE · LAST KNOWN REAL'}</small>
                    <strong>{displayLoginId}</strong>
                    <span className='prodb-api-account__balance'>{displayBalance}</span>
                </span>
                <span className={`prodb-api-account__chevron ${open ? 'is-open' : ''}`}>⌄</span>
            </button>
            {menu}
        </div>
    );
});

const OfflinePremiumAccountSwitcher = () => {
    const [mode, setMode] = useState<'demo' | 'real'>(() => (localStorage.getItem('sharp_account_mode') as 'demo' | 'real') || 'real');
    const [cachedBalance, setCachedBalance] = useState(() => localStorage.getItem('sharp_last_real_balance') || '');
    const [cachedCurrency, setCachedCurrency] = useState(() => localStorage.getItem('sharp_last_real_currency') || 'USD');

    useEffect(() => {
        const syncCachedBalance = () => {
            setCachedBalance(localStorage.getItem('sharp_last_real_balance') || '');
            setCachedCurrency(localStorage.getItem('sharp_last_real_currency') || 'USD');
        };
        window.addEventListener('sharp-real-balance-updated', syncCachedBalance);
        window.addEventListener('storage', syncCachedBalance);
        return () => {
            window.removeEventListener('sharp-real-balance-updated', syncCachedBalance);
            window.removeEventListener('storage', syncCachedBalance);
        };
    }, []);

    const selectMode = (next: 'demo' | 'real') => {
        setMode(next);
        localStorage.setItem('sharp_account_mode', next);
    };

    const displayBalance = cachedBalance ? money(cachedBalance, cachedCurrency) : '— USD';

    return (
        <div className='prodb-api-account prodb-api-account--offline'>
            <button
                type='button'
                className='prodb-api-account__trigger'
                aria-label={`Offline account. Last known real balance: ${displayBalance}`}
                onClick={() => selectMode(mode === 'demo' ? 'real' : 'demo')}
            >
                <span className={`prodb-api-account-icon ${mode === 'demo' ? 'is-demo' : 'is-real'}`} aria-hidden='true'>
                    <CurrencyDemoIcon iconSize='sm' />
                </span>
                <span className='prodb-api-account__current'>
                    <small>OFFLINE · LAST KNOWN REAL</small>
                    <strong>{displayBalance}</strong>
                </span>
                <span className='prodb-api-account__chevron'>⌄</span>
            </button>
        </div>
    );
};

const PremiumAccountSwitcher = () => SHARP_OFFLINE_MODE ? <OfflinePremiumAccountSwitcher /> : <LivePremiumAccountSwitcher />;

export default PremiumAccountSwitcher;
