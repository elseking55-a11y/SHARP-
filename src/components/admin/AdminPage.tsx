import { FormEvent, useEffect, useState } from 'react';

type Appearance = {
    siteName: string;
    primary: string;
    secondary: string;
    navBackground: string;
    navText: string;
    headerBackground: string;
    cardBackground: string;
};

type PublicConfig = { clientId: string; appearance: Appearance };

const defaultAppearance: Appearance = {
    siteName: 'ELISY254',
    primary: '#00a884',
    secondary: '#ffffff',
    navBackground: '#071521',
    navText: '#ffffff',
    headerBackground: '#06111c',
    cardBackground: '#091a2b',
};

const AdminPage = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [checked, setChecked] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [clientId, setClientId] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const loadConfig = async () => {
        const response = await fetch('/api/admin/config', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data: PublicConfig = await response.json();
        setClientId(data.clientId || '');
        setAppearance({ ...defaultAppearance, ...(data.appearance || {}) });
    };

    const loadSession = async () => {
        const response = await fetch('/api/admin/session', { credentials: 'include', cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        setAuthenticated(Boolean(data.authenticated));
        setChecked(true);
        if (data.authenticated) await loadConfig();
    };

    useEffect(() => { void loadSession(); }, []);

    const login = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.authenticated) throw new Error(data.error_description || 'Admin login failed.');
            setAuthenticated(true);
            setPassword('');
            await loadConfig();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Admin login failed.');
        } finally {
            setBusy(false);
        }
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch('/api/admin/config', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ clientId, appearance }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error_description || 'Could not save settings.');
            setMessage('Saved and published to the public interface.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save settings.');
        } finally {
            setBusy(false);
        }
    };

    const validateToken = async () => {
        if (!apiToken.trim()) return;
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch('/api/deriv/pat/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ token: apiToken.trim() }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.valid) throw new Error(data.error_description || 'API token is invalid.');
            setMessage('API token verified for ' + (data.account_id || 'the Deriv account') + '. It is not published to users.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'API token validation failed.');
        } finally {
            setBusy(false);
        }
    };

    const logout = async () => {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
        setAuthenticated(false);
    };

    if (!checked) return <div style={pageStyle}><div style={cardStyle}>Checking admin session…</div></div>;

    if (!authenticated) return (
        <div style={pageStyle}>
            <form onSubmit={login} style={cardStyle}>
                <h1 style={titleStyle}>SHARP ADMIN</h1>
                <p style={mutedStyle}>Private administration panel</p>
                <label style={labelStyle}>Admin email<input style={inputStyle} type='email' value={email} onChange={e => setEmail(e.target.value)} autoComplete='username' required /></label>
                <label style={labelStyle}>Admin password<input style={inputStyle} type='password' value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' required /></label>
                <button style={buttonStyle} disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN TO ADMIN'}</button>
                {message && <p style={errorStyle}>{message}</p>}
            </form>
        </div>
    );

    return (
        <div style={pageStyle}>
            <div style={{ ...cardStyle, maxWidth: 900 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div><h1 style={titleStyle}>SHARP ADMIN CONTROL</h1><p style={mutedStyle}>Separate from the public user navigation.</p></div>
                    <button type='button' onClick={logout} style={secondaryButtonStyle}>LOG OUT</button>
                </div>
                <form onSubmit={save}>
                    <section style={sectionStyle}>
                        <h2 style={headingStyle}>Deriv connection</h2>
                        <label style={labelStyle}>Public Deriv Client ID<input style={inputStyle} value={clientId} onChange={e => setClientId(e.target.value)} placeholder='Client ID' /></label>
                        <label style={labelStyle}>API Token (validation only)<input style={inputStyle} type='password' value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder='Paste token to verify' /></label>
                        <button type='button' onClick={validateToken} style={secondaryButtonStyle} disabled={busy}>VERIFY API TOKEN</button>
                        <p style={mutedStyle}>The API token is never published. Users can enter their own token in Settings.</p>
                    </section>
                    <section style={sectionStyle}>
                        <h2 style={headingStyle}>User appearance</h2>
                        <p style={mutedStyle}>Change public branding/colors while keeping the existing layout and features.</p>
                        <label style={labelStyle}>Site name<input style={inputStyle} value={appearance.siteName} onChange={e => setAppearance({ ...appearance, siteName: e.target.value })} /></label>
                        <ColorRow label='Primary color' value={appearance.primary} onChange={value => setAppearance({ ...appearance, primary: value })} />
                        <ColorRow label='Secondary color' value={appearance.secondary} onChange={value => setAppearance({ ...appearance, secondary: value })} />
                        <ColorRow label='Navigation background' value={appearance.navBackground} onChange={value => setAppearance({ ...appearance, navBackground: value })} />
                        <ColorRow label='Navigation text' value={appearance.navText} onChange={value => setAppearance({ ...appearance, navText: value })} />
                        <ColorRow label='Header background' value={appearance.headerBackground} onChange={value => setAppearance({ ...appearance, headerBackground: value })} />
                        <ColorRow label='Card background' value={appearance.cardBackground} onChange={value => setAppearance({ ...appearance, cardBackground: value })} />
                    </section>
                    <button style={buttonStyle} disabled={busy}>{busy ? 'SAVING…' : 'SAVE & PUBLISH TO USERS'}</button>
                    {message && <p style={messageStyle}>{message}</p>}
                </form>
            </div>
        </div>
    );
};

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span><input type='color' value={value} onChange={e => onChange(e.target.value)} style={{ width: 54, height: 38, border: 0, background: 'transparent' }} />
    </label>
);

const pageStyle: React.CSSProperties = { minHeight: '100vh', padding: 20, boxSizing: 'border-box', background: '#050d15', color: '#fff', fontFamily: 'Arial, sans-serif' };
const cardStyle: React.CSSProperties = { maxWidth: 520, margin: '40px auto', padding: 24, borderRadius: 18, background: '#091a2b', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 18px 50px rgba(0,0,0,.35)' };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 24, letterSpacing: 1 };
const headingStyle: React.CSSProperties = { fontSize: 18, margin: '0 0 14px' };
const mutedStyle: React.CSSProperties = { color: '#9fb0c0', fontSize: 13, lineHeight: 1.5 };
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, margin: '14px 0', fontSize: 13, color: '#dce7ef' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,.16)', background: '#06111c', color: '#fff', outline: 'none' };
const buttonStyle: React.CSSProperties = { width: '100%', marginTop: 16, padding: '13px 16px', border: 0, borderRadius: 10, background: '#00a884', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.16)', background: '#10283c', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const sectionStyle: React.CSSProperties = { marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)' };
const messageStyle: React.CSSProperties = { marginTop: 14, color: '#8ff0cf' };
const errorStyle: React.CSSProperties = { marginTop: 14, color: '#ff9b9b' };

export default AdminPage;
