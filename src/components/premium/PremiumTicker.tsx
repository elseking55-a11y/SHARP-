import { useEffect, useMemo, useRef, useState } from 'react';

const PUBLIC_MARKET_WS = 'wss://api.derivws.com/trading/v1/options/ws/public';
const preferredSymbols = ['1HZ100V', '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', 'R_10', 'R_25', 'R_50', 'R_75', 'R_100'];

type MarketSymbol = {
    symbol: string;
    display_name?: string;
    pip_size?: number | string;
};

type Quote = { value: number; previous?: number };

const nameOf = (item: MarketSymbol) => item?.display_name || item?.symbol || '';
const decimalsOf = (item: MarketSymbol) => {
    const pip = String(item?.pip_size ?? '0.01');
    return pip.includes('.') ? pip.split('.')[1].replace(/0+$/, '').length : 0;
};

const PremiumTicker = ({ light = false }: { light?: boolean }) => {
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

    useEffect(() => {
        let disposed = false;

        const connect = () => {
            if (disposed) return;

            setStatus('connecting');
            const socket = new WebSocket(PUBLIC_MARKET_WS);
            socketRef.current = socket;

            socket.onopen = () => {
                if (disposed) return;
                setStatus('connected');
                socket.send(JSON.stringify({
                    active_symbols: 'brief',
                    req_id: ++requestIdRef.current,
                }));
            };

            socket.onmessage = event => {
                if (disposed) return;

                let message: any;
                try {
                    message = JSON.parse(String(event.data));
                } catch {
                    return;
                }

                if (message?.error) {
                    console.warn('[MarketTicker] Deriv error:', message.error?.message || message.error?.code || message.error);
                    return;
                }

                if (message?.msg_type === 'active_symbols' && Array.isArray(message.active_symbols)) {
                    const all = message.active_symbols
                        .filter((item: any) => item?.symbol)
                        .map((item: any) => ({
                            symbol: String(item.symbol),
                            display_name: item.display_name || item.underlying_symbol_name || item.symbol,
                            pip_size: item.pip_size,
                        }));

                    const preferred = preferredSymbols
                        .map(code => all.find(item => item.symbol === code))
                        .filter(Boolean) as MarketSymbol[];

                    const picked = (preferred.length >= 5 ? preferred : all).slice(0, 8);
                    setSymbols(picked);

                    picked.forEach(item => {
                        socket.send(JSON.stringify({
                            ticks: item.symbol,
                            subscribe: 1,
                            req_id: ++requestIdRef.current,
                        }));
                    });
                    return;
                }

                if (message?.msg_type === 'tick' && message.tick?.symbol) {
                    const symbol = String(message.tick.symbol);
                    const value = Number(message.tick.quote);
                    if (!Number.isFinite(value)) return;

                    setQuotes(current => ({
                        ...current,
                        [symbol]: {
                            value,
                            previous: current[symbol]?.value,
                        },
                    }));
                }
            };

            socket.onerror = () => {
                if (!disposed) setStatus('error');
            };

            socket.onclose = () => {
                if (disposed) return;
                setStatus('error');
                if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = window.setTimeout(connect, 2000);
            };
        };

        connect();

        return () => {
            disposed = true;
            if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            const socket = socketRef.current;
            socketRef.current = null;
            if (socket) {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                try { socket.close(); } catch { /* already closed */ }
            }
        };
    }, []);

    const items = useMemo(
        () => symbols.map((item, index) => {
            const code = item.symbol;
            const quote = quotes[code];
            const decimals = decimalsOf(item);
            const direction = quote?.previous === undefined || quote.value >= quote.previous ? '▲' : '▼';
            return [
                nameOf(item).toUpperCase(),
                quote ? quote.value.toFixed(decimals) : '…',
                ['cyan', 'orange', 'green', 'blue', 'blue', 'red', 'yellow', 'green'][index % 8],
                direction,
            ] as const;
        }),
        [symbols, quotes]
    );

    if (!items.length) {
        const message = status === 'error' ? 'RECONNECTING…' : status === 'connected' ? 'LOADING MARKETS…' : 'CONNECTING…';
        return (
            <div className={`prodb-ticker ${light ? 'prodb-ticker--light' : ''}`} aria-label='Deriv market ticker'>
                <div className='prodb-ticker__track'>
                    <div className='prodb-ticker__set'>
                        <span className='prodb-ticker__item prodb-ticker__item--green'>
                            <b>DERIV MARKET DATA</b><span>{message}</span>
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`prodb-ticker ${light ? 'prodb-ticker--light' : ''}`} aria-label='Live Deriv market ticker'>
            <div className='prodb-ticker__track'>
                {[0, 1].map(set => (
                    <div className='prodb-ticker__set' key={set} aria-hidden={set === 1}>
                        {[...items, ...items].map(([label, value, tone, arrow], index) => (
                            <span className={`prodb-ticker__item prodb-ticker__item--${tone}`} key={`${set}-${index}`}>
                                <b>{label}</b><span>{value}</span><i className={arrow === '▲' ? 'up' : 'down'}>{arrow}</i>
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PremiumTicker;
