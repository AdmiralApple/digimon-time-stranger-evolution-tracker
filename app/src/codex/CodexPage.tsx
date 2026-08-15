import { Fragment, memo, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { appData } from '../data/appData';
import { ATTRIBUTE_KEYS, ELEMENT_KEYS, GENERATION_KEYS, STAT_KEYS, type StatLevel } from '../data/schema';
import { useSearchHotkey } from '../search/useSearchHotkey';
import { toggled, useStore } from '../state/store';
import { ATTRIBUTE_COLORS } from '../theme/attribute';
import { FilterChip, FilterChipGroup } from '../ui/FilterChip';
import { LevelToggle } from '../ui/LevelToggle';
import { Sprite } from '../ui/Sprite';
import { buildCodexRows, compareRows, defaultDir, maxTotal, minTotal, type CodexRow, type SortKey } from './codexRows';
import {
  advancedCount,
  cycleResist,
  elKey,
  hasAdvancedCriteria,
  matchesAdvanced,
  resistState,
  SKILL_FUNCTIONS,
  type ResistKey,
  type ResistState,
} from './codexFilter';
import { ATTACK_TYPES } from '../data/skills';
import type { SpecialFacet } from '../data/search';
import type { Personality } from '../data/schema';
import { SPECIAL_FACETS } from '../filters/specialFacets';
import { toggleBond } from '../filters/personalityFacet';
import { PersonalityGroups } from '../ui/PersonalityGroups';
import styles from './CodexPage.module.css';

const STAT_TITLES: Record<string, string> = {
  HP: 'Hit Points',
  SP: 'Skill Points',
  ATK: 'Attack',
  DEF: 'Defense',
  INT: 'Intelligence',
  SPI: 'Spirit',
  SPD: 'Speed',
};

/**
 * One table row, memoized. Filtering only changes which rows are in the list (not
 * the row objects themselves), so with stable row identity and a stable `onOpen`
 * store action, rows whose `level` / `sortKey` / `fill` didn't change skip
 * re-rendering — keeping the unvirtualized 475-row table responsive on low-end
 * hardware while the user types in the filter.
 */
const CodexTableRow = memo(function CodexTableRow({
  row,
  level,
  sortKey,
  fill,
  onOpen,
}: {
  row: CodexRow;
  level: StatLevel;
  sortKey: SortKey;
  fill: number;
  onOpen: (slug: string) => void;
}) {
  return (
    <tr className={styles.row} onClick={() => onOpen(row.slug)}>
      <td className={`${styles.cell} ${styles.numeric} ${styles.stickyNum}`}>{row.number}</td>
      <td className={`${styles.cell} ${styles.stickyName}`}>
        <button
          type="button"
          className={styles.nameBtn}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(row.slug);
          }}
          title={`View ${row.name} in the Tree`}
        >
          <span className={styles.portrait}>
            <Sprite slug={row.slug} size={26} className={styles.sprite} />
            {/* Attribute survives as a portrait badge on phones, where the
                standalone Attribute column is dropped to free width for stats. */}
            <span
              className={styles.attrBadge}
              style={{ background: ATTRIBUTE_COLORS[row.attribute] }}
              title={row.attribute}
            />
          </span>
          <span className={styles.nameText}>{row.name}</span>
        </button>
      </td>
      <td
        className={`${styles.cell} ${styles.gen} ${styles.optional} ${sortKey === 'generation' ? styles.sortedCell : ''}`}
      >
        {row.generation}
      </td>
      <td
        className={`${styles.cell} ${styles.attr} ${styles.optional} ${sortKey === 'attribute' ? styles.sortedCell : ''}`}
      >
        <span className={styles.attrDot} style={{ background: ATTRIBUTE_COLORS[row.attribute] }} />
        {row.attribute}
      </td>
      {STAT_KEYS.map((s) => (
        <td
          key={s}
          className={`${styles.cell} ${styles.numeric} ${sortKey === s ? styles.sortedCell : ''}`}
        >
          {row.stats[level][s]}
        </td>
      ))}
      <td
        className={`${styles.cell} ${styles.numeric} ${styles.totalCell} ${sortKey === 'total' ? styles.sortedCell : ''}`}
      >
        <span className={styles.totalVal}>{row.total[level]}</span>
        <span className={styles.totalTrack}>
          <span className={styles.totalFill} style={{ '--fill': fill } as CSSProperties} />
        </span>
      </td>
    </tr>
  );
});

