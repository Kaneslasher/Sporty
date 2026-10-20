import React, { useRef } from 'react';
import { ListFilter, ChevronDown, Check, Search, X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';

/**
 * Multi-select Filter and Team Search sheet.
 * Remembers checked sports in localStorage and syncs to Firestore when signed in.
 */
export default function FilterMenu({
  open,
  onOpenChange,
  leagues,
  leagueCounts,
  selectedLeagues,
  onToggleLeague,
  onSelectAllLeagues,
  searchQuery,
  onSearchChange
}) {
  const dialogRef = useModalDialog(open, () => onOpenChange(false));
  const searchRef = useRef(null);

  const allSelected = selectedLeagues.length === leagues.length;
  const singleLeague =
    selectedLeagues.length === 1
      ? leagues.find((l) => l.id === selectedLeagues[0])
      : null;

  const activeLabel = allSelected
    ? 'All sports'
    : singleLeague
      ? singleLeague.shortLabel || singleLeague.label
      : `${selectedLeagues.length} sports`;

  const triggerLabel = searchQuery.trim() ? `"${searchQuery.trim()}"` : activeLabel;
  const isFiltered = !allSelected || Boolean(searchQuery.trim());
  const titleId = 'filter-sheet-title';

  return (
    <>
      <button
        type="button"
        className="filter-trigger"
        onClick={() => onOpenChange(true)}
        data-filtered={isFiltered}
      >
        <ListFilter size={17} aria-hidden="true" />
        <span className="filter-trigger__label">{triggerLabel}</span>
        <ChevronDown size={16} className="filter-trigger__chevron" aria-hidden="true" />
      </button>

      <dialog ref={dialogRef} className="single-sheet-modal" closedby="any" aria-labelledby={titleId}>
        {open ? (
          <div className="sheet">
            <header className="sheet__header">
              <div className="sheet__heading">
                <h2 id={titleId} className="sheet__title">Filter sports</h2>
                <p className="sheet__subtitle">Check the sports you want on your scoreboard. Saved automatically.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <div className="sheet__body">
              <div className="filter-sheet__search-wrap">
                <label className="search-field filter-panel__search">
                  <Search size={18} className="search-field__icon" aria-hidden="true" />
                  <span className="visually-hidden">Search teams</span>
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder="Search teams, drivers, or cities"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') dialogRef.current?.close();
                    }}
                    enterKeyHint="search"
                    autoComplete="off"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="icon-button icon-button--small search-field__clear"
                      onClick={() => {
                        onSearchChange('');
                        searchRef.current?.focus();
                      }}
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </label>
              </div>

              <div className="filter-panel__options" role="group" aria-label="Sports to show">
                {leagues.map((lg) => {
                  const selected = selectedLeagues.includes(lg.id);
                  const count = leagueCounts[lg.id] || 0;
                  return (
                    <button
                      key={lg.id}
                      type="button"
                      className="filter-option"
                      aria-pressed={selected}
                      onClick={() => onToggleLeague(lg.id)}
                    >
                      <span className="filter-option__check" data-checked={selected} aria-hidden="true">
                        {selected ? <Check size={15} strokeWidth={3} /> : null}
                      </span>
                      <span className="filter-option__label">{lg.label}</span>
                      <span className="filter-option__count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <footer className="sheet__footer">
              {!allSelected || searchQuery ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    onSearchChange('');
                    onSelectAllLeagues();
                  }}
                >
                  Select all sports
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="primary-button"
                onClick={() => dialogRef.current?.close()}
              >
                Done
              </button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
