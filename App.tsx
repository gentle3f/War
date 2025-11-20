
import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Plus, 
  Minus, 
  Settings,
  BrainCircuit,
  Check,
  AlertTriangle,
  RefreshCw,
  Zap,
  Save,
  Play,
  Trophy,
  Swords,
  Skull
} from 'lucide-react';
import { Country, Option, RuleMode, PlayerRecord, RoundData } from './types';
import { CountryColumn } from './components/CountryColumn';
import { Modal } from './components/Modal';
import { calculateBestMove, getCounts, getEliminatedOptions, SuggestionResult, evaluateScenario } from './utils/calculations';
import { getAiSuggestion } from './services/ai';

// --- Initial State Constants ---
const INITIAL_POPULATION = {
  [Country.Gold]: 15,
  [Country.Water]: 6,
  [Country.Wood]: 9,
  [Country.Fire]: 9,
};

const COUNTRY_STYLES = {
  [Country.Gold]: { bg: 'bg-gold-light', text: 'text-gold-dark', border: 'border-gold', dot: 'border-gold-dark text-gold-dark', dotActive: 'bg-gold text-black' },
  [Country.Water]: { bg: 'bg-water-light', text: 'text-water-dark', border: 'border-water', dot: 'border-water-dark text-water-dark', dotActive: 'bg-water text-white' },
  [Country.Wood]: { bg: 'bg-wood-light', text: 'text-wood-dark', border: 'border-wood', dot: 'border-wood-dark text-wood-dark', dotActive: 'bg-wood text-white' },
  [Country.Fire]: { bg: 'bg-fire-light', text: 'text-fire-dark', border: 'border-fire', dot: 'border-fire-dark text-fire-dark', dotActive: 'bg-fire text-white' },
};

