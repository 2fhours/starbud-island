import type { Battle } from './battle';
import { NAME_PRESETS, bossScript, getMove, getSpecies, practiceScript, SPECIES_LIST, STARTERS, TYPE_META } from './data';
import { formatPlay, grandmaFollowup, maxHp, questObjectives } from './logic';
import type { Input } from './input';
import type { PlayState, SpeciesId } from './types';

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
  handle(act: string, arg?: string | null): void;
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
  const meta = TYPE_META[type as keyof typeof TYPE_META];
  if (!meta) return '';
  return `<span class="type" style="background:${meta.color}">${meta.label}</span>`;
}

function portrait(id: SpeciesId, faint = false, fit: 'stage' | 'card' | 'hud' = 'card'): string {
  const size = fit === 'stage' ? [156, 138] : fit === 'hud' ? [64, 64] : [88, 88];
  return `<canvas class="portrait portrait-${fit}" data-fit="${fit}" data-species="${id}" data-faint="${faint ? '1' : '0'}" width="${size[0]}" height="${size[1]}" aria-hidden="true"></canvas>`;
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
    inner = `<section class="sheet"><p class="eyebrow">出发之前</p><h2>怎么称呼你？</h2><p>选一个旅伴称呼就好，不会上传，也不会当成真实姓名。</p><div class="stack">${NAME_PRESETS.map((name) => `<button class="btn ${host.createName === name ? 'leaf' : 'secondary'}" data-act="pick-name" data-arg="${esc(name)}">${esc(name)}</button>`).join('')}<button class="btn" data-act="to-starter">选好了</button><button class="texty" data-act="title">返回</button></div></section>`;
  } else if (mode === 'create-starter') {
    inner = `<section class="sheet"><p class="eyebrow">${esc(host.createName)} 的第一位伙伴</p><h2>选一只芽灵</h2><div class="choice-grid">${STARTERS.map((id) => {
      const species = getSpecies(id);
      return `<button class="choice ${host.selectedStarter === id ? 'selected' : ''}" data-act="pick-starter" data-arg="${id}">${portrait(id)}<strong>${species.name}</strong><div>${typePill(species.type)}</div><small>${esc(species.blurb)}</small></button>`;
    }).join('')}</div><div class="stack" style="margin-top:12px"><button class="btn leaf" data-act="confirm-starter" ${host.selectedStarter ? '' : 'disabled'}>和它一起出发</button><button class="texty" data-act="to-name">返回</button></div></section>`;
  } else if (mode === 'dialogue' && host.dialogue) {
    inner = `<section class="sheet"><p class="eyebrow">${esc(host.dialogue.speaker)}</p><p>${esc(host.dialogue.text)}</p><button class="btn" data-act="dialogue-next">继续</button></section>`;
  } else if (mode === 'encounter' && host.encounterView) {
    const view = host.encounterView;
    inner = `<section class="sheet encounter-sheet"><p class="eyebrow">野生芽灵</p><h2>${esc(view.name)}</h2><div class="stage" data-type="${esc(view.type)}">${portrait(view.speciesId, false, 'stage')}</div><p>${typePill(view.type)} ${view.level} 级</p>${hpMarkup(view.hp, view.max)}<p>可以邀请它同行，也可以先比试。体力越低，星芽球越容易成功。</p><div class="stack actions"><button class="btn leaf" data-act="encounter-catch">捕捉</button><button class="btn" data-act="encounter-fight">对战</button><button class="btn secondary" data-act="encounter-leave">先离开</button></div></section>`;
  } else if (mode === 'capture' && host.captureView) {
    const view = host.captureView;
    inner = `<section class="sheet"><p class="eyebrow">星芽球 × ${view.balls}</p><h2>捕捉 ${esc(view.name)}</h2><div class="ring-wrap"><canvas id="catch-ring" width="240" height="240"></canvas></div><p id="catch-odds">等光环缩到绿圈上再投掷。</p>${hpMarkup(view.hp, view.max)}<div class="row"><button class="btn leaf" data-act="throw">投掷</button><button class="btn secondary" data-act="capture-back">先不扔</button></div><p class="fine">空格或交谈键也可以投掷。完美时机会明显提高成功率。</p></section>`;
  } else if (mode === 'shake' && host.captureView) {
    inner = `<section class="sheet"><h2>${host.shakeSuccess ? '星芽球晃了三下' : '星芽球停住了'}</h2><p>${host.shakeSuccess ? '它好像安稳下来了。' : '里面还在挣扎。'}</p><button class="btn" data-act="shake-skip">继续</button></section>`;
  } else if (mode === 'battle' && host.battle && host.play) {
    inner = battleSheet(host);
  } else if (mode === 'menu') {
    inner = `<section class="sheet"><h2>菜单</h2><div class="stack"><button class="btn secondary" data-act="panel" data-arg="team">队伍</button><button class="btn secondary" data-act="panel" data-arg="dex">图鉴</button><button class="btn secondary" data-act="panel" data-arg="bag">背包</button><button class="btn secondary" data-act="panel" data-arg="quest">委托</button><button class="btn secondary" data-act="panel" data-arg="help">操作说明</button><button class="btn" data-act="save">手动保存</button><button class="btn secondary" data-act="mute">${host.muted ? '打开音效' : '关闭音效'}</button><button class="btn secondary" data-act="title">回到标题</button><button class="texty" data-act="ask-reset">清除存档</button><button class="texty" data-act="close">关闭</button></div></section>`;
  } else if (mode === 'team' && host.play) {
    inner = teamSheet(host.play);
  } else if (mode === 'dex' && host.play) {
    inner = dexSheet(host.play);
  } else if (mode === 'bag' && host.play) {
    inner = `<section class="sheet"><h2>背包</h2><p><strong>星芽球 × ${host.play.balls}</strong></p><p>邀请芽灵同行时消耗。光环越接近绿色目标圈，成功率越高。少于 8 个时，在星芽驿休息会补到 8 个。</p><button class="btn secondary" data-act="panel" data-arg="menu">返回</button></section>`;
  } else if (mode === 'quest' && host.play) {
    const items = questObjectives(host.play.quest);
    inner = `<section class="sheet"><h2>芽婆婆的委托</h2>${items.map((item) => `<div class="check ${item.done ? 'done' : ''}"><span>${esc(item.title)}</span><strong>${item.done ? '完成' : '进行中'}</strong></div>`).join('')}<p class="fine">做完两件事后，回星芽驿找芽婆婆复命。失败可以治疗后再试。</p><button class="btn secondary" data-act="panel" data-arg="menu">返回</button></section>`;
  } else if (mode === 'help') {
    inner = `<section class="sheet"><h2>操作说明</h2><p>电脑：WASD 或方向键移动，E / 空格 / 回车交谈，Esc 返回，数字键 1 和 2 使用技能。</p><p>手机：左下角摇杆或方向按钮移动，右下角是交谈和菜单。</p><p>背景音乐可以在画面上的音乐开关和音量条里调整。关闭后会记住，刷新也不会自己打开。</p><p>草克水，水克火，火克草。电擅长对付水和风，岩又硬又慢。靠近会走路的芽灵就会遇见它们。</p><button class="btn secondary" data-act="panel" data-arg="menu">返回</button></section>`;
  } else if (mode === 'confirm-reset') {
    inner = `<section class="sheet"><h2>清除这台设备上的存档？</h2><p>伙伴、图鉴、星芽球和委托进度都会消失。此操作不能撤销。</p><div class="row"><button class="btn" data-act="confirm-reset">确认清除</button><button class="btn secondary" data-act="cancel-reset">再想想</button></div></section>`;
  } else if (mode === 'npc' && host.npcId && host.play) {
    inner = npcSheet(host);
  } else if (mode === 'heal') {
    inner = `<section class="sheet"><p class="eyebrow">星芽驿</p><h2>要在这里休息吗？</h2><p>队伍里的伙伴会恢复全部体力。星芽球如果少于 8 个，会补到 8 个，避免你在岛上没法继续。</p><div class="row"><button class="btn leaf" data-act="heal-yes">休息</button><button class="btn secondary" data-act="close">离开</button></div></section>`;
  } else if (mode === 'sign' && host.signView) {
    inner = `<section class="sheet"><p class="eyebrow">告示</p><h2>${esc(host.signView.title)}</h2><p>${esc(host.signView.text)}</p><button class="btn" data-act="close">好</button></section>`;
  }
  const align = mode === 'title' || mode === 'confirm-new' ? 'title-dim' : '';
  root.innerHTML = `<div class="dim ${align}">${inner}</div>`;
}

