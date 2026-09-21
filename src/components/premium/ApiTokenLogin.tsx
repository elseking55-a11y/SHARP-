import { useState } from 'react';

interface Props {
    onClose: () => void;
    onConnected: (token: string) => Promise<void>;
}

const ApiTokenLogin = ({ onClose, onConnected }: Props) => {
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const connect = async () => {
        const value = token.trim();
        if (!value) {
            setError('Enter your Deriv Personal Access Token.');
            return;
        }

        setBusy(true);
        setError('');

        try {
            const response = await fetch('/api/deriv/pat/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ token: value }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.valid) {
                throw new Error(data.error_description || 'The Deriv API token could not be verified.');
            }

            await onConnected(value);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to connect the Deriv API token.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div role='dialog' aria-modal='true' aria-labelledby='deriv-api-login-title'
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(2, 6, 23, .72)', backdropFilter: 'blur(8px)' }}>
            <div style={{ width: 'min(460px, 100%)', borderRadius: 22, padding: 24, background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,.3)', color: '#0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
                    <div>
                        <h2 id='deriv-api-login-title' style={{ margin: 0, fontSize: 22 }}>🔑 Use Deriv API Token</h2>
                        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.5 }}>Connect your own Deriv Personal Access Token. Your Deriv password is never requested.</p>
                    </div>
                    <button type='button' onClick={onClose} aria-label='Close API token login'
                        style={{ border: 0, background: '#f1f5f9', borderRadius: 10, width: 38, height: 38, fontSize: 20 }}>×</button>
                </div>
                <label htmlFor='deriv-api-token' style={{ display: 'block', marginTop: 20, fontWeight: 700 }}>Personal Access Token</label>
                <input id='deriv-api-token' type='password' autoComplete='off' value={token}
                    onChange={e => setToken(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void connect(); }}
                    placeholder='Paste your Deriv token' disabled={busy}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '13px 14px', border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 15 }} />
                {error && <div role='alert' style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
                <button type='button' onClick={() => void connect()} disabled={busy}
                    style={{ width: '100%', marginTop: 16, padding: '13px 16px', border: 0, borderRadius: 12, background: '#059669', color: '#fff', fontWeight: 800, fontSize: 15 }}>
                    {busy ? 'Connecting to Deriv…' : 'Connect API'}
                </button>
                <p style={{ margin: '14px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>Never paste a Deriv password, OAuth code, client secret, or another person's token here.</p>
            </div>
        </div>
    );
};

export default ApiTokenLogin;