const App: React.FC = () => {
  // --- App Mode State ---
  const [useAi, setUseAi] = useState<boolean>(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  useEffect(() => {
    // Check if API key is present via process.env.API_KEY
    if (process.env.API_KEY) {
      setHasApiKey(true);
    }
  }, []);

  // --- Game State ---
  // Total Max Population (Cap)
  const [totalPopulations, setTotalPopulations] = useState<Record<Country, number>>(INITIAL_POPULATION);
  
  // Active Population (Survivors in the current Bout)
  const [activePopulations, setActivePopulations] = useState<Record<Country, number>>(INITIAL_POPULATION);
  
  // Scores
  const [scores, setScores] = useState<Record<Country, number>>({
    [Country.Gold]: 0,
    [Country.Water]: 0,
    [Country.Wood]: 0,
    [Country.Fire]: 0,
  });

  const [rounds, setRounds] = useState<RoundData[]>([
    { roundNumber: 1, turnNumber: 1, actions: [], isCompleted: false }
  ]);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  
  // Rules & Settings
  const [ruleMode, setRuleMode] = useState<RuleMode>(RuleMode.MajorityEliminated);
  const [optionsPerRound, setOptionsPerRound] = useState<2 | 3>(2);
  const [playersPerRound, setPlayersPerRound] = useState<number>(3); // Not strictly used in new logic but kept for legacy/display
  const [targetCountry, setTargetCountry] = useState<Country>(Country.Water);
  const [myCountry, setMyCountry] = useState<Country>(Country.Wood);

  // UI State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedDotCountry, setSelectedDotCountry] = useState<Country | null>(null);
  
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [manualRemainingInput, setManualRemainingInput] = useState<number | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult & { aiReasoning?: string } | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [isRoundEndModalOpen, setIsRoundEndModalOpen] = useState(false);
  const [roundEndSummary, setRoundEndSummary] = useState<{
    eliminatedOptions: Option[], 
    deaths: Record<Country, number>,
    survivorsTotal: number,
    isBoutOver: boolean,
    winners: Country[]
  } | null>(null);

  // Population Edit State
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingPopulationValue, setEditingPopulationValue] = useState<string>("");

  // --- Computed ---
  const currentRound = rounds[currentRoundIdx];
  const currentActions = currentRound.actions;

  // --- Handlers ---

  const handleDotClick = (country: Country) => {
    // Can only add action if this country still has active players remaining to act
    const actionsCount = currentActions.filter(a => a.country === country).length;
    if (actionsCount >= activePopulations[country]) {
      alert(`${country}國 所有存活者已表態`);
      return;
    }
    setSelectedDotCountry(country);
    setIsActionModalOpen(true);
  };

  const handleActionRemove = (actionId: string) => {
    if (window.confirm("確定要取消這個人的選擇嗎？")) {
      const updatedRounds = [...rounds];
      updatedRounds[currentRoundIdx] = {
        ...currentRound,
        actions: currentRound.actions.filter(a => a.id !== actionId)
      };
      setRounds(updatedRounds);
    }
  };

  const handlePopulationClick = (country: Country) => {
    setEditingCountry(country);
    setEditingPopulationValue(totalPopulations[country].toString());
    setIsPopulationModalOpen(true);
  };

  const savePopulation = () => {
    if (editingCountry && editingPopulationValue !== "") {
      const val = parseInt(editingPopulationValue, 10);
      if (!isNaN(val) && val >= 0) {
        // Update Total
        setTotalPopulations(prev => ({ ...prev, [editingCountry]: val }));
        
        // If we are in Turn 1 of a round (fresh start), update Active too to match new cap
        if (currentRound.turnNumber === 1) {
           setActivePopulations(prev => ({ ...prev, [editingCountry]: val }));
        }
      }
    }
    setIsPopulationModalOpen(false);
    setEditingCountry(null);
  };

  const handleOptionSelect = (option: Option) => {
    if (!selectedDotCountry) return;

    const newAction: PlayerRecord = {
      id: Date.now().toString() + Math.random().toString(),
      country: selectedDotCountry,
      option: option,
    };

    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIdx] = {
      ...currentRound,
      actions: [...currentRound.actions, newAction]
    };
    setRounds(updatedRounds);
    setIsActionModalOpen(false);
    setSelectedDotCountry(null);
  };

  const openSuggestionModal = () => {
    setManualRemainingInput(null);
    setSuggestionResult(null);
    setSuggestionError(null);
    setIsSuggestionModalOpen(true);
  };

  const runSuggestion = async (remaining: number) => {
    setIsSuggestionLoading(true);
    setSuggestionError(null);
    setSuggestionResult(null);
    setManualRemainingInput(remaining);

    try {
      if (useAi) {
        const aiResponse = await getAiSuggestion(
          currentActions,
          myCountry,
          targetCountry,
          remaining,
          ruleMode,
          optionsPerRound,
          activePopulations // Use Active, not Total for logic
        );

        const baseCounts = getCounts(currentActions);
        const targetActions = currentActions.filter(a => a.country === targetCountry);
        const targetBreakdown = getCounts(targetActions);
        const selfActions = currentActions.filter(a => a.country === myCountry);
        const selfBreakdown = getCounts(selfActions);

        const evalResult = evaluateScenario(
          { a: aiResponse.a, b: aiResponse.b, c: aiResponse.c },
          baseCounts,
          targetBreakdown,
          selfBreakdown,
          ruleMode,
          optionsPerRound
        );

        setSuggestionResult({
          ...evalResult,
          aiReasoning: aiResponse.reasoning
        });
      } else {
        const result = calculateBestMove(
          currentActions,
          myCountry,
          targetCountry,
          remaining,
          ruleMode,
          optionsPerRound
        );
        if (result) {
          setSuggestionResult(result);
        } else {
          setSuggestionError("無法計算有效建議");
        }
      }
    } catch (err: any) {
      console.error(err);
      setSuggestionError(`AI 請求失敗: ${err.message || "未知錯誤"}。`);
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const calculateRoundResult = () => {
    const counts = getCounts(currentActions);
    const eliminatedOptions = getEliminatedOptions(counts, ruleMode, optionsPerRound);
    
    const deaths: Record<Country, number> = {
      [Country.Gold]: 0,
      [Country.Water]: 0,
      [Country.Wood]: 0,
      [Country.Fire]: 0,
    };

    currentActions.forEach(action => {
      if (eliminatedOptions.includes(action.option)) {
        deaths[action.country]++;
      }
    });

    // Calculate next state projection
    let remainingTotal = 0;
    const winners: Country[] = [];
    
    (Object.keys(activePopulations) as Country[]).forEach(c => {
       const nextVal = Math.max(0, activePopulations[c] - deaths[c]);
       remainingTotal += nextVal;
       if (nextVal > 0) winners.push(c);
    });

    const isBoutOver = remainingTotal <= 2;

    setRoundEndSummary({ 
      eliminatedOptions, 
      deaths, 
      survivorsTotal: remainingTotal,
      isBoutOver,
      winners: isBoutOver ? winners : [] 
    });
    setIsRoundEndModalOpen(true);
  };

  const confirmRoundEnd = () => {
    if (!roundEndSummary) return;

    // 1. Update Active Populations (Remove deaths)
    const nextActive = { ...activePopulations };
    (Object.keys(nextActive) as Country[]).forEach(c => {
      nextActive[c] = Math.max(0, nextActive[c] - roundEndSummary.deaths[c]);
    });
    
    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIdx] = {
      ...currentRound,
      isCompleted: true,
      statsSnapshot: nextActive
    };

    if (roundEndSummary.isBoutOver) {
      // --- BOUT OVER: Scoring & Reset ---
      
      // Add points
      const newScores = { ...scores };
      (Object.keys(nextActive) as Country[]).forEach(c => {
         newScores[c] += nextActive[c]; // Add remaining survivors as points
      });
      setScores(newScores);

      // Reset for New Main Round
      // "Then add 1 mark per head... start new round." -> Implies reset everyone to full health
      setActivePopulations({ ...totalPopulations }); // Reset Active to Total Cap

      // Start New Round 1, Turn 1
      updatedRounds.push({
        roundNumber: currentRound.roundNumber + 1,
        turnNumber: 1,
        actions: [],
        isCompleted: false
      });

    } else {
      // --- CONTINUE BOUT: Next Turn ---
      setActivePopulations(nextActive);
      
      // Start Same Round, Next Turn
      updatedRounds.push({
        roundNumber: currentRound.roundNumber,
        turnNumber: currentRound.turnNumber + 1,
        actions: [],
        isCompleted: false
      });
    }

    setRounds(updatedRounds);
    setCurrentRoundIdx(currentRoundIdx + 1);
    setIsRoundEndModalOpen(false);
    setRoundEndSummary(null);
  };

  // Shared reset logic
  const resetGameState = () => {
    setTotalPopulations({ ...INITIAL_POPULATION });
    setActivePopulations({ ...INITIAL_POPULATION });
    setScores({
      [Country.Gold]: 0,
      [Country.Water]: 0,
      [Country.Wood]: 0,
      [Country.Fire]: 0,
    });
    setRounds([{ roundNumber: 1, turnNumber: 1, actions: [], isCompleted: false }]);
    setCurrentRoundIdx(0);
    
    // Reset UI States
    setIsActionModalOpen(false);
    setSelectedDotCountry(null);
    setIsSuggestionModalOpen(false);
    setManualRemainingInput(null);
    setSuggestionResult(null);
    setIsRoundEndModalOpen(false);
    setRoundEndSummary(null);
  };

  const handleResetGame = () => {
    if (window.confirm("確定要重新開始遊戲嗎？所有分數將會歸零。")) {
      resetGameState();
    }
  };

  // --- Render Helpers ---
  const totalCounts = getCounts(currentActions);

  // --- MAIN GAME BOARD ---
  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 font-sans">
      {/* === TOP PANEL === */}
      <div className="bg-white border-b shadow-sm p-2 sm:p-4 flex-none z-10">
        
        <div className="flex flex-wrap gap-2 items-center justify-between">
          
          <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start items-center">
             {/* API Status */}
             <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] sm:text-xs font-mono ${hasApiKey ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}`}>
              {hasApiKey ? 'API OK' : 'NO KEY'}
            </div>
             
             {/* Round Control */}
             <div className="bg-gray-800 text-white px-3 py-1 rounded-lg flex items-center gap-2 shadow-lg ring-1 ring-black/5">
               <div className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                 <Swords size={16} className="text-red-400" /> 
                 R{currentRound.roundNumber} <span className="text-gray-400 text-[10px]">TURN {currentRound.turnNumber}</span>
               </div>
             </div>

             {/* Reset (Mobile) */}
              <button 
                onClick={handleResetGame}
                className="sm:hidden p-2 bg-red-50 text-red-600 border border-red-200 rounded-lg"
              >
                <RefreshCw size={16} />
              </button>
          </div>


          {/* Options & Rules Control */}
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            
            {/* Options Count */}
            <div className="bg-gray-100 p-2 rounded-lg flex flex-col gap-1 items-center shadow-inner min-w-[80px]">
              <span className="text-[10px] font-bold text-gray-600">選項數</span>
              <div className="flex items-center gap-1 bg-white rounded px-1 border">
                <button onClick={() => setOptionsPerRound(2)} disabled={optionsPerRound===2} className="p-0.5 hover:bg-gray-100 rounded"><Minus size={12}/></button>
                <span className="font-bold text-blue-600 w-3 text-center text-sm">{optionsPerRound}</span>
                <button onClick={() => setOptionsPerRound(3)} disabled={optionsPerRound===3} className="p-0.5 hover:bg-gray-100 rounded"><Plus size={12}/></button>
              </div>
            </div>

            {/* Rule Settings */}
            <div className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col gap-1 flex-1 min-w-[180px] shadow-sm">
              <div className="flex justify-between items-center text-[10px]">
                 <span className="font-bold text-gray-500 flex items-center gap-1"><Settings size={12}/> 規則</span>
                 <div className="flex gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={ruleMode === RuleMode.MajorityEliminated} onChange={() => setRuleMode(RuleMode.MajorityEliminated)} />
                      多數死
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={ruleMode === RuleMode.MinorityEliminated} onChange={() => setRuleMode(RuleMode.MinorityEliminated)} />
                      少數死
                    </label>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div>
                   {/* Reusing playersPerRound variable for visual consistency or removal if deprecated */}
                   <div className="text-[10px] text-gray-400 text-center">總人數 (點擊修改)</div>
                 </div>
                 <div>
                   <select 
                      value={targetCountry} 
                      onChange={(e) => setTargetCountry(e.target.value as Country)}
                      className="w-full text-xs border rounded p-0.5 bg-red-50 text-red-800 font-bold"
                   >
                     {Object.values(Country).map(c => <option key={c} value={c}>Foul {c}</option>)}
                   </select>
                 </div>
              </div>
            </div>

            {/* My Country */}
             <div className="flex flex-col justify-center bg-green-50 border border-green-200 p-2 rounded-lg min-w-[80px]">
                <label className="text-[10px] text-gray-500 block text-center">我是</label>
                <select 
                    value={myCountry} 
                    onChange={(e) => setMyCountry(e.target.value as Country)}
                    className="text-xs border-none bg-transparent text-green-800 font-bold text-center outline-none"
                 >
                   {Object.values(Country).map(c => <option key={c} value={c}>{c}國</option>)}
                 </select>
             </div>

           {/* Reset Button (Desktop) */}
            <button 
              onClick={handleResetGame}
              className="hidden sm:flex flex-col items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors shadow-sm min-w-[50px]"
              title="重置遊戲"
            >
              <RefreshCw size={16} />
              <span className="text-[10px] font-bold mt-0.5">重置</span>
            </button>
          </div>

        </div>
      </div>

      {/* === GLOBAL STATS BAR (REAL-TIME) === */}
      <div className="flex justify-around items-center bg-gray-50 p-3 border-b border-gray-200 shadow-inner flex-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 border-2 border-yellow-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">A</div>
          <span className="text-3xl font-black text-gray-700">{totalCounts[Option.A]}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 border-2 border-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">B</div>
          <span className="text-3xl font-black text-gray-700">{totalCounts[Option.B]}</span>
        </div>
        {optionsPerRound === 3 && (
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-green-500 border-2 border-green-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">C</div>
             <span className="text-3xl font-black text-gray-700">{totalCounts[Option.C]}</span>
          </div>
        )}
      </div>

      {/* === MAIN GAME BOARD === */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white overflow-y-auto">
        <CountryColumn 
          country={Country.Gold} 
          totalPopulation={totalPopulations[Country.Gold]}
          activePopulation={activePopulations[Country.Gold]}
          score={scores[Country.Gold]}
          actions={currentActions.filter(a => a.country === Country.Gold)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Gold]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
          onActionClick={handleActionRemove}
        />
        <CountryColumn 
          country={Country.Water} 
          totalPopulation={totalPopulations[Country.Water]}
          activePopulation={activePopulations[Country.Water]}
          score={scores[Country.Water]}
          actions={currentActions.filter(a => a.country === Country.Water)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Water]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
          onActionClick={handleActionRemove}
        />
        <CountryColumn 
          country={Country.Wood} 
          totalPopulation={totalPopulations[Country.Wood]}
          activePopulation={activePopulations[Country.Wood]}
          score={scores[Country.Wood]}
          actions={currentActions.filter(a => a.country === Country.Wood)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Wood]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
          onActionClick={handleActionRemove}
        />
        <CountryColumn 
          country={Country.Fire} 
          totalPopulation={totalPopulations[Country.Fire]}
          activePopulation={activePopulations[Country.Fire]}
          score={scores[Country.Fire]}
          actions={currentActions.filter(a => a.country === Country.Fire)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Fire]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
          onActionClick={handleActionRemove}
        />
      </div>

      {/* === BOTTOM BAR: ACTIONS === */}
      <div className="bg-gray-800 text-white p-4 pb-8 sm:pb-4 flex-none z-20 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-center gap-6">
          <button 
            onClick={openSuggestionModal}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95 text-sm sm:text-base ${useAi ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {useAi ? <Zap size={20} /> : <BrainCircuit size={20} />}
            {useAi ? '建議' : '運算'}
          </button>

          <button 
            onClick={calculateRoundResult}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-full font-bold shadow-lg transition-transform active:scale-95 text-sm sm:text-base"
          >
            <Check size={20} />
            {activePopulations[Country.Gold] + activePopulations[Country.Water] + activePopulations[Country.Wood] + activePopulations[Country.Fire] <= 2 
             ? '結算勝者' 
             : '下一個 Turn'}
          </button>
        </div>
      </div>

      {/* === MODALS === */}

      {/* 1. Select Option Modal */}
      <Modal 
        isOpen={isActionModalOpen} 
        onClose={() => { setIsActionModalOpen(false); setSelectedDotCountry(null); }}
        title={`${selectedDotCountry}國人選擇`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500 mb-2">請為這個人選擇今 round 的選項：</p>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleOptionSelect(Option.A)}
              className="p-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="text-2xl">A</span>
            </button>
            <button 
              onClick={() => handleOptionSelect(Option.B)}
              className="p-3 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="text-2xl">B</span>
            </button>
            {optionsPerRound === 3 && (
              <button 
                onClick={() => handleOptionSelect(Option.C)}
                className="col-span-2 p-3 bg-green-100 hover:bg-green-200 text-green-800 font-bold rounded flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span className="text-2xl">C</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* 2. Suggestion Modal */}
      <Modal 
        isOpen={isSuggestionModalOpen} 
        onClose={() => setIsSuggestionModalOpen(false)}
        title="策略建議"
      >
        <div className="space-y-4">
          
          {/* Mode Toggle */}
          {manualRemainingInput === null && (
            <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setUseAi(false)}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${!useAi ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <BrainCircuit size={16} /> 本地算法
              </button>
              <button 
                onClick={() => setUseAi(true)}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${useAi ? 'bg-white text-purple-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Zap size={16} /> Gemini AI
              </button>
            </div>
          )}

          {manualRemainingInput === null ? (
            // Step 1: Input
            <div>
              <p className="mb-3 font-semibold text-gray-700">
                你 ({myCountry}國) 今 Turn 還有多少存活者未表態？
              </p>
              {/* Calculate max remaining for user context */}
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <button
                    key={num}
                    onClick={() => runSuggestion(num)}
                    className={`py-3 rounded font-bold text-lg transition-colors ${useAi ? 'bg-purple-50 hover:bg-purple-100 text-purple-700' : 'bg-gray-100 hover:bg-blue-100 text-blue-700'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ) : isSuggestionLoading ? (
            // Loading
            <div className="flex flex-col items-center py-8">
               <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mb-4 ${useAi ? 'border-purple-600' : 'border-blue-600'}`}></div>
               <p className="text-gray-500 animate-pulse">{useAi ? "Gemini 正在思考最優解..." : "正在計算所有可能性..."}</p>
            </div>
          ) : suggestionResult ? (
             // Result
             <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 max-h-[60vh] overflow-y-auto">
               <div className={`${useAi ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-blue-50 border-blue-200 text-blue-900'} border p-4 rounded-lg mb-4`}>
                 <h4 className="font-bold mb-2 flex items-center gap-2">
                   {useAi ? <Zap size={18}/> : <BrainCircuit size={18}/>} 建議分配方案：
                 </h4>
                 <ul className="space-y-1 ml-1">
                   <li className="text-lg"><span className="font-bold w-6 inline-block">A:</span> {suggestionResult.a} 人</li>
                   <li className="text-lg"><span className="font-bold w-6 inline-block">B:</span> {suggestionResult.b} 人</li>
                   {optionsPerRound === 3 && <li className="text-lg"><span className="font-bold w-6 inline-block">C:</span> {suggestionResult.c} 人</li>}
                 </ul>
               </div>

               <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm space-y-1 text-gray-600 mb-4">
                  <p>預計 <span className="text-red-600 font-bold">{targetCountry}國</span> 損失: {suggestionResult.targetLoss} 人</p>
                  <p>預計 <span className="text-green-600 font-bold">自己 ({myCountry}國)</span> 損失: {suggestionResult.selfLoss} 人</p>
                  <p className="text-xs mt-2 pt-2 border-t border-gray-200">
                    預計淘汰選項: <span className="font-mono font-bold bg-gray-200 px-1 rounded">{suggestionResult.eliminatedOptions.join(", ") || "無"}</span>
                  </p>
               </div>
               
               {suggestionResult.aiReasoning && (
                 <div className="bg-purple-50 p-3 rounded border border-purple-100 text-sm text-purple-800">
                   <p className="font-bold mb-1 flex items-center gap-1"><Zap size={14}/> AI 分析:</p>
                   {suggestionResult.aiReasoning}
                 </div>
               )}
               
               <button 
                 onClick={() => setManualRemainingInput(null)}
                 className="w-full mt-2 text-gray-400 hover:text-gray-600 text-sm underline"
               >
                 重新計算
               </button>
             </div>
          ) : (
            // Error
            <div className="text-center py-4">
              <p className="text-red-500 mb-2"><AlertTriangle className="inline mr-2"/> {suggestionError || "未知錯誤"}</p>
              <button onClick={() => setManualRemainingInput(null)} className="text-blue-600 underline">重試</button>
            </div>
          )}
        </div>
      </Modal>

      {/* 3. Round End Modal (Bout Logic) */}
      <Modal
        isOpen={isRoundEndModalOpen}
        onClose={() => setIsRoundEndModalOpen(false)}
        title={roundEndSummary?.isBoutOver ? "🏆 本 Round 結束，勝者誕生！" : `Round ${currentRound.roundNumber} - Turn ${currentRound.turnNumber} 結算`}
      >
        {roundEndSummary && (
          <div className="space-y-4">
            <div className="text-center mb-4">
               <p className="text-gray-500 mb-1 text-sm">本 Turn 被淘汰選項</p>
               <div className="flex justify-center gap-2">
                 {roundEndSummary.eliminatedOptions.length > 0 ? roundEndSummary.eliminatedOptions.map(opt => (
                   <span key={opt} className="text-2xl font-black text-red-600 bg-red-100 w-10 h-10 flex items-center justify-center rounded-lg">{opt}</span>
                 )) : (
                   <span className="text-lg font-bold text-green-600">和平！無人淘汰</span>
                 )}
               </div>
            </div>

            <div className="bg-gray-50 rounded p-4 border border-gray-200">
              <h4 className="font-bold text-gray-700 border-b pb-2 mb-2 flex items-center gap-2"><Skull size={16}/> 本 Turn 損失</h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {Object.entries(roundEndSummary.deaths).map(([country, count]) => (
                  <div key={country} className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600">{country}國</span>
                    <span className={`font-bold ${(count as number) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                      {(count as number) > 0 ? `-${count}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {roundEndSummary.isBoutOver && (
               <div className="bg-yellow-50 border-yellow-200 border p-4 rounded-lg text-center">
                 <h3 className="text-yellow-800 font-black text-xl mb-2 flex items-center justify-center gap-2"><Trophy size={24}/> 勝者加分</h3>
                 <p className="text-yellow-700 mb-2">全場剩餘 {roundEndSummary.survivorsTotal} 人</p>
                 <div className="flex flex-wrap gap-2 justify-center">
                    {roundEndSummary.winners.map(c => (
                      <span key={c} className="bg-yellow-200 text-yellow-900 px-3 py-1 rounded-full font-bold">
                        {c}國
                      </span>
                    ))}
                 </div>
                 <p className="text-xs text-gray-400 mt-3">所有國家人數將重置，準備下一 Round。</p>
               </div>
            )}
            
            <button 
              onClick={confirmRoundEnd}
              className={`w-full py-3 ${roundEndSummary.isBoutOver ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2`}
            >
              {roundEndSummary.isBoutOver ? (
                <>開啟新 Round (全員復活) <RotateCcw size={16} /></>
              ) : (
                <>進入下一個 Turn <Play size={16} fill="currentColor"/></>
              )}
            </button>
          </div>
        )}
      </Modal>

      {/* 4. Population Edit Modal */}
      <Modal
        isOpen={isPopulationModalOpen}
        onClose={() => setIsPopulationModalOpen(false)}
        title={`修改 ${editingCountry}國 總人數`}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">總人口上限 (Max Capacity)</label>
            <input 
              type="number" 
              value={editingPopulationValue}
              onChange={(e) => setEditingPopulationValue(e.target.value)}
              className="w-full border-2 border-blue-200 rounded-lg p-3 text-xl font-bold text-center focus:border-blue-500 outline-none"
              min="0"
            />
             <p className="text-xs text-gray-500 mt-2">
               * 修改後，若目前處於 Round 1 - Turn 1，活躍人數也會同步更新。
             </p>
          </div>
          <button 
            onClick={savePopulation}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition-colors flex justify-center items-center gap-2"
          >
            <Save size={18} /> 儲存
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default App;