/**
 * A tri-state resistance chip: off → resists (green ▼) → weak (red ▲) → off.
 * Reuses the detail-panel ResistanceGrid's marker + colour language (▼ reduced
 * damage, ▲ extra damage), so colour is never the sole channel and the two
 * surfaces read as one system. State is announced in the accessible name; the
 * marker appears only in the active states. At rest the chip is a centred label
 * with generous symmetric padding; when it activates, the horizontal padding
 * tightens by exactly the marker + gap width, so the marker slots in on the left
 * while the chip keeps a constant width — the row never reflows, and there's no
 * lopsided gap at rest nor wasted space on the right when active.
 */
function ResistChip({
  label,
  state,
  onClick,
}: {
  label: string;
  state: ResistState;
  onClick: () => void;
}) {
  const mark = state === 'resist' ? '▼' : state === 'weak' ? '▲' : '';
  const name =
    state === 'resist'
      ? `${label} resistance filter: requiring resistance. Activate to require weakness.`
      : state === 'weak'
        ? `${label} resistance filter: requiring weakness. Activate to clear.`
        : `${label} resistance filter: off. Activate to require resistance.`;
  return (
    <button
      type="button"
      className={styles.triChip}
      data-state={state}
      aria-label={name}
      title={name}
      onClick={onClick}
    >
      {mark && (
        <span className={styles.triMark} aria-hidden="true">
          {mark}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

export function CodexPage() {
  const openInTree = useStore((s) => s.openInTree);
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchRef);

  const rows = useMemo(() => buildCodexRows(appData().db), []);
  // The Total bar normalizes each level's totals across their own min→max span:
  // Lv.1 totals (≈1091–9810) and Lv.99 totals (≈6616+) occupy very different
  // ranges, so a shared fixed floor would blank most bars at one of the levels.
  const span = useMemo(
    () => ({
      lv1: { min: minTotal(rows, 'lv1'), max: maxTotal(rows, 'lv1') },
      lv99: { min: minTotal(rows, 'lv99'), max: maxTotal(rows, 'lv99') },
    }),
    [rows],
  );

  // Held in the store (not local state) so filters / sort / level persist across
  // switching to the Tree and back — the Codex unmounts each time.
  const patchCodex = useStore((s) => s.patchCodex);
  const {
    query,
    generations: gens,
    attributes: attrs,
    level,
    sortKey,
    sortDir,
    skillElements: skillEls,
    skillTypes,
    resist,
    weak,
    special,
    personalities,
  } = useStore((s) => s.codex);

  // One criteria object drives both the table filter and the badge count /
  // "any advanced?" check, so they can't drift as facets are added.
  const advanced = useMemo(
    () => ({ skillElements: skillEls, skillTypes, resist, weak, special, personalities }),
    [skillEls, skillTypes, resist, weak, special, personalities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A leading '#' or an all-digits query is a dex-number lookup. Parse to an int
    // so leading zeros match ('007' → #7); a lone '#' (a number-in-progress)
    // matches everything rather than blanking the table.
    const digits = q.replace(/^#/, '');
    const numberQuery = /^\d+$/.test(digits) ? Number(digits) : null;
    const numberMode = numberQuery !== null || q.startsWith('#');
    const dir: 1 | -1 = sortDir === 'asc' ? 1 : -1;
    return rows
      .filter((r) => {
        if (gens.size && !gens.has(r.generation)) return false;
        if (attrs.size && !attrs.has(r.attribute)) return false;
        if (!matchesAdvanced(r, advanced)) return false;
        if (!q) return true;
        if (numberMode) return numberQuery === null || r.number === numberQuery;
        return r.name.toLowerCase().includes(q);
      })
      .sort((a, b) => compareRows(a, b, sortKey, level, dir));
  }, [rows, query, gens, attrs, advanced, sortKey, sortDir, level]);

  const advCount = advancedCount(advanced);
  const advActive = hasAdvancedCriteria(advanced);
  const filtering = query.trim() !== '' || gens.size > 0 || attrs.size > 0 || advActive;
  const clearAll = () =>
    patchCodex({
      query: '',
      generations: new Set(),
      attributes: new Set(),
      skillElements: new Set(),
      skillTypes: new Set(),
      resist: new Set(),
      weak: new Set(),
      special: new Set(),
      personalities: new Set(),
    });

  // Advanced facets are opt-in, so the disclosure defaults closed; its open
  // state persists (localStorage) like the detail-panel Collapse sections.
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tst.codex.advanced') === '1';
    } catch {
      return false;
    }
  });
  const toggleAdvanced = () =>
    setAdvancedOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem('tst.codex.advanced', next ? '1' : '0');
      } catch {
        /* private mode — just won't persist */
      }
      return next;
    });
  const toggleSkill = (value: string) =>
    patchCodex({ skillElements: toggled(skillEls, value) });
  const toggleType = (value: string) => patchCodex({ skillTypes: toggled(skillTypes, value) });
  const toggleTrait = (value: SpecialFacet) => patchCodex({ special: toggled(special, value) });
  const togglePersonality = (value: Personality) =>
    patchCodex({ personalities: toggled(personalities, value) });
  const cycle = (key: ResistKey) => {
    const next = cycleResist(resist, weak, key);
    patchCodex({ resist: next.resist, weak: next.weak });
  };

  // Phone-only: the chip groups collapse behind a toggle to reclaim vertical
  // space above the table. When collapsed, the active facets are summarised
  // inline (canonical game order) so what's applied stays visible.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFacets: Array<{ key: string; label: string; color?: string }> = [
    ...GENERATION_KEYS.filter((g) => gens.has(g)).map((g) => ({ key: `g:${g}`, label: g })),
    ...ATTRIBUTE_KEYS.filter((a) => attrs.has(a)).map((a) => ({
      key: `a:${a}`,
      label: a,
      color: ATTRIBUTE_COLORS[a],
    })),
  ];
  const SUMMARY_CAP = 3;

  const onSort = (key: SortKey) => {
    if (key === sortKey) patchCodex({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    else patchCodex({ sortKey: key, sortDir: defaultDir(key) });
  };

  const th = (
    key: SortKey,
    label: ReactNode,
    opts: { numeric?: boolean; sticky?: string; title?: string; cls?: string } = {},
  ) => {
    const active = sortKey === key;
    const classes = [
      styles.th,
      opts.numeric ? styles.thNumeric : '',
      opts.sticky ?? '',
      opts.cls ?? '',
      active ? styles.thActive : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <th
        scope="col"
        className={classes}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        title={opts.title}
      >
        <button type="button" className={styles.sortBtn} onClick={() => onSort(key)}>
          <span>{label}</span>
          <span className={styles.arrow} aria-hidden="true">
            {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section className={styles.page} aria-label="Field guide — all Digimon">
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <input
            ref={searchRef}
            className={styles.search}
            type="search"
            value={query}
            onChange={(e) => patchCodex({ query: e.target.value })}
            placeholder="Filter by name or #…"
            spellCheck={false}
            aria-label="Filter Digimon by name or number"
          />
          <LevelToggle value={level} onChange={(l) => patchCodex({ level: l })} />
          <div className={styles.tail}>
            <span className={styles.count}>
              <strong>{filtered.length}</strong> / {rows.length}
            </span>
            {filtering && (
              <button type="button" className={styles.clear} onClick={clearAll}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={styles.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls="codex-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className={styles.chevron} aria-hidden="true">
              {filtersOpen ? '▾' : '▸'}
            </span>
            <span className={styles.filterToggleLabel}>Filters</span>
            {!filtersOpen && activeFacets.length > 0 && (
              <span className={styles.summary}>
                {activeFacets.slice(0, SUMMARY_CAP).map((f) => (
                  <span key={f.key} className={styles.sumChip}>
                    {f.color && (
                      <span className={styles.sumDot} style={{ background: f.color }} />
                    )}
                    {f.label}
                  </span>
                ))}
                {activeFacets.length > SUMMARY_CAP && (
                  <span className={styles.sumMore}>+{activeFacets.length - SUMMARY_CAP}</span>
                )}
              </span>
            )}
          </button>

          <div id="codex-filters" className={styles.filterGroups} data-open={filtersOpen}>
            <FilterChipGroup label="Gen">
              {GENERATION_KEYS.map((g) => (
                <FilterChip
                  key={g}
                  active={gens.has(g)}
                  onClick={() => patchCodex({ generations: toggled(gens, g) })}
                >
                  {g}
                </FilterChip>
              ))}
            </FilterChipGroup>
            <FilterChipGroup label="Attribute">
              {ATTRIBUTE_KEYS.map((a) => (
                <FilterChip
                  key={a}
                  active={attrs.has(a)}
                  color={ATTRIBUTE_COLORS[a]}
                  dot
                  onClick={() => patchCodex({ attributes: toggled(attrs, a) })}
                >
                  {a}
                </FilterChip>
              ))}
            </FilterChipGroup>
          </div>
        </div>

        {/* Advanced, opt-in facets: special-skill element/effect + resistance
            profile. Collapsed by default so the everyday name/gen/attribute
            filters stay uncluttered. */}
        <div className={styles.advanced}>
          <button
            type="button"
            className={styles.advToggle}
            aria-expanded={advancedOpen}
            aria-controls="codex-advanced"
            onClick={toggleAdvanced}
          >
            <span className={styles.chevron} aria-hidden="true">
              {advancedOpen ? '▾' : '▸'}
            </span>
            <span className={styles.filterToggleLabel}>Advanced</span>
            {advCount > 0 && (
              <span className={styles.advCount} title={`${advCount} advanced filters active`}>
                {advCount}
              </span>
            )}
          </button>

          <div
            id="codex-advanced"
            className={styles.advPanel}
            data-open={advancedOpen}
            inert={!advancedOpen}
          >
            <div className={styles.advInner}>
              <div className={styles.advContent}>
              <FilterChipGroup label="Trait" block>
                {SPECIAL_FACETS.map(({ key, label, title }) => (
                  <FilterChip
                    key={key}
                    active={special.has(key)}
                    title={title}
                    onClick={() => toggleTrait(key)}
                  >
                    {label}
                  </FilterChip>
                ))}
              </FilterChipGroup>

              <div className={styles.personalityBlock}>
                <span className="label">Base personality</span>
                <PersonalityGroups
                  selected={personalities}
                  onToggle={togglePersonality}
                  onToggleBond={(group) =>
                    patchCodex({ personalities: toggleBond(personalities, group) })
                  }
                />
              </div>

              {/* One "Special skill" section with two inline sub-facets: the
                  elemental school, and the skill kind (attack type or effect). */}
              <div className={styles.skillBlock}>
                <span className="label">Special skill</span>
                <FilterChipGroup label="Element">
                  {ELEMENT_KEYS.map((el) => (
                    <FilterChip key={el} active={skillEls.has(el)} onClick={() => toggleSkill(el)}>
                      {el}
                    </FilterChip>
                  ))}
                </FilterChipGroup>
                <FilterChipGroup label="Skill type">
                  {ATTACK_TYPES.map((t) => (
                    <FilterChip key={t} active={skillTypes.has(t)} onClick={() => toggleType(t)}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </FilterChip>
                  ))}
                  {SKILL_FUNCTIONS.map((fn) => (
                    <FilterChip key={fn} active={skillTypes.has(fn)} onClick={() => toggleType(fn)}>
                      {fn}
                    </FilterChip>
                  ))}
                </FilterChipGroup>
              </div>

              <div className={styles.resistBlock}>
                <div className={styles.resistHead}>
                  <span className="label">Elemental resistance</span>
                  <span className={styles.resistHint}>
                    <span className={styles.hintResist}>▼</span> resists ·{' '}
                    <span className={styles.hintWeak}>▲</span> weak — click to cycle
                  </span>
                </div>
                <div className={styles.resistRow}>
                  {ELEMENT_KEYS.map((el) => {
                    const key = elKey(el);
                    return (
                      <ResistChip
                        key={key}
                        label={el}
                        state={resistState(resist, weak, key)}
                        onClick={() => cycle(key)}
                      />
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {th('number', '#', { numeric: true, sticky: styles.stickyNum, title: 'Dex number' })}
              {th('name', 'Digimon', { sticky: styles.stickyName })}
              {th('generation', 'Gen', { cls: styles.optional })}
              {th('attribute', 'Attribute', { cls: styles.optional })}
              {STAT_KEYS.map((s) => (
                <Fragment key={s}>{th(s, s, { numeric: true, title: STAT_TITLES[s] })}</Fragment>
              ))}
              {th('total', 'Total', { numeric: true, title: 'Sum of all seven stats' })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <CodexTableRow
                key={r.slug}
                row={r}
                level={level}
                sortKey={sortKey}
                fill={(r.total[level] - span[level].min) / (span[level].max - span[level].min || 1)}
                onOpen={openInTree}
              />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No Digimon match these filters.</p>
            <button type="button" className={styles.emptyClear} onClick={clearAll}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
