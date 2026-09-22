import type { CSSProperties } from 'react';

type Props = { onAddBot: () => void };

const BotBuilderPage = ({ onAddBot }: Props) => (
    <section style={pageStyle}>
        <div style={heroStyle}>
            <div style={iconStyle}>🤖</div>
            <div>
                <div style={eyebrowStyle}>BOT BUILDER</div>
                <h1 style={titleStyle}>Your Bots</h1>
                <p style={textStyle}>No bots are published yet.</p>
            </div>
        </div>

        <div style={emptyStyle}>
            <div style={plusStyle}>＋</div>
            <h2 style={emptyTitle}>No bots available</h2>
            <p style={emptyText}>
                Admin-uploaded bots will appear here when they are published.
                You can also create a new bot directly in the builder.
            </p>
            <button type='button' onClick={onAddBot} style={buttonStyle}>
                ＋ ADD BOT
            </button>
        </div>
    </section>
);

const pageStyle: CSSProperties = {
    minHeight: 'calc(100vh - 110px)',
    padding: '28px 20px 80px',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #06121f 0%, #081a2a 100%)',
    color: '#fff',
};

const heroStyle: CSSProperties = {
    maxWidth: 1100,
    margin: '0 auto 22px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
};

const iconStyle: CSSProperties = {
    width: 58,
    height: 58,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #00a884, #087fca)',
    fontSize: 28,
    boxShadow: '0 10px 30px rgba(0,168,132,.22)',
};

const eyebrowStyle: CSSProperties = {
    color: '#55e6c1',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
};

const titleStyle: CSSProperties = {
    margin: '3px 0',
    fontSize: 28,
};

const textStyle: CSSProperties = {
    margin: 0,
    color: '#9fb0c0',
};

const emptyStyle: CSSProperties = {
    maxWidth: 720,
    minHeight: 360,
    margin: '40px auto 0',
    padding: 36,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    borderRadius: 22,
    border: '1px solid rgba(0,168,132,.28)',
    background: 'rgba(9,26,43,.88)',
    boxShadow: '0 20px 60px rgba(0,0,0,.28)',
};

const plusStyle: CSSProperties = {
    width: 72,
    height: 72,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: 'rgba(0,168,132,.14)',
    color: '#55e6c1',
    fontSize: 42,
    lineHeight: 1,
};

const emptyTitle: CSSProperties = {
    margin: '18px 0 8px',
    fontSize: 22,
};

const emptyText: CSSProperties = {
    maxWidth: 520,
    margin: '0 0 24px',
    color: '#9fb0c0',
    lineHeight: 1.6,
};

const buttonStyle: CSSProperties = {
    border: 0,
    borderRadius: 12,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #00a884, #087fca)',
    color: '#fff',
    fontWeight: 900,
    letterSpacing: .5,
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(0,168,132,.22)',
};

export default BotBuilderPage;
