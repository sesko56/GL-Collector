import { Rarity } from '../types';

export interface RarityVisualMeta {
  key: Rarity;
  label: string;
  percentileLabel: string;
  defaultProbabilityLabel: string;
  borderClass: string;
  innerBorderClass: string;
  bgGradientClass: string;
  textAccentClass: string;
  sealColorHex: string;
  auraClass: string;
  rankOrder: number;
}

export const RARITY_ORDER: Rarity[] = [
  'MYTHIQUE',
  'LEGENDAIRE',
  'EPIQUE',
  'RARE',
  'PEU_COMMUNE',
  'COMMUNE',
];

export const RARITY_META: Record<Rarity, RarityVisualMeta> = {
  MYTHIQUE: {
    key: 'MYTHIQUE',
    label: 'Mythique',
    percentileLabel: 'Top 1 % des visites',
    defaultProbabilityLabel: '0,1 %',
    borderClass: 'border-rose-500/80',
    innerBorderClass: 'border-amber-400/50',
    bgGradientClass: 'from-[#230B17] via-[#171124] to-[#1D120B]',
    textAccentClass: 'text-rose-300',
    sealColorHex: '#F43F5E',
    auraClass: 'mythic-aura card-foil-shimmer',
    rankOrder: 6,
  },
  LEGENDAIRE: {
    key: 'LEGENDAIRE',
    label: 'Légendaire',
    percentileLabel: 'Top 5 % des visites',
    defaultProbabilityLabel: '0,9 %',
    borderClass: 'border-[#D4AF37]/85',
    innerBorderClass: 'border-[#D4AF37]/35',
    bgGradientClass: 'from-[#1F190D] via-[#131722] to-[#19140A]',
    textAccentClass: 'text-[#F3D266]',
    sealColorHex: '#D4AF37',
    auraClass: 'legendary-aura card-foil-shimmer',
    rankOrder: 5,
  },
  EPIQUE: {
    key: 'EPIQUE',
    label: 'Épique',
    percentileLabel: 'Top 10 % des visites',
    defaultProbabilityLabel: '4 %',
    borderClass: 'border-purple-400/75',
    innerBorderClass: 'border-purple-400/30',
    bgGradientClass: 'from-[#1B1128] via-[#121624] to-[#161021]',
    textAccentClass: 'text-purple-300',
    sealColorHex: '#C084FC',
    auraClass: 'epic-aura',
    rankOrder: 4,
  },
  RARE: {
    key: 'RARE',
    label: 'Rare',
    percentileLabel: 'Top 25 % des visites',
    defaultProbabilityLabel: '10 %',
    borderClass: 'border-sky-400/70',
    innerBorderClass: 'border-sky-400/25',
    bgGradientClass: 'from-[#0E1C2B] via-[#111723] to-[#0D1824]',
    textAccentClass: 'text-sky-300',
    sealColorHex: '#38BDF8',
    auraClass: '',
    rankOrder: 3,
  },
  PEU_COMMUNE: {
    key: 'PEU_COMMUNE',
    label: 'Peu commune',
    percentileLabel: 'Top 50 % des visites',
    defaultProbabilityLabel: '25 %',
    borderClass: 'border-emerald-500/60',
    innerBorderClass: 'border-emerald-500/20',
    bgGradientClass: 'from-[#0D1F1B] via-[#111722] to-[#0E1A17]',
    textAccentClass: 'text-emerald-300',
    sealColorHex: '#34D399',
    auraClass: '',
    rankOrder: 2,
  },
  COMMUNE: {
    key: 'COMMUNE',
    label: 'Commune',
    percentileLabel: 'Reste de l’encyclopédie',
    defaultProbabilityLabel: '60 %',
    borderClass: 'border-slate-600/70',
    innerBorderClass: 'border-slate-700/50',
    bgGradientClass: 'from-[#141A26] via-[#101520] to-[#131822]',
    textAccentClass: 'text-slate-300',
    sealColorHex: '#94A3B8',
    auraClass: '',
    rankOrder: 1,
  },
};

export function formatNumberFR(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
