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
  '五行相克：金克木，木克土，土克水，水克火，火克金。克制时伤害为 2 倍，被克时为 0.75 倍。',
  '五行相生：金生水，水生木，木生火，火生土，土生金。相生会轻轻化掉或扶助伤害，不会变成治疗循环。',
  '同一五行里，阴和阳互相克制，双向都是 1.5 倍。例如阴金打阳金，阳金打阴金也一样。',
  '纯阴和纯阳没有五行，不和金木水火土相克，也不和它们做阴阳互克。纯阴与纯阳彼此是 1.5 倍。同一种属性打自己是 0.9 倍。',
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
  let element = 1;
  let pole = 1;
  let same = 1;
  const ae = elementOf(attack);
  const de = elementOf(defense);
  if (ae !== 'pure' && de !== 'pure') {
    if (BEATS[ae] === de) {
      element = 2;
      notes.push('效果拔群');
    } else if (BEATS[de] === ae) {
      element = 0.75;
      notes.push('效果不利');
    } else if (FEEDS[ae] === de) {
      element = 0.85;
      notes.push('相生化劲');
    } else if (FEEDS[de] === ae) {
      element = 1.15;
      notes.push('得相生');
    }
    if (ae === de && TYPE_META[attack].pole !== TYPE_META[defense].pole) {
      pole = 1.5;
      notes.push('阴阳互克');
    }
  } else if ((attack === 'chunyang' && defense === 'chunyin') || (attack === 'chunyin' && defense === 'chunyang')) {
    pole = 1.5;
    notes.push('阴阳互克');
  }
  if (attack === defense) {
    same = 0.9;
    notes.push('同气');
  }
  const mult = Math.max(0.75, Math.min(2, Math.round(element * pole * same * 100) / 100));
  return { mult, notes };
}

export function effectiveness(attack: TypeId, defense: TypeId): number {
  return relate(attack, defense).mult;
}
