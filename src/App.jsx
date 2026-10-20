import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Heart,
  LayoutGrid,
  ListFilter,
  RefreshCw
} from 'lucide-react';
import { useSports } from './context/SportsContext';
import GameRow from './components/GameRow';
import LiveTile from './components/LiveTile';
import GameDetailSheet from './components/GameDetailSheet';
import NotificationRulesModal from './components/NotificationRulesModal';
import AlertsSheet from './components/AlertsSheet';
import Toasts from './components/Toasts';
import FilterMenu from './components/FilterMenu';
import AccountMenu from './components/AccountMenu';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { getDayChip } from './utils/format';

function SkeletonList() {
  return (
    <div className="game-sheet game-sheet--skeleton" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton-line skeleton-line--status" />
          <span className="skeleton-stack">
            <span className="skeleton-line" />
            <span className="skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const {
    user,
    isAdmin,
    signIn,
    signOut,
    favoriteTeams,
    leagues,
    selectedLeagues,
    toggleLeagueSelection,
    selectAllLeagues,
    activeLeague,
    setActiveLeague,
    selectedDateOffset,
    setSelectedDateOffset,
    searchQuery,
    setSearchQuery,
    games,
    filteredGames,
    loading,
    refreshNow,
    isTeamFavorited,
    isGamePinned,
    isGameFollowed,
    togglePinGame,
    pushEnabled,
    isPwaInstalled,
    triggerInstallPwa,
    dismissInstallToast
  } = useSports();

  const [detailGameId, setDetailGameId] = useState(null);
  const [rulesTarget, setRulesTarget] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLiveIndex, setActiveLiveIndex] = useState(0);
  const liveCarouselRef = useRef(null);

  const detailGame = useMemo(
    () => games.find((g) => g.id === detailGameId) || null,
    [games, detailGameId]
  );

  /* Deep link from a push notification: /?game=<id> */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    if (!gameParam || games.length === 0) return;
    if (games.some((g) => g.id === gameParam)) {
      setDetailGameId(gameParam);
    }
    params.delete('game');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [games]);

  /* Tapping a notification while the app is already open focuses it and opens that game */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const handleMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED' && event.data.data?.gameId) {
        setDetailGameId(String(event.data.data.gameId));
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNow(true);
    setRefreshing(false);
  }, [refreshNow]);

  const handleInstallApp = useCallback(async () => {
    const outcome = await triggerInstallPwa();
    dismissInstallToast();
    if (outcome === 'manual') {
      setAlertsOpen(true);
    }
  }, [triggerInstallPwa, dismissInstallToast]);

  const { pullDistance, readyToRefresh } = usePullToRefresh(handleRefresh, refreshing);

  const openGameAlerts = useCallback((game) => {
    setRulesTarget({
      type: 'game',
      key: game.id,
      leagueId: game.leagueId,
      title: `Alerts for ${game.awayTeam.abbreviation} at ${game.homeTeam.abbreviation}`,
      subtitle: 'Applies to this game only.',
      game
    });
  }, []);

  const openTeamAlerts = useCallback((team) => {
    setRulesTarget({
      type: 'team',
      key: team.teamKey,
      leagueId: team.leagueId,
      title: `Alerts for ${team.fullName || team.name}`,
      subtitle: 'Applies to every game this team plays.'
    });
  }, []);

  /* Brand tap returns to the default view: today, all sports, no search, top of page. */
  const goHome = useCallback(() => {
    setSelectedDateOffset(0);
    setActiveLeague('all');
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSelectedDateOffset, setActiveLeague, setSearchQuery]);

  const goToScores = useCallback(() => {
    if (activeLeague === 'all' && !searchQuery.trim()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveLeague('all');
      setSearchQuery('');
    }
  }, [activeLeague, searchQuery, setActiveLeague, setSearchQuery]);

  const leagueCounts = useMemo(() => {
    const counts = {};
    games.forEach((g) => {
      counts[g.leagueId] = (counts[g.leagueId] || 0) + 1;
    });
    return counts;
  }, [games]);

  const followingCount = useMemo(() => games.filter(isGameFollowed).length, [games, isGameFollowed]);

  /* Live games headline the screen in the carousel; everything else is a compact list. */
  const liveGames = useMemo(() => filteredGames.filter((g) => g.state === 'in'), [filteredGames]);

  useEffect(() => {
    if (activeLiveIndex >= liveGames.length) {
      setActiveLiveIndex(0);
    }
  }, [activeLiveIndex, liveGames.length]);

  const handleLiveScroll = useCallback((event) => {
    const container = event.currentTarget;
    const firstCard = container.firstElementChild;
    if (!firstCard) return;
    const cardStep = firstCard.getBoundingClientRect().width + 10.4;
    if (cardStep <= 0) return;
    const idx = Math.round(container.scrollLeft / cardStep);
    setActiveLiveIndex(Math.max(0, Math.min(liveGames.length - 1, idx)));
  }, [liveGames.length]);

  const scrollToLiveCard = useCallback((index) => {
    const container = liveCarouselRef.current;
    const card = container?.children?.[index];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      setActiveLiveIndex(index);
    }
  }, []);

  const sections = useMemo(() => {
    const listGames = filteredGames.filter((g) => g.state !== 'in');
    if (activeLeague !== 'all' || searchQuery.trim()) {
      return listGames.length ? [{ id: 'results', title: null, games: listGames }] : [];
    }
    const followed = listGames.filter(isGameFollowed);
    const rest = listGames.filter((g) => !isGameFollowed(g));
    const grouped = leagues
      .map((lg) => ({
        id: lg.id,
        title: lg.label,
        games: rest.filter((g) => g.leagueId === lg.id)
      }))
      .filter((s) => s.games.length > 0);
    return [
      ...(followed.length ? [{ id: 'yours', title: 'Your games', games: followed }] : []),
      ...grouped
    ];
  }, [activeLeague, searchQuery, filteredGames, isGameFollowed, leagues]);

  const day = getDayChip(selectedDateOffset);
  const allLeaguesSelected = selectedLeagues.length === leagues.length;
  const singleSelectedLeague =
    selectedLeagues.length === 1
      ? leagues.find((l) => l.id === selectedLeagues[0])
      : null;
  const isSportFiltered = !allLeaguesSelected || Boolean(searchQuery.trim());
  const filterTabLabel = searchQuery.trim()
    ? `"${searchQuery.trim()}"`
    : allLeaguesSelected
      ? 'Filter'
      : singleSelectedLeague
        ? singleSelectedLeague.shortLabel || singleSelectedLeague.label
        : `Filter (${selectedLeagues.length})`;

  const renderEmpty = () => {
    if (searchQuery.trim()) {
      return (
        <div className="empty-state">
          <p className="empty-state__title">No games match "{searchQuery}"</p>
          <p className="empty-state__body">Try a team name, a city, or a short code like KC.</p>
        </div>
      );
    }
    if (activeLeague === 'following') {
      return (
        <div className="empty-state">
          <Heart size={28} className="empty-state__icon" aria-hidden="true" />
          <p className="empty-state__title">None of your games are on this day</p>
          <p className="empty-state__body">
            Open any game and tap Follow on a team, or pin a single game to track it tonight.
          </p>
        </div>
      );
    }
    return (
      <div className="empty-state">
        <p className="empty-state__title">
          {singleSelectedLeague
            ? `No ${singleSelectedLeague.label} games scheduled`
            : 'No games scheduled'}
        </p>
        <p className="empty-state__body">
          Nothing on {day.fullLabel}. Use the arrows above to check another day.
        </p>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__row topbar__row--brand">
          <button type="button" className="brand" onClick={goHome} aria-label="Sporty, back to today">
            <img src="/icon.svg" alt="" width={34} height={34} className="brand__mark" />
            <span className="brand__name">Sporty</span>
          </button>
          <div className="topbar__actions">
            <button
              type="button"
              className="icon-button topbar__alerts"
              onClick={() => setAlertsOpen(true)}
              aria-label="Alerts and notification settings"
              data-active={pushEnabled}
            >
              {pushEnabled ? <BellRing size={20} /> : <Bell size={20} />}
            </button>
            <AccountMenu
              user={user}
              isAdmin={isAdmin}
              onSignIn={signIn}
              onSignOut={signOut}
              onOpenAlerts={() => setAlertsOpen(true)}
              onInstallApp={handleInstallApp}
              isPwaInstalled={isPwaInstalled}
              followingCount={favoriteTeams.length}
              pushEnabled={pushEnabled}
            />
          </div>
        </div>

        <div className="topbar__row topbar__row--controls">
          <FilterMenu
            open={filterOpen}
            onOpenChange={setFilterOpen}
            leagues={leagues}
            leagueCounts={leagueCounts}
            selectedLeagues={selectedLeagues}
            onToggleLeague={toggleLeagueSelection}
            onSelectAllLeagues={selectAllLeagues}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <div className="date-switcher" role="group" aria-label="Choose a day">
            <button
              type="button"
              className="icon-button icon-button--small date-switcher__step"
              onClick={() => setSelectedDateOffset(selectedDateOffset - 1)}
              aria-label="Previous day"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="date-switcher__label"
              onClick={() => setSelectedDateOffset(0)}
              aria-label={selectedDateOffset === 0 ? `Today, ${day.fullLabel}` : `${day.fullLabel}. Jump to today`}
            >
              <span className="date-switcher__day">{day.label}</span>
              {day.isRelative ? <span className="date-switcher__date">{day.monthDay}</span> : null}
            </button>
            <button
              type="button"
              className="icon-button icon-button--small date-switcher__step"
              onClick={() => setSelectedDateOffset(selectedDateOffset + 1)}
              aria-label="Next day"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div
          className="pull-indicator"
          data-visible={pullDistance > 0 || refreshing}
          style={pullDistance > 0 ? { '--pull-offset': `${pullDistance}px` } : undefined}
          aria-live="polite"
        >
          <span className="pull-indicator__pill" data-spinning={refreshing}>
            <RefreshCw size={15} aria-hidden="true" />
            <span>
              {refreshing
                ? 'Refreshing scores'
                : readyToRefresh
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
            </span>
          </span>
        </div>

        {loading ? (
          <SkeletonList />
        ) : filteredGames.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {liveGames.length > 0 ? (
              <section className="live-section" aria-label="Live now">
                <div className="live-section__header">
                  <h2 className="section-title">
                    Live now
                    <span className="section-title__count">{liveGames.length}</span>
                  </h2>
                  {liveGames.length > 1 ? (
                    <div className="live-dots" role="tablist" aria-label="Live games">
                      {liveGames.map((game, idx) => (
                        <button
                          key={game.id}
                          type="button"
                          role="tab"
                          aria-selected={idx === activeLiveIndex}
                          aria-label={`Live game ${idx + 1} of ${liveGames.length}`}
                          className="live-dots__dot"
                          data-active={idx === activeLiveIndex}
                          onClick={() => scrollToLiveCard(idx)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                <div ref={liveCarouselRef} className="live-carousel" onScroll={handleLiveScroll}>
                  {liveGames.map((game) => (
                    <LiveTile key={game.id} game={game} onOpen={setDetailGameId} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="section-grid">
              {sections.map((section) => (
                <section key={section.id} className="game-section" aria-label={section.title || 'Games'}>
                  {section.title ? (
                    <h2 className="section-title">
                      {section.title}
                      <span className="section-title__count">{section.games.length}</span>
                    </h2>
                  ) : null}
                  <div className="game-sheet">
                    {section.games.map((game) => (
                      <GameRow
                        key={game.id}
                        game={game}
                        isPinned={isGamePinned(game.id)}
                        homeFavorite={isTeamFavorited(game.homeTeam.teamKey)}
                        awayFavorite={isTeamFavorited(game.awayTeam.teamKey)}
                        onOpen={setDetailGameId}
                        onTogglePin={togglePinGame}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <p className="data-credit">Scores from ESPN public scoreboards. Not affiliated with any league.</p>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        <button
          type="button"
          className="bottom-nav__item"
          data-active={activeLeague === 'all' && !searchQuery.trim() && !filterOpen}
          onClick={goToScores}
        >
          <LayoutGrid size={22} aria-hidden="true" />
          <span>Scores</span>
        </button>
        <button
          type="button"
          className="bottom-nav__item"
          data-active={activeLeague === 'following' && !filterOpen}
          onClick={() => setActiveLeague('following')}
        >
          <Heart size={22} aria-hidden="true" />
          <span>Following</span>
          {followingCount > 0 ? <span className="bottom-nav__count">{followingCount}</span> : null}
        </button>
        <button
          type="button"
          className="bottom-nav__item"
          data-active={filterOpen || isSportFiltered}
          onClick={() => setFilterOpen(true)}
        >
          <ListFilter size={22} aria-hidden="true" />
          <span className="bottom-nav__label">{filterTabLabel}</span>
        </button>
      </nav>

      <GameDetailSheet
        game={detailGame}
        onClose={() => setDetailGameId(null)}
        onOpenTeamAlerts={openTeamAlerts}
        onOpenGameAlerts={openGameAlerts}
      />
      <NotificationRulesModal target={rulesTarget} onClose={() => setRulesTarget(null)} />
      <AlertsSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        onOpenTeamAlerts={openTeamAlerts}
        onOpenGame={(id) => {
          setAlertsOpen(false);
          setDetailGameId(id);
        }}
      />
      <Toasts onOpenGame={setDetailGameId} onInstallApp={handleInstallApp} />
    </div>
  );
}
