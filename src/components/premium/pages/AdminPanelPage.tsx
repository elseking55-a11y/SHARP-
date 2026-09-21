import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    readManagedBots,
    removeManagedBot,
    upsertManagedBot,
    type ManagedBot,
} from '@/utils/managed-bot-library';

type AdminForm = {
    name: string;
    description: string;
    emoji: string;
    badge: string;
    category: string;
    accent: string;
    surface: string;
    text: string;
    priority: string;
    imageUrl: string;
    videoUrl: string;
};

const defaultForm: AdminForm = {
    name: '',
    description: '',
    emoji: '🤖',
    badge: 'FREE BOT',
    category: 'Free Bots',
    accent: '#20b98d',
    surface: '#0d2135',
    text: '#ffffff',
    priority: '1',
    imageUrl: '',
    videoUrl: '',
};

const ADMIN_SESSION_KEY = 'sharp_local_admin_session_v1';
const ADMIN_PIN_HASH_KEY = 'sharp_local_admin_pin_v1';

const hashPin = async (pin: string) => {
    if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(pin);
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
    }
    return btoa(pin);
};

const AdminPanelPage = () => {
    const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === '1');
    const [hasPin, setHasPin] = useState(false);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [bots, setBots] = useState<ManagedBot[]>([]);
    const [form, setForm] = useState(defaultForm);
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const refreshBots = () => setBots(readManagedBots());

    useEffect(() => {
        setHasPin(Boolean(localStorage.getItem(ADMIN_PIN_HASH_KEY)));
        refreshBots();

        const refresh = () => refreshBots();
        window.addEventListener('sharp-managed-bots-updated', refresh);
        return () => window.removeEventListener('sharp-managed-bots-updated', refresh);
    }, []);

    const authenticate = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');

        try {
            if (!hasPin) {
                if (pin.length < 6) throw new Error('Create an admin PIN with at least 6 characters.');
                if (pin !== confirmPin) throw new Error('The PIN confirmation does not match.');
                localStorage.setItem(ADMIN_PIN_HASH_KEY, await hashPin(pin));
                setHasPin(true);
                sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
                setAuthenticated(true);
                setPin('');
                setConfirmPin('');
                setMessage('Admin PIN created on this device.');
                return;
            }

            const savedHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);
            if (!savedHash || savedHash !== await hashPin(pin)) throw new Error('Incorrect admin PIN.');
            sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
            setAuthenticated(true);
            setPin('');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const logout = () => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAuthenticated(false);
        setPin('');
    };

    const resetForm = () => {
        setForm(defaultForm);
        setXmlFile(null);
        setEditingId('');
        setMessage('');
        setError('');
    };

    const editBot = (bot: ManagedBot) => {
        setEditingId(bot.id);
        setForm({
            name: bot.name || '',
            description: bot.description || '',
            emoji: bot.emoji || '🤖',
            badge: bot.badge || 'FREE BOT',
            category: bot.category || 'Free Bots',
            accent: bot.accent || '#20b98d',
            surface: bot.surface || '#0d2135',
            text: bot.text || '#ffffff',
            priority: String(bot.priority ?? 1),
            imageUrl: bot.imageUrl || '',
            videoUrl: bot.videoUrl || '',
        });
        setMessage('Editing bot. Select a new XML only if you want to replace its file.');
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const saveBot = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.name.trim()) {
            setError('Enter a bot name.');
            return;
        }
        if (!editingId && !xmlFile) {
            setError('Choose the bot XML file.');
            return;
        }

        setBusy(true);
        setError('');
        setMessage('');

        try {
            let xmlBase64 = editingId ? readManagedBots().find(bot => bot.id === editingId)?.xmlBase64 || '' : '';
            if (xmlFile) {
                if (xmlFile.size > 5 * 1024 * 1024) throw new Error('XML file is larger than 5 MB.');
                const raw = await xmlFile.arrayBuffer();
                const bytes = new Uint8Array(raw);
                let binary = '';
                for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
                }
                xmlBase64 = btoa(binary);
            }

            const id = editingId || `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            upsertManagedBot({
                id,
                name: form.name.trim(),
                description: form.description.trim(),
                emoji: form.emoji || '🤖',
                badge: form.badge || 'FREE BOT',
                category: form.category || 'Free Bots',
                accent: form.accent,
                surface: form.surface,
                text: form.text,
                priority: Math.max(1, Number(form.priority) || 1),
                imageUrl: form.imageUrl.trim(),
                videoUrl: form.videoUrl.trim(),
                file: xmlFile?.name || readManagedBots().find(bot => bot.id === editingId)?.file || `${id}.xml`,
                xmlBase64,
                updatedAt: Date.now(),
            });

            resetForm();
            refreshBots();
            setMessage('Bot saved. It is now available in this browser without editing code.');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const deleteBot = (bot: ManagedBot) => {
        if (!window.confirm(`Delete "${bot.name}" from this device's bot library?`)) return;
        removeManagedBot(bot.id);
        if (editingId === bot.id) resetForm();
        refreshBots();
        setMessage('Bot deleted.');
    };

    if (!authenticated) {
        return (
            <div className='prodb-admin-page'>
                <section className='prodb-admin-login'>
                    <div className='prodb-admin-logo'>🛡️</div>
                    <span>ELISY254 SHARP • LOCAL CONTROL</span>
                    <h1>{hasPin ? 'Admin Panel' : 'Create Admin PIN'}</h1>
                    <p>
                        {hasPin
                            ? 'Enter your local admin PIN to manage bots and their appearance.'
                            : 'This no-server admin stores its bot library on this device. Create a PIN to protect the local panel.'}
                    </p>
                    <div className='prodb-admin-warning'>
                        Local mode does not provide server-side security or cross-device publishing. It is designed for your current device while live backend publishing is disabled.
                    </div>
                    {error && <div className='prodb-admin-error'>{error}</div>}
                    {message && <div className='prodb-admin-success'>{message}</div>}
                    <form onSubmit={authenticate}>
                        <label>Admin PIN<input type='password' inputMode='numeric' value={pin} onChange={e => setPin(e.target.value)} autoComplete='current-password' minLength={6} required /></label>
                        {!hasPin && (
                            <label>Confirm PIN<input type='password' inputMode='numeric' value={confirmPin} onChange={e => setConfirmPin(e.target.value)} autoComplete='new-password' minLength={6} required /></label>
                        )}
                        <button type='submit' disabled={busy}>{busy ? 'OPENING…' : hasPin ? 'OPEN ADMIN PANEL' : 'CREATE ADMIN PIN'}</button>
                    </form>
                </section>
            </div>
        );
    }

    return (
        <div className='prodb-admin-page'>
            <header className='prodb-admin-head'>
                <div>
                    <span>ELISY254 SHARP • CONTROL CENTRE</span>
                    <h1>Admin Panel</h1>
                    <p>Add bots, XML files, preview links and card colours without opening code.</p>
                </div>
                <button type='button' onClick={logout}>LOCK PANEL</button>
            </header>

            {error && <div className='prodb-admin-error'>{error}</div>}
            {message && <div className='prodb-admin-success'>{message}</div>}

            <div className='prodb-admin-layout'>
                <form className='prodb-admin-card prodb-admin-form' onSubmit={saveBot}>
                    <div className='prodb-admin-card-head'>
                        <div><span>BOT MANAGER</span><h2>{editingId ? 'Edit bot' : 'Add new bot'}</h2></div>
                        <button type='button' onClick={resetForm}>CLEAR</button>
                    </div>

                    <label>Bot name<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder='e.g. Gold Fast Bot' required /></label>
                    <label>Description<textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder='Short description shown on the card.' rows={3} /></label>

                    <div className='prodb-admin-fields'>
                        <label>Icon / emoji<input value={form.emoji} onChange={e => setForm({...form, emoji:e.target.value})} maxLength={4} /></label>
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

                    <label>Bot XML {editingId && <small>(optional when editing)</small>}<input type='file' accept='.xml,text/xml,application/xml' onChange={e => setXmlFile(e.target.files?.[0] || null)} /></label>
                    <label>Preview image URL <input value={form.imageUrl} onChange={e => setForm({...form, imageUrl:e.target.value})} placeholder='https://...' /></label>
                    <label>Preview video URL <input value={form.videoUrl} onChange={e => setForm({...form, videoUrl:e.target.value})} placeholder='https://...' /></label>

                    <div className='prodb-admin-preview' style={{'--admin-accent':form.accent,'--admin-surface':form.surface,'--admin-text':form.text} as CSSProperties}>
                        <span>{form.emoji || '🤖'}</span>
                        <div><small>{form.badge || 'FREE BOT'}</small><strong>{form.name || 'Your bot name'}</strong><em>{form.description || 'Your bot description'}</em></div>
                    </div>

                    <button className='prodb-admin-save' type='submit' disabled={busy}>{busy ? 'SAVING…' : editingId ? 'SAVE BOT CHANGES' : 'ADD BOT TO LIBRARY'}</button>
                </form>

                <section className='prodb-admin-card'>
                    <div className='prodb-admin-card-head'>
                        <div><span>LOCAL LIBRARY</span><h2>{bots.length} bots</h2></div>
                        <button type='button' onClick={refreshBots}>↻ REFRESH</button>
                    </div>

                    <div className='prodb-admin-list'>
                        {bots.map(bot => (
                            <article key={bot.id} className='prodb-admin-bot' style={{'--admin-accent':bot.accent || '#20b98d','--admin-surface':bot.surface || '#0d2135','--admin-text':bot.text || '#fff'} as CSSProperties}>
                                {bot.imageUrl ? <img src={bot.imageUrl} alt='' /> : <span>{bot.emoji || '🤖'}</span>}
                                <div><strong>{bot.name}</strong><small>{bot.category || 'Free Bots'} • {bot.file}</small></div>
                                <div className='prodb-admin-bot-actions'>
                                    <button type='button' onClick={() => editBot(bot)}>EDIT</button>
                                    <button type='button' className='danger' onClick={() => deleteBot(bot)}>DELETE</button>
                                </div>
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
