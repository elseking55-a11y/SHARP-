import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from 'react-router-dom';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';
import { StoreProvider } from '@/hooks/useStore';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { initializeI18n, TranslationProvider } from '@deriv-com/translations';
import CoreStoreProvider from './CoreStoreProvider';
import PremiumLayout from '../components/premium/PremiumLayout';
import './app-root.scss';

const AppRoot = lazy(() => import('./app-root'));
const i18nInstance = initializeI18n({ cdnUrl: '' });

const LanguageHandler = ({ children }: { children: React.ReactNode }) => {
    useLanguageFromURL();
    return <>{children}</>;
};

const AppShell = () => (
    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
        <LanguageHandler>
            <StoreProvider>
                <LocalStorageSyncWrapper>
                    <RoutePromptDialog />
                    <CoreStoreProvider>
                        <PremiumLayout />
                        <Outlet />
                    </CoreStoreProvider>
                </LocalStorageSyncWrapper>
            </StoreProvider>
        </LanguageHandler>
    </TranslationProvider>
);

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path='/' element={<AppShell />}>
                <Route index element={
                    <Suspense fallback={null}>
                        <AppRoot />
                    </Suspense>
                } />
            </Route>
            <Route path='/callback' element={<AppShell />}>
                <Route index element={
                    <Suspense fallback={null}>
                        <AppRoot />
                    </Suspense>
                } />
            </Route>
        </>
    )
);

function App() {
    const { isProcessing, isValid, params, error, cleanupURL } = useOAuthCallback();
    useAccountSwitching();

    React.useEffect(() => {
        if (!isProcessing && isValid && params.code) {
            // Mark the OAuth callback as an authentication handoff. The app will
            // stay on the callback page until the token is actually stored.
            sessionStorage.setItem('sharp_auth_handoff', 'pending');

            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token && OAuthTokenExchangeService.isAuthenticated()) {
                        sessionStorage.setItem('sharp_auth_handoff', 'complete');

                        // Do a clean application reload after the token is stored.
                        // This prevents the callback route from rendering the
                        // landing page while React still has the old auth state.
                        window.location.replace('/#dashboard');
                        return;
                    }

                    sessionStorage.removeItem('sharp_auth_handoff');
                    console.error(
                        'Token exchange failed:',
                        response.error,
                        response.error_description
                    );
                    cleanupURL();
                })
                .catch(exchangeError => {
                    sessionStorage.removeItem('sharp_auth_handoff');
                    console.error('OAuth token exchange request failed:', exchangeError);
                    cleanupURL();
                });
        } else if (!isProcessing && error) {
            console.error('OAuth callback error:', error);
        }
    }, [isProcessing, isValid, params.code, error, cleanupURL]);

    return <RouterProvider router={router} />;
}

export default App;
