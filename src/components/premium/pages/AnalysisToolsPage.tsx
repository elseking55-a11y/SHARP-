import { useCallback, useEffect, useMemo, useState } from 'react';
import { PremiumDerivApiService } from '@/services/premium-deriv-api.service';

type AnalysisTool = 'digits' | 'percentage';

const number = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getSymbolCode = (item: any) => item?.underlying_symbol || item?.symbol || '';
const getSymbolName = (item: any) => item?.underlying_symbol_name || item?.display_name || getSymbolCode(item);
const getPipDecimals = (item: any) => {
    const pip = String(item?.pip_size ?? item?.pip ?? '0.01');
    const decimals = pip.includes('.') ? pip.split('.')[1].replace(/0+$/, '').length : 0;
    return Math.max(decimals, 0);
};

const AnalysisToolsPage = () => {
    const [activeTool, setActiveTool] = useState<AnalysisTool>('digits');
    const [symbols, setSymbols] = useState<any[]>([]);
    const [symbol, setSymbol] = useState('1HZ100V');
    const [windowSize, setWindowSize] = useState(1000);
    const [prices, setPrices] = useState<number[]>([]);
    const [error, setError] = useState('');
    const selectedSymbol = symbols.find(item => getSymbolCode(item) === symbol);
    const decimals = getPipDecimals(selectedSymbol);

    useEffect(() => {
        let mounted = true;
        PremiumDerivApiService.activeSymbols()
            .then(items => {
                if (!mounted) return;
                const usable = items.filter(item => getSymbolCode(item));
                setSymbols(usable);
                if (!usable.some(item => getSymbolCode(item) === symbol) && usable[0]) setSymbol(getSymbolCode(usable[0]));
            })
            .catch(err => mounted && setError(err instanceof Error ? err.message : String(err)));
        return () => { mounted = false; };
    }, []);

    const refresh = useCallback(() => {
        if (!symbol || activeTool !== 'digits') return;
        setError('');
        PremiumDerivApiService.ticksHistory(symbol, windowSize)
            .then(setPrices)
            .catch(err => setError(err instanceof Error ? err.message : String(err)));
    }, [activeTool, symbol, windowSize]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        if (!symbol || activeTool !== 'digits') return;
        let dispose: (() => void) | undefined;
        PremiumDerivApiService.subscribeTicks(symbol, tick => {
            setPrices(current => [...current.slice(-(windowSize - 1)), number(tick?.quote)]);
        })
            .then(fn => { dispose = fn; })
            .catch(err => setError(err instanceof Error ? err.message : String(err)));
        return () => dispose?.();
    }, [activeTool, symbol, windowSize]);

    const digits = useMemo(() => prices.map(price => Number(price.toFixed(decimals).slice(-1))), [prices, decimals]);
    const counts = useMemo(() => Array.from({ length: 10 }, (_, digit) => digits.filter(value => value === digit).length), [digits]);
    const total = digits.length || 1;
    const even = digits.filter(value => value % 2 === 0).length;
    const odd = digits.length - even;
    const highest = Math.max(...counts);
    const lowest = Math.min(...counts);
    const distinctCounts = Array.from(new Set(counts)).sort((a, b) => b - a);
    const secondHighest = distinctCounts.length > 1 ? distinctCounts[1] : distinctCounts[0];
    const ascendingDistinctCounts = Array.from(new Set(counts)).sort((a, b) => a - b);
    const secondLowest = ascendingDistinctCounts.length > 1 ? ascendingDistinctCounts[1] : ascendingDistinctCounts[0];
    const secondHighDigits = counts
        .map((count, digit) => ({ digit, count }))
        .filter(item => item.count === secondHighest)
        .map(item => item.digit);
    const secondLowDigits = counts
        .map((count, digit) => ({ digit, count }))
        .filter(item => item.count === secondLowest)
        .map(item => item.digit);

    return <div className='prodb-live-page prodb-analysis-page'>
        <header className='prodb-live-header'>
            <span>DERIV ANALYSIS TOOLS</span>
            <div><h1>Analysis Tools</h1><p>Choose a tool. Native tools use the authenticated Deriv market-data session; external tools stay isolated inside their iframe.</p></div>
        </header>

        <div className='prodb-analysis-tool-tabs' role='tablist' aria-label='Analysis tools'>
            <button type='button' role='tab' aria-selected={activeTool === 'digits'} className={activeTool === 'digits' ? 'is-active' : ''} onClick={() => setActiveTool('digits')}>Digit Analysis</button>
            <button type='button' role='tab' aria-selected={activeTool === 'percentage'} className={activeTool === 'percentage' ? 'is-active' : ''} onClick={() => setActiveTool('percentage')}>Percentage Tool</button>
        </div>

        {activeTool === 'percentage' ? (
            <section className='prodb-analysis-iframe-card' role='tabpanel'>
                <iframe title='Percentage Tool' src='https://api.binarytool.site/' className='prodb-analysis-iframe' allow='clipboard-read; clipboard-write; fullscreen' referrerPolicy='strict-origin-when-cross-origin' />
            </section>
        ) : (
            <section className='prodb-live-card' role='tabpanel'>
                <div className='prodb-analysis-controls'>
                    <div className='prodb-analysis-field prodb-analysis-market-field'>
                        <label htmlFor='analysis-market'>MARKET</label>
                        <select id='analysis-market' value={symbol} onChange={event => setSymbol(event.target.value)}>{symbols.map(item => <option key={getSymbolCode(item)} value={getSymbolCode(item)}>{getSymbolName(item)} · {getSymbolCode(item)}</option>)}</select>
                    </div>
                    <div className='prodb-analysis-field'>
                        <label htmlFor='analysis-window'>TICK WINDOW</label>
                        <input id='analysis-window' type='number' min='10' max='5000' value={windowSize} onChange={event => setWindowSize(Math.min(Math.max(number(event.target.value, 1000), 10), 5000))} />
                    </div>
                    <button className='prodb-analysis-refresh' type='button' onClick={refresh}>REFRESH</button>
                </div>
                <div className='prodb-analysis-tick'><small>LATEST DERIV TICK</small><strong>{prices.at(-1)?.toFixed(decimals) ?? '—'}</strong><span>{digits.at(-1) ?? '—'}</span></div>
                <div className='prodb-analysis-appearance-cards'>
                    <div className='prodb-analysis-appearance-card prodb-analysis-appearance-card--high'>
                        <div className='prodb-analysis-appearance-card__icon'>2ND HIGH</div>
                        <div><small>SECOND HIGH APPEARANCE</small><strong>{secondHighDigits.length ? secondHighDigits.join(' · ') : '—'}</strong><span>{secondHighest} appearance{secondHighest === 1 ? '' : 's'} · {((secondHighest / total) * 100).toFixed(2)}%</span></div>
                    </div>
                    <div className='prodb-analysis-appearance-card prodb-analysis-appearance-card--low'>
                        <div className='prodb-analysis-appearance-card__icon'>2ND LOW</div>
                        <div><small>SECOND LOW APPEARANCE</small><strong>{secondLowDigits.length ? secondLowDigits.join(' · ') : '—'}</strong><span>{secondLowest} appearance{secondLowest === 1 ? '' : 's'} · {((secondLowest / total) * 100).toFixed(2)}%</span></div>
                    </div>
                </div>
                <div className='prodb-analysis-digits'>{counts.map((count, digit) => <div key={digit}><span className={count === highest ? 'is-high' : count === lowest ? 'is-low' : secondHighDigits.includes(digit) ? 'is-second-high' : secondLowDigits.includes(digit) ? 'is-second-low' : ''}>{digit}</span><b>{((count / total) * 100).toFixed(2)}%</b><small>{count}/{digits.length}</small></div>)}</div>
                <div className='prodb-analysis-bars'><div style={{ flex: even || 1 }}><span>Even</span><strong>{((even / total) * 100).toFixed(2)}%</strong></div><div style={{ flex: odd || 1 }}><span>Odd</span><strong>{((odd / total) * 100).toFixed(2)}%</strong></div></div>
                <div className='prodb-analysis-sequence'>{digits.slice(-30).map((digit, index) => <span className={digit % 2 === 0 ? 'is-even' : 'is-odd'} key={`${index}-${digit}`}>{digit}</span>)}</div>
                {error && <div className='prodb-live-error'>{error}</div>}
            </section>
        )}
    </div>;
};

export default AnalysisToolsPage;
