import { appData } from '../data/appData';
import { ATTRIBUTE_KEYS } from '../data/schema';
import { filterSlugs, hasActiveCriteria } from '../data/search';
import { useStore } from '../state/store';
import { ATTRIBUTE_COLORS } from '../theme/attribute';
import { FilterChip, FilterChipGroup } from '../ui/FilterChip';
import { PersonalityFilter } from './PersonalityFilter';
import { SPECIAL_FACETS } from './specialFacets';
import styles from './FilterBar.module.css';

export function FilterBar() {
  const attributes = useStore((s) => s.attributes);
  const special = useStore((s) => s.special);
  const personalities = useStore((s) => s.personalities);
  const toggleAttribute = useStore((s) => s.toggleAttribute);
  const toggleSpecial = useStore((s) => s.toggleSpecial);
  const clearFilters = useStore((s) => s.clearFilters);

  // No generation filter here: in the tree, generation is already the spatial
  // axis (bands + watermarks + shading), so filtering by it is redundant and
  // just collapses a stage to one row. The Codex table keeps its own (codex.*).
  const criteria = { attributes, special, personalities };
  const active = hasActiveCriteria(criteria);
  const count = active ? filterSlugs(appData().db, criteria).size : 475;

  return (
    <div className={styles.bar}>
      <FilterChipGroup label="Attribute">
        {ATTRIBUTE_KEYS.map((attribute) => (
          <FilterChip
            key={attribute}
            active={attributes.has(attribute)}
            color={ATTRIBUTE_COLORS[attribute]}
            onClick={() => toggleAttribute(attribute)}
          >
            {attribute}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <FilterChipGroup label="Trait">
        {SPECIAL_FACETS.map(({ key, label, title }) => (
          <FilterChip
            key={key}
            active={special.has(key)}
            title={title}
            onClick={() => toggleSpecial(key)}
          >
            {label}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <FilterChipGroup label="Base personality">
        <PersonalityFilter />
      </FilterChipGroup>
      <div className={styles.tail}>
        <span className={styles.count}>
          {count} / 475
        </span>
        {active && (
          <button className={styles.clear} onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
