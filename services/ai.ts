import { GoogleGenAI, Type } from "@google/genai";
import { GameState, PlayerRecord, RuleMode, Country, Option } from '../types';
import { getCounts } from '../utils/calculations';

export interface AiSuggestionResponse {
  a: number;
  b: number;
  c: number;
  reasoning: string;
}

export const getAiSuggestion = async (
  currentActions: PlayerRecord[],
  myCountry: Country,
  targetCountry: Country,
  remainingMoves: number,
  mode: RuleMode,
  optionsPerRound: 2 | 3,
  populations: Record<Country, number>
): Promise<AiSuggestionResponse> => {
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Construct context for the AI
    const counts = getCounts(currentActions);
    const breakdown = currentActions.reduce((acc, act) => {
      if (!acc[act.country]) acc[act.country] = { A: 0, B: 0, C: 0 };
      acc[act.country][act.option]++;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const prompt = `
      I am playing a game where countries vote A, B, (or C). 
      Current Rule: The ${mode === RuleMode.MajorityEliminated ? 'MAJORITY' : 'MINORITY'} group is eliminated.
      
      My Country: ${myCountry} (Total Pop: ${populations[myCountry]})
      Target to Eliminate: ${targetCountry} (Total Pop: ${populations[targetCountry]})
      
      Current Votes on Board:
      A: ${counts[Option.A]}
      B: ${counts[Option.B]}
      C: ${optionsPerRound === 3 ? counts[Option.C] : 'N/A'}
      
      Vote Breakdown by Country:
      ${JSON.stringify(breakdown, null, 2)}
      
      I have ${remainingMoves} undecided players from my country (${myCountry}).
      How should I distribute them (A, B, C) to MAXIMIZE damage to ${targetCountry} and MINIMIZE damage to ${myCountry}?
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            a: { type: Type.INTEGER, description: "Number of my players to vote A" },
            b: { type: Type.INTEGER, description: "Number of my players to vote B" },
            c: { type: Type.INTEGER, description: "Number of my players to vote C" },
            reasoning: { type: Type.STRING, description: "Brief explanation of the strategy" }
          },
          required: ["a", "b", "c", "reasoning"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    const result = JSON.parse(jsonText);
    
    // Validate consistency
    const totalSuggested = result.a + result.b + (result.c || 0);
    if (totalSuggested !== remainingMoves) {
      console.warn("AI suggested move count mismatch, falling back to raw values but be careful.");
    }

    return {
      a: result.a || 0,
      b: result.b || 0,
      c: result.c || 0,
      reasoning: result.reasoning || "AI Suggestion"
    };

  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};