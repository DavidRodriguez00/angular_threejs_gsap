export interface VpDef {
    domId: string;
    modelPath: string;
    accentHex: number;
    cssAccent: string;
    cssAccentRgb: string;
    phase: string;
    era: string;
    name: string;
    year: string;
    specs: string[];
}

export const VP_DEFS: VpDef[] = [
    {
        domId: 'clone-vp-0',
        modelPath: '/assets/models/clone1.glb',
        accentHex: 0xddd8cc,
        cssAccent: 'rgb(221,216,204)',
        cssAccentRgb: '221 216 204',
        phase: 'PHASE I · CLASSIFIED',
        era: 'CLONE WARS ERA',
        name: 'Phase I Clone Trooper',
        year: '22 BBY — Battle of Geonosis',
        specs: [
            'Mandalorian-derived armour design',
            'DC-15A Blaster Rifle',
            'ARC-170 Starfighter compatible',
            'Full environmental seal',
        ],
    },
    {
        domId: 'clone-vp-1',
        modelPath: '/assets/models/clone2.glb',
        accentHex: 0x00aaff,
        cssAccent: 'rgb(0,170,255)',
        cssAccentRgb: '0 170 255',
        phase: 'PHASE II · CLASSIFIED',
        era: 'CLONE WARS ERA',
        name: 'Phase II Clone Trooper',
        year: '20 BBY — Siege of Mandalore',
        specs: [
            'Enhanced joint mobility system',
            'Modular attachment interface',
            'Improved HUD & comms array',
            'Corps colour identification',
        ],
    },
    {
        domId: 'clone-vp-2',
        modelPath: '/assets/models/trooper1.glb',
        accentHex: 0xff4422,
        cssAccent: 'rgb(255,68,34)',
        cssAccentRgb: '255 68 34',
        phase: 'IMPERIAL · CLASSIFIED',
        era: 'GALACTIC EMPIRE',
        name: 'Imperial Stormtrooper',
        year: '19 BBY — 4 ABY',
        specs: [
            'Mass-production standardized design',
            'E-11 BlasTech Blaster Rifle',
            'Non-clone volunteer recruitment',
            'Galaxy-wide Imperial deployment',
        ],
    },
];