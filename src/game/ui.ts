import type { Battle } from './battle';
import { ELEMENT_RULE_TEXT, TYPE_META, TYPE_ORDER } from './elements';
import { NAME_PRESETS, bossScript, getSpecies, practiceScript, SPECIES_LIST, STARTERS, stageElement } from './data';
import { AILMENT_LABEL, moveEffectLabel } from './ailments';
import { evolutionStatus, ITEM_LABEL } from './evolution';
import { aspectOf, currentObjective, formatPlay, grandmaFollowup, learnableMoves, maxHp, maxMp, profile, questObjectives, ridgeObjectives } from './logic';
import { SKILL_LIST, basicStrike, getMove, skillFormLabel, skillStats } from './skills';
import type { Input } from './input';
import { actorFor, actorPortraitHtml, battleFacing, bindStandingPortraits, speciesPortraitHtml, type PortraitFacing } from './portraits';
import type { MoveCat, MoveDef, PlayState, SpeciesId, TypeId } from './types';
import { CAT_LABEL, LOADOUT_LIMIT, TIER_LABEL, TIER_LEVEL } from './types';

function formMark(move: MoveDef): string {
  const effect = moveEffectLabel(move);
  const text = effect ? `${skillFormLabel(move)}·${effect}` : skillFormLabel(move);
  return `<span class="move-form">${text}</span>`;
}

function moveFacts(move: MoveDef): string {
  return `${TIER_LABEL[move.tier]} · ${skillFormLabel(move)} · ${CAT_LABEL[move.cat]}`;
}

export interface EncounterView {
  speciesId: SpeciesId;
  name: string;
  level: number;
  hp: number;
  max: number;
  type: string;
}

export interface CaptureView extends EncounterView {
  balls: number;
}

export interface GameHost {
  mode: string;
  play: PlayState | null;
  currentLog: string;
  logsDone: boolean;
  canAct: boolean;
  mustSwitch: boolean;
  switchOpen: boolean;
  saveExists: boolean;
  saveSummaryText: string;
  createName: string;
  selectedStarter: SpeciesId | null;
  nearbyLabel: string | null;
  shakeSuccess: boolean;
  muted: boolean;
  battle: Battle | null;
  encounterView: EncounterView | null;
  captureView: CaptureView | null;
  signView: { title: string; text: string } | null;
  npcId: string | null;
  dialogue: { speaker: string; text: string } | null;
  skillQuery: string;
  skillType: string;
  skillTier: string;
  skillCat: string;
  loadoutIndex: number;
  handle(act: string, arg?: string | null): void;
}

