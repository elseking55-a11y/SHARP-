import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { configure } from 'mobx';
import { performVersionCheck } from './utils/version-check';
import './styles/index.scss';


configure({ isolateGlobalState: true });

const isChunkLoadError = (value: unknown) => {
    const message = value instanceof Error ? value.message : String(value ?? '');
    return /Loading chunk/i.test(message) || /ChunkLoadError/i.test(message) || /missing:\s*https?:/i.test(message);
};

const recoverFromStaleChunk = (value: unknown) => {
    if (!isChunkLoadError(value)) return false;

    try {
        const reloadKey = 'sharp_chunk_reload';
        if (sessionStorage.getItem(reloadKey)) {
            sessionStorage.removeItem(reloadKey);
            return false;
        }

        sessionStorage.setItem(reloadKey, '1');
        const url = new URL(window.location.href);
        url.searchParams.set('_sharp_reload', String(Date.now()));
        window.location.replace(url.toString());
        return true;
    } catch (error) {
        console.error('[SHARP] Chunk recovery failed:', error);
        return false;
    }
};

// Catch chunk failures from every lazy boundary, including nested routes/components.
window.addEventListener('error', event => {
    const target = event.target as HTMLScriptElement | HTMLLinkElement | null;
    const resourceUrl = target?.src || target?.href || '';
    if (isChunkLoadError(event.error) || /\/static\/js\/async\//i.test(resourceUrl)) {
        recoverFromStaleChunk(event.error || new Error(`Missing frontend resource: ${resourceUrl}`));
    }
}, true);

window.addEventListener('unhandledrejection', event => {
    if (isChunkLoadError(event.reason)) {
        recoverFromStaleChunk(event.reason);
    }
});

type BootState = { error: Error | null };

class BootErrorBoundary extends Component<React.PropsWithChildren, BootState> {
    state: BootState = { error: null };

    static getDerivedStateFromError(error: Error): BootState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[SHARP] Application boot/runtime error:', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        const message = this.state.error?.message || String(this.state.error);
        return (
            <div style={{
                minHeight: '100vh',
                background: '#07131d',
                color: '#fff',
                padding: '32px 20px',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box',
            }}>
                <div style={{
                    maxWidth: 720,
                    margin: '40px auto',
                    padding: 24,
                    border: '1px solid #29465a',
                    borderRadius: 16,
                    background: '#0b1d2b',
                    boxShadow: '0 12px 40px rgba(0,0,0,.35)',
                }}>
                    <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>ELISY254 SHARP</div>
                    <div style={{ color: '#ff6b6b', fontWeight: 800, marginBottom: 16 }}>Application startup error</div>
                    <pre style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#d8e6ef',
                        fontSize: 13,
                        lineHeight: 1.55,
                        margin: 0,
                    }}>{message}</pre>
                    <button
                        type='button'
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 20,
                            width: '100%',
                            minHeight: 46,
                            border: 0,
                            borderRadius: 10,
                            background: '#00b686',
                            color: '#06130f',
                            fontWeight: 900,
                            cursor: 'pointer',
                        }}
                    >
                        Reload ELISY254 SHARP
                    </button>
                </div>
            </div>
        );
    }
}

import App from './app/App';

let versionCheckError: Error | null = null;
try {
    performVersionCheck();
} catch (error) {
    versionCheckError = error instanceof Error ? error : new Error(String(error));
    console.error('[SHARP] Version check failed:', error);
}

const Boot = () => {
    if (versionCheckError) {
        throw versionCheckError;
    }

    return <App />;
};

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('SHARP root element #root was not found.');
}

createRoot(rootElement).render(
    <BootErrorBoundary>
        <Boot />
    </BootErrorBoundary>
);
