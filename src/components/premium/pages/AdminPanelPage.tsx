import { useEffect, useState } from 'react';

type AdminBot = {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
    badge?: string;
    category?: string;
    accent?: string;
    surface?: string;
    text?: string;
    file: string;
    priority?: number;
};

const defaultForm = {
    name: '',
    description: '',
    emoji: '🤖',
    badge: 'SPECIAL BOT',
    category: 'Free Bots',
    accent: '#20b98d',
    surface: '#0d2135',
    text: '#ffffff',
    priority: '1',
};

const AdminPanelPage = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [configured, setConfigured] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [bots, setBots] = useState<AdminBot[]>([]);
    const [form, setForm] = useState(defaultForm);
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadBots = async () => {
        const response = await fetch('/api/admin/bots', { cache: 'no-store' });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Unable to load bot library.');
        const payload = await response.json();
        setBots(Array.isArray(payload.bots) ? payload.bots : []);
    };

    useEffect(() => {
        fetch('/api/admin/session', { cache: 'no-store' })
            .then(response => response.json())
            .then(data => {
                setAuthenticated(Boolean(data.authenticated));
                setConfigured(Boolean(data.configured));
                if (data.authenticated) void loadBots().catch(err => setError(err.message));
            })
            .catch(() => setError('Admin service is unavailable.'));
    }, []);

    const login = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.error || 'Admin login failed.');
            setAuthenticated(true);
            setPassword('');
            await loadBots();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally { setBusy(false); }
    };

    const logout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
        setAuthenticated(false);
        setBots([]);
    };

    const resetForm = () => {
        setForm(defaultForm);
        setXmlFile(null);
        setEditingId('');
        setMessage('');
        setError('');
    };

    const editBot = (bot: AdminBot) => {
        setEditingId(bot.id);
        setForm({
            name: bot.name || '',
            description: bot.description || '',
            emoji: bot.emoji || '🤖',
            badge: bot.badge || 'SPECIAL BOT',
            category: bot.category || 'Free Bots',
            accent: bot.accent || '#20b98d',
            surface: bot.surface || '#0d2135',
            text: bot.text || '#ffffff',
            priority: String(bot.priority ?? 1),
        });
        setMessage('Choose a new XML only if you want to replace the bot file.');
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const saveBot = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.name.trim()) return setError('Enter a bot name.');
        if (!editingId && !xmlFile) return setError('Choose the bot XML file.');
        setBusy(true); setError(''); setMessage('');
        try {
            let xmlBase64 = '';
            if (xmlFile) {
                const raw = await xmlFile.arrayBuffer();
                if (raw.byteLength > 5 * 1024 * 1024) throw new Error('XML file is larger than 5 MB.');
                xmlBase64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
            }
            const response = await fetch('/api/admin/bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId || undefined,
                    ...form,
                    priority: Number(form.priority),
                    fileName: xmlFile?.name,
                    xmlBase64,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.error || 'Could not save bot.');
            setMessage('Bot saved. GitHub was updated; Render will publish the new library on its next deploy.');
            resetForm();
            setMessage('Bot saved. GitHub was updated; Render will publish the new library on its next deploy.');
            await loadBots();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally { setBusy(false); }
    };

    const deleteBot = async (bot: AdminBot) => {
        if (!window.confirm(`Delete "${bot.name}" from the bot library?`)) return;
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch(`/api/admin/bots/${encodeURIComponent(bot.id)}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.error || 'Could not delete bot.');
            setMessage('Bot deleted.');
            if (editingId === bot.id) resetForm();
            await loadBots();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally { setBusy(false); }
    };

    if (!authenticated) {
        return (
            <div className='prodb-admin-page'>
                <section className='prodb-admin-login'>
                    <div className='prodb-admin-logo'>🛡️</div>
                    <span>ELISY254 SHARP</span>
                    <h1>Admin Panel</h1>
                    <p>Manage bots, colours, badges and the public bot library without editing code.</p>
                    {!configured && <div className='prodb-admin-warning'>Admin storage is not configured yet. Add ADMIN_EMAIL, ADMIN_PASSWORD and GITHUB_TOKEN on Render.</div>}
                    {error && <div className='prodb-admin-error'>{error}</div>}
                    <form onSubmit={login}>
                        <label>Email<input type='email' value={email} onChange={e => setEmail(e.target.value)} autoComplete='username' required /></label>
                        <label>Password<input type='password' value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' required /></label>
                        <button type='submit' disabled={busy}>{busy ? 'CONNECTING…' : 'OPEN ADMIN PANEL'}</button>
                    </form>
                </section>
            </div>
        );
    }

    return (
        <div className='prodb-admin-page'>
            <header className='prodb-admin-head'>
                <div><span>ELISY254 SHARP • CONTROL CENTRE</span><h1>Admin Panel</h1><p>Add and style bots without opening GitHub code.</p></div>
                <button type='button' onClick={logout}>LOG OUT</button>
            </header>

            {error && <div className='prodb-admin-error'>{error}</div>}
            {message && <div className='prodb-admin-success'>{message}</div>}

            <div className='prodb-admin-layout'>
                <form className='prodb-admin-card prodb-admin-form' onSubmit={saveBot}>
                    <div className='prodb-admin-card-head'><div><span>BOT MANAGER</span><h2>{editingId ? 'Edit bot' : 'Add new bot'}</h2></div><button type='button' onClick={resetForm}>CLEAR</button></div>
                    <label>Bot name<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder='e.g. Gold Fast Bot' required /></label>
                    <label>Description<textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder='Short description shown on the card.' rows={3} /></label>
                    <div className='prodb-admin-fields'>
                        <label>Emoji<input value={form.emoji} onChange={e => setForm({...form, emoji:e.target.value})} maxLength={4} /></label>
                        <label>Badge<input value={form.badge} onChange={e => setForm({...form, badge:e.target.value})} /></label>
                    </div>
                    <div className='prodb-admin-fields'>
                        <label>Category<input value={form.category} onChange={e => setForm({...form, category:e.target.value})} /></label>
                        <label>Order<input type='number' min='1' value={form.priority} onChange={e => setForm({...form, priority:e.target.value})} /></label>
                    </div>
                    <div className='prodb-admin-colours'>
                        <label>Accent<input type='color' value={form.accent} onChange={e => setForm({...form, accent:e.target.value})} /></label>
                        <label>Card colour<input type='color' value={form.surface} onChange={e => setForm({...form, surface:e.target.value})} /></label>
                        <label>Text colour<input type='color' value={form.text} onChange={e => setForm({...form, text:e.target.value})} /></label>
                    </div>
                    <label className='prodb-admin-file'>Bot XML {editingId && <small>(optional when editing)</small>}<input type='file' accept='.xml,text/xml,application/xml' onChange={e => setXmlFile(e.target.files?.[0] || null)} /></label>
                    <div className='prodb-admin-preview' style={{'--admin-accent':form.accent,'--admin-surface':form.surface,'--admin-text':form.text} as React.CSSProperties}>
                        <span>{form.emoji || '🤖'}</span><div><small>{form.badge || 'SPECIAL BOT'}</small><strong>{form.name || 'Your bot name'}</strong><em>{form.description || 'Your bot description'}</em></div>
                    </div>
                    <button className='prodb-admin-save' type='submit' disabled={busy}>{busy ? 'SAVING…' : editingId ? 'SAVE BOT CHANGES' : 'ADD BOT TO LIBRARY'}</button>
                </form>

                <section className='prodb-admin-card'>
                    <div className='prodb-admin-card-head'><div><span>LIVE LIBRARY</span><h2>{bots.length} bots</h2></div><button type='button' onClick={() => loadBots()}>↻ REFRESH</button></div>
                    <div className='prodb-admin-list'>
                        {bots.map(bot => (
                            <article key={bot.id} className='prodb-admin-bot' style={{'--admin-accent':bot.accent || '#20b98d','--admin-surface':bot.surface || '#0d2135','--admin-text':bot.text || '#fff'} as React.CSSProperties}>
                                <span>{bot.emoji || '🤖'}</span><div><strong>{bot.name}</strong><small>{bot.category || 'Free Bots'} • {bot.file}</small></div>
                                <div className='prodb-admin-bot-actions'><button type='button' onClick={() => editBot(bot)}>EDIT</button><button type='button' className='danger' onClick={() => deleteBot(bot)}>DELETE</button></div>
                            </article>
                        ))}
                        {!bots.length && <div className='prodb-admin-empty'>No bots yet. Upload your first XML above.</div>}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminPanelPage;
