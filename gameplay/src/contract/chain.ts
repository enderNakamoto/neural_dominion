// chain.ts
import {
    Contract,
    Signer,
    encodeBytes32String,
    decodeBytes32String,
    getBigInt,
    ContractTransactionResponse
} from 'ethers';
import type { Nation, GameStatus } from '../types';
import { NATION_BUILDER_ABI } from './abi';
import type {
    ChainGameState,
    ChainNationStats,
    ChainDecision,
    ChainWinnerInfo
} from './ContractTypes';

// Generic type for contract call responses
type ContractResponse<T> = Promise<T>;

// READ OPERATIONS
export const chainRead = {
    async getGameState(
        contract: Contract,
        gameId: string
    ): ContractResponse<ChainGameState> {
        try {
            const [status, player1, player2, player1Moved, player2Moved, lastUpdateTime] = 
                await contract.getGameState(encodeBytes32String(gameId));
            
            return {
                status: Number(status),
                player1,
                player2,
                player1Moved,
                player2Moved,
                lastUpdateTime: Number(lastUpdateTime)
            };
        } catch (error) {
            console.error('Error fetching game state:', error);
            throw new Error('Failed to fetch game state');
        }
    },

    async getPlayerStats(
        contract: Contract,
        gameId: string,
        isPlayer1: boolean
    ): ContractResponse<ChainNationStats> {
        try {
            const [economicFreedom, civilRights, politicalFreedom, gdp] = 
                await contract.getPlayerStats(encodeBytes32String(gameId), isPlayer1);

            return {
                economicFreedom: Number(economicFreedom),
                civilRights: Number(civilRights),
                politicalFreedom: Number(politicalFreedom),
                gdp: Number(gdp)
            };
        } catch (error) {
            console.error('Error fetching player stats:', error);
            throw new Error('Failed to fetch player stats');
        }
    },

    async getPlayerDecisions(
        contract: Contract,
        gameId: string,
        playerAddress: string
    ): ContractResponse<ChainDecision[]> {
        try {
            const decisions = await contract.getPlayerDecisions(
                encodeBytes32String(gameId),
                playerAddress
            );

            return decisions.map(([issueId, chosenOptionId]: [number, number]) => ({
                issueId: Number(issueId),
                chosenOptionId: Number(chosenOptionId)
            }));
        } catch (error) {
            console.error('Error fetching player decisions:', error);
            throw new Error('Failed to fetch player decisions');
        }
    },

    async getWinner(
        contract: Contract,
        gameId: string
    ): ContractResponse<ChainWinnerInfo> {
        try {
            const [winner, winningScore, isGameCompleted] = 
                await contract.getWinner(encodeBytes32String(gameId));

            return {
                winner,
                winningScore: Number(winningScore),
                isGameCompleted
            };
        } catch (error) {
            console.error('Error fetching winner info:', error);
            throw new Error('Failed to fetch winner information');
        }
    },

    async getPlayerGames(
        contract: Contract,
        playerAddress: string
    ): ContractResponse<string[]> {
        try {
            const games = await contract.getPlayerGames(playerAddress);
            return games.map((game: string) => decodeBytes32String(game));
        } catch (error) {
            console.error('Error fetching player games:', error);
            throw new Error('Failed to fetch player games');
        }
    }
};

