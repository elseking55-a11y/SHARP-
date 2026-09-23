import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';

type Appearance = {
    siteName: string;
    primary: string;
    secondary: string;
    navBackground: string;
    navText: string;
    headerBackground: string;
    cardBackground: string;
};

type EnvironmentMapping = { realLabel: 'REAL' | 'DEMO'; demoLabel: 'REAL' | 'DEMO' };
type ManagedBot = { id: string; name: string; description?: string; emoji?: string; file: string; accent?: string; surface?: string; text?: string; published?: boolean; comingSoon?: boolean; xmlBase64: string; updatedAt: number };
type PublicConfig = { clientId: string; appearance: Appearance; environmentMapping: EnvironmentMapping; managedBots?: ManagedBot[] };

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
    const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
    const [environmentMapping, setEnvironmentMapping] = useState<EnvironmentMapping>({ realLabel: 'REAL', demoLabel: 'DEMO' });
    const [managedBots, setManagedBots] = useState<ManagedBot[]>([]);
    const [botName, setBotName] = useState('');
    const [botDescription, setBotDescription] = useState('');
    const [botEmoji, setBotEmoji] = useState('🤖');
    const [botXmlBase64, setBotXmlBase64] = useState('');
    const [botFile, setBotFile] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const loadConfig = async () => {
        const response = await fetch('/api/admin/config', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data: PublicConfig = await response.json();
        setClientId(data.clientId || '');
        setAppearance({ ...defaultAppearance, ...(data.appearance || {}) });
        setEnvironmentMapping({ realLabel: 'REAL', demoLabel: 'DEMO', ...(data.environmentMapping || {}) });
        setManagedBots(Array.isArray(data.managedBots) ? data.managedBots : []);
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
                body: JSON.stringify({ clientId, appearance, environmentMapping, managedBots }),
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
                        <h2 style={headingStyle}>Bot Management</h2>
                        <p style={mutedStyle}>Upload a Blockly XML bot, give it a name, and publish it to the public Free Bots page.</p>
                        <label style={labelStyle}>Bot XML file
                            <input style={inputStyle} type='file' accept='.xml,text/xml,application/xml' onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const xml = String(reader.result || '');
                                    if (!/<xml[\s>]/i.test(xml) && !/<block[\s>]/i.test(xml)) { setMessage('Invalid Blockly XML file.'); return; }
                                    const bytes = new TextEncoder().encode(xml);
                                    let binary = '';
                                    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
                                    setBotXmlBase64(btoa(binary));
                                    setBotFile(file.name);
                                    if (!botName) setBotName(file.name.replace(/\.xml$/i, ''));
                                    setMessage('Bot XML loaded. Add it below, then save and publish.');
                                };
                                reader.readAsText(file);
                            }} />
                        </label>
                        <label style={labelStyle}>Bot name<input style={inputStyle} value={botName} onChange={e => setBotName(e.target.value)} placeholder='Elisy234 Sharp' /></label>
                        <label style={labelStyle}>Description<input style={inputStyle} value={botDescription} onChange={e => setBotDescription(e.target.value)} placeholder='Free bot ready for Bot Builder' /></label>
                        <label style={labelStyle}>Emoji<input style={inputStyle} value={botEmoji} onChange={e => setBotEmoji(e.target.value)} /></label>
                        <button type='button' style={secondaryButtonStyle} onClick={() => {
                            if (!botXmlBase64 || !botName.trim()) { setMessage('Choose an XML bot and enter its name first.'); return; }
                            const id = `bot-${Date.now()}`;
                            setManagedBots(current => [...current, { id, name: botName.trim(), description: botDescription.trim(), emoji: botEmoji || '🤖', file: botFile || `${botName.trim()}.xml`, accent: '#00a884', surface: '#091a2b', text: '#ffffff', published: true, comingSoon: false, xmlBase64: botXmlBase64, updatedAt: Date.now() }]);
                            setBotName(''); setBotDescription(''); setBotEmoji('🤖'); setBotXmlBase64(''); setBotFile('');
                            setMessage('Bot added. Press SAVE & PUBLISH TO USERS.');
                        }}>ADD BOT</button>
                        {managedBots.map(bot => <div key={bot.id} style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#06111c', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span>{bot.emoji || '🤖'}</span><strong style={{ flex: 1 }}>{bot.name}</strong><small>{bot.file}</small>
                            <button type='button' style={dangerButtonStyle} onClick={() => setManagedBots(current => current.filter(item => item.id !== bot.id))}>DELETE</button>
                        </div>)}
                    </section>
                    <section style={sectionStyle}>
                        <h2 style={headingStyle}>Environment mapping — Admin only</h2>
                        <p style={mutedStyle}>This persistent setting is for Admin preview/label testing only. It does not change or disguise the user's actual Deriv account type.</p>
                        <label style={labelStyle}>When Deriv account is REAL
                            <select style={inputStyle} value={environmentMapping.realLabel} onChange={e => setEnvironmentMapping({ ...environmentMapping, realLabel: e.target.value as EnvironmentMapping['realLabel'] })}>
                                <option value='REAL'>Show REAL</option><option value='DEMO'>Show DEMO (admin preview)</option>
                            </select>
                        </label>
                        <label style={labelStyle}>When Deriv account is DEMO
                            <select style={inputStyle} value={environmentMapping.demoLabel} onChange={e => setEnvironmentMapping({ ...environmentMapping, demoLabel: e.target.value as EnvironmentMapping['demoLabel'] })}>
                                <option value='DEMO'>Show DEMO</option><option value='REAL'>Show REAL (admin preview)</option>
                            </select>
                        </label>
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

const pageStyle: CSSProperties = { minHeight: '100vh', padding: 20, boxSizing: 'border-box', background: '#050d15', color: '#fff', fontFamily: 'Arial, sans-serif' };
const cardStyle: CSSProperties = { maxWidth: 520, margin: '40px auto', padding: 24, borderRadius: 18, background: '#091a2b', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 18px 50px rgba(0,0,0,.35)' };
const titleStyle: CSSProperties = { margin: 0, fontSize: 24, letterSpacing: 1 };
const headingStyle: CSSProperties = { fontSize: 18, margin: '0 0 14px' };
const mutedStyle: CSSProperties = { color: '#9fb0c0', fontSize: 13, lineHeight: 1.5 };
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, margin: '14px 0', fontSize: 13, color: '#dce7ef' };
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,.16)', background: '#06111c', color: '#fff', outline: 'none' };
const buttonStyle: CSSProperties = { width: '100%', marginTop: 16, padding: '13px 16px', border: 0, borderRadius: 10, background: '#00a884', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const dangerButtonStyle: CSSProperties = { padding: '8px 10px', borderRadius: 8, border: 0, background: '#7b2832', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const secondaryButtonStyle: CSSProperties = { padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.16)', background: '#10283c', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const sectionStyle: CSSProperties = { marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)' };
const messageStyle: CSSProperties = { marginTop: 14, color: '#8ff0cf' };
const errorStyle: CSSProperties = { marginTop: 14, color: '#ff9b9b' };

export default AdminPage;
