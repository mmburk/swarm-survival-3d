// THE COMBAT HARNESS.
//
// Runs a street against the game's own rules and reports what it did to the
// player. Nothing here reimplements anything: Enemy.updateAI, the sector's own
// plan(), Engine.updateTurns and Engine.pressBodies are all the real ones,
// called through the prototype with a stand-in `this`.
//
// The player is a rule rather than a person — a point that stands still or
// walks a circle, and never shoots back. That is the whole point: it isolates
// what the street does to somebody who does nothing, which is the only way to
// compare one build of the AI against another.
import { createServer } from 'vite';
import * as THREE from 'three';

globalThis.window = { innerWidth: 1920, innerHeight: 1080 };

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = (p) => server.ssrLoadModule(p);

const { Enemy, EnemyType } = await load('/src/entities/Enemy.ts');
const { Engine } = await load('/src/core/Engine.ts');
const { SectorManager } = await load('/src/core/SectorManager.ts');
const { SpatialHashGrid } = await load('/src/utils/SpatialHashGrid.ts');
const { NIGHT_TIERS } = await load('/src/config/Progression.ts');

const noop = () => {};
const particles = new Proxy({}, { get: () => noop });
const audio = new Proxy({}, { get: () => noop });
const terrain = { getHeightAt: () => 0 };

// The real table, not a guess at it.
const planFor = (sector, nightLevel = 0) =>
  SectorManager.prototype.plan.call(
    { bossEvery: 5, traderNext: false, night: NIGHT_TIERS[nightLevel] },
    sector
  );

const KEYS = [
  ['shamblers', 'SHAMBLER'], ['sprinters', 'SPRINTER'], ['bloaters', 'BLOATER'],
  ['butchers', 'BUTCHER'], ['bursters', 'BURSTER'], ['screamers', 'SCREAMER'],
  ['clingers', 'CLINGER']
];

// Engine.ts: `if (this.sectors.remainingSpawns() > 0 && pending < 34)`.
const STREET_CAP = 34;
const GRAB_DURATION = 1.5;
const GRAB_DAMAGE_PER_SECOND = 13;
const SCREAM_LANE_DURATION = 5.0;
const SCREAM_LANES = 6;

function run({ sector, seconds = 25, kiting, exclude = [], dt = 1 / 60, seed = 7 }) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const realRandom = Math.random;
  Math.random = rnd;

  try {
    const plan = planFor(sector);
    const queue = [];
    for (const [key, type] of KEYS) {
      if (exclude.includes(type)) continue;
      for (let i = 0; i < plan[key]; i++) queue.push(type);
    }
    // Shuffled, so a cap of 34 does not mean "all the shamblers and nothing
    // else" — the game drips them in mixed.
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    const grid = new SpatialHashGrid(4);
    const active = [];
    const planned = queue.length;

    let damage = 0;
    let strikes = 0;
    let grabs = 0;

    const player = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 0.45,
      health: 100,
      maxHealth: 100,
      isHeld: false,
      shoveCooldown: 0,
      takeDamage(n) { damage += n; strikes++; },
      drain(n) { damage += n; },
      seize() { return true; }
    };

    let grabber = null;
    let grabTimer = 0;

    const ctx = {
      grid,
      player,
      boss: { active: false },
      frictionTimer: 0,
      calm: 0,
      turnTimer: 0,
      screamLanes: 0,
      meleeOrder: [],
      heavyOrder: [],
      grabOrder: [],
      sectors: { current: sector },
      enemies: { getActiveItems: () => active }
    };

    const updateTurns = Engine.prototype.updateTurns;
    const pressBodies = Engine.prototype.pressBodies;

    // Everything alive at t=0 would be a wall arriving at once; the game drips
    // them in on a timer while the street is under the cap.
    let spawnTimer = 0;
    const spawn = () => {
      const type = queue.shift();
      const e = new Enemy(particles, audio, terrain);
      const a = rnd() * Math.PI * 2;
      const r = 21 + rnd() * 6;
      e.reset(new THREE.Vector3(
        player.position.x + Math.cos(a) * r, 0, player.position.z + Math.sin(a) * r
      ), EnemyType[type]);
      e.active = true;
      active.push(e);
    };

    // A street that starts empty measures the walk-in and not the fight, so it
    // is filled to the cap first and then topped up.
    while (queue.length && active.length < STREET_CAP) spawn();

    let frame = 0;
    let peak = 0;
    for (let t = 0; t < seconds; t += dt) {
      frame++;

      if (kiting) {
        const w = t * 0.55;
        player.position.set(Math.cos(w) * 9, 0, Math.sin(w) * 9);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0 && queue.length && active.length < STREET_CAP) {
        spawnTimer = 0.45;
        spawn();
      }

      grid.clear();
      for (const e of active) if (e.active) grid.insert(e);

      updateTurns.call(ctx, active, dt);

      for (const e of active) {
        if (!e.active) continue;
        e.updateAI(
          dt, frame, player.position, grid, noop, noop,
          () => {
            ctx.screamLanes = SCREAM_LANE_DURATION;
            let called = 0;
            for (const o of active) {
              if (called >= SCREAM_LANES) break;
              if (!o.active || o.engaged) continue;
              if (o.type === EnemyType.BLOATER || o.type === EnemyType.SCREAMER) continue;
              o.engaged = true; o.turnTimer = 0; o.restTimer = 0; called++;
            }
          },
          (clinger) => {
            if (grabber) return false;
            grabber = clinger;
            grabTimer = GRAB_DURATION;
            player.isHeld = true;
            grabs++;
            return true;
          }
        );
      }

      if (grabber) {
        grabTimer -= dt;
        damage += GRAB_DAMAGE_PER_SECOND * dt;
        grabber.position.copy(player.position);
        if (grabTimer <= 0 || !grabber.grabbing) {
          grabber.grabbing = false;
          grabber = null;
          player.isHeld = false;
        }
      }

      pressBodies.call(ctx, dt);
      peak = Math.max(peak, active.filter((e) => e.active).length);
    }

    return {
      planned,
      onStreet: peak,
      dps: damage / seconds,
      strikes: strikes / seconds,
      grabs,
      engaged: active.filter((e) => e.active && e.engaged).length
    };
  } finally {
    Math.random = realRandom;
  }
}