function titleSheet(host: GameHost, confirm: boolean): string {
  if (confirm) {
    return `<section class="sheet title-sheet"><h2>开始新旅程会覆盖存档</h2><p>这台设备上的 ${esc(host.saveSummaryText)} 会被新的进度替换。</p><div class="row"><button class="btn" data-act="confirm-new">仍然开始</button><button class="btn secondary" data-act="title">返回</button></div></section>`;
  }
  return `<section class="sheet title-sheet"><p class="eyebrow">原创芽灵小岛</p><h1>星芽岛</h1><p class="lead">在明亮的岛上散步，认识会自己走动的芽灵。邀请它们同行，或友好地比试一场。</p><div class="stack"><button class="btn leaf" data-act="new-game">开始新旅程</button><button class="btn" data-act="continue" ${host.saveExists ? '' : 'disabled'}>继续旅程</button><p class="fine">${host.saveExists ? esc(host.saveSummaryText) : '还没有旅程记录'}</p><button class="texty" data-act="ask-reset">清除存档</button><p class="fine">进度只写在这台设备里，不登录，也不收集个人资料。</p></div></section>`;
}

function teamSheet(play: PlayState): string {
  const cards = play.team.map((mon, index) => {
    const species = getSpecies(mon.speciesId);
    const max = maxHp(mon);
    return `<article class="mon-card ${index === 0 ? 'lead' : ''}">${portrait(mon.speciesId, mon.hp <= 0)}<div><strong>${esc(species.name)}</strong> ${typePill(species.type)} <span>${mon.level} 级</span>${hpMarkup(mon.hp, max)}<p>${species.moves.map((id) => esc(getMove(id).name)).join(' · ')}</p>${index === 0 ? '<small>当前领队，会跟在身后</small>' : `<button class="btn tiny leaf" data-act="set-lead" data-arg="${index}">设为领队</button>`}</div></article>`;
  }).join('');
  const box = play.box.length
    ? play.box.map((mon) => `<span>${esc(getSpecies(mon.speciesId).name)} ${mon.level}级</span>`).join('、')
    : '寄存处还空着。队伍满六只后再捕捉，就会寄存在这里。';
  return `<section class="sheet"><h2>队伍</h2><div class="mon-list">${cards}</div><h3>驿站寄存</h3><p>${box}</p><button class="btn secondary" data-act="panel" data-arg="menu">返回</button></section>`;
}

