/**
 * Deep fairness sweep (not part of the main suite).
 *
 *   node test/sweep.mjs [routesToKm] [startSeed]
 *
 * Flies every pilot over a spread of seeds using only the reference pilot's
 * steering + 3 boosts (no skills, no upgrades) and reports anyone who dies.
 */
import { simulateFlight } from './autopilot.mjs';
import { CHARACTERS } from '../src/game/characters.js';

const km = Number(process.argv[2] || 20);
const startSeed = Number(process.argv[3] || 1);
const seeds = [1, 5, 7, 11, 23, 42, 77, 99, 123, 2024].map((s) => s + (startSeed - 1) * 1000);

let dead = 0;
let total = 0;
const rows = [];
for (const char of Object.values(CHARACTERS)) {
  for (const seed of seeds) {
    const r = simulateFlight(seed, {
      maxMetres: km * 1000,
      steer: true,
      useBoost: true,
      boostCharges: 3,
      gravityMul: char.stats.gravity,
      dragMul: char.stats.drag,
      bounceMul: char.stats.bounce,
    });
    total++;
    const ok = !r.dead && r.metres >= km * 1000;
    if (!ok) {
      dead++;
      rows.push(`  ✗ ${char.id.padEnd(9)} seed ${String(seed).padStart(5)}  ${r.dead ? 'DIED' : 'SHORT'} at ${Math.round(r.metres)} m`);
    }
  }
}
for (const row of rows) console.log(row);
console.log(`\n${total - dead}/${total} routes reached ${km} km with steering + 3 boosts (no skills, no upgrades)`);
process.exitCode = dead ? 1 : 0;
