import React from 'react';
import { ExternalLink, Lock } from 'lucide-react';
import { CardRecord } from '../types';
import { formatNumberFR, RARITY_META } from '../lib/rarity';

interface EncyclopediaCardProps {
  card: CardRecord;
  ownedCount?: number;
  serialNumber?: number;
  lockedForAuction?: boolean;
  isNewDiscovery?: boolean;
  faceDown?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

function CategoryCrestSVG({ category, color }: { category: string; color: string }) {
  const cat = category.toLowerCase();
  if (cat.includes('fruit')) {
    return (
      <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-85" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="32" cy="34" r="20" strokeOpacity="0.45" />
        <path d="M32 14 C36 8, 44 8, 42 14 C39 17, 34 15, 32 14 Z" />
        <path d="M24 30 C24 23, 38 22, 38 31 C38 39, 25 40, 26 33 C27 29, 33 29, 33 33" strokeLinecap="round" />
        <path d="M18 38 C21 46, 30 50, 39 47" strokeOpacity="0.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (cat.includes('lieu') || cat.includes('île')) {
    return (
      <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-85" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="32" cy="32" r="22" strokeOpacity="0.4" />
        <circle cx="32" cy="32" r="16" strokeDasharray="3 3" strokeOpacity="0.6" />
        <polygon points="32,10 36,28 54,32 36,36 32,54 28,36 10,32 28,28" fill={color} fillOpacity="0.12" />
        <circle cx="32" cy="32" r="3" fill={color} />
      </svg>
    );
  }
  if (cat.includes('navire')) {
    return (
      <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-85" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="32" cy="32" r="16" />
        <circle cx="32" cy="32" r="5" />
        <line x1="32" y1="8" x2="32" y2="56" />
        <line x1="8" y1="32" x2="56" y2="32" />
        <line x1="15" y1="15" x2="49" y2="49" />
        <line x1="49" y1="15" x2="15" y2="49" />
      </svg>
    );
  }
  if (cat.includes('arme') || cat.includes('relique') || cat.includes('histoire') || cat.includes('lore')) {
    return (
      <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-85" fill="none" stroke={color} strokeWidth="1.6">
        <rect x="14" y="12" width="36" height="40" rx="2" fill={color} fillOpacity="0.1" />
        <rect x="18" y="16" width="28" height="32" strokeOpacity="0.5" />
        <line x1="23" y1="23" x2="41" y2="23" />
        <line x1="23" y1="30" x2="37" y2="30" />
        <line x1="23" y1="37" x2="41" y2="37" />
        <line x1="23" y1="43" x2="33" y2="43" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-85" fill="none" stroke={color} strokeWidth="1.6">
      <path d="M32 10 L50 18 V32 C50 44 41 51 32 55 C23 51 14 44 14 32 V18 L32 10 Z" fill={color} fillOpacity="0.1" />
      <path d="M32 15 L45 21 V31 C45 40 38 46 32 49 C26 46 19 40 19 31 V21 L32 15 Z" strokeOpacity="0.5" />
      <circle cx="32" cy="31" r="6" />
      <path d="M24 39 L40 23 M24 23 L40 39" strokeOpacity="0.65" />
    </svg>
  );
}

export const EncyclopediaCard: React.FC<EncyclopediaCardProps> = ({
  card,
  ownedCount,
  serialNumber,
  lockedForAuction,
  isNewDiscovery,
  faceDown = false,
  compact = false,
  onClick,
}) => {
  const meta = RARITY_META[card.rarity] || RARITY_META.COMMUNE;

  if (faceDown) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative w-full aspect-[5/7] rounded-xl border-2 border-[#D4AF37]/60 bg-gradient-to-b from-[#161F33] via-[#0E1422] to-[#131B2E] p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-transform duration-200 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
      >
        <div className="w-full h-full rounded-lg border border-[#D4AF37]/30 flex flex-col items-center justify-between p-4 relative overflow-hidden">
          <div className="text-[11px] font-mono-tabular tracking-widest text-[#D4AF37]/80">
            ARCHIVE SCELLÉE
          </div>

          <div className="my-auto flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full border border-[#D4AF37]/50 flex items-center justify-center bg-[#D4AF37]/5 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none" stroke="#D4AF37" strokeWidth="1.5">
                <circle cx="32" cy="32" r="24" strokeDasharray="4 3" />
                <polygon points="32,8 37,27 56,32 37,37 32,56 27,37 8,32 27,27" fill="#D4AF37" fillOpacity="0.18" />
                <circle cx="32" cy="32" r="4" fill="#D4AF37" />
              </svg>
            </div>
            <div className="font-display text-sm tracking-wider text-[#F3D266]">
              GL COLLECTOR
            </div>
            <div className="text-xs text-slate-400">
              Cliquer pour révéler
            </div>
          </div>

          <div className="text-[10px] text-slate-500">
            Édition Certifiée
          </div>
        </div>
      </button>
    );
  }

  const monogram = card.name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative w-full rounded-xl border-2 ${meta.borderClass} bg-gradient-to-b ${meta.bgGradientClass} ${meta.auraClass} p-2.5 flex flex-col justify-between transition-transform duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-1' : ''
      } select-none`}
    >
      <div
        className={`relative w-full h-full rounded-lg border ${meta.innerBorderClass} p-3 flex flex-col justify-between gap-2 bg-[#0B101B]/55`}
      >
        <svg className="absolute top-1.5 left-1.5 w-3 h-3 pointer-events-none opacity-60" viewBox="0 0 16 16" fill="none" stroke={meta.sealColorHex} strokeWidth="1.5">
          <path d="M1 15 V1 H15" />
        </svg>
        <svg className="absolute top-1.5 right-1.5 w-3 h-3 pointer-events-none opacity-60" viewBox="0 0 16 16" fill="none" stroke={meta.sealColorHex} strokeWidth="1.5">
          <path d="M15 15 V1 H1" />
        </svg>
        <svg className="absolute bottom-1.5 left-1.5 w-3 h-3 pointer-events-none opacity-60" viewBox="0 0 16 16" fill="none" stroke={meta.sealColorHex} strokeWidth="1.5">
          <path d="M1 1 V15 H15" />
        </svg>
        <svg className="absolute bottom-1.5 right-1.5 w-3 h-3 pointer-events-none opacity-60" viewBox="0 0 16 16" fill="none" stroke={meta.sealColorHex} strokeWidth="1.5">
          <path d="M15 1 V15 H1" />
        </svg>

        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`font-semibold tracking-wide ${meta.textAccentClass}`}>
              {meta.label}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono-tabular text-[10px] text-slate-400">
              Popularité
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono-tabular">
            {isNewDiscovery && (
              <span className="text-amber-300 font-semibold text-[11px]">Nouveau</span>
            )}
            {serialNumber !== undefined && (
              <span className="text-slate-200 font-semibold">#{serialNumber}</span>
            )}
            {ownedCount !== undefined && ownedCount > 0 && serialNumber === undefined && (
              <span className="text-[#F3D266] font-semibold">×{ownedCount}</span>
            )}
            {lockedForAuction && (
              <span className="inline-flex items-center gap-1 text-amber-400" title="Verrouillé aux enchères">
                <Lock className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm sm:text-base font-bold text-[#F8F5EE] leading-snug tracking-wide line-clamp-1">
            {card.name}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
            <span className="truncate">{card.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-[10px] text-slate-500">
              #{card.fandomPageId}
            </span>
          </div>
        </div>

        {!compact && (
          <div className="relative py-2 px-2.5 rounded-md border border-white/10 bg-[#080C15]/80 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-2.5">
              <CategoryCrestSVG category={card.category} color={meta.sealColorHex} />
              <div>
                <div className="text-[10px] text-slate-400">
                  Fréquentation (12 mois)
                </div>
                <div className={`font-mono-tabular text-xs font-semibold ${meta.textAccentClass}`}>
                  {formatNumberFR(card.annualViews)} visites
                </div>
              </div>
            </div>
            <div
              className="font-display text-base font-bold opacity-30 tracking-widest"
              style={{ color: meta.sealColorHex }}
            >
              {monogram}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between">
          <p
            className={`text-xs text-slate-300/95 leading-relaxed ${
              compact ? 'line-clamp-2' : 'line-clamp-3'
            }`}
          >
            {card.description}
          </p>

          <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="truncate">
              Collection : <strong className="font-medium text-slate-300">GL Collector</strong>
            </span>
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-[#F3D266] transition-colors shrink-0"
              title="Consulter l'article"
            >
              <span>Article</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
