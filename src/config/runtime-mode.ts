/**
 * SHARP runtime/trading mode helpers.
 *
 * IMPORTANT: Demo mode never fabricates balances or trades. It only selects
 * the user's real Deriv demo account when one is available. Real mode selects
 * the user's real Deriv account. The existing public/demo appearance is not
 * changed by this setting.
 */
export type SharpTradingMode = 'demo' | 'real';

const MODE_KEY = 'sharp_trading_mode';
const API_TOKEN_KEY = 'sharp_deriv_api_token';
const CLIENT_ID_KEY = 'sharp_deriv_client_id';

export const SHARP_OFFLINE_MODE = false;

export const getSharpTradingMode = (): SharpTradingMode => {
    if (typeof window === 'undefined') return 'demo';
    return localStorage.getItem(MODE_KEY) === 'real' ? 'real' : 'demo';
};

export const setSharpTradingMode = (mode: SharpTradingMode): void => {
    localStorage.setItem(MODE_KEY, mode);
};

export const getStoredDerivApiToken = (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(API_TOKEN_KEY) || '';
};

export const setStoredDerivApiToken = (token: string): void => {
    if (!token) localStorage.removeItem(API_TOKEN_KEY);
    else localStorage.setItem(API_TOKEN_KEY, token);
};

export const getStoredDerivClientId = (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(CLIENT_ID_KEY) || '';
};

export const setStoredDerivClientId = (clientId: string): void => {
    if (!clientId) localStorage.removeItem(CLIENT_ID_KEY);
    else localStorage.setItem(CLIENT_ID_KEY, clientId);
};
