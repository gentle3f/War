export enum Country {
  Gold = '金',
  Water = '水',
  Wood = '木',
  Fire = '火',
}

export enum Option {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum RuleMode {
  MajorityEliminated = 'majority',
  MinorityEliminated = 'minority',
}

export interface PlayerRecord {
  id: string;
  country: Country;
  option: Option;
}

export interface RoundData {
  roundNumber: number;
  actions: PlayerRecord[];
  isCompleted: boolean;
  statsSnapshot?: Record<Country, number>; // Population at end of round
}

export interface CountryConfig {
  name: Country;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  total: number;
}

export interface GameState {
  mode: RuleMode;
  optionsPerRound: 2 | 3;
  playersPerRound: number; // 'n'
  targetCountry: Country;
  myCountry: Country; // To calculate "Self" damage
  populations: Record<Country, number>;
  rounds: RoundData[];
  currentRoundIndex: number;
  notes: string;
}