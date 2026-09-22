import { useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import {
    getStoredDerivApiToken,
    getStoredDerivClientId,
    setStoredDerivApiToken,
    setStoredDerivClientId,
    type SharpTradingMode,
} from '@/config/runtime-mode';

type Props = {
    mode: SharpTradingMode;
    onModeChange: (mode: SharpTradingMode) => Promise<void>;
};

const SettingsPage = ({ mode, onModeChange }: Props) => {
    const [clientId, setClientId] = useState(getStoredDerivClientId());
    const [token, setToken] = useState(getStoredDerivApiToken());
    const [saved, setSaved] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setClientId(getStoredDerivClientId());
        setToken(getStoredDerivApiToken());
    }, []);

    const save = async () => {
        setBusy(true);
        setSaved('');
        setError('');
        const cleanClientId = clientId.trim();
        const cleanToken = token.trim();

        try {
            setStoredDerivClientId(cleanClientId);
            setStoredDerivApiToken(cleanToken);

            if (cleanToken) {
                await api_base.init(true);
                const api = api_base.api as any;
                if (!api) throw new Error('Deriv API connection is unavailable.');

                await new Promise<void>((resolve, reject) => {
                    if (api.connection?.readyState === WebSocket.OPEN) return resolve();
                    const timer = window.setTimeout(() => reject(new Error('Deriv connection timed out.')), 10000);
                    const onOpen = () => {
                        window.clearTimeout(timer);
                        api.connection.removeEventListener('open', onOpen);
                        resolve();
                    };
                    api.connection.addEventListener('open', onOpen);
                });

                const result = await api.authorize(cleanToken);
                if (result?.error) throw new Error(result.error.message || 'Deriv API token authorization failed.');

                api_base.token = cleanToken;
                await api_base.authorizeAndSubscribe();
            }

            setSaved('Saved. Your settings persist after refresh.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save Deriv settings.');
        } finally {
            setBusy(false);
        }
    };

    const clearToken = () => {
        setStoredDerivApiToken('');
        setToken('');
        setSaved('API token removed from this browser.');
    };

    return (
        <section style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ margin: 0 }}>Settings</h1>
                <p style={{ margin: '8px 0 0', opacity: .72 }}>
                    Connection and trading mode. Existing demo appearance is unchanged.
                </p>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
                <div className='prodb-premium-card' style={{ padding: 18 }}>
                    <h2 style={{ marginTop: 0 }}>Deriv Connection</h2>

                    <label style={{ display: 'block', fontWeight: 700, marginTop: 12 }}>
                        Client ID
                    </label>
                    <input
                        value={clientId}
                        onChange={e => setClientId(e.target.value)}
                        placeholder='Deriv Client ID'
                        autoComplete='off'
                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}
                    />

                    <label style={{ display: 'block', fontWeight: 700, marginTop: 16 }}>
                        Deriv API Token
                    </label>
                    <input
                        type='password'
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        placeholder='Personal Access Token'
                        autoComplete='off'
                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}
                    />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                        <button type='button' onClick={() => void save()} disabled={busy}
                            style={{ padding: '11px 16px', border: 0, borderRadius: 10, background: '#059669', color: '#fff', fontWeight: 800 }}>
                            {busy ? 'Saving…' : 'Save & Connect'}
                        </button>
                        <button type='button' onClick={clearToken}
                            style={{ padding: '11px 16px', border: '1px solid #cbd5e1', borderRadius: 10, background: 'transparent', fontWeight: 700 }}>
                            Remove API Token
                        </button>
                    </div>
                    {saved && <p style={{ color: '#059669', marginBottom: 0 }}>{saved}</p>}
                    {error && <p style={{ color: '#dc2626', marginBottom: 0 }}>{error}</p>}
                </div>

                <div className='prodb-premium-card' style={{ padding: 18 }}>
                    <h2 style={{ marginTop: 0 }}>Trading Account Mode</h2>
                    <p style={{ opacity: .72 }}>
                        This changes the selected authenticated Deriv account. It does not create demo data.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <button type='button' aria-pressed={mode === 'demo'}
                            onClick={() => void onModeChange('demo')}
                            style={{ padding: 16, borderRadius: 12, border: mode === 'demo' ? '2px solid #059669' : '1px solid #cbd5e1', background: mode === 'demo' ? 'rgba(5,150,105,.10)' : 'transparent', fontWeight: 800 }}>
                            DEMO — ON
                        </button>
                        <button type='button' aria-pressed={mode === 'real'}
                            onClick={() => void onModeChange('real')}
                            style={{ padding: 16, borderRadius: 12, border: mode === 'real' ? '2px solid #dc2626' : '1px solid #cbd5e1', background: mode === 'real' ? 'rgba(220,38,38,.08)' : 'transparent', fontWeight: 800 }}>
                            REAL — ON
                        </button>
                    </div>

                    <p style={{ marginBottom: 0, fontWeight: 700 }}>
                        Current mode: {mode.toUpperCase()}
                    </p>
                </div>
            </div>
        </section>
    );
};

export default SettingsPage;
