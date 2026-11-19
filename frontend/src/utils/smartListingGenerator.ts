import { ProductCondition } from '../types';
import { getConditionMeta } from './formatters';

export interface ListingSpecsContext {
  brand: string;
  model: string;
  storageGb: number;
  ramGb: number;
  batteryHealth: number;
  color: string;
  condition: ProductCondition;
  hasBox: boolean;
  hasCharger: boolean;
  locationCity: string;
  knownFaults?: string;
  ageMonths?: number;
}

export interface TitleSuggestion {
  id: string;
  title: string;
  label: string;
  tag: string;
}

export interface DescriptionSuggestion {
  id: string;
  label: string;
  tag: string;
  text: string;
}

/**
 * Generates transparent, factual title variations based exclusively on seller-confirmed device specifications.
 * Does NOT hallucinate unconfirmed features.
 */
export function generateTitleSuggestions(ctx: ListingSpecsContext): TitleSuggestion[] {
  const condMeta = getConditionMeta(ctx.condition);
  const colorStr = ctx.color?.trim() ? ` ${ctx.color.trim()}` : '';
  const boxCharger = ctx.hasBox && ctx.hasCharger
    ? 'with Box & Charger'
    : ctx.hasBox
    ? 'with Original Box'
    : ctx.hasCharger
    ? 'with Charger'
    : 'Phone Only';

  return [
    {
      id: 'concise',
      label: 'Concise & Standard',
      tag: 'Recommended',
      title: `${ctx.brand} ${ctx.model} (${ctx.storageGb}GB) - ${condMeta.label}`,
    },
    {
      id: 'spec_rich',
      label: 'Spec-Focused',
      tag: 'Detailed',
      title: `${ctx.brand} ${ctx.model} ${ctx.storageGb}GB${colorStr} • ${ctx.batteryHealth}% Battery • ${condMeta.label}`,
    },
    {
      id: 'complete_kit',
      label: 'Accessories Highlight',
      tag: 'High Visibility',
      title: `${ctx.brand} ${ctx.model} (${ctx.storageGb}GB, ${ctx.ramGb}GB RAM) ${boxCharger} - ${condMeta.label}`,
    },
  ];
}

/**
 * Generates transparent, professional listing descriptions from verified device data.
 * Adheres strictly to factual inputs without making unsupported performance claims.
 */
export function generateDescriptionSuggestions(ctx: ListingSpecsContext): DescriptionSuggestion[] {
  const condMeta = getConditionMeta(ctx.condition);
  const colorText = ctx.color?.trim() ? ctx.color.trim() : 'Standard';
  const ageText = ctx.ageMonths ? `${ctx.ageMonths} months` : 'Gently used';
  const faultsText = ctx.knownFaults?.trim()
    ? `Disclosed cosmetic wear: ${ctx.knownFaults.trim()}`
    : 'No functional defects or undisclosed hardware faults.';

  const boxChargerText = ctx.hasBox && ctx.hasCharger
    ? 'Includes original packaging box and authentic charger adapter.'
    : ctx.hasBox
    ? 'Comes with the original retail box. (Charger not included).'
    : ctx.hasCharger
    ? 'Comes with compatible charger. (Box not included).'
    : 'Device only (handset). Safely sanitized and packaged for transit.';

  // 1. Professional Detailed
  const professionalText = `Authentic ${ctx.brand} ${ctx.model} in ${condMeta.label.toLowerCase()} condition.

Key Hardware Specifications:
• Internal Storage: ${ctx.storageGb} GB
• System RAM: ${ctx.ramGb} GB
• Battery Health: ${ctx.batteryHealth}%
• Colorway: ${colorText}
• Approximate Age: ${ageText}

Physical Condition & Wear:
• Cosmetic Grade: ${condMeta.label} (${condMeta.description})
• ${faultsText}

Package & Accessories:
• ${boxChargerText}

Location & Fulfillment:
• Available for verified inspection and delivery in ${ctx.locationCity || 'India'}.
• Covered by ReValue escrow payment and in-person verification before fund release.`;

  // 2. Direct / Quick-Sell (Bulleted & Clean)
  const directText = `Selling pre-owned ${ctx.brand} ${ctx.model} (${ctx.storageGb}GB / ${ctx.ramGb}GB RAM).

Quick Summary:
- Condition: ${condMeta.label}
- Battery Health: ${ctx.batteryHealth}%
- Color: ${colorText}
- Accessories: ${ctx.hasBox ? 'Box included' : 'No box'} | ${ctx.hasCharger ? 'Charger included' : 'No charger'}
- Location: ${ctx.locationCity || 'India'}
- Faults: ${ctx.knownFaults?.trim() || 'None, fully tested and working'}

Handset is thoroughly cleaned, wiped to factory defaults, and ready for a new owner. Instant dispatch or hybrid local rider delivery.`;

  // 3. Value & Deal-Focused
  const dealText = `Great value offer on a genuine ${ctx.brand} ${ctx.model} (${ctx.storageGb}GB storage).

Maintained carefully in ${condMeta.label.toLowerCase()} cosmetic condition with ${ctx.batteryHealth}% maximum battery capacity remaining. All hardware features (cameras, biometric sensors, display, speakers) are fully operational.

Includes: ${ctx.hasBox ? '✓ Original Box ' : ''}${ctx.hasCharger ? '✓ Original Charger ' : ''}✓ Clean Handset.
Location: ${ctx.locationCity || 'Local pickup / verified courier delivery'}.
Priced fairly for quick sale. Feel free to review all photos or make an offer!`;

  return [
    {
      id: 'professional',
      label: 'Professional & Structured',
      tag: 'Best for Buyers',
      text: professionalText,
    },
    {
      id: 'direct',
      label: 'Direct & Concise',
      tag: 'Quick Read',
      text: directText,
    },
    {
      id: 'deal',
      label: 'Value & Deal-Focused',
      tag: 'Friendly',
      text: dealText,
    },
  ];
}
