import type { MapId, SpeciesId } from './types';

export const COLS = 42;
export const ROWS = 30;
export const TILE = 48;

export const Tile = {
  Deep: 0,
  Water: 1,
  Sand: 2,
  Grass: 3,
  Tall: 4,
  Path: 5,
  Forest: 6,
  Plaza: 7,
  Door: 8,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

const WALK = new Set<number>([Tile.Sand, Tile.Grass, Tile.Tall, Tile.Path, Tile.Forest, Tile.Plaza, Tile.Door]);

export interface Prop {
  kind: 'tree' | 'rock' | 'house' | 'shrine' | 'flower';
  x: number;
  y: number;
  w?: number;
  h?: number;
  variant: number;
  roof?: string;
}

export interface SpawnDef {
  id: string;
  speciesId: SpeciesId;
  level: number;
  x: number;
  y: number;
}

export interface NpcDef {
  id: 'grandma' | 'qinghe' | 'lanchuan' | 'wushou' | 'shiling';
  name: string;
  x: number;
  y: number;
}

export interface GateDef {
  id: string;
  x: number;
  y: number;
  edge: 'north' | 'south';
  kind: 'open' | 'quest' | 'sealed';
  to: MapId | null;
  arriveX: number;
  arriveY: number;
  promptOpen: string;
  promptLocked: string;
  textOpen: string;
  textLocked: string;
}

export interface PickupDef {
  id: string;
  x: number;
  y: number;
  balls: number;
}

export interface GatherDef {
  id: 'ember-rock' | 'bell-branch';
  x: number;
  y: number;
  item: 'yanxinshi' | 'qingfengling';
  name: string;
  got: string;
  waiting: string;
}

export interface SignDef {
  id: string;
  x: number;
  y: number;
  title: string;
  text: string;
}

export interface World {
  id: MapId;
  name: string;
  cols: number;
  rows: number;
  tiles: number[][];
  solid: boolean[][];
  props: Prop[];
  spawns: SpawnDef[];
  npcs: NpcDef[];
  pickups: PickupDef[];
  gathers: GatherDef[];
  signs: SignDef[];
  gates: GateDef[];
  door: { x: number; y: number };
  spawnTile: { x: number; y: number };
  bossTile: { x: number; y: number };
}

export function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function isWalkable(world: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return false;
  if (world.solid[ty][tx]) return false;
  return WALK.has(world.tiles[ty][tx]);
}

export function canWalkPixel(world: World, px: number, py: number): boolean {
  const r = 11;
  const points = [
    [px - r, py - 6],
    [px + r, py - 6],
    [px - r, py + 10],
    [px + r, py + 10],
  ];
  return points.every(([x, y]) => {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return isWalkable(world, tx, ty);
  });
}

export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

export function pathExists(world: World, ax: number, ay: number, bx: number, by: number): boolean {
  if (!isWalkable(world, ax, ay) || !isWalkable(world, bx, by)) return false;
  const seen = new Set<number>();
  const queue: [number, number][] = [[ax, ay]];
  seen.add(ay * world.cols + ax);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === bx && y === by) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = ny * world.cols + nx;
      if (seen.has(key) || !isWalkable(world, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

function islandHeight(x: number, y: number): number {
  const nx = (x - 20.5) / 17.6;
  const ny = (y - 15) / 12.3;
  return nx * nx + ny * ny;
}

function inLake(x: number, y: number): boolean {
  const nx = (x - 33.2) / 5.4;
  const ny = (y - 14.6) / 3.7;
  return nx * nx + ny * ny < 1;
}

export function createWorld(): World {
  const tiles: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(Tile.Deep));
  const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const d = islandHeight(x, y);
      const n = hash(x, y);
      if (d < 0.8 + n * 0.03) tiles[y][x] = Tile.Grass;
      else if (d < 1.02) tiles[y][x] = Tile.Sand;
      else if (d < 1.22) tiles[y][x] = Tile.Water;
      else tiles[y][x] = Tile.Deep;
      if (tiles[y][x] !== Tile.Deep && tiles[y][x] !== Tile.Water && inLake(x, y)) tiles[y][x] = Tile.Water;
    }
  }

  const reserved = (x: number, y: number) => {
    if (x >= 18 && x <= 22 && tiles[y][x] !== Tile.Water && tiles[y][x] !== Tile.Deep) return true;
    if (y >= 17 && y <= 19 && x >= 8 && x <= 27) return true;
    if ((y === 11 || y === 12) && x >= 6 && x <= 22) return true;
    if (x >= 7 && x <= 12 && y >= 12 && y <= 17) return true;
    if (x >= 12 && x <= 18 && y >= 22 && y <= 26) return true;
    if (x >= 26 && x <= 31 && y >= 16 && y <= 22) return true;
    if (x >= 16 && x <= 24 && y >= 4 && y <= 10) return true;
    return false;
  };

  const carve = (x: number, y: number, tile: number) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    if (tiles[y][x] === Tile.Water || tiles[y][x] === Tile.Deep) return;
    tiles[y][x] = tile;
    solid[y][x] = false;
  };

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 18; x <= 22; x += 1) carve(x, y, Tile.Path);
  }
  for (let x = 8; x <= 27; x += 1) {
    for (let y = 17; y <= 19; y += 1) carve(x, y, y === 18 ? Tile.Path : Tile.Plaza);
  }
  for (let x = 6; x <= 22; x += 1) {
    carve(x, 11, Tile.Path);
    carve(x, 12, Tile.Plaza);
  }
  for (let y = 16; y <= 21; y += 1) {
    for (let x = 14; x <= 26; x += 1) carve(x, y, Tile.Plaza);
  }
  for (let y = 22; y <= 25; y += 1) {
    for (let x = 12; x <= 18; x += 1) if (tiles[y][x] === Tile.Grass) tiles[y][x] = Tile.Tall;
  }
  for (let y = 13; y <= 16; y += 1) {
    for (let x = 7; x <= 12; x += 1) if (tiles[y][x] === Tile.Grass || tiles[y][x] === Tile.Forest) tiles[y][x] = Tile.Tall;
  }
  for (let y = 17; y <= 21; y += 1) {
    for (let x = 26; x <= 30; x += 1) if (tiles[y][x] === Tile.Grass) tiles[y][x] = Tile.Tall;
  }
  for (let y = 7; y <= 9; y += 1) {
    for (let x = 16; x <= 24; x += 1) if (tiles[y][x] === Tile.Grass && x !== 20) tiles[y][x] = Tile.Tall;
  }
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (x <= 13 && tiles[y][x] === Tile.Grass && !reserved(x, y)) tiles[y][x] = Tile.Forest;
    }
  }

  const props: Prop[] = [];
  const addBuilding = (x: number, y: number, w: number, h: number, kind: 'house' | 'shrine', roof: string, door: { x: number; y: number } | null) => {
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        const tx = x + i;
        const ty = y + j;
        const isDoor = !!door && door.x === tx && door.y === ty;
        if (isDoor) {
          solid[ty][tx] = false;
          tiles[ty][tx] = Tile.Door;
        } else {
          solid[ty][tx] = true;
        }
      }
    }
    props.push({ kind, x, y, w, h, variant: 0, roof });
  };

  const door = { x: 16, y: 16 };
  addBuilding(15, 14, 3, 3, 'shrine', '#69b35a', door);
  addBuilding(13, 20, 3, 2, 'house', '#ef7d62', null);
  addBuilding(23, 20, 3, 2, 'house', '#4aa3c8', null);

  const claim = (x: number, y: number, tile: number) => {
    let bestX = x;
    let bestY = y;
    let best = 99;
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const tx = x + dx;
        const ty = y + dy;
        if (!isWalkable({ id: 'island', name: '星芽岛', cols: COLS, rows: ROWS, tiles, solid, props, spawns: [], npcs: [], pickups: [], gathers: [], signs: [], gates: [], door, spawnTile: { x: 0, y: 0 }, bossTile: { x: 0, y: 0 } }, tx, ty)) {
          if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) continue;
          if (tiles[ty][tx] === Tile.Water || tiles[ty][tx] === Tile.Deep || solid[ty][tx]) continue;
        }
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < best && tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && tiles[ty][tx] !== Tile.Water && tiles[ty][tx] !== Tile.Deep && !solid[ty][tx]) {
          best = dist;
          bestX = tx;
          bestY = ty;
        }
      }
    }
    solid[bestY][bestX] = false;
    if (tiles[bestY][bestX] !== Tile.Door) tiles[bestY][bestX] = tile;
    return { x: bestX, y: bestY };
  };

  const desiredSpawns: Omit<SpawnDef, 'id'>[] = [
    { speciesId: 'dianrong', level: 3, x: 14, y: 23 },
    { speciesId: 'yanwei', level: 4, x: 16, y: 24 },
    { speciesId: 'dianrong', level: 5, x: 13, y: 25 },
    { speciesId: 'luzhu', level: 3, x: 28, y: 18 },
    { speciesId: 'xiwen', level: 5, x: 29, y: 20 },
    { speciesId: 'luzhu', level: 4, x: 27, y: 21 },
    { speciesId: 'taibei', level: 5, x: 9, y: 15 },
    { speciesId: 'lujiao', level: 4, x: 10, y: 16 },
    { speciesId: 'fengling', level: 4, x: 8, y: 14 },
    { speciesId: 'yanke', level: 5, x: 17, y: 8 },
    { speciesId: 'yanke', level: 6, x: 23, y: 8 },
    { speciesId: 'fengling', level: 5, x: 22, y: 9 },
    { speciesId: 'taibei', level: 6, x: 8, y: 17 },
    { speciesId: 'xiwen', level: 6, x: 30, y: 17 },
  ];
  const spawns: SpawnDef[] = [];
  const used = new Set<string>();
  desiredSpawns.forEach((spawn, index) => {
    let spot = claim(spawn.x, spawn.y, Tile.Tall);
    let guard = 0;
    while (used.has(`${spot.x},${spot.y}`) && guard < 8) {
      spot = claim(spawn.x + guard + 1, spawn.y, Tile.Tall);
      guard += 1;
    }
    used.add(`${spot.x},${spot.y}`);
    spawns.push({ id: `wild-${index + 1}`, speciesId: spawn.speciesId, level: spawn.level, x: spot.x, y: spot.y });
  });

  const npcs: NpcDef[] = [
    { id: 'grandma', name: '芽婆婆', ...claim(16, 17, Tile.Plaza) },
    { id: 'qinghe', name: '青禾', ...claim(12, 18, Tile.Path) },
    { id: 'lanchuan', name: '岚川', ...claim(20, 6, Tile.Path) },
  ];
  const pickups: PickupDef[] = [
    { id: 'balls-south', ...claim(18, 25, Tile.Sand), balls: 3 },
    { id: 'balls-forest', ...claim(9, 13, Tile.Tall), balls: 3 },
    { id: 'balls-lake', ...claim(30, 21, Tile.Tall), balls: 3 },
  ];
  const gathers: GatherDef[] = [
    {
      id: 'ember-rock',
      ...claim(15, 26, Tile.Sand),
      item: 'yanxinshi',
      name: '余烬暖岩',
      got: '暖岩结出 1 个焰心石',
      waiting: '暖岩还没再结出焰心石，再走一段路吧',
    },
    {
      id: 'bell-branch',
      ...claim(24, 11, Tile.Grass),
      item: 'qingfengling',
      name: '铃风枝',
      got: '枝头落下 1 个清风铃',
      waiting: '铃风枝还是空的，再走一段路吧',
    },
  ];
  const signs: SignDef[] = [
    { id: 'shrine', ...claim(17, 15, Tile.Plaza), title: '星芽驿', text: '治疗与补给都在这里。站到门前按交谈，就能让伙伴休息。' },
    { id: 'north', ...claim(23, 10, Tile.Grass), title: '指路牌', text: '往北是试炼林，岚川在林间空地等着。' },
    { id: 'west', ...claim(12, 13, Tile.Path), title: '指路牌', text: '往西是苔木林。空地上常能见到苔背熊和叶角鹿。' },
    { id: 'east', ...claim(26, 16, Tile.Grass), title: '指路牌', text: '往东是星湖。走近水边，就能遇见露珠蛙和汐纹獭。' },
  ];
  for (const sign of signs) solid[sign.y][sign.x] = true;

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (reserved(x, y) || solid[x] && false) continue;
      if (solid[y][x]) continue;
      if (reserved(x, y)) continue;
      const ground = tiles[y][x];
      if ((ground === Tile.Forest || ground === Tile.Grass) && hash(x, y) > 0.45 && !reserved(x, y)) {
        solid[y][x] = true;
        props.push({ kind: 'tree', x, y, variant: hash(x + 3, y) > 0.5 ? 1 : 0 });
      } else if (ground === Tile.Grass && hash(x, y + 9) > 0.86 && !reserved(x, y)) {
        props.push({ kind: 'flower', x, y, variant: Math.floor(hash(x, y) * 3) });
      }
    }
  }
  const rocks = [
    [15, 5],
    [25, 6],
    [15, 9],
    [25, 9],
  ];
  for (const [x, y] of rocks) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
    if (tiles[y][x] === Tile.Water || tiles[y][x] === Tile.Deep) continue;
    if (reserved(x, y)) continue;
    solid[y][x] = true;
    props.push({ kind: 'rock', x, y, variant: hash(x, y) > 0.5 ? 1 : 0 });
  }

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 18; x <= 22; x += 1) {
      if (tiles[y][x] !== Tile.Water && tiles[y][x] !== Tile.Deep && tiles[y][x] !== Tile.Door) {
        solid[y][x] = false;
        if (tiles[y][x] !== Tile.Path && tiles[y][x] !== Tile.Plaza) tiles[y][x] = Tile.Path;
      }
    }
  }

  for (const node of gathers) solid[node.y][node.x] = false;

  const north = columnEdge(tiles, solid, 20, 'north');
  const south = columnEdge(tiles, solid, 20, 'south');
  const northBack = stepFrom(tiles, solid, north.x, north.y, 1);
  const gates: GateDef[] = [
    {
      id: 'island-north',
      x: north.x,
      y: north.y,
      edge: 'north',
      kind: 'quest',
      to: 'ridge',
      arriveX: 20,
      arriveY: 24,
      promptOpen: '前往 · 星雾岭',
      promptLocked: '北岭未开 · 先完成委托',
      textOpen: '北岭的雾散开了，你走上星雾岭。',
      textLocked: '芽婆婆的委托还没完成，北岭的路口关着。',
    },
    {
      id: 'island-south',
      x: south.x,
      y: south.y,
      edge: 'south',
      kind: 'sealed',
      to: null,
      arriveX: south.x,
      arriveY: south.y,
      promptOpen: '南边未开',
      promptLocked: '南边未开 · 还是海',
      textOpen: '南边仍是海，更远的岛还没开放。',
      textLocked: '南边仍是海，更远的岛还没开放。',
    },
  ];

  return {
    id: 'island',
    name: '星芽岛',
    cols: COLS,
    rows: ROWS,
    tiles,
    solid,
    props,
    spawns,
    npcs,
    pickups,
    gathers,
    signs,
    gates,
    door,
    spawnTile: { x: 20, y: 18 },
    bossTile: { x: 20, y: 6 },
    northBack,
  } as World & { northBack: { x: number; y: number } };
}

