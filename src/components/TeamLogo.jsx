import React, { useState } from 'react';

/**
 * Team logo with a fixed square box so remote logos never stretch,
 * falling back to the team abbreviation when the image fails.
 */
export default function TeamLogo({ team, size = 28 }) {
  const [failed, setFailed] = useState(false);

  if (!team?.logo || failed) {
    return (
      <span
        className="team-logo team-logo--fallback"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
        aria-hidden="true"
      >
        {(team?.abbreviation || '').slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      className="team-logo"
      src={team.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
