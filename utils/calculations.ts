import { Country, Option, RuleMode, PlayerRecord } from '../types';

export interface RoundCounts {
  [Option.A]: number;
  [Option.B]: number;
  [Option.C]: number;
}

// Helper to get counts from a list of actions
export const getCounts = (actions: PlayerRecord[]): RoundCounts => {
  return {
    [Option.A]: actions.filter(a => a.option === Option.A).length,
    [Option.B]: actions.filter(a => a.option === Option.B).length,
    [Option.C]: actions.filter(a => a.option === Option.C).length,
  };
};

// Determine which options are eliminated based on rules
export const getEliminatedOptions = (
  counts: RoundCounts,
  mode: RuleMode,
  optionCount: 2 | 3
): Option[] => {
  const relevantOptions = optionCount === 2 ? [Option.A, Option.B] : [Option.A, Option.B, Option.C];
  const relevantCounts = relevantOptions.map(opt => ({ opt, count: counts[opt] }));

  if (mode === RuleMode.MajorityEliminated) {
    const maxVal = Math.max(...relevantCounts.map(c => c.count));
    if (maxVal === 0) return [];
    return relevantCounts.filter(c => c.count === maxVal).map(c => c.opt);
  } else {
    const minVal = Math.min(...relevantCounts.map(c => c.count));
    const totalVotes = relevantCounts.reduce((a, b) => a + b.count, 0);
    if (totalVotes === 0) return [];
    return relevantCounts.filter(c => c.count === minVal).map(c => c.opt);
  }
};

export interface SuggestionResult {
  a: number;
  b: number;
  c: number;
  targetLoss: number;
  selfLoss: number;
  eliminatedOptions: Option[];
}

// Evaluates a specific allocation scenario
export const evaluateScenario = (
  scenario: { a: number; b: number; c: number },
  baseCounts: RoundCounts,
  targetBreakdown: RoundCounts,
  selfBreakdown: RoundCounts,
  mode: RuleMode,
  optionCount: 2 | 3
): SuggestionResult => {
  const finalCounts = {
    [Option.A]: baseCounts[Option.A] + scenario.a,
    [Option.B]: baseCounts[Option.B] + scenario.b,
    [Option.C]: baseCounts[Option.C] + scenario.c,
  };

  const eliminated = getEliminatedOptions(finalCounts, mode, optionCount);

  let targetLoss = 0;
  let selfLoss = 0;

  // Existing losses
  if (eliminated.includes(Option.A)) {
    targetLoss += targetBreakdown[Option.A];
    selfLoss += selfBreakdown[Option.A];
  }
  if (eliminated.includes(Option.B)) {
    targetLoss += targetBreakdown[Option.B];
    selfLoss += selfBreakdown[Option.B];
  }
  if (eliminated.includes(Option.C)) {
    targetLoss += targetBreakdown[Option.C];
    selfLoss += selfBreakdown[Option.C];
  }

  // Future losses (from the dots we are about to place)
  if (eliminated.includes(Option.A)) selfLoss += scenario.a;
  if (eliminated.includes(Option.B)) selfLoss += scenario.b;
  if (eliminated.includes(Option.C)) selfLoss += scenario.c;

  return {
    a: scenario.a,
    b: scenario.b,
    c: scenario.c,
    targetLoss,
    selfLoss,
    eliminatedOptions: eliminated
  };
};

// Algorithm to find best move
export const calculateBestMove = (
  currentActions: PlayerRecord[],
  myCountry: Country,
  targetCountry: Country,
  remainingMovesForMe: number,
  mode: RuleMode,
  optionCount: 2 | 3
): SuggestionResult | null => {
  
  const baseCounts = getCounts(currentActions);
  const targetActions = currentActions.filter(a => a.country === targetCountry);
  const targetBreakdown = getCounts(targetActions);
  const selfActions = currentActions.filter(a => a.country === myCountry);
  const selfBreakdown = getCounts(selfActions);

  let bestScenario: SuggestionResult | null = null;
  let bestScore = -Infinity;

  const scenarios: { a: number; b: number; c: number }[] = [];

  if (optionCount === 2) {
    for (let i = 0; i <= remainingMovesForMe; i++) {
      scenarios.push({ a: i, b: remainingMovesForMe - i, c: 0 });
    }
  } else {
    for (let i = 0; i <= remainingMovesForMe; i++) {
      for (let j = 0; j <= remainingMovesForMe - i; j++) {
        scenarios.push({ a: i, b: j, c: remainingMovesForMe - i - j });
      }
    }
  }

  for (const scen of scenarios) {
    const result = evaluateScenario(
      scen,
      baseCounts,
      targetBreakdown,
      selfBreakdown,
      mode,
      optionCount
    );

    // Score: Maximize Target Loss, Minimize Self Loss
    const score = result.targetLoss - (result.selfLoss * 1.2); 

    if (score > bestScore) {
      bestScore = score;
      bestScenario = result;
    }
  }

  return bestScenario;
};