function columnEdge(tiles: number[][], solid: boolean[][], x: number, edge: 'north' | 'south'): { x: number; y: number } {
  const ys = edge === 'north' ? [...Array(ROWS).keys()] : [...Array(ROWS).keys()].reverse();
  for (const y of ys) {
    if (walk(tiles, solid, x, y)) return { x, y };
  }
  return { x, y: edge === 'north' ? 1 : ROWS - 2 };
}

function stepFrom(tiles: number[][], solid: boolean[][], x: number, y: number, dir: 1 | -1): { x: number; y: number } {
  for (let step = 2; step <= 5; step += 1) {
    const ty = y + dir * step;
    if (walk(tiles, solid, x, ty)) return { x, y: ty };
  }
  const near = y + dir;
  return walk(tiles, solid, x, near) ? { x, y: near } : { x, y };
}

function walk(tiles: number[][], solid: boolean[][], x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (solid[y][x]) return false;
  return WALK.has(tiles[y][x]);
}

export function createRidge(): World {
  const island = createWorld() as World & { northBack: { x: number; y: number } };
  const back = island.northBack;
  const tiles: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(Tile.Forest));
  const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
  const open = (x: number, y: number, tile: number) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    tiles[y][x] = tile;
    solid[y][x] = false;
  };
  for (let y = 3; y <= 26; y += 1) {
    for (let x = 18; x <= 22; x += 1) open(x, y, Tile.Path);
  }
  for (let y = 22; y <= 26; y += 1) {
    for (let x = 15; x <= 25; x += 1) open(x, y, Tile.Plaza);
  }
  for (let y = 12; y <= 15; y += 1) {
    for (let x = 16; x <= 24; x += 1) open(x, y, y === 13 || y === 14 ? Tile.Plaza : Tile.Path);
  }
  for (let y = 3; y <= 6; y += 1) {
    for (let x = 16; x <= 24; x += 1) open(x, y, Tile.Path);
  }
  for (let x = 14; x <= 18; x += 1) open(x, 20, Tile.Path);
  for (let x = 22; x <= 27; x += 1) open(x, 18, Tile.Path);
  for (let x = 14; x <= 18; x += 1) open(x, 10, Tile.Path);
  for (let x = 22; x <= 27; x += 1) open(x, 8, Tile.Tall);
  open(14, 20, Tile.Tall);
  open(27, 18, Tile.Tall);
  open(14, 10, Tile.Tall);
  open(27, 8, Tile.Tall);
  open(17, 16, Tile.Path);
  open(16, 16, Tile.Tall);
  open(23, 16, Tile.Path);
  open(24, 16, Tile.Grass);
  open(27, 17, Tile.Path);
  open(27, 16, Tile.Sand);
  open(28, 17, Tile.Sand);
  for (let y = 15; y <= 17; y += 1) {
    for (let x = 29; x <= 32; x += 1) {
      tiles[y][x] = Tile.Water;
      solid[y][x] = true;
    }
  }
  open(28, 16, Tile.Sand);
  const props: Prop[] = [];
  for (const [x, y] of [[15, 4], [25, 4], [15, 7], [25, 11], [13, 19], [28, 15]]) {
    if (!solid[y][x] && tiles[y][x] !== Tile.Water) {
      solid[y][x] = true;
      props.push({ kind: 'rock', x, y, variant: 0 });
    }
  }
  for (let y = 4; y < ROWS - 2; y += 2) {
    for (const x of [12, 30]) {
      if (tiles[y][x] === Tile.Forest) props.push({ kind: 'tree', x, y, variant: y % 4 === 0 ? 1 : 0 });
    }
  }
  const spawns: SpawnDef[] = [
    { id: 'ridge-wild-1', speciesId: 'wudeng', level: 8, x: 14, y: 20 },
    { id: 'ridge-wild-2', speciesId: 'yunyang', level: 9, x: 27, y: 18 },
    { id: 'ridge-wild-3', speciesId: 'luoxing', level: 10, x: 14, y: 10 },
    { id: 'ridge-wild-4', speciesId: 'hanquan', level: 11, x: 28, y: 16 },
    { id: 'ridge-wild-5', speciesId: 'wudeng', level: 12, x: 16, y: 16 },
    { id: 'ridge-wild-6', speciesId: 'yunyang', level: 8, x: 24, y: 16 },
    { id: 'ridge-wild-7', speciesId: 'luoxing', level: 11, x: 27, y: 8 },
    { id: 'ridge-wild-8', speciesId: 'hanquan', level: 12, x: 19, y: 8 },
  ];
  const npcs: NpcDef[] = [
    { id: 'wushou', name: '雾守', x: 18, y: 24 },
    { id: 'shiling', name: '石岭', x: 22, y: 5 },
  ];
  const pickups: PickupDef[] = [
    { id: 'ridge:camp-balls', x: 16, y: 25, balls: 3 },
    { id: 'ridge:spring-balls', x: 26, y: 18, balls: 3 },
  ];
  const signs: SignDef[] = [
    { id: 'ridge-south', x: 16, y: 26, title: '岭南台阶', text: '顺着台阶下去，会回到星芽岛的北口。脚下的雾不会把你送回原地。' },
    { id: 'ridge-north', x: 24, y: 3, title: '北雾', text: '再往北的山路还没开放。牌子后面不是能走的地图。' },
    { id: 'ridge-spring', x: 27, y: 15, title: '冷泉', text: '寒泉鲵喜欢待在水边。水很凉，不要走进去。' },
  ];
  for (const sign of signs) {
    solid[sign.y][sign.x] = true;
    tiles[sign.y][sign.x] = Tile.Path;
  }
  const gates: GateDef[] = [
    {
      id: 'ridge-south',
      x: 20,
      y: 26,
      edge: 'south',
      kind: 'open',
      to: 'island',
      arriveX: back.x,
      arriveY: back.y,
      promptOpen: '返回 · 星芽岛',
      promptLocked: '返回 · 星芽岛',
      textOpen: '你走下台阶，回到星芽岛的北口。',
      textLocked: '你走下台阶，回到星芽岛的北口。',
    },
    {
      id: 'ridge-north',
      x: 20,
      y: 3,
      edge: 'north',
      kind: 'sealed',
      to: null,
      arriveX: 20,
      arriveY: 3,
      promptOpen: '北雾未开',
      promptLocked: '北雾未开 · 还没有路',
      textOpen: '雾还没散，再往北的路还没开放。',
      textLocked: '雾还没散，再往北的路还没开放。',
    },
  ];
  open(20, 26, Tile.Path);
  open(20, 3, Tile.Path);
  open(20, 24, Tile.Plaza);
  open(20, 23, Tile.Door);
  return {
    id: 'ridge',
    name: '星雾岭',
    cols: COLS,
    rows: ROWS,
    tiles,
    solid,
    props,
    spawns,
    npcs,
    pickups,
    gathers: [],
    signs,
    gates,
    door: { x: 20, y: 23 },
    spawnTile: { x: 20, y: 24 },
    bossTile: { x: 22, y: 5 },
  };
}

export function worldFor(id: MapId): World {
  return id === 'ridge' ? createRidge() : createWorld();
}

export function gateChoice(completed: boolean, gate: GateDef): 'go' | 'stay' {
  if (gate.kind === 'sealed' || !gate.to) return 'stay';
  if (gate.kind === 'quest' && !completed) return 'stay';
  return 'go';
}
