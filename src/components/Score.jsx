import React from 'react';
import { useScoreFlash } from '../hooks/useScoreFlash';

/**
 * Score number that briefly highlights when it changes.
 */
export default function Score({ value, className = '', winner = false, trailing = false }) {
  const flashing = useScoreFlash(value);
  return (
    <span
      className={`score ${className}`}
      data-flash={flashing}
      data-winner={winner}
      data-trailing={trailing}
    >
      {value}
    </span>
  );
}
