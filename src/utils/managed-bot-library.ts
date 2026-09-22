export type ManagedBot = {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
    badge?: string;
    category?: string;
    accent?: string;
    surface?: string;
    text?: string;
    file: string;
    priority?: number;
    imageUrl?: string;
    imageBase64?: string;
    videoUrl?: string;
    published?: boolean;
    comingSoon?: boolean;
    xmlBase64: string;
    xmlUrl?: string;
    updatedAt: number;
};

// v2 intentionally starts empty so old demo/local libraries cannot leak into production.
const STORAGE_KEY = 'sharp_managed_bot_library_v2';
const ELISY_AI_SEEDED_KEY = 'sharp_elisy_ai_seeded_v1';
const MARKET_KILLER_SEEDED_KEY = 'sharp_market_killer_seeded_v1';


const seedElisyAI = (bots: ManagedBot[]): ManagedBot[] => {
    if (typeof window === 'undefined' || window.localStorage.getItem(ELISY_AI_SEEDED_KEY) === '1') return bots;
    const seeded: ManagedBot = {
        id: 'elisy-ai',
        name: 'ELISY AI',
        emoji: '🤖',
        category: 'Free Bots',
        accent: '#1878df',
        surface: '#0d2137',
        text: '#ffffff',
        file: 'ElisyAI.xml',
        priority: 1,
        imageUrl: '/free-bots/elisy-ai-robot.svg',
        published: true,
        comingSoon: false,
        xmlBase64: '',
        xmlUrl: '/free-bots/ElisyAI.xml',
        updatedAt: Date.now(),
    };
    const marketKiller: ManagedBot = {
        id: 'market-killer',
        name: 'MARKET KILLER',
        emoji: '',
        category: 'Free Bots',
        accent: '#d11f2f',
        surface: '#241017',
        text: '#ffffff',
        file: 'MarketKiller.xml',
        priority: 2,
        imageUrl: '/free-bots/market-killer-lion.svg',
        published: true,
        comingSoon: false,
        xmlUrl: '/free-bots/MarketKiller.xml',
        updatedAt: Date.now(),
    };
    if (window.localStorage.getItem(MARKET_KILLER_SEEDED_KEY) !== '1') {
        window.localStorage.setItem(MARKET_KILLER_SEEDED_KEY, '1');
    }
    const next = [marketKiller, seeded, ...bots.filter(bot => bot.id !== seeded.id && bot.id !== marketKiller.id)];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(ELISY_AI_SEEDED_KEY, '1');
    return next;
};

const safeParse = (value: string | null): ManagedBot[] => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.xmlBase64 === 'string'
        );
    } catch {
        return [];
    }
};

export const readManagedBots = (): ManagedBot[] => {
    if (typeof window === 'undefined') return [];
    return seedElisyAI(safeParse(window.localStorage.getItem(STORAGE_KEY))).sort(
        (a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999)
    );
};

export const writeManagedBots = (bots: ManagedBot[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
    window.dispatchEvent(new CustomEvent('sharp-managed-bots-updated'));
};

export const upsertManagedBot = (bot: ManagedBot) => {
    const bots = readManagedBots().filter(item => item.id !== bot.id);
    writeManagedBots([...bots, bot]);
};

export const removeManagedBot = (id: string) => {
    writeManagedBots(readManagedBots().filter(item => item.id !== id));
};

export const decodeManagedBotXml = (encoded: string): string => {
    const binary = window.atob(encoded.replace(/\\s+/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    try {
        return new TextDecoder().decode(bytes);
    } catch {
        let result = '';
        for (const byte of bytes) result += String.fromCharCode(byte);
        return result;
    }
};

export const managedBotStorageKey = STORAGE_KEY;