// WRITE OPERATIONS
export const chainWrite = {
    async createGame(
        contract: Contract,
        gameId: string
    ): Promise<ContractTransactionResponse> {
        try {
            const tx = await contract.createGame(encodeBytes32String(gameId));
            return await tx.wait();
        } catch (error) {
            console.error('Error creating game:', error);
            throw new Error('Failed to create game');
        }
    },

    async joinGame(
        contract: Contract,
        gameId: string
    ): Promise<ContractTransactionResponse> {
        try {
            const tx = await contract.joinGame(encodeBytes32String(gameId));
            return await tx.wait();
        } catch (error) {
            console.error('Error joining game:', error);
            throw new Error('Failed to join game');
        }
    },

    async addDecision(
        contract: Contract,
        gameId: string,
        issueId: number,
        chosenOptionId: number
    ): Promise<ContractTransactionResponse> {
        try {
            const tx = await contract.addDecision(
                encodeBytes32String(gameId),
                issueId,
                chosenOptionId
            );
            return await tx.wait();
        } catch (error) {
            console.error('Error adding decision:', error);
            throw new Error('Failed to add decision');
        }
    },

    async submitStats(
        contract: Contract,
        gameId: string,
        stats: Nation['stats']
    ): Promise<ContractTransactionResponse> {
        try {
            const statsForChain = [
                Math.floor(stats.economicFreedom),
                Math.floor(stats.civilRights),
                Math.floor(stats.politicalFreedom),
                getBigInt(stats.gdp)
            ];

            const tx = await contract.submitStats(
                encodeBytes32String(gameId),
                statsForChain
            );
            return await tx.wait();
        } catch (error) {
            console.error('Error submitting stats:', error);
            throw new Error('Failed to submit stats');
        }
    },

    async updateGameStatus(
        contract: Contract,
        gameId: string,
        newStatus: GameStatus
    ): Promise<ContractTransactionResponse> {
        try {
            const tx = await contract.updateGameStatus(
                encodeBytes32String(gameId),
                convertStatusToChain(newStatus)
            );
            return await tx.wait();
        } catch (error) {
            console.error('Error updating game status:', error);
            throw new Error('Failed to update game status');
        }
    },

    async setWinner(
        contract: Contract,
        gameId: string,
        winnerAddress: string,
        score: number
    ): Promise<ContractTransactionResponse> {
        try {
            const tx = await contract.setWinner(
                encodeBytes32String(gameId),
                winnerAddress,
                score
            );
            return await tx.wait();
        } catch (error) {
            console.error('Error setting winner:', error);
            throw new Error('Failed to set winner');
        }
    }
};

// Status conversion helpers
export function convertStatusToChain(status: GameStatus): number {
    const statusMap: Record<GameStatus, number> = {
        'created': 0,
        'player1_completed': 1,
        'player2_completed': 2,
        'ready': 3,
        'processing': 4,
        'ready_for_processing_alliance': 5,
        'completed_alliance_processing': 6,
        'completed': 7
    };
    return statusMap[status];
}

export function convertStatusFromChain(status: number): GameStatus {
    const statusMap: Record<number, GameStatus> = {
        0: 'created',
        1: 'player1_completed',
        2: 'player2_completed',
        3: 'ready',
        4: 'processing',
        5: 'ready_for_processing_alliance',
        6: 'completed_alliance_processing',
        7: 'completed'
    };
    return statusMap[status];
}

// Contract creation helper
export function createContract(
    address: string,
    signer: Signer
): Contract {
    return new Contract(address, NATION_BUILDER_ABI, signer);
}

// Event listeners helper
export function setupEventListeners(
    contract: Contract,
    handlers: {
        onGameCreated?: (gameId: string, player1: string) => void;
        onPlayer2Joined?: (gameId: string, player2: string) => void;
        onDecisionsMade?: (gameId: string, player: string) => void;
        onGameStatusUpdated?: (gameId: string, newStatus: GameStatus) => void;
        onWinnerDeclared?: (gameId: string, winner: string, score: number) => void;
    }
) {
    if (handlers.onGameCreated) {
        contract.on('GameCreated', (gameId, player1) => {
            handlers.onGameCreated?.(decodeBytes32String(gameId), player1);
        });
    }

    if (handlers.onPlayer2Joined) {
        contract.on('Player2Joined', (gameId, player2) => {
            handlers.onPlayer2Joined?.(decodeBytes32String(gameId), player2);
        });
    }

    if (handlers.onDecisionsMade) {
        contract.on('DecisionsMade', (gameId, player) => {
            handlers.onDecisionsMade?.(decodeBytes32String(gameId), player);
        });
    }

    if (handlers.onGameStatusUpdated) {
        contract.on('GameStatusUpdated', (gameId, newStatus) => {
            handlers.onGameStatusUpdated?.(
                decodeBytes32String(gameId),
                convertStatusFromChain(Number(newStatus))
            );
        });
    }

    if (handlers.onWinnerDeclared) {
        contract.on('WinnerDeclared', (gameId, winner, score) => {
            handlers.onWinnerDeclared?.(
                decodeBytes32String(gameId),
                winner,
                Number(score)
            );
        });
    }

    return () => {
        contract.removeAllListeners();
    };
}