function moveName(id: Parameters<typeof getMove>[0]): string {
  return getMove(id).name;
}

function dexSheet(play: PlayState): string {
  const caught = Object.values(play.dex).filter((entry) => entry.caught).length;
  const cards = SPECIES_LIST.map((species) => {
    const entry = play.dex[species.id];
    if (!entry?.seen) return `<article class="dex-card unknown"><div class="portrait"></div><strong>？？？</strong><p>还没见过</p></article>`;
    return `<article class="dex-card">${portrait(species.id)}<strong>${esc(species.name)}</strong><div>${typePill(species.type)}</div><p>${entry.caught ? esc(species.dex) : '见过了，还没同行。'}</p></article>`;
  }).join('');
  return `<section class="sheet"><h2>芽灵图鉴 ${caught}/8</h2><div class="dex-grid">${cards}</div><button class="btn secondary" data-act="panel" data-arg="menu">返回</button></section>`;
}

function battleSheet(host: GameHost): string {
  const battle = host.battle;
  const play = host.play;
  if (!battle || !play) return '';
  const foe = battle.foes[battle.fIndex];
  const mine = battle.player[battle.pIndex];
  const foeSpecies = getSpecies(foe.speciesId);
  const mySpecies = getSpecies(mine.speciesId);
  const moves = mySpecies.moves.map((id, index) => `<button class="btn" data-act="battle-move" data-arg="${index}" ${host.canAct ? '' : 'disabled'}>${index + 1}. ${esc(moveName(id))}</button>`).join('');
  const switches = battle.player.map((mon, index) => {
    const name = getSpecies(mon.speciesId).name;
    const disabled = mon.hp <= 0 || index === battle.pIndex;
    return `<button class="btn tiny secondary" data-act="switch" data-arg="${index}" ${disabled || (!host.canAct && !host.mustSwitch) ? 'disabled' : ''}>${esc(name)} ${mon.hp <= 0 ? '疲惫' : `${mon.hp}/${maxHp(mon)}`}</button>`;
  }).join('');
  const actions = host.mustSwitch
    ? `<p>选择还能战斗的伙伴。</p><div class="party">${switches}</div>`
    : host.canAct
      ? `<div class="moves">${moves}</div><div class="row"><button class="btn tiny secondary" data-act="toggle-switch">更换</button>${battle.kind === 'wild' ? `<button class="btn tiny leaf" data-act="battle-catch">捕捉</button><button class="btn tiny secondary" data-act="battle-run">退开</button>` : ''}</div>${host.switchOpen ? `<div class="party">${switches}</div>` : ''}`
      : `<button class="btn" data-act="log-next">继续</button>`;
  return `<section class="sheet battle-sheet"><div class="stage battle-stage" data-type="${esc(foeSpecies.type)}"><div class="battle-top"><div><p class="eyebrow">${battle.kind === 'trainer' ? esc(battle.trainerName) : '野生'}</p><h2>${esc(foeSpecies.name)} ${foe.level} 级</h2>${typePill(foeSpecies.type)}${hpMarkup(foe.hp, maxHp(foe))}</div>${portrait(foe.speciesId, foe.hp <= 0, 'stage')}</div></div><div class="log">${esc(host.currentLog || '……')}</div><div class="battle-bottom">${portrait(mine.speciesId, mine.hp <= 0)}<div><strong>${esc(mySpecies.name)}</strong> ${mine.level} 级 ${typePill(mySpecies.type)}${hpMarkup(mine.hp, maxHp(mine))}</div></div><div class="actions">${actions}</div></section>`;
}

