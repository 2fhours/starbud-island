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
  speciesId: 'lujiao' | 'yanwei' | 'luzhu' | 'dianrong' | 'yanke' | 'fengling' | 'taibei' | 'xiwen';
  level: number;
  x: number;
  y: number;
}

export interface NpcDef {
  id: 'grandma' | 'qinghe' | 'lanchuan';
  name: string;
  x: number;
  y: number;
}

export interface PickupDef {
  id: string;
  x: number;
  y: number;
  balls: number;
}

export interface SignDef {
  id: string;
  x: number;
  y: number;
  title: string;
  text: string;
}

export interface World {
  cols: number;
  rows: number;
  tiles: number[][];
  solid: boolean[][];
  props: Prop[];
  spawns: SpawnDef[];
  npcs: NpcDef[];
  pickups: PickupDef[];
  signs: SignDef[];
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
        if (!isWalkable({ cols: COLS, rows: ROWS, tiles, solid, props, spawns: [], npcs: [], pickups: [], signs: [], door, spawnTile: { x: 0, y: 0 }, bossTile: { x: 0, y: 0 } }, tx, ty)) {
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

  return {
    cols: COLS,
    rows: ROWS,
    tiles,
    solid,
    props,
    spawns,
    npcs,
    pickups,
    signs,
    door,
    spawnTile: { x: 20, y: 18 },
    bossTile: { x: 20, y: 6 },
  };
}
