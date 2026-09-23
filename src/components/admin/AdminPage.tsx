import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';

type Appearance = {
    siteName: string; primary: string; secondary: string; navBackground: string; navText: string; headerBackground: string; cardBackground: string;
};
type EnvironmentMapping = { realLabel: 'REAL' | 'DEMO'; demoLabel: 'REAL' | 'DEMO' };
type ManagedBot = {
    id: string; name: string; description?: string; emoji?: string; file: string; accent?: string; surface?: string; text?: string;
    published?: boolean; comingSoon?: boolean; xmlBase64: string; splash?: boolean; splashColor?: string; splashText?: string; updatedAt: number;
};
type SharpUser = { id: string; loginid: string; accountType: 'REAL' | 'DEMO'; displayMode: 'AUTO' | 'REAL' | 'DEMO'; lastSeen: number };
type PublicConfig = { clientId: string; appearance: Appearance; environmentMapping: EnvironmentMapping; managedBots?: ManagedBot[] };

const defaultAppearance: Appearance = { siteName: 'ELISY254', primary: '#00a884', secondary: '#ffffff', navBackground: '#071521', navText: '#ffffff', headerBackground: '#06111c', cardBackground: '#091a2b' };
const colorChoices = [
    ['BLUE', '#2563eb'], ['CYAN', '#06b6d4'], ['PURPLE', '#7c3aed'], ['PINK', '#db2777'],
    ['GREEN', '#16a34a'], ['ORANGE', '#ea580c'], ['RED', '#dc2626'], ['GOLD', '#d4a017'],
];

