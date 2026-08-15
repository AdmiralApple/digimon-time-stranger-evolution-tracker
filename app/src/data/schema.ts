// Hand-written mirror of time-stranger-scraper's data/digimon.json (schemaVersion 1).
// Verified against the dataset on 2026-07-11.

export type Generation =
  | 'In-Training I' | 'In-Training II' | 'Rookie' | 'Champion'
  | 'Ultimate' | 'Mega' | 'Mega +' | 'Armor' | 'Hybrid';

export type Attribute =
  | 'Vaccine' | 'Data' | 'Virus' | 'Free' | 'Variable' | 'Unknown' | 'No Data';

export type StatKey = 'HP' | 'SP' | 'ATK' | 'DEF' | 'INT' | 'SPI' | 'SPD';

export const STAT_KEYS: readonly StatKey[] = ['HP', 'SP', 'ATK', 'DEF', 'INT', 'SPI', 'SPD'];

/** Which end of a stat's range to read — level 1 or the level-99 cap. */
export type StatLevel = 'lv1' | 'lv99';

export type Element =
  | 'Fire' | 'Water' | 'Plant' | 'Ice' | 'Electricity' | 'Earth'
  | 'Steel' | 'Wind' | 'Light' | 'Dark' | 'Null';

export const ELEMENT_KEYS: readonly Element[] = [
  'Fire', 'Water', 'Plant', 'Ice', 'Electricity', 'Earth',
  'Steel', 'Wind', 'Light', 'Dark', 'Null',
];

export const ATTRIBUTE_KEYS: readonly Attribute[] = [
  'Vaccine', 'Data', 'Virus', 'Free', 'Variable', 'Unknown', 'No Data',
];

export const GENERATION_KEYS: readonly Generation[] = [
  'In-Training I', 'In-Training II', 'Rookie', 'Champion',
  'Ultimate', 'Mega', 'Mega +', 'Armor', 'Hybrid',
];

export type Personality =
  | 'Adoring' | 'Devoted' | 'Tolerant' | 'Overprotective'
  | 'Zealous' | 'Brave' | 'Reckless' | 'Daring'
  | 'Enlightened' | 'Sly' | 'Astute' | 'Strategic'
  | 'Opportunistic' | 'Friendly' | 'Sociable' | 'Compassionate';

/** Canonical order of the 16 base personalities — four blocks of four, one block
 *  per Agent-Skill bond (see agentSkills.ts's PERSONALITY_CATEGORY). */
export const PERSONALITY_KEYS: readonly Personality[] = [
  'Adoring', 'Devoted', 'Tolerant', 'Overprotective',
  'Zealous', 'Brave', 'Reckless', 'Daring',
  'Enlightened', 'Sly', 'Astute', 'Strategic',
  'Opportunistic', 'Friendly', 'Sociable', 'Compassionate',
];

export type AgentSkillCategory = 'Valor' | 'Philanthropy' | 'Wisdom' | 'Amicability';

export type ResistanceMultiplier = 0 | 0.5 | 1 | 1.5 | 2;

export interface StatRange { lv1: number; lv99: number; }

/** Only '>=' occurs in the dataset; the scraper reserves `op` for future shapes. */
export interface Threshold { op: '>=' | '<='; value: number; }

export interface JogressPartner {
  slug: string;
  name: string;
  personality: Personality;
}

export interface AgentSkillRequirement {
  category: AgentSkillCategory;
  value: number;
}

/** Requirements to evolve INTO this Digimon (from any of its evolvesFrom). */
export interface EvolutionCondition {
  agentRank: Threshold;                          // present on all 475 nodes
  stats?: Partial<Record<StatKey, Threshold>>;   // 426/475
  talent?: Threshold;                            // 4
  requiredItem?: string;                         // 18 — never co-occurs with jogressPartners
  jogressPartners?: JogressPartner[];            // 17
  agentSkills?: AgentSkillRequirement[];         // 11 (Bond forms)
}

export interface Skill {
  slug: string;
  name: string;
  element: string;         // '' on a handful of skills
  description: string;
  spCost: number;
  accuracy: number;
  critRate: number;
  /** Plain number; for percent-HP skills this is the percentage (see description). */
  power: number;
}

export interface AttachmentSkill extends Skill {
  level: number;
}

export interface DialogueLine {
  speaker: 'digimon' | 'player';
  text: string;
}

export interface Digimon {
  number: number;                    // unique, 1..475
  slug: string;                      // canonical node id
  name: string;                      // unique
  generation: Generation;
  attribute: Attribute;
  type: string;                      // 95 distinct values — kept open
  traits: string[];
  basePersonality: Personality;
  ridable: boolean;
  description: string;
  icon: string;                      // `icons/${slug}.png`, relative to data/
  stats: Record<StatKey, StatRange>;
  attributeResistances: Record<Attribute, ResistanceMultiplier>;
  elementalResistances: Record<Element, ResistanceMultiplier>;
  conversionPersonalities: Record<Personality, number>;
  evolutionCondition: EvolutionCondition;
  evolvesTo: string[];               // canonical forward edges (1120 total)
  evolvesFrom: string[];             // computed inverse of evolvesTo
  devolvesFrom: string[];            // empty everywhere in current data
  specialSkills: Skill[];
  attachmentSkills: AttachmentSkill[];
  postEvolutionDialogue: DialogueLine[] | null;
}

export interface DatabaseMeta {
  schemaVersion: 1;
  source: string;
  scrapedAt: string;
  count: number;
}

export interface DigimonDatabase {
  meta: DatabaseMeta;
  digimon: Record<string, Digimon>;
}
