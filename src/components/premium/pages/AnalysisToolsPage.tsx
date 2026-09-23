import React, { useState } from 'react';
import { SUPPORTED_VOLATILITY_MARKETS } from '@/utils/digit-strategy';

const TRADE_TYPES = ['Rise / Fall', 'Higher / Lower', 'Even / Odd', 'Over / Under'];

const AnalysisToolsPage = () => {
    const [market, setMarket] = useState(SUPPORTED_VOLATILITY_MARKETS[0]?.symbol || 'R_10');
    const [ticks, setTicks] = useState(10);
    const [tradeType, setTradeType] = useState(TRADE_TYPES[0]);
    const selectedMarket = SUPPORTED_VOLATILITY_MARKETS.find(item => item.symbol === market);
    return (
        <div className='prodb-live-page prodb-analysis-page'>
            <section className='prodb-synthetic-box'>
                <div className='prodb-synthetic-box__glow' />
                <div className='prodb-synthetic-box__header'>
                    <div><span className='prodb-synthetic-box__eyebrow'>SYNTHETIC MARKET</span><h2>Market Setup</h2><p>Select your synthetic market, number of ticks and trade type.</p></div>
                    <span className='prodb-synthetic-live'>● LIVE</span>
                </div>
                <div className='prodb-synthetic-fields'>
                    <label><span>MARKET</span><select value={market} onChange={event => setMarket(event.target.value)}>{SUPPORTED_VOLATILITY_MARKETS.map(item => <option key={item.symbol} value={item.symbol}>{item.label}</option>)}</select><small>{selectedMarket?.symbol || market}</small></label>
                    <label><span>NUMBER OF TICKS</span><input type='number' min={1} max={1000} value={ticks} onChange={event => setTicks(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))} /><small>1–1000 ticks</small></label>
                    <label><span>TRADE TYPE</span><select value={tradeType} onChange={event => setTradeType(event.target.value)}>{TRADE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select><small>Analysis contract type</small></label>
                </div>
                <div className='prodb-synthetic-summary'>
                    <div><small>MARKET</small><strong>{selectedMarket?.label || market}</strong></div>
                    <div><small>TICKS</small><strong>{ticks}</strong></div>
                    <div><small>TRADE TYPE</small><strong>{tradeType}</strong></div>
                </div>
            </section>
            <section className='prodb-analysis-iframe-card' role='tabpanel'>
                <iframe title='Analysis' src='https://api.binarytool.site/' className='prodb-analysis-iframe' allow='clipboard-read; clipboard-write; fullscreen' referrerPolicy='strict-origin-when-cross-origin' />
            </section>
        </div>
    );
};

export default AnalysisToolsPage;