const AdminPage = () => {
    const [authenticated, setAuthenticated] = useState(false), [checked, setChecked] = useState(false);
    const [email, setEmail] = useState(''), [password, setPassword] = useState('');
    const [clientId, setClientId] = useState(''), [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
    const [environmentMapping, setEnvironmentMapping] = useState<EnvironmentMapping>({ realLabel: 'REAL', demoLabel: 'DEMO' });
    const [managedBots, setManagedBots] = useState<ManagedBot[]>([]), [users, setUsers] = useState<SharpUser[]>([]);
    const [tab, setTab] = useState<'dashboard' | 'appearance' | 'bots' | 'settings' | 'sharp'>('dashboard');
    const [botName, setBotName] = useState(''), [botDescription, setBotDescription] = useState(''), [botEmoji, setBotEmoji] = useState('🤖');
    const [botXmlBase64, setBotXmlBase64] = useState(''), [botFile, setBotFile] = useState('');
    const [botColor, setBotColor] = useState('#2563eb'), [botSurface, setBotSurface] = useState('#071a2d'), [botText, setBotText] = useState('#ffffff');
    const [botSplash, setBotSplash] = useState(true), [botSplashText, setBotSplashText] = useState('SHARP MIND');
    const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);

    const loadConfig = async () => {
        const response = await fetch('/api/admin/config', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data: PublicConfig = await response.json();
        setClientId(data.clientId || '');
        setAppearance({ ...defaultAppearance, ...(data.appearance || {}) });
        setEnvironmentMapping({ realLabel: 'REAL', demoLabel: 'DEMO', ...(data.environmentMapping || {}) });
        setManagedBots(Array.isArray(data.managedBots) ? data.managedBots : []);
    };
    const loadUsers = async () => {
        const response = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
    };
    const loadSession = async () => {
        const response = await fetch('/api/admin/session', { credentials: 'include', cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        setAuthenticated(Boolean(data.authenticated)); setChecked(true);
        if (data.authenticated) { await Promise.all([loadConfig(), loadUsers()]); }
    };
    useEffect(() => { void loadSession(); }, []);

    const login = async (event: FormEvent) => {
        event.preventDefault(); setBusy(true); setMessage('');
        try {
            const response = await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.authenticated) throw new Error(data.error_description || 'Admin login failed.');
            setAuthenticated(true); setPassword(''); await Promise.all([loadConfig(), loadUsers()]);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Admin login failed.'); }
        finally { setBusy(false); }
    };
    const save = async (event?: FormEvent) => {
        event?.preventDefault(); setBusy(true); setMessage('');
        try {
            const response = await fetch('/api/admin/config', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, appearance, environmentMapping, managedBots }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error_description || 'Could not save settings.');
            setMessage('Saved and published.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save settings.'); }
        finally { setBusy(false); }
    };
    const updateUser = async (id: string, displayMode: SharpUser['displayMode']) => {
        setMessage('');
        const response = await fetch('/api/admin/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, displayMode }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setMessage(data.error_description || 'Could not update user.'); return; }
        setUsers(current => current.map(user => user.id === id ? { ...user, displayMode } : user));
        setMessage('User website display setting updated. Actual Deriv account type was not changed.');
    };
    const logout = async () => { await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); setAuthenticated(false); };

    const addBot = () => {
        if (!botXmlBase64 || !botName.trim()) { setMessage('Choose an XML bot and enter its name first.'); return; }
        const id = 'bot-' + Date.now();
        setManagedBots(current => [...current, {
            id, name: botName.trim(), description: botDescription.trim(), emoji: botEmoji || '🤖', file: botFile || botName.trim() + '.xml',
            accent: botColor, surface: botSurface, text: botText, published: true, comingSoon: false, xmlBase64: botXmlBase64,
            splash: botSplash, splashColor: botColor, splashText: botSplashText.trim() || 'SHARP MIND', updatedAt: Date.now()
        }]);
        setBotName(''); setBotDescription(''); setBotEmoji('🤖'); setBotXmlBase64(''); setBotFile('');
        setMessage('Bot added. Save & Publish to send it to Free Bot.');
    };

    const stats = useMemo(() => ({ users: users.length, bots: managedBots.length, published: managedBots.filter(b => b.published !== false).length }), [users, managedBots]);

    if (!checked) return <div style={pageStyle}><div style={loginCard}>Checking admin session…</div></div>;
    if (!authenticated) return <div style={pageStyle}><form onSubmit={login} style={loginCard}>
        <div style={logo}>SHARP</div><h1 style={titleStyle}>ADMIN CONTROL</h1><p style={muted}>Private administration panel</p>
        <label style={label}>Admin email<input style={input} type='email' value={email} onChange={e => setEmail(e.target.value)} autoComplete='username' required /></label>
        <label style={label}>Admin password<input style={input} type='password' value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' required /></label>
        <button style={primaryButton} disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN TO ADMIN'}</button>{message && <p style={error}>{message}</p>}
    </form></div>;

    const tabs = [['dashboard','DASHBOARD'],['appearance','APPEARANCE'],['bots','BOT MANAGEMENT'],['settings','SETTINGS'],['sharp','SHARP']] as const;
    return <div style={pageStyle}>
        <div style={shell}>
            <header style={topbar}><div><div style={logo}>SHARP</div><h1 style={{ margin: 0, fontSize: 22 }}>ADMIN CONTROL</h1></div><button style={ghostButton} onClick={logout}>LOG OUT</button></header>
            <nav style={tabsBar}>{tabs.map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{ ...tabButton, ...(tab === id ? activeTab : {}) }}>{label}</button>)}</nav>

            {tab === 'dashboard' && <section>
                <h2 style={heading}>DASHBOARD</h2><p style={muted}>Manage SHARP without changing the public navigation.</p>
                <div style={grid}>{[['USERS',stats.users,'#2563eb'],['FREE BOTS',stats.bots,'#7c3aed'],['PUBLISHED',stats.published,'#16a34a'],['STATUS','ONLINE','#06b6d4']].map(([label,value,color]) =>
                    <div key={String(label)} style={{ ...statCard, borderColor: String(color) }}><strong>{label}</strong><b>{value}</b></div>)}</div>
                <div style={infoCard}><b>Admin structure</b><p style={muted}>Dashboard → overview · Appearance → colors/branding · Bot Management → free bots · Settings → Deriv Client ID · SHARP → users and website-only display mapping.</p></div>
            </section>}

            {tab === 'appearance' && <form onSubmit={save}>
                <h2 style={heading}>APPEARANCE</h2><p style={muted}>Choose the public SHARP look. Changes affect the website, not the real Deriv account.</p>
                <label style={label}>Site name<input style={input} value={appearance.siteName} onChange={e => setAppearance({ ...appearance, siteName: e.target.value })} /></label>
                <div style={grid}>{[['primary','PRIMARY'],['secondary','SECONDARY'],['navBackground','NAV BACKGROUND'],['navText','NAV TEXT'],['headerBackground','HEADER'],['cardBackground','CARDS']].map(([key,label]) =>
                    <label key={key} style={colorCard}><span>{label}</span><input type='color' value={(appearance as any)[key]} onChange={e => setAppearance({ ...appearance, [key]: e.target.value })} /><code>{(appearance as any)[key]}</code></label>)}</div>
                <button style={primaryButton} disabled={busy}>{busy ? 'SAVING…' : 'SAVE APPEARANCE'}</button>
            </form>}

            {tab === 'bots' && <form onSubmit={e => { e.preventDefault(); void save(); }}>
                <h2 style={heading}>BOT MANAGEMENT</h2><p style={muted}>Each bot appears as: <b>NAME</b> → <b>LOAD</b>. Choose its card color and splash before publishing.</p>
                <div style={previewCard}><div style={{ ...previewSplash, background: botSplash ? `linear-gradient(135deg,${botColor},#071521)` : botSurface }}>{botSplash ? botSplashText : botEmoji}</div><h2 style={{ margin: '12px 0 4px' }}>{botName || 'BOT NAME'}</h2><button type='button' style={{ ...loadButton, background: botColor }}>LOAD</button></div>
                <label style={label}>Bot XML<input style={input} type='file' accept='.xml,text/xml,application/xml' onChange={e => { const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ const xml=String(reader.result||''); if(!/<xml[\\s>]/i.test(xml)&&!/<block[\\s>]/i.test(xml)){setMessage('Invalid Blockly XML file.');return;} let binary=''; new TextEncoder().encode(xml).forEach(b=>binary+=String.fromCharCode(b)); setBotXmlBase64(btoa(binary)); setBotFile(file.name); if(!botName)setBotName(file.name.replace(/\\.xml$/i,'')); setMessage('XML loaded.'); }; reader.readAsText(file); }} /></label>
                <div style={grid}><label style={label}>Bot name<input style={input} value={botName} onChange={e=>setBotName(e.target.value)} placeholder='Elisy234 Sharp' /></label><label style={label}>Description<input style={input} value={botDescription} onChange={e=>setBotDescription(e.target.value)} /></label><label style={label}>Emoji<input style={input} value={botEmoji} onChange={e=>setBotEmoji(e.target.value)} /></label></div>
                <div style={grid}><label style={label}>Card color<input type='color' value={botColor} onChange={e=>setBotColor(e.target.value)} /></label><label style={label}>Card background<input type='color' value={botSurface} onChange={e=>setBotSurface(e.target.value)} /></label><label style={label}>Text color<input type='color' value={botText} onChange={e=>setBotText(e.target.value)} /></label></div>
                <div style={colorChoiceRow}>{colorChoices.map(([name,color])=><button type='button' key={name} title={name} onClick={()=>setBotColor(color)} style={{...colorChoice,background:color}}>{name}</button>)}</div>
                <label style={checkRow}><input type='checkbox' checked={botSplash} onChange={e=>setBotSplash(e.target.checked)} /> SHOW SPLASH</label>
                {botSplash && <label style={label}>Splash text<input style={input} value={botSplashText} onChange={e=>setBotSplashText(e.target.value)} placeholder='SHARP MIND' /></label>}
                <button type='button' style={secondaryButton} onClick={addBot}>ADD BOT</button>
                <div style={{ marginTop: 18 }}>{managedBots.map(bot => <div key={bot.id} style={{ ...botRow, borderColor: bot.accent || '#2563eb' }}><span style={{ fontSize: 24 }}>{bot.emoji || '🤖'}</span><div style={{ flex: 1 }}><b>{bot.name}</b><div style={muted}>{bot.splash === false ? 'No splash' : 'Splash enabled'} · {bot.file}</div></div><button type='button' style={danger} onClick={()=>setManagedBots(current=>current.filter(x=>x.id!==bot.id))}>DELETE</button></div>)}</div>
                <button style={primaryButton} disabled={busy}>{busy ? 'SAVING…' : 'SAVE & PUBLISH BOTS'}</button>
            </form>}

            {tab === 'settings' && <form onSubmit={save}>
                <h2 style={heading}>SETTINGS</h2><p style={muted}>Server-side Deriv OAuth setting. Keep secrets out of the browser.</p>
                <label style={label}>Deriv Client ID<input style={input} value={clientId} onChange={e=>setClientId(e.target.value)} placeholder='Your Deriv Client ID' /></label>
                <div style={infoCard}><b>Account mapping defaults</b>
                    <div style={grid}><label style={label}>REAL account shows<select style={input} value={environmentMapping.realLabel} onChange={e=>setEnvironmentMapping({...environmentMapping,realLabel:e.target.value as any})}><option>REAL</option><option>DEMO</option></select></label>
                    <label style={label}>DEMO account shows<select style={input} value={environmentMapping.demoLabel} onChange={e=>setEnvironmentMapping({...environmentMapping,demoLabel:e.target.value as any})}><option>DEMO</option><option>REAL</option></select></label></div>
                    <p style={muted}>These are defaults only. Per-user SHARP settings override them. They never change Deriv account status.</p>
                </div>
                <button style={primaryButton} disabled={busy}>{busy ? 'SAVING…' : 'SAVE SETTINGS'}</button>
            </form>}

            {tab === 'sharp' && <section>
                <h2 style={heading}>SHARP · USERS</h2><p style={muted}>Only users who have authenticated with a Deriv login ID are listed here. Select one user and choose how that user’s account label appears <b>on SHARP only</b>.</p>
                {users.length === 0 ? <div style={infoCard}><b>NO USERS YET</b><p style={muted}>A user will appear after signing in to SHARP with Deriv.</p></div> :
                <div style={userGrid}>{users.map(user => <div key={user.id} style={userCard}>
                    <div style={{ display:'flex',justifyContent:'space-between',gap:8 }}><b>{user.loginid}</b><span style={{...pill,background:user.accountType==='REAL'?'#16a34a':'#2563eb'}}>{user.accountType}</span></div>
                    <small style={muted}>Last seen: {new Date(user.lastSeen).toLocaleString()}</small>
                    <label style={label}>SHARP website display<select style={input} value={user.displayMode} onChange={e=>void updateUser(user.id,e.target.value as SharpUser['displayMode'])}>
                        <option value='AUTO'>AUTO · show actual</option><option value='REAL'>FORCE REAL · website only</option><option value='DEMO'>FORCE DEMO · website only</option>
                    </select></label>
                    <p style={muted}>Deriv remains <b>{user.accountType}</b>. This setting changes only the label shown by SHARP.</p>
                </div>)}</div>}
                {message && <p style={success}>{message}</p>}
            </section>}
            {message && tab !== 'sharp' && <p style={success}>{message}</p>}
        </div>
    </div>;
};

