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
  Play
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
    // Check if API key is present
    if (process.env.API_KEY) {
      setHasApiKey(true);
    }
  }, []);

  // --- Game State ---
  const [populations, setPopulations] = useState<Record<Country, number>>(INITIAL_POPULATION);
  const [rounds, setRounds] = useState<RoundData[]>([
    { roundNumber: 1, actions: [], isCompleted: false }
  ]);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  
  // Rules & Settings
  const [ruleMode, setRuleMode] = useState<RuleMode>(RuleMode.MajorityEliminated);
  const [optionsPerRound, setOptionsPerRound] = useState<2 | 3>(2);
  const [playersPerRound, setPlayersPerRound] = useState<number>(3);
  const [targetCountry, setTargetCountry] = useState<Country>(Country.Water);
  const [myCountry, setMyCountry] = useState<Country>(Country.Wood);
  const [notes, setNotes] = useState<string>("");

  // UI State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedDotCountry, setSelectedDotCountry] = useState<Country | null>(null);
  
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [manualRemainingInput, setManualRemainingInput] = useState<number | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult & { aiReasoning?: string } | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [isRoundEndModalOpen, setIsRoundEndModalOpen] = useState(false);
  const [roundEndSummary, setRoundEndSummary] = useState<{eliminated: Option[], deaths: Record<Country, number>} | null>(null);

  // Population Edit State
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingPopulationValue, setEditingPopulationValue] = useState<string>("");

  // --- Computed ---
  const currentRound = rounds[currentRoundIdx];
  const currentActions = currentRound.actions;

  // --- Handlers ---

  const handleDotClick = (country: Country) => {
    setSelectedDotCountry(country);
    setIsActionModalOpen(true);
  };

  const handlePopulationClick = (country: Country) => {
    setEditingCountry(country);
    setEditingPopulationValue(populations[country].toString());
    setIsPopulationModalOpen(true);
  };

  const savePopulation = () => {
    if (editingCountry && editingPopulationValue !== "") {
      const val = parseInt(editingPopulationValue, 10);
      if (!isNaN(val) && val >= 0) {
        setPopulations({
          ...populations,
          [editingCountry]: val
        });
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
        // Use Gemini AI
        const aiResponse = await getAiSuggestion(
          currentActions,
          myCountry,
          targetCountry,
          remaining,
          ruleMode,
          optionsPerRound,
          populations
        );

        // Evaluate the AI's suggested move using our deterministic engine to get precise loss stats
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
        // Use Local Heuristic
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
      setSuggestionError(`AI 請求失敗: ${err.message || "未知錯誤"}。請檢查 API Key (VITE_GEMINI_API_KEY)。`);
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const calculateRoundResult = () => {
    const counts = getCounts(currentActions);
    const eliminated = getEliminatedOptions(counts, ruleMode, optionsPerRound);
    
    const deaths: Record<Country, number> = {
      [Country.Gold]: 0,
      [Country.Water]: 0,
      [Country.Wood]: 0,
      [Country.Fire]: 0,
    };

    currentActions.forEach(action => {
      if (eliminated.includes(action.option)) {
        deaths[action.country]++;
      }
    });

    setRoundEndSummary({ eliminated, deaths });
    setIsRoundEndModalOpen(true);
  };

  const confirmRoundEnd = () => {
    if (!roundEndSummary) return;

    // Update populations
    const newPopulations = { ...populations };
    (Object.keys(newPopulations) as Country[]).forEach(c => {
      newPopulations[c] = Math.max(0, newPopulations[c] - roundEndSummary.deaths[c]);
    });
    setPopulations(newPopulations);

    // Close Round
    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIdx] = {
      ...currentRound,
      isCompleted: true,
      statsSnapshot: newPopulations
    };

    // Start New Round
    updatedRounds.push({
      roundNumber: currentRound.roundNumber + 1,
      actions: [],
      isCompleted: false
    });

    setRounds(updatedRounds);
    setCurrentRoundIdx(currentRoundIdx + 1);
    setIsRoundEndModalOpen(false);
    setRoundEndSummary(null);
  };

  // Shared reset logic
  const resetGameState = () => {
    setPopulations({ ...INITIAL_POPULATION });
    setRounds([{ roundNumber: 1, actions: [], isCompleted: false }]);
    setCurrentRoundIdx(0);
    setNotes("");
    
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
    if (window.confirm("確定要重新開始遊戲嗎？所有數據將會清除（但保留當前設定）。")) {
      resetGameState();
    }
  };

  // --- Render Helpers ---

  const getTotalCounts = () => getCounts(currentActions);
  const totalCounts = getTotalCounts();

  // --- MAIN GAME BOARD ---
  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* === TOP PANEL === */}
      <div className="bg-white border-b shadow-sm p-2 sm:p-4 flex-none z-10">
        
        <div className="flex flex-wrap gap-2 items-center justify-between">
          
          <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
             {/* API Status */}
             <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] sm:text-xs font-mono ${hasApiKey ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}`}>
              {hasApiKey ? 'API OK' : 'NO KEY'}
            </div>
             
             {/* Round Control */}
             <div className="bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-2 shadow-inner">
               <div className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-1">
                 <RotateCcw size={14} /> R{currentRound.roundNumber}
               </div>
               <div className="flex gap-1">
                 <button 
                   disabled={currentRoundIdx === 0}
                   onClick={() => setCurrentRoundIdx(curr => curr - 1)}
                   className="px-2 py-0.5 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                 >&lt;</button>
                  <button 
                   disabled={currentRoundIdx === rounds.length - 1}
                   onClick={() => setCurrentRoundIdx(curr => curr + 1)}
                   className="px-2 py-0.5 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                 >&gt;</button>
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


          {/* Options & Rules Control (Scrollable on tiny screens) */}
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
                   <select 
                      value={playersPerRound} 
                      onChange={(e) => setPlayersPerRound(Number(e.target.value))}
                      className="w-full text-xs border rounded p-0.5 bg-gray-50"
                   >
                     {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>每國 {n} 人</option>)}
                   </select>
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
      {/* Changed to allow scrolling on mobile (overflow-y-auto) and stack columns (grid-cols-1) */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white overflow-y-auto">
        <CountryColumn 
          country={Country.Gold} 
          currentPopulation={populations[Country.Gold]} 
          actions={currentActions.filter(a => a.country === Country.Gold)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Gold]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
        />
        <CountryColumn 
          country={Country.Water} 
          currentPopulation={populations[Country.Water]} 
          actions={currentActions.filter(a => a.country === Country.Water)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Water]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
        />
        <CountryColumn 
          country={Country.Wood} 
          currentPopulation={populations[Country.Wood]} 
          actions={currentActions.filter(a => a.country === Country.Wood)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Wood]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
        />
        <CountryColumn 
          country={Country.Fire} 
          currentPopulation={populations[Country.Fire]} 
          actions={currentActions.filter(a => a.country === Country.Fire)}
          playersPerRound={playersPerRound}
          optionsPerRound={optionsPerRound}
          styles={COUNTRY_STYLES[Country.Fire]}
          onDotClick={handleDotClick}
          onPopulationClick={handlePopulationClick}
        />
      </div>

      {/* === BOTTOM BAR: ACTIONS === */}
      <div className="bg-gray-800 text-white p-4 flex-none z-20 shadow-lg">
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
            結算
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
          
          {/* Mode Toggle (Only visible when waiting for input) */}
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
                你 ({myCountry}國) 今 round 還有多少人未表態？
              </p>
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

      {/* 3. Round End Modal */}
      <Modal
        isOpen={isRoundEndModalOpen}
        onClose={() => setIsRoundEndModalOpen(false)}
        title={`Round ${currentRound.roundNumber} 結算`}
      >
        {roundEndSummary && (
          <div className="space-y-4">
            <div className="text-center mb-4">
               <p className="text-gray-500 mb-1">被淘汰的選項</p>
               <div className="flex justify-center gap-2">
                 {roundEndSummary.eliminated.length > 0 ? roundEndSummary.eliminated.map(opt => (
                   <span key={opt} className="text-3xl font-black text-red-600 bg-red-100 w-12 h-12 flex items-center justify-center rounded-lg">{opt}</span>
                 )) : (
                   <span className="text-lg font-bold text-green-600">和平！無人被淘汰</span>
                 )}
               </div>
            </div>

            <div className="bg-gray-50 rounded p-4">
              <h4 className="font-bold text-gray-700 border-b pb-2 mb-2">各國損失人數</h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {Object.entries(roundEndSummary.deaths).map(([country, count]) => (
                  <div key={country} className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600">{country}國</span>
                    <span className={`font-bold ${(count as number) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {(count as number) > 0 ? `-${count}` : '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={confirmRoundEnd}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              確認並進入下一 Round <Play size={16} fill="currentColor"/>
            </button>
          </div>
        )}
      </Modal>

      {/* 4. Population Edit Modal */}
      <Modal
        isOpen={isPopulationModalOpen}
        onClose={() => setIsPopulationModalOpen(false)}
        title={`修改 ${editingCountry}國 人數`}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">當前人數</label>
            <input 
              type="number" 
              value={editingPopulationValue}
              onChange={(e) => setEditingPopulationValue(e.target.value)}
              className="w-full border-2 border-blue-200 rounded-lg p-3 text-xl font-bold text-center focus:border-blue-500 outline-none"
              min="0"
            />
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