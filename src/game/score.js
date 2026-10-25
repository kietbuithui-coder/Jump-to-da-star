/** Distance, collections, combo chains and skill bonuses. */
import { COMBO_TIERS, ECONOMY, PX_PER_METER } from '../config/config.js';

export class ScoreTracker {
  constructor() {
    this.reset(0);
  }

  reset(startX) {
    this.startX = startX;
    this.maxX = startX;
    this.distanceScore = 0;
    this.collectionScore = 0;
    this.comboScore = 0;
    this.skillScore = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.tierIndex = 0;
    this.coins = 0;
    this.pickups = 0;
    this.actions = 0;
    this.lastTierLabel = '';
  }

  get metres() {
    return Math.max(0, (this.maxX - this.startX) / PX_PER_METER);
  }

  get score() {
    return Math.floor(this.distanceScore + this.collectionScore + this.comboScore + this.skillScore);
  }

  updateMax(x) {
    if (x > this.maxX) {
      this.maxX = x;
      this.distanceScore = this.metres * ECONOMY.distanceScore;
    }
  }

  /** Pickups award points once each (the game removes them from the world). */
  addPickup(def) {
    const pts = def.score || 0;
    this.collectionScore += pts;
    this.pickups++;
    if (def.coins) this.coins += def.coins;
    this.addCombo(def.combo || 0);
  }

  addCoins(n) {
    this.coins += n;
  }

  /** Skill/tech bonus, e.g. converting a meteor dive into a launch. */
  addSkillBonus(points, label = '') {
    this.skillScore += points;
    this.addCombo(1);
    return label;
  }

  /** Returns {combo, tierUp, label, colour} so the HUD can celebrate. */
  addCombo(amount = 1) {
    if (amount <= 0) return null;
    this.combo += amount;
    this.actions++;
    this.comboTimer = 2.8;
    this.comboScore += ECONOMY.comboScore * amount * 0.25;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    let tier = 0;
    for (let i = 0; i < COMBO_TIERS.length; i++) {
      if (this.combo >= COMBO_TIERS[i].at) tier = i + 1;
    }
    if (tier > this.tierIndex) {
      this.tierIndex = tier;
      const t = COMBO_TIERS[tier - 1];
      this.lastTierLabel = t.label;
      return { combo: this.combo, tier, tierUp: true, label: t.label, colour: t.colour };
    }
    return { combo: this.combo, tier, tierUp: false };
  }

  breakCombo() {
    this.combo = 0;
    this.comboTimer = 0;
    this.tierIndex = 0;
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.breakCombo();
      }
    }
  }

  get comboFraction() {
    return Math.max(0, Math.min(1, this.comboTimer / 2.8));
  }

  summary() {
    return {
      metres: this.metres,
      distanceScore: Math.floor(this.distanceScore),
      collectionScore: Math.floor(this.collectionScore),
      comboScore: Math.floor(this.comboScore),
      skillScore: Math.floor(this.skillScore),
      score: this.score,
      bestCombo: this.bestCombo,
      coins: this.coins,
      pickups: this.pickups,
      actions: this.actions,
    };
  }
}
