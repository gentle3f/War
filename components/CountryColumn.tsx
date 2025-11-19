import React from 'react';
import { Country, Option, PlayerRecord } from '../types';

interface CountryColumnProps {
  country: Country;
  currentPopulation: number;
  actions: PlayerRecord[];
  playersPerRound: number;
  optionsPerRound: 2 | 3;
  styles: { bg: string; text: string; border: string; dot: string; dotActive: string };
  onDotClick: (country: Country) => void;
  onPopulationClick: (country: Country) => void;
}

export const CountryColumn: React.FC<CountryColumnProps> = ({
  country,
  currentPopulation,
  actions,
  playersPerRound,
  optionsPerRound,
  styles,
  onDotClick,
  onPopulationClick,
}) => {
  // Count current choices
  const counts = {
    [Option.A]: actions.filter((a) => a.option === Option.A).length,
    [Option.B]: actions.filter((a) => a.option === Option.B).length,
    [Option.C]: actions.filter((a) => a.option === Option.C).length,
  };

  // Dots already played this round
  const playedDots = actions;

  // Dots remaining available (Total population - Played this round)
  // Note: In some versions, only 'n' players can play. In others, everyone plays. 
  // The prompt implies "n" players go out, but later says "Total available dots" and "Foul reduces total".
  // We will visually separate played vs unplayed.
  const remainingCount = Math.max(0, currentPopulation - actions.length);

  return (
    <div className={`flex flex-col h-full border-r last:border-r-0 border-gray-200 ${styles.bg} bg-opacity-5`}>
      {/* Header */}
      <div className={`p-3 border-b-4 ${styles.border} ${styles.bg} bg-opacity-20`}>
        <div className="flex justify-between items-center mb-1">
          <h2 className={`text-xl font-bold ${styles.text}`}>{country}國</h2>
          <button 
            onClick={() => onPopulationClick(country)}
            className="bg-white px-2 py-0.5 rounded shadow text-sm font-mono font-bold hover:bg-gray-50 hover:scale-105 transition-all cursor-pointer border border-transparent hover:border-gray-300"
            title="點擊修改人數"
          >
            {currentPopulation}人
          </button>
        </div>
        
        {/* Stats for this round */}
        <div className="grid grid-cols-3 gap-1 text-center text-xs font-semibold mt-2">
          <div className="bg-white/60 rounded px-1 py-0.5">A: {counts[Option.A]}</div>
          <div className="bg-white/60 rounded px-1 py-0.5">B: {counts[Option.B]}</div>
          {optionsPerRound === 3 && (
            <div className="bg-white/60 rounded px-1 py-0.5">C: {counts[Option.C]}</div>
          )}
        </div>
        <div className="text-right text-xs text-gray-500 mt-1">
          已出: {actions.length} / {playersPerRound}
        </div>
      </div>

      {/* Played Zone */}
      <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto min-h-[150px] border-b border-dashed border-gray-300">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 text-center">已表態 ({actions.length})</div>
        <div className="flex flex-wrap content-start gap-2 justify-center">
          {playedDots.map((action) => (
            <div
              key={action.id}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-md transition-transform transform scale-100 ${styles.dotActive}`}
              title={`已選 ${action.option}`}
            >
              {action.option}
            </div>
          ))}
        </div>
      </div>

      {/* Available Zone */}
      <div className="flex-1 p-2 flex flex-col bg-white/50">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 text-center">未表態 ({remainingCount})</div>
        <div className="flex flex-wrap content-start gap-3 justify-center p-2">
          {Array.from({ length: remainingCount }).map((_, idx) => (
            <button
              key={`remaining-${idx}`}
              onClick={() => onDotClick(country)}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-125 transition-all hover:shadow-lg ${styles.dot} bg-white`}
              title="點擊設定選項"
            />
          ))}
        </div>
      </div>
    </div>
  );
};