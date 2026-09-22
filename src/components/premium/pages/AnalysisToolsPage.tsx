import React from 'react';

const AnalysisToolsPage = () => {
    return (
        <div className='prodb-live-page prodb-analysis-page'>
            <header className='prodb-live-header'>
                <span>DERIV ANALYSIS TOOLS</span>
                <div>
                    <h1>Analysis Tools</h1>
                    <p>Choose a tool. Native tools use the authenticated Deriv market-data session; external tools stay isolated inside their iframe.</p>
                </div>
            </header>

            <section className='prodb-analysis-iframe-card' role='tabpanel'>
                <iframe
                    title='Percentage Tool'
                    src='https://api.binarytool.site/'
                    className='prodb-analysis-iframe'
                    allow='clipboard-read; clipboard-write; fullscreen'
                    referrerPolicy='strict-origin-when-cross-origin'
                />
            </section>
        </div>
    );
};

export default AnalysisToolsPage;
