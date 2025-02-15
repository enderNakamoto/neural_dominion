// contractTypes.ts
export interface ChainNationStats {
    economicFreedom: number;
    civilRights: number;
    politicalFreedom: number;
    gdp: number;
}

export interface ChainDecision {
    issueId: number;
    chosenOptionId: number;
}

export interface ChainGameState {
    status: number;
    player1: string;
    player2: string;
    player1Moved: boolean;
    player2Moved: boolean;
    lastUpdateTime: number;
}

export interface ChainWinnerInfo {
    winner: string;
    winningScore: number;
    isGameCompleted: boolean;
}