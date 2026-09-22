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
    updatedAt: number;
};

// v2 intentionally starts empty so old demo/local libraries cannot leak into production.
const STORAGE_KEY = 'sharp_managed_bot_library_v2';

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
    return safeParse(window.localStorage.getItem(STORAGE_KEY)).sort(
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
