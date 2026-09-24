import React, { Component, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { configure } from 'mobx';
import { performVersionCheck } from './utils/version-check';
import './styles/index.scss';

configure({ isolateGlobalState: true });

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

const App = lazy(async () => {
    try {
        return await import('./app/App');
    } catch (error) {
        console.error('[SHARP] Failed to load application bundle:', error);

        // Rsbuild emits hashed async chunks. If the browser has an old
        // entry/chunk cached after a deployment, force one clean HTML reload
        // so the browser receives the new chunk manifest.
        const message = error instanceof Error ? error.message : String(error);
        const isChunkError =
            /Loading chunk/i.test(message) ||
            /ChunkLoadError/i.test(message) ||
            /missing:/i.test(message);

        if (isChunkError) {
            const reloadKey = 'sharp_chunk_reload';
            if (!sessionStorage.getItem(reloadKey)) {
                sessionStorage.setItem(reloadKey, '1');
                const url = new URL(window.location.href);
                url.searchParams.set('_sharp_reload', String(Date.now()));
                window.location.replace(url.toString());
                return new Promise<never>(() => {});
            }
            sessionStorage.removeItem(reloadKey);
        }

        throw error;
    }
});

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

    return (
        <Suspense
            fallback={
                <div style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#07131d',
                    color: '#fff',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 800,
                }}>
                    Loading ELISY254 SHARP…
                </div>
            }
        >
            <App />
        </Suspense>
    );
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
