import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Play, 
  RotateCcw, 
  Plus, 
  Minus, 
  HelpCircle,
  BrainCircuit,
  Check,
  AlertTriangle,
  RefreshCw,
  Zap,
  Cpu
} from 'lucide-react';
import { Country, Option, RuleMode, GameState, PlayerRecord, RoundData } from './types';
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
  const [hasStarted, setHasStarted] = useState(false);
  const [useAi, setUseAi] = useState(false);

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

  const handleStartGame = (withAi: boolean) => {
    setUseAi(withAi);
    setHasStarted(true);
  };

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
    } catch (err) {
      console.error(err);
      setSuggestionError("AI 請求失敗，請檢查 API Key 或網絡連線。");
      // Fallback to local calculation? 
      // Optionally we could auto-fallback, but explicit error is better for "AI Mode".
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

  const handleResetGame = () => {
    if (window.confirm("確定要重置整場遊戲嗎？所有數據（人數、Round）將會回復初始狀態。")) {
      setPopulations(INITIAL_POPULATION);
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
    }
  };

  // --- Render Helpers ---

  const getTotalCounts = () => getCounts(currentActions);
  const totalCounts = getTotalCounts();

  // --- START SCREEN ---
  if (!hasStarted) {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in duration-500">
          
          {/* Left / Top Banner */}
          <div className="bg-blue-600 p-8 md:w-2/5 text-white flex flex-col justify-center items-center text-center">
            <div className="mb-6 bg-white/20 p-4 rounded-full">
              <Users size={64} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Minority Game Strategist</h1>
            <p className="text-blue-100">少數決商戰輔助工具</p>
            <div className="mt-8 space-y-2 text-sm text-blue-200">
               <p>✓ 實時人數追踪</p>
               <p>✓ 策略模擬建議</p>
               <p>✓ Round 結算自動化</p>
            </div>
          </div>

          {/* Right / Bottom Content */}
          <div className="p-8 md:w-3/5 flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">選擇模式</h2>
            
            <div className="space-y-4">
              {/* Option 1: Free / Offline */}
              <button 
                onClick={() => handleStartGame(false)}
                className="w-full group relative flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="bg-gray-100 p-3 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Cpu size={24} className="text-gray-600 group-hover:text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">免費版 (Free Tier)</h3>
                  <p className="text-sm text-gray-500">使用內置算法進行邏輯運算。無需連網，完全本地執行。</p>
                </div>
              </button>

              {/* Option 2: Gemini AI */}
              <button 
                onClick={() => handleStartGame(true)}
                className="w-full group relative flex items-center gap-4 p-4 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
              >
                <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Zap size={24} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    Gemini AI 版 <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Pro</span>
                  </h3>
                  <p className="text-sm text-gray-500">使用 Google Gemini 模型分析局勢。需配置 API Key。</p>
                </div>
              </button>
            </div>

            <div className="mt-8 text-xs text-gray-400 text-center">
              注意：AI 建議僅供參考，請自行承擔遊戲風險。
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* === TOP PANEL === */}
      <div className="bg-white border-b shadow-sm p-4 flex-none z-10">
        
        <div className="flex flex-wrap gap-4 items-start justify-between">
          
          {/* Round Control */}
          <div className="bg-gray-100 p-3 rounded-lg flex flex-col gap-2 shadow-inner min-w-[140px]">
            <div className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <RotateCcw size={16} /> Round {currentRound.roundNumber}
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentRoundIdx === 0}
                onClick={() => setCurrentRoundIdx(curr => curr - 1)}
                className="flex-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
              >上一 Round</button>
               <button 
                disabled={currentRoundIdx === rounds.length - 1}
                onClick={() => setCurrentRoundIdx(curr => curr + 1)}
                className="flex-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
              >下一 Round</button>
            </div>
          </div>

          {/* Options Control */}
          <div className="bg-gray-100 p-3 rounded-lg flex flex-col gap-2 items-center shadow-inner">
            <span className="text-xs font-bold text-gray-600">選項數目</span>
            <div className="flex items-center gap-2 bg-white rounded px-2 py-1 border">
              <button onClick={() => setOptionsPerRound(2)} disabled={optionsPerRound===2} className="p-1 hover:bg-gray-100 rounded"><Minus size={14}/></button>
              <span className="font-bold text-blue-600 w-4 text-center">{optionsPerRound}</span>
              <button onClick={() => setOptionsPerRound(3)} disabled={optionsPerRound===3} className="p-1 hover:bg-gray-100 rounded"><Plus size={14}/></button>
            </div>
          </div>

          {/* Rule Settings */}
          <div className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col gap-2 flex-1 min-w-[200px] max-w-lg shadow-sm">
            <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Settings size={14}/> 規則設定</span>
               <div className="text-xs flex gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={ruleMode === RuleMode.MajorityEliminated} onChange={() => setRuleMode(RuleMode.MajorityEliminated)} />
                    多數淘汰
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={ruleMode === RuleMode.MinorityEliminated} onChange={() => setRuleMode(RuleMode.MinorityEliminated)} />
                    少數淘汰
                  </label>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-1">
               <div>
                 <label className="text-xs text-gray-500 block">每國出場人數 (n)</label>
                 <select 
                    value={playersPerRound} 
                    onChange={(e) => setPlayersPerRound(Number(e.target.value))}
                    className="w-full text-sm border rounded p-1 mt-0.5 bg-gray-50"
                 >
                   {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} 人</option>)}
                 </select>
               </div>
               <div>
                 <label className="text-xs text-gray-500 block">目標 Foul (敵國)</label>
                 <select 
                    value={targetCountry} 
                    onChange={(e) => setTargetCountry(e.target.value as Country)}
                    className="w-full text-sm border rounded p-1 mt-0.5 bg-red-50 text-red-800 font-bold"
                 >
                   {Object.values(Country).map(c => <option key={c} value={c}>{c}國</option>)}
                 </select>
               </div>
            </div>
             <div className="mt-1">
                <label className="text-xs text-gray-500 inline-block mr-2">我是:</label>
                <select 
                    value={myCountry} 
                    onChange={(e) => setMyCountry(e.target.value as Country)}
                    className="text-xs border rounded p-0.5 bg-green-50 text-green-800 font-bold"
                 >
                   {Object.values(Country).map(c => <option key={c} value={c}>{c}國</option>)}
                 </select>
             </div>
          </div>

           {/* Notes */}
           <div className="flex-1 hidden lg:block">
             <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="備註 / 特別規則..."
              className="w-full h-full min-h-[80px] text-xs p-2 border rounded bg-yellow-50 text-gray-700 resize-none focus:ring-2 focus:ring-yellow-400 focus:outline-none"
             />
           </div>

           {/* Reset Button */}
            <button 
              onClick={handleResetGame}
              className="flex flex-col items-center justify-center p-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors shadow-sm"
              title="重置遊戲"
            >
              <RefreshCw size={18} />
              <span className="text-xs font-bold mt-1">重置</span>
            </button>

        </div>
      </div>

      {/* === MAIN GAME BOARD === */}
      <div className="flex-1 grid grid-cols-4 bg-white overflow-hidden">
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

      {/* === BOTTOM BAR: STATS & ACTIONS === */}
      <div className="bg-gray-800 text-white p-4 flex-none z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Total Stats */}
          <div className="flex gap-6">
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 uppercase">Total A</span>
              <span className="text-2xl font-bold text-yellow-400">{totalCounts[Option.A]}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 uppercase">Total B</span>
              <span className="text-2xl font-bold text-blue-400">{totalCounts[Option.B]}</span>
            </div>
            {optionsPerRound === 3 && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 uppercase">Total C</span>
                <span className="text-2xl font-bold text-green-400">{totalCounts[Option.C]}</span>
              </div>
            )}
          </div>

          {/* Main Actions */}
          <div className="flex gap-4">
            <button 
              onClick={openSuggestionModal}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95 ${useAi ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {useAi ? <Zap size={20} /> : <BrainCircuit size={20} />}
              {useAi ? 'Gemini 建議' : '運算建議'}
            </button>

            <button 
              onClick={calculateRoundResult}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-full font-bold shadow-lg transition-transform active:scale-95"
            >
              <Check size={20} />
              結算 Round
            </button>
          </div>

        </div>
      </div>

      {/* === MODALS === */}

      {/* 1. Pick Option Modal */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={`為 ${selectedDotCountry}國 成員選擇`}>
        <div className="flex flex-col gap-4">
          <p className="text-gray-600 text-center mb-2">呢個人今 round 揀咩選項？</p>
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => handleOptionSelect(Option.A)} className="bg-yellow-100 text-yellow-800 border-2 border-yellow-400 hover:bg-yellow-200 p-4 rounded-lg font-bold text-xl transition-colors">A</button>
            <button onClick={() => handleOptionSelect(Option.B)} className="bg-blue-100 text-blue-800 border-2 border-blue-400 hover:bg-blue-200 p-4 rounded-lg font-bold text-xl transition-colors">B</button>
            {optionsPerRound === 3 && (
              <button onClick={() => handleOptionSelect(Option.C)} className="bg-green-100 text-green-800 border-2 border-green-400 hover:bg-green-200 p-4 rounded-lg font-bold text-xl transition-colors">C</button>
            )}
          </div>
        </div>
      </Modal>

      {/* 2. Suggestion Modal */}
      <Modal isOpen={isSuggestionModalOpen} onClose={() => setIsSuggestionModalOpen(false)} title={`${useAi ? 'Gemini' : '算法'} 戰略建議`}>
        <div className="space-y-6">
          {!suggestionResult && !isSuggestionLoading ? (
            <div className="text-center">
              <h4 className="text-md font-medium text-gray-700 mb-4">你（{myCountry}國）今 round 仲有幾多人未揀？</h4>
              {suggestionError && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">{suggestionError}</div>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num} 
                    onClick={() => runSuggestion(num)}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-800 hover:text-blue-600 font-bold border border-gray-300 transition-colors"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ) : isSuggestionLoading ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-purple-600 font-bold animate-pulse">AI 思考中...</p>
             </div>
          ) : suggestionResult && (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className={`${useAi ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 mb-4`}>
                <h4 className={`font-bold ${useAi ? 'text-purple-900' : 'text-blue-900'} mb-2 flex items-center gap-2`}>
                  {useAi ? <Zap size={18}/> : <BrainCircuit size={18}/>} 建議方案：
                </h4>
                <ul className={`list-disc list-inside space-y-1 ${useAi ? 'text-purple-800' : 'text-blue-800'} font-medium`}>
                  {suggestionResult.a > 0 && <li>{suggestionResult.a} 人揀 <span className="bg-yellow-200 px-1 rounded text-yellow-900">A</span></li>}
                  {suggestionResult.b > 0 && <li>{suggestionResult.b} 人揀 <span className="bg-blue-200 px-1 rounded text-blue-900">B</span></li>}
                  {suggestionResult.c > 0 && <li>{suggestionResult.c} 人揀 <span className="bg-green-200 px-1 rounded text-green-900">C</span></li>}
                </ul>
                {suggestionResult.aiReasoning && (
                  <div className="mt-3 pt-3 border-t border-purple-200 text-sm text-purple-800 italic">
                    <span className="font-bold not-italic block mb-1">AI 分析:</span>
                    "{suggestionResult.aiReasoning}"
                  </div>
                )}
              </div>
              
              <div className="bg-white border rounded-lg p-3 text-sm">
                <div className="font-bold text-gray-600 mb-1">預計後果 ({ruleMode === RuleMode.MajorityEliminated ? '多數死' : '少數死'})：</div>
                <p className="text-gray-700 mb-2">
                  會被淘汰的選項： 
                  {suggestionResult.eliminatedOptions.length === 0 
                    ? <span className="text-green-600 font-bold">無 (安全)</span> 
                    : <span className="text-red-600 font-bold">{suggestionResult.eliminatedOptions.join(', ')}</span>
                  }
                </p>
                <div className="grid grid-cols-2 gap-2">
                   <div className="p-2 bg-red-50 rounded border border-red-100">
                      <div className="text-xs text-red-500 uppercase font-bold">目標 ({targetCountry}) 損失</div>
                      <div className="text-xl font-bold text-red-700">-{suggestionResult.targetLoss}</div>
                   </div>
                   <div className="p-2 bg-green-50 rounded border border-green-100">
                      <div className="text-xs text-green-500 uppercase font-bold">自己 ({myCountry}) 損失</div>
                      <div className="text-xl font-bold text-green-700">-{suggestionResult.selfLoss}</div>
                   </div>
                </div>
              </div>

              <button 
                onClick={() => setSuggestionResult(null)}
                className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
              >
                重新計算
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* 3. Round End Modal */}
      <Modal isOpen={isRoundEndModalOpen} onClose={() => setIsRoundEndModalOpen(false)} title="本回合結算">
         {roundEndSummary && (
           <div className="space-y-4">
             <div className="bg-red-50 border-l-4 border-red-500 p-4">
               <p className="font-bold text-red-700">被淘汰選項： {roundEndSummary.eliminated.length > 0 ? roundEndSummary.eliminated.join(' & ') : '無'}</p>
               <p className="text-xs text-red-500 mt-1">規則：{ruleMode === RuleMode.MajorityEliminated ? '多數者' : '少數者'} 淘汰</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                {Object.entries(roundEndSummary.deaths).map(([country, dead]) => {
                    if (dead === 0) return null;
                    return (
                      <div key={country} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                        <span className="font-bold text-gray-700">{country}國</span>
                        <span className="font-bold text-red-600">-{dead} 人</span>
                      </div>
                    );
                })}
                {Object.values(roundEndSummary.deaths).every(d => d === 0) && (
                  <div className="col-span-2 text-center text-green-600 font-bold py-2">
                    全員生還！ Peace & Love.
                  </div>
                )}
             </div>
             
             <div className="flex gap-2 pt-4 border-t">
               <button onClick={() => setIsRoundEndModalOpen(false)} className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50">取消</button>
               <button onClick={confirmRoundEnd} className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold shadow">確認並開始下一 Round</button>
             </div>
           </div>
         )}
      </Modal>

      {/* 4. Edit Population Modal */}
      <Modal isOpen={isPopulationModalOpen} onClose={() => setIsPopulationModalOpen(false)} title={`修改 ${editingCountry}國 人數`}>
        <div className="flex flex-col gap-4">
           <p className="text-sm text-gray-600">請手動輸入該國當前剩餘人數：</p>
           <input 
              type="number" 
              className="border-2 border-blue-200 rounded p-3 text-2xl font-bold text-center w-full focus:border-blue-500 focus:outline-none"
              value={editingPopulationValue}
              onChange={(e) => setEditingPopulationValue(e.target.value)}
              min="0"
              autoFocus
           />
           <div className="flex gap-3 mt-2">
              <button onClick={() => setIsPopulationModalOpen(false)} className="flex-1 py-2 border rounded hover:bg-gray-100">取消</button>
              <button onClick={savePopulation} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow">儲存</button>
           </div>
        </div>
      </Modal>

    </div>
  );
};

export default App;