import { GoogleGenAI, Type, Schema } from "@google/genai";
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

    const isTwoOptions = optionsPerRound === 2;
    const optionText = isTwoOptions ? "A or B" : "A, B, or C";
    const optionsList = isTwoOptions ? "A, B" : "A, B, C";

    const prompt = `
      I am playing a game where countries vote ${optionText}. 
      Current Rule: The ${mode === RuleMode.MajorityEliminated ? 'MAJORITY' : 'MINORITY'} group is eliminated.
      
      My Country: ${myCountry} (Total Pop: ${populations[myCountry]})
      Target to Eliminate: ${targetCountry} (Total Pop: ${populations[targetCountry]})
      
      Current Votes on Board:
      A: ${counts[Option.A]}
      B: ${counts[Option.B]}
      ${!isTwoOptions ? `C: ${counts[Option.C]}` : ''}
      
      Vote Breakdown by Country:
      ${JSON.stringify(breakdown, null, 2)}
      
      I have ${remainingMoves} undecided players from my country (${myCountry}).
      How should I distribute them (${optionsList}) to MAXIMIZE damage to ${targetCountry} and MINIMIZE damage to ${myCountry}?

      ${isTwoOptions ? 'IMPORTANT: There are only 2 options (A and B). Do NOT assign any votes to C.' : ''}
    `;

    // Dynamic Schema Construction
    const properties: Record<string, Schema> = {
      a: { type: Type.INTEGER, description: "Number of my players to vote A" },
      b: { type: Type.INTEGER, description: "Number of my players to vote B" },
      reasoning: { type: Type.STRING, description: "Brief explanation of the strategy" }
    };

    const requiredFields = ["a", "b", "reasoning"];

    if (!isTwoOptions) {
      properties.c = { type: Type.INTEGER, description: "Number of my players to vote C" };
      requiredFields.push("c");
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: properties,
          required: requiredFields
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    const result = JSON.parse(jsonText);
    
    return {
      a: result.a || 0,
      b: result.b || 0,
      c: result.c || 0, // Will be undefined/0 for 2-option schema
      reasoning: result.reasoning || "AI Suggestion"
    };

  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};