import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
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
            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token) {
                        cleanupURL();
                    } else if (response.error) {
                        console.error('Token exchange failed:', response.error, response.error_description);
                        cleanupURL();
                    }
                })
                .catch(exchangeError => {
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
