import type { ElementId, TypeId } from './types';

export const TYPE_ORDER: TypeId[] = [
  'yinjin', 'yangjin', 'yinmu', 'yangmu', 'yinshui', 'yangshui',
  'yinhuo', 'yanghuo', 'yintu', 'yangtu', 'chunyin', 'chunyang',
];

export const TYPE_META: Record<TypeId, { label: string; color: string; soft: string; element: ElementId | 'pure'; pole: 'yin' | 'yang' }> = {
  yinjin: { label: '阴金', color: '#6e7d92', soft: '#e7edf4', element: 'jin', pole: 'yin' },
  yangjin: { label: '阳金', color: '#d4a24a', soft: '#fff3d8', element: 'jin', pole: 'yang' },
  yinmu: { label: '阴木', color: '#3f7a55', soft: '#e5f4ea', element: 'mu', pole: 'yin' },
  yangmu: { label: '阳木', color: '#67b85a', soft: '#eefae8', element: 'mu', pole: 'yang' },
  yinshui: { label: '阴水', color: '#3d7ea8', soft: '#e5f3fb', element: 'shui', pole: 'yin' },
  yangshui: { label: '阳水', color: '#3db7c9', soft: '#e7fafc', element: 'shui', pole: 'yang' },
  yinhuo: { label: '阴火', color: '#b85a3a', soft: '#fdeee6', element: 'huo', pole: 'yin' },
  yanghuo: { label: '阳火', color: '#ef6844', soft: '#ffe8e1', element: 'huo', pole: 'yang' },
  yintu: { label: '阴土', color: '#8a6a45', soft: '#f6eee4', element: 'tu', pole: 'yin' },
  yangtu: { label: '阳土', color: '#c49a55', soft: '#fff6e4', element: 'tu', pole: 'yang' },
  chunyin: { label: '纯阴', color: '#5c5378', soft: '#eeeaf6', element: 'pure', pole: 'yin' },
  chunyang: { label: '纯阳', color: '#e0b13a', soft: '#fff8e2', element: 'pure', pole: 'yang' },
};

const BEATS: Record<ElementId, ElementId> = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' };
const FEEDS: Record<ElementId, ElementId> = { jin: 'shui', shui: 'mu', mu: 'huo', huo: 'tu', tu: 'jin' };

export const ELEMENT_RULE_TEXT = [
  '五行相克：金克木，木克土，土克水，水克火，火克金。相克时伤害提高，但只到 1.5 倍。',
  '五行相生：金生水，水生木，木生火，火生土，土生金。相生会轻轻化掉或扶助伤害，不会变成治疗循环。',
  '阴阳：阳打阴略强（1.1）。阴打阳不额外加成。同一种属性互击为 0.9，避免同属性对刷。',
  '纯阴与纯阳彼此对立，伤害 1.2 倍，并且不能叠到相克之上超过 1.6 倍。纯阴纯阳没有五行相生，所以不会无限补血。',
  '治疗、护盾各自有上限：单次治疗不超过最大体力的 40%，护盾总量不超过 35%。控制最多定住 1 回合，而且不能连着补控。',
].join('');

export interface TypeRelation {
  mult: number;
  notes: string[];
}

function elementOf(type: TypeId): ElementId | 'pure' {
  return TYPE_META[type].element;
}

export function relate(attack: TypeId, defense: TypeId): TypeRelation {
  const notes: string[] = [];
  let mult = 1;
  const ae = elementOf(attack);
  const de = elementOf(defense);
  if (ae !== 'pure' && de !== 'pure') {
    if (BEATS[ae] === de) {
      mult *= 1.5;
      notes.push('相克');
    } else if (BEATS[de] === ae) {
      mult *= 0.75;
      notes.push('受克');
    } else if (FEEDS[ae] === de) {
      mult *= 0.85;
      notes.push('相生化劲');
    } else if (FEEDS[de] === ae) {
      mult *= 1.15;
      notes.push('得相生');
    }
  }
  const ap = TYPE_META[attack].pole;
  const dp = TYPE_META[defense].pole;
  if (attack === 'chunyang' && defense === 'chunyin') {
    mult *= 1.2;
    notes.push('纯阳对纯阴');
  } else if (attack === 'chunyin' && defense === 'chunyang') {
    mult *= 1.2;
    notes.push('纯阴对纯阳');
  } else if (ap === 'yang' && dp === 'yin') {
    mult *= 1.1;
    notes.push('阳盛');
  }
  if (attack === defense) {
    mult *= 0.9;
    notes.push('同气');
  }
  mult = Math.max(0.7, Math.min(1.6, Math.round(mult * 100) / 100));
  return { mult, notes };
}

export function effectiveness(attack: TypeId, defense: TypeId): number {
  return relate(attack, defense).mult;
}
