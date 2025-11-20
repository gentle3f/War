
import React from 'react';
import { Country, Option, PlayerRecord } from '../types';
import { Trophy, User, Users } from 'lucide-react';

interface CountryColumnProps {
  country: Country;
  totalPopulation: number;   // Max capacity
  activePopulation: number;  // Currently alive in this bout
  score: number;
  actions: PlayerRecord[];
  playersPerRound: number;
  optionsPerRound: 2 | 3;
  styles: { bg: string; text: string; border: string; dot: string; dotActive: string };
  onDotClick: (country: Country) => void;
  onPopulationClick: (country: Country) => void;
  onActionClick: (actionId: string) => void;
}

export const CountryColumn: React.FC<CountryColumnProps> = ({
  country,
  totalPopulation,
  activePopulation,
  score,
  actions,
  playersPerRound,
  optionsPerRound,
  styles,
  onDotClick,
  onPopulationClick,
  onActionClick,
}) => {
  // Count current choices
  const counts = {
    [Option.A]: actions.filter((a) => a.option === Option.A).length,
    [Option.B]: actions.filter((a) => a.option === Option.B).length,
    [Option.C]: actions.filter((a) => a.option === Option.C).length,
  };

  // Dots already played this round
  const playedDots = actions;

  // Dots remaining available (Active survivors - Played this turn)
  const remainingCount = Math.max(0, activePopulation - actions.length);
  
  // Calculate percentage of players active
  const healthPercent = totalPopulation > 0 ? (activePopulation / totalPopulation) * 100 : 0;

  return (
    <div className={`flex flex-col min-h-[350px] sm:h-full border-b last:border-b-0 sm:border-b-0 lg:border-r lg:last:border-r-0 border-gray-200 ${styles.bg} bg-opacity-5 relative`}>
      {/* Header */}
      <div className={`p-3 border-b-4 ${styles.border} ${styles.bg} bg-opacity-20`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className={`text-2xl font-black ${styles.text} leading-none`}>{country}</h2>
            <div className="flex items-center gap-1 mt-1">
               <Trophy size={14} className="text-yellow-600" />
               <span className="font-bold text-gray-700 text-sm">{score} 分</span>
            </div>
          </div>
          
          <button 
            onClick={() => onPopulationClick(country)}
            className="flex flex-col items-end bg-white/80 px-2 py-1 rounded border border-transparent hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
            title="點擊修改總人數"
          >
            <div className="text-xs font-bold text-gray-500 flex items-center gap-1">
              總人數 <Users size={10}/>
            </div>
            <div className="text-lg font-mono font-bold leading-none">{totalPopulation}</div>
          </button>
        </div>

        {/* Health Bar (Active vs Total) */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden border border-black/5">
          <div 
            className={`h-full transition-all duration-500 ${styles.bg} opacity-80`} 
            style={{ width: `${healthPercent}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs font-bold text-gray-600 mb-2 px-1">
           <span className="flex items-center gap-1"><User size={12}/> 存活: {activePopulation}</span>
           <span className={`${remainingCount === 0 ? 'text-green-600' : 'text-red-500'}`}>
             {remainingCount > 0 ? `未表態: ${remainingCount}` : '全部已出'}
           </span>
        </div>
        
        {/* Stats for this round */}
        <div className="grid grid-cols-3 gap-1 text-center text-xs font-bold">
          <div className="bg-white/80 rounded px-1 py-1 border border-gray-100 shadow-sm">A: {counts[Option.A]}</div>
          <div className="bg-white/80 rounded px-1 py-1 border border-gray-100 shadow-sm">B: {counts[Option.B]}</div>
          {optionsPerRound === 3 && (
            <div className="bg-white/80 rounded px-1 py-1 border border-gray-100 shadow-sm">C: {counts[Option.C]}</div>
          )}
        </div>
      </div>

      {/* Played Zone */}
      <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto min-h-[100px] border-b border-dashed border-gray-300 transition-colors hover:bg-gray-50/50">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 text-center font-bold">已表態 ({actions.length})</div>
        <div className="flex flex-wrap content-start gap-2 justify-center">
          {playedDots.map((action) => (
            <button
              key={action.id}
              onClick={() => onActionClick(action.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-md transition-transform transform hover:scale-110 hover:opacity-90 active:scale-95 cursor-pointer ${styles.dotActive} text-sm`}
              title={`點擊移除 (已選 ${action.option})`}
            >
              {action.option}
            </button>
          ))}
        </div>
      </div>

      {/* Available Zone */}
      <div className="flex-1 p-2 flex flex-col bg-white/60 min-h-[120px]">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 text-center font-bold">未表態 ({remainingCount})</div>
        <div className="flex flex-wrap content-start gap-3 justify-center p-2">
          {Array.from({ length: remainingCount }).map((_, idx) => (
            <button
              key={`remaining-${idx}`}
              onClick={() => onDotClick(country)}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-125 transition-all hover:shadow-lg hover:bg-gray-50 ${styles.dot} bg-white`}
              title="點擊設定選項"
            />
          ))}
          {remainingCount === 0 && activePopulation === 0 && (
            <span className="text-xs text-gray-400 italic py-4">此國已全滅</span>
          )}
          {remainingCount === 0 && activePopulation > 0 && (
            <span className="text-xs text-gray-400 italic py-4">全員已就位</span>
          )}
        </div>
      </div>
    </div>
  );
};
