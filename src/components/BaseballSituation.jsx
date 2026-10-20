import React from 'react';

/**
 * Compact baseball situation: base runners on a diamond plus out indicators.
 */
export default function BaseballSituation({ bases, outs = 0 }) {
  const safeOuts = Math.max(0, Math.min(3, Number(outs) || 0));
  const outLabel = `${safeOuts} ${safeOuts === 1 ? 'out' : 'outs'}`;
  const runners = [
    bases?.first && 'first',
    bases?.second && 'second',
    bases?.third && 'third'
  ].filter(Boolean);
  const runnerLabel = runners.length ? `Runners on ${runners.join(', ')}` : 'Bases empty';

  return (
    <span className="baseball-situation" role="img" aria-label={`${runnerLabel}, ${outLabel}`}>
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
        <rect x="11" y="1" width="8" height="8" transform="rotate(45 15 5)" className={bases?.second ? 'base base--on' : 'base'} />
        <rect x="20" y="10" width="8" height="8" transform="rotate(45 24 14)" className={bases?.first ? 'base base--on' : 'base'} />
        <rect x="2" y="10" width="8" height="8" transform="rotate(45 6 14)" className={bases?.third ? 'base base--on' : 'base'} />
      </svg>
      <span className="outs" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < safeOuts ? 'out-dot out-dot--on' : 'out-dot'} />
        ))}
      </span>
    </span>
  );
}
