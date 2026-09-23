import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { SUPPORTED_VOLATILITY_MARKETS } from '@/utils/digit-strategy';
import { getLastDigitFromQuote } from '@/utils/market-data';
import { safeSubscribe } from '@/utils/websocket-handler';

const MIN_TICKS = 10;
const MAX_TICKS = 100;
const DEFAULT_TICKS = 50;

const DcirclePage = observer(() => {
    const [symbol, setSymbol] = useState(SUPPORTED_VOLATILITY_MARKETS[0]?.symbol ?? '1HZ100V');
    const [ticksInput, setTicksInput] = useState(String(DEFAULT_TICKS));
    const [digits, setDigits] = useState<number[]>([]);
    const [liveDigit, setLiveDigit] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestRef = useRef(0);
    const subscriptionRef = useRef<any>(null);
    const tickCount = Math.min(MAX_TICKS, Math.max(MIN_TICKS, Number(ticksInput) || DEFAULT_TICKS));
    const markets = useMemo(() => SUPPORTED_VOLATILITY_MARKETS.map(market => ({ label: market.label, symbol: market.symbol })), []);

    useEffect(() => {
        let cancelled = false;
        const requestVersion = ++requestRef.current;
        const load = async () => {
            setLoading(true); setError(''); setDigits([]); setLiveDigit(null);
            try {
                await api_base.init(true);
                const api = api_base.api as any;
                if (!api) throw new Error('Deriv connection is unavailable.');
                const response = await api.send({ ticks_history: symbol, adjust_start_time: 1, end: 'latest', count: tickCount, start: 1, style: 'ticks' });
                if (cancelled || requestVersion !== requestRef.current) return;
                const prices = Array.isArray(response?.history?.prices) ? response.history.prices : [];
                setDigits(prices.map((price: unknown) => getLastDigitFromQuote(Number(price), symbol)).filter((digit: number | null): digit is number => Number.isInteger(digit)).slice(-tickCount));
                const stream = api.subscribe({ ticks: symbol });
                subscriptionRef.current = safeSubscribe(stream, (data: any) => {
                    if (cancelled || requestVersion !== requestRef.current) return;
                    const quote = Number(data?.tick?.quote);
                    if (!Number.isFinite(quote)) return;
                    const digit = getLastDigitFromQuote(quote, symbol);
                    if (!Number.isInteger(digit)) return;
                    setLiveDigit(digit);
                    setDigits(previous => [...previous, digit].slice(-tickCount));
                });
            } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); }
            finally { if (!cancelled) setLoading(false); }
        };
        void load();
        return () => { cancelled = true; requestRef.current++; try { subscriptionRef.current?.unsubscribe?.(); } catch {} subscriptionRef.current = null; };
    }, [symbol, tickCount]);

    const counts = useMemo(() => Array.from({ length: 10 }, (_, digit) => ({ digit, count: digits.filter(value => value === digit).length })), [digits]);

    return <main className='dcircle-page'>
        <header className='dcircle-header'><div><span className='dcircle-kicker'>LIVE DIGIT MARKET</span><h1>Dcircle</h1><p>Watch the last digit move live from the selected Deriv market.</p></div><span className={'dcircle-status ' + (loading ? 'is-loading' : 'is-live')}>{loading ? 'LOADING' : 'LIVE'}</span></header>
        <section className='dcircle-controls'>
            <label><span>Market</span><select value={symbol} onChange={event => setSymbol(event.target.value)}>{markets.map(market => <option key={market.symbol} value={market.symbol}>{market.label}</option>)}</select></label>
            <label><span>Ticks</span><input inputMode='numeric' type='number' min={MIN_TICKS} max={MAX_TICKS} value={ticksInput} onChange={event => setTicksInput(event.target.value.replace(/\D/g, '').slice(0, 3))} onBlur={() => setTicksInput(String(tickCount))} /></label>
            <div className='dcircle-current'><span>Current digit</span><strong>{liveDigit ?? digits[digits.length - 1] ?? '—'}</strong></div>
        </section>
        {error && <div className='dcircle-error'>{error}</div>}
        <section className='dcircle-board'><div className='dcircle-board__title'><span>Digit movement</span><small>{digits.length} / {tickCount} ticks</small></div>
            <div className='dcircle-track'>{counts.map(item => <div key={item.digit} className={'dcircle-digit ' + (liveDigit === item.digit ? 'is-active' : '')}><span className='dcircle-dot'>{item.digit}</span><b>{item.count}</b></div>)}</div>
            <div className='dcircle-history'>{digits.slice(-30).map((digit, index) => <span key={String(index) + '-' + String(digit)} className={digit === liveDigit ? 'is-live' : ''}>{digit}</span>)}</div>
        </section>
    </main>;
});

export default DcirclePage;