const pageStyle: CSSProperties = { minHeight:'100vh', padding:16, boxSizing:'border-box', background:'radial-gradient(circle at top,#10263a,#050b12 55%)', color:'#fff', fontFamily:'Arial,sans-serif' };
const shell: CSSProperties = { maxWidth:1180, margin:'0 auto', background:'rgba(7,21,33,.94)', border:'1px solid rgba(255,255,255,.1)', borderRadius:22, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.45)' };
const topbar: CSSProperties = { display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,padding:18,background:'linear-gradient(90deg,#071521,#0c263c)' };
const tabsBar: CSSProperties = { display:'flex',gap:6,padding:10,overflowX:'auto',background:'#06111c',borderBottom:'1px solid rgba(255,255,255,.1)' };
const tabButton: CSSProperties = { flex:'0 0 auto',padding:'11px 15px',border:0,borderRadius:10,background:'transparent',color:'#9fb0c0',fontWeight:800,cursor:'pointer' };
const activeTab: CSSProperties = { background:'#2563eb',color:'#fff',boxShadow:'0 8px 22px rgba(37,99,235,.3)' };
const loginCard: CSSProperties = { maxWidth:440,margin:'70px auto',padding:28,borderRadius:22,background:'#091a2b',border:'1px solid rgba(255,255,255,.12)',boxShadow:'0 24px 70px rgba(0,0,0,.4)' };
const logo: CSSProperties = { color:'#60a5fa',fontWeight:900,letterSpacing:2,fontSize:13,marginBottom:6 };
const titleStyle: CSSProperties = { margin:'0 0 6px',fontSize:26 };
const heading: CSSProperties = { fontSize:20,margin:'0 0 8px' };
const muted: CSSProperties = { color:'#9fb0c0',fontSize:13,lineHeight:1.5 };
const label: CSSProperties = { display:'flex',flexDirection:'column',gap:7,margin:'12px 0',fontSize:13,color:'#dce7ef' };
const input: CSSProperties = { width:'100%',boxSizing:'border-box',padding:'11px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,.14)',background:'#04101b',color:'#fff' };
const primaryButton: CSSProperties = { width:'100%',marginTop:16,padding:'13px 16px',border:0,borderRadius:11,background:'linear-gradient(135deg,#2563eb,#06b6d4)',color:'#fff',fontWeight:900,cursor:'pointer' };
const secondaryButton: CSSProperties = { padding:'12px 16px',border:0,borderRadius:11,background:'#16a34a',color:'#fff',fontWeight:900,cursor:'pointer' };
const ghostButton: CSSProperties = { padding:'10px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,.16)',background:'#10283c',color:'#fff',fontWeight:800 };
const grid: CSSProperties = { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,margin:'16px 0' };
const statCard: CSSProperties = { padding:18,borderRadius:16,background:'#091a2b',border:'1px solid',display:'flex',flexDirection:'column',gap:8 };
const infoCard: CSSProperties = { marginTop:16,padding:16,borderRadius:16,background:'#061522',border:'1px solid rgba(255,255,255,.1)' };
const colorCard: CSSProperties = { padding:14,borderRadius:14,background:'#061522',border:'1px solid rgba(255,255,255,.1)',display:'flex',flexDirection:'column',gap:8 };
const colorChoiceRow: CSSProperties = { display:'flex',gap:7,flexWrap:'wrap',margin:'10px 0' };
const colorChoice: CSSProperties = { border:0,borderRadius:999,padding:'7px 10px',color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer' };
const checkRow: CSSProperties = { display:'flex',gap:8,alignItems:'center',margin:'14px 0',fontWeight:800 };
const previewCard: CSSProperties = { maxWidth:330,padding:14,borderRadius:18,background:'#061522',border:'1px solid rgba(255,255,255,.1)',margin:'16px 0' };
const previewSplash: CSSProperties = { minHeight:90,borderRadius:14,display:'grid',placeItems:'center',fontWeight:900,fontSize:20 };
const loadButton: CSSProperties = { border:0,borderRadius:9,padding:'10px 18px',color:'#fff',fontWeight:900 };
const botRow: CSSProperties = { display:'flex',alignItems:'center',gap:10,padding:12,borderRadius:14,background:'#061522',border:'1px solid',marginBottom:8 };
const danger: CSSProperties = { border:0,borderRadius:8,padding:'8px 10px',background:'#b91c1c',color:'#fff',fontWeight:800 };
const userGrid: CSSProperties = { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginTop:16 };
const userCard: CSSProperties = { padding:16,borderRadius:16,background:'#091a2b',border:'1px solid rgba(255,255,255,.12)' };
const pill: CSSProperties = { padding:'4px 8px',borderRadius:999,color:'#fff',fontSize:11,fontWeight:900 };
const success: CSSProperties = { color:'#8ff0cf',marginTop:14 };
const error: CSSProperties = { color:'#ff9b9b' };

export default AdminPage;
