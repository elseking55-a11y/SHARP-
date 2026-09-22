import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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
    imageBase64: string;
    published: boolean;
    comingSoon: boolean;
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
    imageBase64: '',
    published: true,
    comingSoon: false,
};

const ADMIN_SESSION_KEY = 'sharp_local_admin_session_v1';
const ADMIN_PIN_HASH_KEY = 'sharp_local_admin_pin_v1';

// Admin-only visual rule: this configured OAuth Client ID enables the REAL badge.
// It does NOT change the Deriv/API account type, loginid, balance, or trading mode.
const ADMIN_REAL_DISPLAY_CLIENT_ID = '019e9805-8d85-70f2-ba17-112d31bf66e3';
const configuredDerivClientId = String(import.meta.env.VITE_DERIV_CLIENT_ID || '').trim();
const clientIdMatchedForAdminDisplay = configuredDerivClientId === ADMIN_REAL_DISPLAY_CLIENT_ID;
const ADMIN_REAL_FLAG_ENABLED_KEY = 'sharp_admin_real_flag_enabled_v1';
const ADMIN_REAL_FLAG_CLIENT_ID_KEY = 'sharp_admin_real_flag_client_id_v1';

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
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    // Admin-only display override. This never changes the actual Deriv account type.
    const [adminAccountBadge, setAdminAccountBadge] = useState<'REAL' | 'DEMO' | 'ACTUAL'>(() => {
        const saved = localStorage.getItem('sharp_admin_account_badge_v1');
        return saved === 'REAL' || saved === 'DEMO' || saved === 'ACTUAL' ? saved : 'ACTUAL';
    });
    const [realFlagEnabled, setRealFlagEnabled] = useState(() => localStorage.getItem(ADMIN_REAL_FLAG_ENABLED_KEY) === '1');
    const [realFlagClientId, setRealFlagClientId] = useState(() => localStorage.getItem(ADMIN_REAL_FLAG_CLIENT_ID_KEY) || configuredDerivClientId);
    const [appearance, setAppearance] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem('sharp_admin_appearance_v1') || '{}'); } catch { return {}; }
    });

    const refreshBots = () => setBots(readManagedBots());

    const saveRealFlagSettings = (enabled: boolean, clientId: string) => {
        const cleanClientId = clientId.trim();
        localStorage.setItem(ADMIN_REAL_FLAG_ENABLED_KEY, enabled ? '1' : '0');
        localStorage.setItem(ADMIN_REAL_FLAG_CLIENT_ID_KEY, cleanClientId);
        setRealFlagEnabled(enabled);
        setRealFlagClientId(cleanClientId);
        window.dispatchEvent(new Event('sharp-admin-real-flag-updated'));
        setMessage(enabled ? 'Admin REAL flag switched ON.' : 'Admin REAL flag switched OFF.');
    };

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
        setImageFile(null);
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
            imageBase64: bot.imageBase64 || '',
            published: bot.published !== false,
            comingSoon: Boolean(bot.comingSoon),
        });
        setMessage('Editing bot. Select a new XML only if you want to replace its file.');
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const saveBot = async (event: FormEvent) => {
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
            const existingBot = editingId ? readManagedBots().find(bot => bot.id === editingId) : undefined;
            let xmlBase64 = existingBot?.xmlBase64 || '';
            let imageBase64 = existingBot?.imageBase64 || form.imageBase64 || '';

            if (imageFile) {
                if (!imageFile.type.startsWith('image/')) throw new Error('Please choose an image file.');
                if (imageFile.size > 2 * 1024 * 1024) throw new Error('Bot image must be 2 MB or smaller.');
                imageBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('Could not read the bot image.'));
                    reader.readAsDataURL(imageFile);
                });
            }

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
                imageBase64,
                videoUrl: form.videoUrl.trim(),
                published: form.published,
                comingSoon: form.comingSoon,
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

    const togglePublished = (bot: ManagedBot) => {
        upsertManagedBot({ ...bot, published: bot.published === false });
        refreshBots();
        setMessage(`${bot.name} is now ${bot.published === false ? 'published' : 'unpublished'}.`);
    };

    const downloadBot = (bot: ManagedBot) => {
        try {
            const binary = atob(bot.xmlBase64);
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = bot.file || `${bot.name}.xml`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('This bot file could not be downloaded. Replace its XML file from Bot Files.');
        }
    };

    const saveAccountBadge = (value: 'REAL' | 'DEMO' | 'ACTUAL') => {
        setAdminAccountBadge(value);
        localStorage.setItem('sharp_admin_account_badge_v1', value);
        // Keep the visual choice persistent. Client-ID detection reveals Admin;
        // it must never silently overwrite the choice made here.
        localStorage.setItem(ADMIN_REAL_FLAG_ENABLED_KEY, value === 'REAL' ? '1' : '0');
        localStorage.setItem(ADMIN_REAL_FLAG_CLIENT_ID_KEY, configuredDerivClientId || ADMIN_REAL_DISPLAY_CLIENT_ID);
        window.dispatchEvent(new Event('sharp-admin-real-flag-updated'));
        setRealFlagEnabled(value === 'REAL');
        setRealFlagClientId(configuredDerivClientId || ADMIN_REAL_DISPLAY_CLIENT_ID);
        setMessage(value === 'REAL'
            ? 'Admin display set to REAL and locked until you change it here.'
            : value === 'DEMO'
                ? 'Admin display set to DEMO and locked until you change it here.'
                : 'Account display override switched OFF. Actual Deriv account type is shown.');
    };

    const saveAppearance = (key: string, value: string) => {
        const next = { ...appearance, [key]: value };
        setAppearance(next);
        localStorage.setItem('sharp_admin_appearance_v1', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('sharp-admin-appearance-updated'));
        setMessage('');
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

const adminMenu = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'bot_management', icon: '🤖', label: 'Bot Management' },
        { id: 'bot_files', icon: '📁', label: 'Bot Files' },
        { id: 'appearance', icon: '🎨', label: 'App Appearance' },
        { id: 'account_status', icon: '🟢', label: 'Account Display' },
        { id: 'users', icon: '👥', label: 'Users' },
        { id: 'trading', icon: '📈', label: 'Trading Activity' },
        { id: 'content', icon: '📢', label: 'Tutorials / Content' },
        { id: 'settings', icon: '⚙️', label: 'System Settings' },
    ];

    const renderAdminPanel = () => {
        if (activeTab === 'bot_management' || activeTab === 'bot_files') {
            return             <div className='prodb-admin-layout'>
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

                    <div className='prodb-admin-fields'>
                        <label>Publishing status
                            <select value={form.published ? 'published' : 'unpublished'} onChange={e => setForm({...form, published:e.target.value === 'published'})}>
                                <option value='published'>Published</option>
                                <option value='unpublished'>Unpublished</option>
                            </select>
                        </label>
                        <label>Bot release
                            <select value={form.comingSoon ? 'coming_soon' : 'available'} onChange={e => setForm({...form, comingSoon:e.target.value === 'coming_soon'})}>
                                <option value='available'>Available / Free Bot</option>
                                <option value='coming_soon'>Coming Soon</option>
                            </select>
                        </label>
                    </div>

                    <label>Bot XML {editingId && <small>(optional when editing)</small>}<input type='file' accept='.xml,text/xml,application/xml' onChange={e => setXmlFile(e.target.files?.[0] || null)} /></label>
                    <div className='prodb-admin-media-box'>
                        <label>Bot image <input type='file' accept='image/png,image/jpeg,image/webp,image/gif' onChange={e => setImageFile(e.target.files?.[0] || null)} /></label>
                        <small>Upload the image directly from your phone. No image URL is required. Maximum 2 MB.</small>
                        {(imageFile || form.imageBase64) && <div className='prodb-admin-media-preview'><img src={imageFile ? URL.createObjectURL(imageFile) : form.imageBase64} alt='Bot preview' /></div>}
                    </div>
                    <label>Image URL <span className='prodb-admin-optional'>(optional fallback)</span><input value={form.imageUrl} onChange={e => setForm({...form, imageUrl:e.target.value})} placeholder='Optional: https://...' /></label>
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
                                    <button type='button' onClick={() => togglePublished(bot)}>{bot.published === false ? 'PUBLISH' : 'UNPUBLISH'}</button>
                                    <button type='button' onClick={() => downloadBot(bot)}>DOWNLOAD</button>
                                    <button type='button' className='danger' onClick={() => deleteBot(bot)}>DELETE</button>
                                </div>
                            </article>
                        ))}
                        {!bots.length && <div className='prodb-admin-empty'>No bots yet. Upload your first XML above.</div>}
                    </div>
                </section>
            </div>
        }

        if (activeTab === 'dashboard') {
            const published = bots.filter(bot => bot.published !== false && !bot.comingSoon).length;
            const comingSoon = bots.filter(bot => bot.comingSoon).length;
            return (
                <section className='prodb-admin-dashboard-grid'>
                    <article className='prodb-admin-stat'><span>🤖 TOTAL BOTS</span><strong>{bots.length}</strong><small>Managed bot files</small></article>
                    <article className='prodb-admin-stat'><span>🟢 PUBLISHED</span><strong>{published}</strong><small>Visible as available bots</small></article>
                    <article className='prodb-admin-stat'><span>🕐 COMING SOON</span><strong>{comingSoon}</strong><small>Prepared for release</small></article>
                    <article className='prodb-admin-stat'><span>🔒 MODE</span><strong>LOCAL</strong><small>Live server publishing is disabled</small></article>
                    <section className='prodb-admin-wide-card'>
                        <span>QUICK ACTIONS</span><h2>Manage your app</h2>
                        <div className='prodb-admin-quick-grid'>
                            <button onClick={() => { setActiveTab('bot_management'); resetForm(); }}>＋ Add Bot</button>
                            <button onClick={() => setActiveTab('bot_files')}>📁 Bot Files</button>
                            <button onClick={() => setActiveTab('appearance')}>🎨 Appearance</button>
                            <button onClick={() => setActiveTab('content')}>📢 Content</button>
                        </div>
                    </section>
                </section>
            );
        }

        if (activeTab === 'account_status') {
            return (
                <section className='prodb-admin-wide-card'>
                    <span>ADMIN ACCOUNT DISPLAY</span>
                    <h2>Account badge</h2>
                    <p className='prodb-admin-section-copy'>
                        {clientIdMatchedForAdminDisplay
                            ? 'Configured sign-in Client ID detected. REAL is shown only inside this Admin Panel.'
                            : 'No matching sign-in Client ID detected. The Deriv/API account type is not changed by this display setting.'}
                    </p>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        alignItems: 'center',
                        marginTop: '20px',
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 18px',
                            borderRadius: '14px',
                            background: '#0b241d',
                            border: '1px solid #20b98d',
                            color: '#20b98d',
                            fontWeight: 800,
                            letterSpacing: '.08em',
                        }}>
                            <span style={{ fontSize: '20px' }}>🟢</span>
                            {adminAccountBadge}
                        </div>

                        <label>
                            Admin badge
                            <select
                                value={adminAccountBadge}
                                onChange={e => saveAccountBadge(e.target.value as 'REAL' | 'DEMO' | 'ACTUAL')}
                            >
                                <option value='REAL'>REAL LOOK</option>
                                <option value='DEMO'>DEMO LOOK</option>
                                <option value='ACTUAL'>OFF — ACTUAL ACCOUNT</option>
                            </select>
                        </label>
                    </div>

                    <div style={{
                        marginTop: '18px',
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,.04)',
                        border: '1px solid rgba(255,255,255,.08)',
                    }}>
                        <strong>REAL FLAG TEST / DEBUG</strong>
                        <div style={{display:'grid',gap:'12px',marginTop:'12px'}}>
                            <label style={{display:'grid',gap:'6px'}}>
                                Sign-in Client ID
                                <input
                                    value={realFlagClientId}
                                    onChange={e => setRealFlagClientId(e.target.value)}
                                    placeholder='Paste Client ID'
                                    style={{minWidth:'260px'}}
                                />
                            </label>
                            <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                                <button type='button' onClick={() => saveAccountBadge('REAL')}>🟢 REAL LOOK ON</button>
                                <button type='button' onClick={() => saveAccountBadge('DEMO')}>🔵 DEMO LOOK ON</button>
                                <button type='button' onClick={() => saveAccountBadge('ACTUAL')}>⚪ OVERRIDE OFF</button>
                            </div>
                            <div style={{fontSize:'13px',lineHeight:1.6}}>
                                <div>Configured VITE Client ID: <strong>{configuredDerivClientId || 'NOT SET'}</strong></div>
                                <div>Admin Client ID: <strong>{realFlagClientId || 'NOT SET'}</strong></div>
                                <div>Exact match: <strong>{realFlagClientId.trim() === ADMIN_REAL_DISPLAY_CLIENT_ID ? 'YES' : 'NO'}</strong></div>
                                <div>Display mode: <strong>{adminAccountBadge === 'ACTUAL' ? 'OFF — ACTUAL' : adminAccountBadge}</strong></div>
                            </div>
                        </div>
                        <small style={{display:'block',marginTop:'12px'}}>Client ID detection reveals this Admin control. The REAL/DEMO display choice stays unchanged until you change it here. OFF restores the actual Deriv account type. Deriv/API account_type remains the actual account type.</small>
                    </div>
                </section>
            );
        }

        if (activeTab === 'appearance') {
            return (
                <section className='prodb-admin-wide-card'>
                    <span>APP APPEARANCE</span><h2>Colours, buttons & dashboard cards</h2>
                    <div className='prodb-admin-appearance-grid'>
                        <label>Primary colour<input type='color' value={appearance.primary || '#20b98d'} onChange={e => saveAppearance('primary',e.target.value)} /></label>
                        <label>Accent colour<input type='color' value={appearance.accent || '#1878df'} onChange={e => saveAppearance('accent',e.target.value)} /></label>
                        <label>Card colour<input type='color' value={appearance.card || '#0d2137'} onChange={e => saveAppearance('card',e.target.value)} /></label>
                        <label>Button colour<input type='color' value={appearance.button || appearance.primary || '#20b98d'} onChange={e => saveAppearance('button',e.target.value)} /></label>
                        <label>Icon colour<input type='color' value={appearance.icon || appearance.accent || '#1878df'} onChange={e => saveAppearance('icon',e.target.value)} /></label>
                        <label>Navigation background<input type='color' value={appearance.navBackground || '#151d26'} onChange={e => saveAppearance('navBackground',e.target.value)} /></label>
                        <label>Navigation text<input type='color' value={appearance.navText || '#f3f6f8'} onChange={e => saveAppearance('navText',e.target.value)} /></label>
                        <label>Header background<input type='color' value={appearance.header || '#ffffff'} onChange={e => saveAppearance('header',e.target.value)} /></label>
                        <label>Theme
                            <select value={appearance.theme || 'dark'} onChange={e => saveAppearance('theme',e.target.value)}>
                                <option value='dark'>Dark</option><option value='light'>Light</option>
                            </select>
                        </label>
                    </div>
                    <div className='prodb-admin-appearance-preview' style={{ background: appearance.card || '#0d2137', borderColor: appearance.primary || '#20b98d' }}>
                        <span>🤖</span><div><small>PREVIEW</small><strong>Dashboard card</strong><em>Appearance settings are stored on this device.</em></div>
                    </div>
                </section>
            );
        }

        const info: Record<string, {title:string; text:string; items:string[]}> = {
            users: { title:'Users', text:'User/account analytics will appear here when a shared backend is enabled.', items:['Users','Active users','User activity'] },
            trading: { title:'Trading Activity', text:'Trading records are intentionally not fabricated while live trading is disabled.', items:['Auto Trades','Manual Trades','Trade History'] },
            content: { title:'Tutorials / Content', text:'Create the content-management area here for tutorials, guides and announcements.', items:['Tutorials','Guides','Announcements'] },
            settings: { title:'System Settings', text:'Core application controls for this device and future backend settings.', items:['Security','Runtime mode','Data management'] },
        };
        const current = info[activeTab];
        return (
            <section className='prodb-admin-wide-card'>
                <span>{current.title.toUpperCase()}</span><h2>{current.title}</h2><p className='prodb-admin-section-copy'>{current.text}</p>
                <div className='prodb-admin-placeholder-grid'>
                    {current.items.map(item => <button key={item} type='button' onClick={() => setMessage(`${item}: ready for configuration.`)}><strong>{item}</strong><small>Open section →</small></button>)}
                </div>
            </section>
        );
    };

    return (
        <div className='prodb-admin-page'>
            <header className='prodb-admin-head'>
                <div><span>ELISY254 SHARP • CONTROL CENTRE</span><h1>Admin Panel</h1><p>Manage bots, files, appearance and app sections without editing code.</p></div>
                <button type='button' onClick={logout}>LOCK PANEL</button>
            </header>

            {error && <div className='prodb-admin-error'>{error}</div>}
            {message && <div className='prodb-admin-success'>{message}</div>}

            <div className='prodb-admin-shell'>
                <aside className='prodb-admin-sidebar'>
                    <div className='prodb-admin-sidebar-brand'><div>⚡</div><strong>SHARP ADMIN</strong><small>CONTROL CENTRE</small></div>
                    <nav>
                        {adminMenu.map(item => (
                            <button key={item.id} type='button' className={activeTab === item.id ? 'is-active' : ''} onClick={() => { setActiveTab(item.id); setError(''); }}>
                                <span>{item.icon}</span><strong>{item.label}</strong><b>›</b>
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className='prodb-admin-main'>
                    <div className='prodb-admin-breadcrumb'><span>ADMIN</span><b>›</b><strong>{adminMenu.find(item => item.id === activeTab)?.label}</strong></div>

                    {(activeTab === 'bot_management' || activeTab === 'bot_files') && (
                        <div className='prodb-admin-subnav'>
                            <button className={activeTab === 'bot_management' ? 'is-active' : ''} onClick={() => setActiveTab('bot_management')}>🤖 Bot Management</button>
                            <button className={activeTab === 'bot_files' ? 'is-active' : ''} onClick={() => setActiveTab('bot_files')}>📁 Bot Files</button>
                            <button onClick={() => { setActiveTab('bot_management'); resetForm(); }}>＋ Add Bot</button>
                        </div>
                    )}

                    {renderAdminPanel()}
                </main>
            </div>
        </div>
    );
};

export default AdminPanelPage;