// Every fifth sector is a boss and every (5n+3) is Vic's, which has nobody in
// it at all — measuring those would be measuring an empty street.
const SECTORS = [1, 2, 4, 6, 7, 9];

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const repeat = (opts, n = 5) => {
  const rs = [];
  for (let i = 0; i < n; i++) rs.push(run({ ...opts, seed: 7 + i * 13 }));
  return {
    planned: rs[0].planned,
    onStreet: Math.round(mean(rs.map((r) => r.onStreet))),
    dps: mean(rs.map((r) => r.dps)),
    strikes: mean(rs.map((r) => r.strikes)),
    grabs: mean(rs.map((r) => r.grabs)),
    engaged: Math.round(mean(rs.map((r) => r.engaged)))
  };
};

console.log('Five 25-second runs per cell, averaged.');
console.log('');
console.log('READ THIS BEFORE THE NUMBERS. The player here never shoots, so the');
console.log('street stays at its 34-body cap for the whole run. That makes the');
console.log('absolute figures a stress test and not a prediction — nobody stands');
console.log('in a sector 9 crowd for 25 seconds doing nothing. What the harness is');
console.log('for is comparison: the same dummy against two builds of the AI, or');
console.log('against two rosters, is a fair fight.');
console.log('');
console.log('STANDING STILL');
console.log('sector  planned  on street   dps    strikes/s  engaged');
for (const sector of SECTORS) {
  const r = repeat({ sector, kiting: false });
  console.log(
    '  ' + String(sector).padStart(2) + '     ' + String(r.planned).padStart(4) + '      ' +
    String(r.onStreet).padStart(3) + '     ' + r.dps.toFixed(1).padStart(6) + '     ' +
    r.strikes.toFixed(2).padStart(5) + '      ' + String(r.engaged).padStart(3)
  );
}

console.log('');
console.log('KITING — does the Clinger and the Screamer make up for it?');
console.log('sector   melee only    full roster    change   grabs');
for (const sector of SECTORS) {
  const a = repeat({ sector, kiting: true, exclude: ['CLINGER', 'SCREAMER', 'BLOATER', 'BURSTER'] });
  const b = repeat({ sector, kiting: true });
  const change = a.dps > 0.01 ? ((b.dps / a.dps - 1) * 100).toFixed(0) + '%' : '—';
  console.log(
    '  ' + String(sector).padStart(2) + '      ' + a.dps.toFixed(2).padStart(6) + '        ' +
    b.dps.toFixed(2).padStart(6) + '       ' + change.padStart(6) + '    ' + b.grabs.toFixed(1)
  );
}

console.log('');
console.log('STANDING vs KITING — how safe is running away?');
console.log('sector   standing   kiting    kiting is');
for (const sector of [1, 2, 6, 9]) {
  const a = repeat({ sector, kiting: false });
  const b = repeat({ sector, kiting: true });
  console.log(
    '  ' + String(sector).padStart(2) + '      ' + a.dps.toFixed(1).padStart(6) + '    ' +
    b.dps.toFixed(1).padStart(6) + '     ' + (100 - (b.dps / a.dps) * 100).toFixed(0) + '% safer'
  );
}

await server.close();