function shell(title: string, body: string, foot: string, extra = ''): string {
  return `<section class="sheet ${extra}"><header class="sheet-head">${title}</header><div class="sheet-body">${body}</div><footer class="sheet-foot">${foot}</footer></section>`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function hpMarkup(hp: number, max: number): string {
  const ratio = max <= 0 ? 0 : hp / max;
  const tone = ratio <= 0.28 ? 'low' : ratio <= 0.55 ? 'mid' : '';
  return `<div class="hp ${tone}"><span style="width:${Math.max(0, Math.min(100, ratio * 100))}%"></span></div><small>体力 ${hp}/${max}</small>`;
}

function typePill(type: string): string {
  const meta = TYPE_META[type as TypeId];
  if (!meta) return '';
  return `<span class="type" style="background:${meta.color}">${meta.label}</span>`;
}

function portrait(id: SpeciesId, faint = false, fit: 'stage' | 'card' | 'detail' | 'hud' = 'card', facing: PortraitFacing = 'front'): string {
  if (fit === 'hud') {
    return `<canvas class="portrait portrait-hud" data-fit="hud" data-species="${id}" data-faint="${faint ? '1' : '0'}" width="64" height="64" aria-hidden="true"></canvas>`;
  }
  return speciesPortraitHtml(id, fit, faint, facing);
}

function talkRow(actor: string | null, body: string, compact = false): string {
  const id = actor ? actorFor(actor) : null;
  if (!id) return body;
  return `<div class="talk-row">${actorPortraitHtml(id, compact)}<div class="talk-copy">${body}</div></div>`;
}

export function renderOverlay(root: HTMLElement, host: GameHost): void {
  const mode = host.mode;
  if (mode === 'explore') {
    root.innerHTML = '';
    return;
  }
  let inner = '';
  if (mode === 'title' || mode === 'confirm-new') {
    inner = titleSheet(host, mode === 'confirm-new');
  } else if (mode === 'create-name') {
    inner = shell('<p class="eyebrow">出发之前</p><h2>怎么称呼你？</h2>', talkRow('player', `<p>选一个旅伴称呼就好，不会上传，也不会当成真实姓名。</p><div class="stack">${NAME_PRESETS.map((name) => `<button class="btn ${host.createName === name ? 'leaf' : 'secondary'}" data-act="pick-name" data-arg="${esc(name)}">${esc(name)}</button>`).join('')}</div>`), `<div class="stack"><button class="btn" data-act="to-starter">选好了</button><button class="texty" data-act="title">返回</button></div>`);
  } else if (mode === 'create-starter') {
    inner = shell(`<p class="eyebrow">${esc(host.createName)} 的第一位伙伴</p><h2>选一只芽灵</h2>`, `<div class="choice-grid">${STARTERS.map((id) => {
      const species = getSpecies(id);
      return `<button class="choice ${host.selectedStarter === id ? 'selected' : ''}" data-act="pick-starter" data-arg="${id}">${portrait(id)}<strong>${species.name}</strong><div>${typePill(species.type)}</div><small>${esc(species.blurb)}</small></button>`;
    }).join('')}</div>`, `<div class="stack"><button class="btn leaf" data-act="confirm-starter" ${host.selectedStarter ? '' : 'disabled'}>和它一起出发</button><button class="texty" data-act="to-name">返回</button></div>`);
  } else if (mode === 'dialogue' && host.dialogue) {
    inner = shell(`<p class="eyebrow">${esc(host.dialogue.speaker)}</p>`, talkRow(host.dialogue.speaker, `<p class="dialogue-copy" data-act="dialogue-next">${esc(host.dialogue.text)}</p>`), `<p class="fine">点文字可跳过，也会自动继续</p>`);
  } else if (mode === 'encounter' && host.encounterView) {
    const view = host.encounterView;
    inner = shell(`<p class="eyebrow">野生芽灵</p><h2>${esc(view.name)}</h2>`, `<div class="stage" data-type="${esc(stageElement(view.type as TypeId))}">${portrait(view.speciesId, false, 'stage')}</div><p>${typePill(view.type)} ${view.level} 级</p>${hpMarkup(view.hp, view.max)}<p>可以邀请它同行，也可以先比试。体力越低，星芽球越容易成功。</p>`, `<div class="stack actions"><button class="btn leaf" data-act="encounter-catch">捕捉</button><button class="btn" data-act="encounter-fight">对战</button><button class="btn secondary" data-act="encounter-leave">先离开</button></div>`, 'encounter-sheet');
  } else if (mode === 'capture' && host.captureView) {
    const view = host.captureView;
    inner = shell(`<p class="eyebrow">星芽球 × ${view.balls}</p><h2>捕捉 ${esc(view.name)}</h2>`, `<div class="ring-wrap"><canvas id="catch-ring" width="240" height="240"></canvas></div><p id="catch-odds">等光环缩到绿圈上再投掷。</p>${hpMarkup(view.hp, view.max)}<p class="fine">空格或交谈键也可以投掷。完美时机会明显提高成功率。</p>`, `<div class="row"><button class="btn leaf" data-act="throw">投掷</button><button class="btn secondary" data-act="capture-back">先不扔</button></div>`);
  } else if (mode === 'shake' && host.captureView) {
    inner = shell(`<h2>${host.shakeSuccess ? '星芽球晃了三下' : '星芽球停住了'}</h2>`, `<p data-act="shake-skip">${host.shakeSuccess ? '它好像安稳下来了。' : '里面还在挣扎。'}</p>`, `<p class="fine">结果会自动继续</p>`);
  } else if (mode === 'battle' && host.battle && host.play) {
    inner = battleSheet(host);
  } else if (mode === 'menu') {
    const identity = host.play ? `<div class="identity">${actorPortraitHtml('player', true)}<div><strong>${esc(host.play.name)}</strong><span class="fine">旅人</span></div></div>` : '';
    inner = shell('<h2>菜单</h2>', `${identity}<div class="stack"><button class="btn secondary" data-act="panel" data-arg="team">队伍</button><button class="btn secondary" data-act="panel" data-arg="dex">图鉴</button><button class="btn secondary" data-act="panel" data-arg="elements">五行阴阳</button><button class="btn secondary" data-act="panel" data-arg="skilldex">技能图鉴</button><button class="btn secondary" data-act="panel" data-arg="bag">背包</button><button class="btn secondary" data-act="panel" data-arg="quest">委托</button><button class="btn secondary" data-act="panel" data-arg="help">操作说明</button><a class="btn secondary" href="./iso.html">2.5D 预览</a><a class="btn secondary" href="./view3d.html">3D 预览</a></div>`, `<div class="stack"><button class="btn" data-act="save">手动保存</button><button class="btn secondary" data-act="mute">${host.muted ? '打开音效' : '关闭音效'}</button><button class="btn secondary" data-act="title">回到标题</button><button class="texty" data-act="ask-reset">清除存档</button><button class="texty" data-act="close">关闭</button></div>`);
  } else if (mode === 'team' && host.play) {
    inner = teamSheet(host.play);
  } else if (mode === 'dex' && host.play) {
    inner = dexSheet(host.play);
  } else if (mode === 'bag' && host.play) {
    const items = host.play.items;
    inner = shell('<h2>背包</h2>', `<p><strong>星芽球 × ${host.play.balls}</strong></p><p>邀请芽灵同行时消耗。光环越接近绿色目标圈，成功率越高。少于 8 个时，在星芽驿休息会补到 8 个。</p><p><strong>${ITEM_LABEL.yanxinshi} × ${items.yanxinshi}</strong></p><p>火纹狐进化成炽焰狐时消耗 1 个。战胜或收服野生焰尾狐会得到 1 个。星芽岛南坡的余烬暖岩也能采集，拿走后再走 40 步会重新结出。</p><p><strong>${ITEM_LABEL.qingfengling} × ${items.qingfengling}</strong></p><p>铃羽鸟进化成瑶铃鸟时消耗 1 个。战胜或收服野生风铃鸟会得到 1 个。试炼林东侧的铃风枝也能采集，拿走后再走 40 步会重新结出。</p>`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
  } else if (mode === 'quest' && host.play) {
    const items = questObjectives(host.play.quest);
    const ridge = host.play.quest.completed || host.play.mapId === 'ridge'
      ? `<h3>星雾岭</h3>${ridgeObjectives(host.play.ridgeQuest).map((item) => `<div class="check ${item.done ? 'done' : ''}"><span>${esc(item.title)}</span><strong>${item.done ? '完成' : '进行中'}</strong></div>`).join('')}<p class="fine">${host.play.quest.completed ? '岛北路口已经通往星雾岭。岭北的雾还没开放。' : '完成岛上的委托后，岛北路口才会打开。'}</p>`
      : '<p class="fine">完成岛上的委托后，岛北路口才会通往星雾岭。南边的海还过不去。</p>';
    inner = shell('<h2>芽婆婆的委托</h2>', `${items.map((item) => `<div class="check ${item.done ? 'done' : ''}"><span>${esc(item.title)}</span><strong>${item.done ? '完成' : '进行中'}</strong></div>`).join('')}<p class="fine">做完两件事后，回星芽驿找芽婆婆复命。失败可以治疗后再试。</p>${ridge}`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
  } else if (mode === 'elements') {
    inner = elementsSheet();
  } else if (mode === 'skilldex') {
    inner = skilldexSheet(host);
  } else if (mode === 'loadout' && host.play) {
    inner = loadoutSheet(host);
  } else if (mode === 'help') {
    inner = shell('<h2>操作说明</h2>', `<p>电脑：WASD 或方向键移动，E / 空格 / 回车交谈，Esc 返回，数字键 1 到 4 使用已装备的技能。</p><p>手机：左下角摇杆移动，也可以在地图上按住拖动。右下角是交谈。菜单在右上角。</p><p>对话和战报会自动继续，点文字可以提前跳过。技能、捕捉、逃跑、休息和清除存档仍要自己点。</p><p>五行相克和技能图鉴都在菜单里。每只芽灵最多装备 4 个技能。</p>`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
  } else if (mode === 'confirm-reset') {
    inner = shell('<h2>清除这台设备上的存档？</h2>', '<p>伙伴、图鉴、星芽球和委托进度都会消失。此操作不能撤销，也不会自动执行。</p>', `<div class="row"><button class="btn" data-act="confirm-reset">确认清除</button><button class="btn secondary" data-act="cancel-reset">再想想</button></div>`);
  } else if (mode === 'npc' && host.npcId && host.play) {
    inner = npcSheet(host);
  } else if (mode === 'heal') {
    const ridge = host.play?.mapId === 'ridge';
    inner = shell(ridge ? '<p class="eyebrow">星雾岭</p><h2>要在岭南营地休息吗？</h2>' : '<p class="eyebrow">星芽驿</p><h2>要在这里休息吗？</h2>', '<p>队伍里的伙伴会恢复全部体力。星芽球如果少于 8 个，会补到 8 个。休息需要你自己确认。</p>', `<div class="row"><button class="btn leaf" data-act="heal-yes">休息</button><button class="btn secondary" data-act="close">离开</button></div>`);
  } else if (mode === 'sign' && host.signView) {
    inner = shell(`<p class="eyebrow">告示</p><h2>${esc(host.signView.title)}</h2>`, `<p data-act="close">${esc(host.signView.text)}</p>`, `<p class="fine">读完会自动返回</p>`);
  }
  const align = mode === 'title' || mode === 'confirm-new' ? 'title-dim' : '';
  root.innerHTML = `<div class="dim ${align}">${inner}</div>`;
  bindStandingPortraits(root);
}

function titleSheet(host: GameHost, confirm: boolean): string {
  if (confirm) {
    return shell('<h2>开始新旅程会覆盖存档</h2>', `<p>这台设备上的 ${esc(host.saveSummaryText)} 会被新的进度替换。这需要你确认，不会自动开始。</p>`, `<div class="row"><button class="btn" data-act="confirm-new">仍然开始</button><button class="btn secondary" data-act="title">返回</button></div>`, 'title-sheet');
  }
  return shell('<p class="eyebrow">原创芽灵小岛</p><h1>星芽岛</h1>', `<p class="lead">在明亮的岛上散步，认识会自己走动的芽灵。邀请它们同行，或友好地比试一场。</p><p class="fine">${host.saveExists ? esc(host.saveSummaryText) : '还没有旅程记录'}</p><p class="fine">进度只写在这台设备里。2.5D 和 3D 只是预览，不改这趟旅程的存档。</p>`, `<div class="stack"><button class="btn leaf" data-act="new-game">开始新旅程</button><button class="btn" data-act="continue" ${host.saveExists ? '' : 'disabled'}>继续旅程</button><a class="btn secondary" href="./iso.html">2.5D 预览</a><a class="btn secondary" href="./view3d.html">3D 预览</a><button class="texty" data-act="ask-reset">清除存档</button></div>`, 'title-sheet');
}

function petStats(mon: PlayState['team'][number]): string {
  const view = profile(mon);
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const cores: Array<[string, number]> = [
    ['体质', view.core.con],
    ['力量', view.core.str],
    ['智力', view.core.int],
    ['精神', view.core.spi],
    ['速度', view.core.spd],
  ];
  const derived: Array<[string, string | number]> = [
    ['生命', view.maxHp],
    ['法力', view.maxMp],
    ['物攻', view.physAtk],
    ['物防', view.physDef],
    ['魔攻', view.magAtk],
    ['魔防', view.magDef],
    ['命中', pct(view.hit)],
    ['闪避', pct(view.evasion)],
    ['出手', view.action],
  ];
  return `<div class="pet-stats"><p class="core-row">${cores.map(([label, value]) => `<span><b>${label}</b> ${value}</span>`).join('')}</p><p class="derived-row">${derived.map(([label, value]) => `<span>${label} ${value}</span>`).join('')}</p><p class="fine">体质提高生命和物防。力量提高物攻和物防。智力提高魔攻和魔防。精神提高法力、魔防和命中。速度提高出手、闪避和命中。这和五行属性是两套数。</p></div>`;
}

function teamSheet(play: PlayState): string {
  const cards = play.team.map((mon, index) => {
    const species = getSpecies(mon.speciesId);
    const max = maxHp(mon);
    const names = (mon.moves ?? []).map((id) => {
      const move = getMove(id);
      return `${esc(move.name)} ${skillFormLabel(move)}`;
    }).join(' · ');
    const evo = evolutionStatus(mon, play, (id) => getSpecies(id).name);
    const evolveButton = evo.ready ? `<button class="btn tiny leaf" data-act="evolve" data-arg="${index}">进化</button>` : '';
    return `<article class="mon-card ${index === 0 ? 'lead' : ''}">${portrait(mon.speciesId, mon.hp <= 0, 'detail')}<div class="mon-copy"><strong>${esc(species.name)}</strong> ${typePill(aspectOf(mon))} <span>${mon.level} 级</span>${hpMarkup(mon.hp, max)}<small>法力 ${mon.mp}/${maxMp(mon)}</small>${petStats(mon)}<p>${names}</p><p class="evo">${esc(evo.line)}</p><div class="row"><button class="btn tiny secondary" data-act="open-loadout" data-arg="${index}">技能</button><button class="btn tiny secondary" data-act="attune" data-arg="${index}">试炼</button>${evolveButton}${index === 0 ? '' : `<button class="btn tiny leaf" data-act="set-lead" data-arg="${index}">领队</button>`}</div>${index === 0 ? '<small>当前领队，会跟在身后</small>' : ''}</div></article>`;
  }).join('');
  const box = play.box.length
    ? play.box.map((mon) => `<span>${esc(getSpecies(mon.speciesId).name)} ${mon.level}级</span>`).join('、')
    : '寄存处还空着。队伍满六只后再捕捉，就会寄存在这里。';
  return shell('<h2>队伍</h2>', `<div class="mon-list">${cards}</div><h3>驿站寄存</h3><p>${box}</p><p class="fine">试炼可在阴阳之间切换。16 级后可以暂时进入纯阴或纯阳，神级技能 24 级学会。</p>`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
}

function dexSheet(play: PlayState): string {
  const caught = Object.values(play.dex).filter((entry) => entry.caught).length;
  const total = SPECIES_LIST.length;
  const cards = SPECIES_LIST.map((species) => {
    const entry = play.dex[species.id];
    if (!entry?.seen) return `<article class="dex-card unknown"><div class="portrait"></div><strong>？？？</strong><p>还没见过</p></article>`;
    return `<article class="dex-card">${portrait(species.id)}<strong>${esc(species.name)}</strong><div>${typePill(species.type)}</div><p>${entry.caught ? esc(species.dex) : '见过了，还没同行。'}</p></article>`;
  }).join('');
  return shell(`<h2>芽灵图鉴 ${caught}/${total}</h2>`, `<div class="dex-grid">${cards}</div>`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
}

function battleSheet(host: GameHost): string {
  const battle = host.battle;
  const play = host.play;
  if (!battle || !play) return '';
  const foe = battle.foes[battle.fIndex];
  const mine = battle.player[battle.pIndex];
  const foeSpecies = getSpecies(foe.speciesId);
  const mySpecies = getSpecies(mine.speciesId);
  const myAspect = aspectOf(mine);
  const basic = basicStrike(myAspect);
  const mineState = battle.runtime[mine.uid];
  const moves = (mine.moves ?? []).map((id, index) => {
    const move = getMove(id);
    const cooling = (mineState?.cd[id] ?? 0) > 0;
    const broke = (mine.mp ?? 0) < move.cost;
    return `<button class="btn" data-act="battle-move" data-arg="${index}" ${host.canAct && !cooling && !broke ? '' : 'disabled'}>${index + 1}. ${esc(move.name)}${formMark(move)}${move.cost > 0 ? ` ·${move.cost}` : ''}${cooling ? ` ${mineState.cd[id]}` : ''}</button>`;
  }).join('');
  const switches = battle.player.map((mon, index) => {
    const name = getSpecies(mon.speciesId).name;
    const disabled = mon.hp <= 0 || index === battle.pIndex;
    return `<button class="btn tiny secondary" data-act="switch" data-arg="${index}" ${disabled || (!host.canAct && !host.mustSwitch) ? 'disabled' : ''}>${esc(name)} ${mon.hp <= 0 ? '疲惫' : `${mon.hp}/${maxHp(mon)}`}</button>`;
  }).join('');
  const actions = host.mustSwitch
    ? `<p>选择还能战斗的伙伴。</p><div class="party">${switches}</div>`
    : host.canAct
      ? `<div class="moves"><button class="btn secondary" data-act="battle-basic" ${host.canAct ? '' : 'disabled'}>${esc(basic.name)}${formMark(basic)}</button>${moves}</div><div class="row battle-row"><button class="btn secondary" data-act="toggle-switch">更换</button>${battle.kind === 'wild' ? `<button class="btn leaf" data-act="battle-catch">捕捉</button><button class="btn secondary" data-act="battle-run">退开</button>` : ''}</div>${host.switchOpen ? `<div class="party">${switches}</div>` : ''}`
      : `<p class="auto-note">回合自动继续</p>`;
  const foeAspect = aspectOf(foe);
  const foeState = battle.runtime[foe.uid];
  const tags = [
    foeState?.shield ? `护盾${foeState.shield}` : '',
    foeState?.dotTurns ? `持续${foeState.dotTurns}` : '',
    foeState?.ailment ? `${AILMENT_LABEL[foeState.ailment]} ${foeState.ailmentTurns}` : '',
  ].filter(Boolean).map((text) => `<span class="status-tag">${text}</span>`).join('');
  const body = `<div class="stage battle-stage" data-type="${esc(stageElement(foeAspect))}"><div class="battle-top"><div><p class="eyebrow">${battle.kind === 'trainer' ? esc(battle.trainerName) : '野生'}</p><h2>${esc(foeSpecies.name)} ${foe.level} 级</h2>${typePill(foeAspect)}${hpMarkup(foe.hp, maxHp(foe))}<small>法力 ${foe.mp}/${maxMp(foe)}</small><div class="status-row">${tags}</div></div>${portrait(foe.speciesId, foe.hp <= 0, 'stage', battleFacing('foe'))}</div></div><div class="log">${esc(host.currentLog || '……')}</div><div class="battle-bottom">${portrait(mine.speciesId, mine.hp <= 0, 'card', battleFacing('player'))}<div><strong>${esc(mySpecies.name)}</strong> ${mine.level} 级 ${typePill(myAspect)}${hpMarkup(mine.hp, maxHp(mine))}<small>法力 ${mine.mp}/${maxMp(mine)}</small></div></div>`;
  return shell('', body, `<div class="actions">${actions}</div>`, 'battle-sheet');
}

function npcSheet(host: GameHost): string {
  const play = host.play;
  if (!play || !host.npcId) return '';
  if (host.npcId === 'grandma') {
    const lines = grandmaFollowup(play.quest, play.ridgeQuest.completed);
    const ready = play.quest.caughtWild && play.quest.bossDefeated && !play.quest.completed;
    return shell('<p class="eyebrow">星芽驿</p><h2>芽婆婆</h2>', talkRow('grandma', lines.map((line) => `<p>${esc(line)}</p>`).join('')), `<div class="stack"><button class="btn leaf" data-act="npc-heal">休息治疗</button>${ready ? '<button class="btn" data-act="npc-quest">向她复命</button>' : '<button class="btn secondary" data-act="npc-quest">再说说委托</button>'}<button class="texty" data-act="close">离开</button></div>`);
  }
  if (host.npcId === 'qinghe') {
    const done = play.trainers.qinghe;
    return shell('<h2>青禾</h2>', talkRow('qinghe', practiceScript(done).map((line) => `<p>${esc(line.text)}</p>`).join('')), `<div class="row"><button class="btn" data-act="npc-fight">${done ? '再练一次' : '请多指教'}</button><button class="btn secondary" data-act="close">下次再说</button></div>`);
  }
  if (host.npcId === 'lanchuan') {
    const done = play.trainers.lanchuan;
    return shell('<h2>岚川</h2>', talkRow('lanchuan', bossScript(done).map((line) => `<p>${esc(line.text)}</p>`).join('')), `<div class="row"><button class="btn" data-act="npc-fight">${done ? '再战一次' : '开始试炼'}</button><button class="btn secondary" data-act="close">再准备一下</button></div>`);
  }
  if (host.npcId === 'wushou') {
    const quest = play.ridgeQuest;
    const ready = quest.caught && quest.trial && !quest.completed;
    const lines = quest.completed
      ? ['岭上的委托已经做完了。南边台阶回星芽岛，北边的雾还关着。', '雾灯蛾要在这岭上才能进入最后的形态。别的芽灵回岛也能进化。']
      : ['我是雾守。星雾岭上的芽灵和岛上的不是同一种。', '先收服一只，再去北面让石岭看看你们。北边的牌子后面没有下一张地图。'];
    return shell('<p class="eyebrow">星雾岭</p><h2>雾守</h2>', talkRow('雾守', lines.map((line) => `<p>${esc(line)}</p>`).join('')), `<div class="stack"><button class="btn leaf" data-act="npc-heal">休息治疗</button>${ready || quest.completed ? '<button class="btn" data-act="npc-quest">向她复命</button>' : '<button class="btn secondary" data-act="npc-quest">再说说委托</button>'}<button class="texty" data-act="close">离开</button></div>`);
  }
  if (host.npcId === 'shiling') {
    const done = play.trainers.shiling;
    const lines = done
      ? ['试炼已经通过了。想再练可以，这次不再发星芽球。', '雾守在岭南等你。再往北的路还没开。']
      : ['我是石岭。岛上的试炼和这里不是同一场。', '我的伙伴比岛上的更老练。准备好再开始，撑不住就回岭南营地。'];
    return shell('<h2>石岭</h2>', talkRow('石岭', lines.map((line) => `<p>${esc(line)}</p>`).join('')), `<div class="row"><button class="btn" data-act="npc-fight">${done ? '再战一次' : '开始试炼'}</button><button class="btn secondary" data-act="close">再准备一下</button></div>`);
  }
  return '';
}

function elementsSheet(): string {
  const pills = TYPE_ORDER.map((id) => typePill(id)).join('');
  return shell('<h2>五行阴阳</h2>', `<div class="type-row">${pills}</div><p>${esc(ELEMENT_RULE_TEXT)}</p><p class="fine">十二种属性都能在技能图鉴里检索。野生芽灵带着各自五行的阴阳，16 级后可在队伍里把伙伴试炼成纯阴或纯阳。</p>`, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
}

export function skillResultsHtml(host: GameHost): string {
  const stats = skillStats();
  const query = host.skillQuery.trim();
  const list = SKILL_LIST.filter((move) => {
    if (host.skillType !== 'all' && move.type !== host.skillType) return false;
    if (host.skillTier !== 'all' && move.tier !== host.skillTier) return false;
    if (host.skillCat !== 'all' && move.cat !== host.skillCat) return false;
    if (query && !move.name.includes(query) && !move.desc.includes(query)) return false;
    return true;
  });
  const cards = list.slice(0, 80).map((move) => `<article class="skill-card"><strong>${esc(move.name)}</strong><div>${typePill(move.type)} <span>${moveFacts(move)}</span></div><p>${esc(move.desc)}</p></article>`).join('');
  return `<p class="fine">共 ${stats.total} 个技能，当前显示 ${list.length} 个。每属性 ${stats.perType.yangmu ?? 0} 个。</p>${cards || '<p>没有符合的技能。</p>'}`;
}

function skilldexSheet(host: GameHost): string {
  const typeButtons = [`<button class="btn tiny ${host.skillType === 'all' ? '' : 'secondary'}" data-act="skill-type" data-arg="all">全部</button>`, ...TYPE_ORDER.map((id) => `<button class="btn tiny ${host.skillType === id ? '' : 'secondary'}" data-act="skill-type" data-arg="${id}">${TYPE_META[id].label}</button>`)].join('');
  const tiers = (['all', 'basic', 'mid', 'high', 'divine'] as const).map((id) => `<button class="btn tiny ${host.skillTier === id ? '' : 'secondary'}" data-act="skill-tier" data-arg="${id}">${id === 'all' ? '全阶' : TIER_LABEL[id]}</button>`).join('');
  const cats = (['all', 'attack', 'guard', 'heal', 'aid', 'status'] as const).map((id) => `<button class="btn tiny ${host.skillCat === id ? '' : 'secondary'}" data-act="skill-cat" data-arg="${id}">${id === 'all' ? '全类' : CAT_LABEL[id as MoveCat]}</button>`).join('');
  const body = `<div class="filter-row">${typeButtons}</div><div class="filter-row">${tiers}</div><div class="filter-row">${cats}</div><label class="skill-search">搜索<input id="skill-q" value="${esc(host.skillQuery)}" placeholder="技能名" autocomplete="off"></label><div id="skill-results">${skillResultsHtml(host)}</div>`;
  return shell('<h2>技能图鉴</h2>', body, `<button class="btn secondary" data-act="panel" data-arg="menu">返回</button>`);
}

function loadoutSheet(host: GameHost): string {
  const play = host.play;
  if (!play) return '';
  const mon = play.team[host.loadoutIndex] ?? play.team[0];
  if (!mon) return shell('<h2>技能</h2>', '<p>队伍是空的。</p>', `<button class="btn secondary" data-act="panel" data-arg="team">返回</button>`);
  const equipped = new Set(mon.moves ?? []);
  const known = learnableMoves(mon);
  const cards = known.map((move) => `<button class="skill-card ${equipped.has(move.id) ? 'on' : ''}" data-act="equip-move" data-arg="${move.id}"><strong>${esc(move.name)}</strong><span>${moveFacts(move)} · ${TIER_LEVEL[move.tier]}级</span><small>${esc(move.desc)}</small></button>`).join('');
  return shell(`<h2>${esc(getSpecies(mon.speciesId).name)}的技能</h2>`, `<div class="talk-row">${portrait(mon.speciesId, mon.hp <= 0, 'card')}<div class="talk-copy"><p>${typePill(aspectOf(mon))} 已装备 ${equipped.size}/${LOADOUT_LIMIT}。点一下装备或卸下。神级要 24 级。</p></div></div><div class="skill-list">${cards}</div>`, `<button class="btn secondary" data-act="panel" data-arg="team">返回队伍</button>`);
}

export function mountTouch(el: HTMLElement, input: Input, onAct: (act: string) => void): void {
  el.innerHTML = `<div class="touch-left"><div class="joy" id="joy" role="slider" aria-label="摇杆移动" aria-valuemin="0" aria-valuemax="1"><div class="knob"></div></div></div><div class="touch-right"><button type="button" id="btn-touch-talk">交谈</button></div>`;
  el.querySelector('#btn-touch-talk')?.addEventListener('click', () => onAct('interact'));
  const joy = el.querySelector<HTMLElement>('#joy');
  const knob = el.querySelector<HTMLElement>('.knob');
  if (!joy || !knob) return;
  const move = (event: PointerEvent) => {
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = rect.width / 2 - 8;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.joyX = dx / max;
    input.joyY = dy / max;
  };
  const end = () => {
    input.joyX = 0;
    input.joyY = 0;
    knob.style.transform = 'translate(0, 0)';
  };
  joy.addEventListener('pointerdown', (event) => {
    joy.setPointerCapture(event.pointerId);
    move(event);
  });
  joy.addEventListener('pointermove', (event) => {
    if (!joy.hasPointerCapture(event.pointerId)) return;
    move(event);
  });
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
}

export function hudHtml(host: GameHost): string {
  if (host.mode !== 'explore' || !host.play) return '';
  const lead = host.play.team[0];
  const species = getSpecies(lead.speciesId);
  const caught = Object.values(host.play.dex).filter((entry) => entry.caught).length;
  const total = SPECIES_LIST.length;
  const mapName = host.play.mapId === 'ridge' ? '星雾岭' : '星芽岛';
  const quest = `<small class="quest-chip">${esc(currentObjective(host.play))}</small>`;
  return `<div class="hud-left"><div class="hud-portrait">${portrait(lead.speciesId, lead.hp <= 0, 'hud')}</div><div class="hud-copy"><strong>${esc(species.name)}</strong><span>${lead.level} 级 ${typePill(aspectOf(lead))}</span>${hpMarkup(lead.hp, maxHp(lead))}${quest}</div></div><div class="hud-right"><strong class="map-chip">${mapName}</strong><strong>星芽球 ${host.play.balls}</strong><span>图鉴 ${caught}/${total}</span><div class="row"><button class="btn tiny secondary" data-act="mute">${host.muted ? '音效关' : '音效开'}</button><button class="btn tiny" data-act="menu">菜单</button></div></div><div class="hint">WASD / 方向键移动 · E 交谈 · Esc 菜单</div>${host.nearbyLabel ? `<button class="prompt btn" data-act="interact">${esc(host.nearbyLabel)}</button>` : ''}<p class="fine" style="position:absolute;left:-999px">已游玩 ${formatPlay(host.play.playMs)}</p>`;
}