function npcSheet(host: GameHost): string {
  const play = host.play;
  if (!play || !host.npcId) return '';
  if (host.npcId === 'grandma') {
    const lines = grandmaFollowup(play.quest);
    const ready = play.quest.caughtWild && play.quest.bossDefeated && !play.quest.completed;
    return `<section class="sheet"><p class="eyebrow">星芽驿</p><h2>芽婆婆</h2>${lines.map((line) => `<p>${esc(line)}</p>`).join('')}<div class="stack"><button class="btn leaf" data-act="npc-heal">休息治疗</button>${ready ? '<button class="btn" data-act="npc-quest">向她复命</button>' : '<button class="btn secondary" data-act="npc-quest">再说说委托</button>'}<button class="texty" data-act="close">离开</button></div></section>`;
  }
  if (host.npcId === 'qinghe') {
    const done = play.trainers.qinghe;
    return `<section class="sheet"><h2>青禾</h2>${practiceScript(done).map((line) => `<p>${esc(line.text)}</p>`).join('')}<div class="row"><button class="btn" data-act="npc-fight">${done ? '再练一次' : '请多指教'}</button><button class="btn secondary" data-act="close">下次再说</button></div></section>`;
  }
  const done = play.trainers.lanchuan;
  return `<section class="sheet"><h2>岚川</h2>${bossScript(done).map((line) => `<p>${esc(line.text)}</p>`).join('')}<div class="row"><button class="btn" data-act="npc-fight">${done ? '再战一次' : '开始试炼'}</button><button class="btn secondary" data-act="close">再准备一下</button></div></section>`;
}

export function mountTouch(el: HTMLElement, input: Input, onAct: (act: string) => void): void {
  el.innerHTML = `<div class="touch-left"><button class="pad" type="button" data-dir="up" aria-label="向上">↑</button><div class="pad-row"><button class="pad" type="button" data-dir="left" aria-label="向左">←</button><div class="joy" id="joy"><div class="knob"></div></div><button class="pad" type="button" data-dir="right" aria-label="向右">→</button></div><button class="pad" type="button" data-dir="down" aria-label="向下">↓</button></div><div class="touch-right"><button type="button" id="btn-touch-menu">菜单</button><button type="button" id="btn-touch-talk">交谈</button></div>`;
  el.querySelector('#btn-touch-menu')?.addEventListener('click', () => onAct('menu'));
  el.querySelector('#btn-touch-talk')?.addEventListener('click', () => onAct('interact'));
  el.querySelectorAll<HTMLButtonElement>('.pad').forEach((button) => {
    const dir = button.dataset.dir as 'up' | 'down' | 'left' | 'right' | undefined;
    if (!dir) return;
    const press = (event: PointerEvent) => {
      event.preventDefault();
      input.dpad[dir] = true;
      button.setPointerCapture(event.pointerId);
    };
    const release = () => {
      input.dpad[dir] = false;
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  });
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
  const quest = host.play.quest.completed ? '<div class="ribbon">委托完成</div>' : '<div class="ribbon" style="background:#ef6844">委托进行中</div>';
  return `<div class="hud-left">${portrait(lead.speciesId, lead.hp <= 0, 'hud')}<div class="hud-copy"><strong>${esc(species.name)}</strong><span>${lead.level} 级 ${typePill(species.type)}</span>${hpMarkup(lead.hp, maxHp(lead))}</div></div><div class="hud-right"><strong>星芽球 ${host.play.balls}</strong><span>图鉴 ${caught}/8</span><div class="row"><button class="btn tiny secondary" data-act="mute">${host.muted ? '音效关' : '音效开'}</button><button class="btn tiny" data-act="menu">菜单</button></div></div><div class="hint">WASD / 方向键移动 · E 交谈 · Esc 菜单</div>${host.nearbyLabel ? `<button class="prompt btn" data-act="interact">${esc(host.nearbyLabel)}</button>` : ''}${quest}<p class="fine" style="position:absolute;left:-999px">已游玩 ${formatPlay(host.play.playMs)}</p>`;
}
