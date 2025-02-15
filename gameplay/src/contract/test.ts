// test.ts
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import {
    createContract,
    chainRead,
    chainWrite
} from './chain';
import type { GameStatus } from '../types';

dotenv.config();

// Configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL; 
const PLAYER1_PRIVATE_KEY = process.env.PLAYER1_PRIVATE_KEY;
const PLAYER2_PRIVATE_KEY = process.env.PLAYER2_PRIVATE_KEY;

async function testPlayer1Flow(
    player1Contract: ethers.Contract, 
    player1Signer: ethers.Wallet,
    gameId: string
) {
    console.log("\n=== Testing Player 1 Flow ===");
    
    // Create game
    console.log("\nPlayer 1 creating new game...");
    await chainWrite.createGame(player1Contract, gameId);
    
    // Read game state
    console.log("\nReading game state after creation...");
    const gameState = await chainRead.getGameState(player1Contract, gameId);
    console.log("Game State:", gameState);

    // Add decisions
    console.log("\nPlayer 1 adding decision...");
    await chainWrite.addDecision(player1Contract, gameId, 1, 2);
    await chainWrite.addDecision(player1Contract, gameId, 2, 1);

    // Submit stats
    const player1Stats = {
        economicFreedom: 75,
        civilRights: 80,
        politicalFreedom: 85,
        gdp: 5000
    };
    
    console.log("\nPlayer 1 submitting stats...");
    await chainWrite.submitStats(player1Contract, gameId, player1Stats);

    // Read player stats
    console.log("\nReading Player 1 stats...");
    const readStats = await chainRead.getPlayerStats(player1Contract, gameId, true);
    console.log("Player 1 Stats:", readStats);

    // Read decisions
    console.log("\nReading Player 1 decisions...");
    const decisions = await chainRead.getPlayerDecisions(
        player1Contract,
        gameId,
        await player1Signer.getAddress()
    );
    console.log("Player 1 Decisions:", decisions);

    // Read game state after player 1 actions
    console.log("\nReading game state after player 1 actions...");
    const gameStateA = await chainRead.getGameState(player1Contract, gameId);
    console.log("Game State:", gameStateA);
}

async function testPlayer2Flow(
    player2Contract: ethers.Contract,
    player2Signer: ethers.Wallet,
    gameId: string
) {
    console.log("\n=== Testing Player 2 Flow ===");
    
    // Join game
    console.log("\nPlayer 2 joining game...");
    await chainWrite.joinGame(player2Contract, gameId);
    
    // Add decisions
    console.log("\nPlayer 2 adding decision...");
    await chainWrite.addDecision(player2Contract, gameId, 1, 3);
    await chainWrite.addDecision(player2Contract, gameId, 2, 4);

    // Submit stats
    const player2Stats = {
        economicFreedom: 65,
        civilRights: 70,
        politicalFreedom: 75,
        gdp: 4500
    };
    
    console.log("\nPlayer 2 submitting stats...");
    await chainWrite.submitStats(player2Contract, gameId, player2Stats);

    // Read player stats
    console.log("\nReading Player 2 stats...");
    const readStats = await chainRead.getPlayerStats(player2Contract, gameId, false);
    console.log("Player 2 Stats:", readStats);

    // Read decisions
    console.log("\nReading Player 2 decisions...");
    const decisions = await chainRead.getPlayerDecisions(
        player2Contract,
        gameId,
        await player2Signer.getAddress()
    );
    console.log("Player 2 Decisions:", decisions);

    // Read game state after player 2 actions
    console.log("\nReading game state after player 2 actions...");
    const gameStateA = await chainRead.getGameState(player2Contract, gameId);
    console.log("Game State:", gameStateA);
}

async function testGameCompletion(
    player1Contract: ethers.Contract,
    player1Signer: ethers.Wallet,
    gameId: string
) {
    console.log("\n=== Testing Game Completion ===");
    
    // Update game status to ready
    console.log("\nUpdating game status to ready...");
    await chainWrite.updateGameStatus(player1Contract, gameId, 'ready');

    // Update to processing
    console.log("\nUpdating game status to processing...");
    await chainWrite.updateGameStatus(player1Contract, gameId, 'processing');

    // Update to ready for alliance processing
    console.log("\nUpdating game status to ready for alliance processing...");
    await chainWrite.updateGameStatus(player1Contract, gameId, 'ready_for_processing_alliance');

    // Update to completed alliance processing
    console.log("\nUpdating game status to completed alliance processing...");
    await chainWrite.updateGameStatus(player1Contract, gameId, 'completed_alliance_processing');

    // Set winner
    console.log("\nSetting winner...");
    const winnerAddress = await player1Signer.getAddress();
    await chainWrite.setWinner(player1Contract, gameId, winnerAddress, 100);

    // Read winner info
    console.log("\nReading winner info...");
    const winnerInfo = await chainRead.getWinner(player1Contract, gameId);
    console.log("Winner Info:", winnerInfo);
}

async function testFullGameFlow() {
    try {
        if (!PLAYER1_PRIVATE_KEY || !PLAYER2_PRIVATE_KEY || !CONTRACT_ADDRESS || !RPC_URL) {
            throw new Error("Missing environment variables");
        }

        // Setup provider and signers
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const player1Signer = new ethers.Wallet(PLAYER1_PRIVATE_KEY, provider);
        const player2Signer = new ethers.Wallet(PLAYER2_PRIVATE_KEY, provider);

        // Create contract instances
        const player1Contract = createContract(CONTRACT_ADDRESS, player1Signer);
        const player2Contract = createContract(CONTRACT_ADDRESS, player2Signer);
        console.log("Contract instances created");

        // Generate unique game ID
        const gameId = `TEST${Date.now().toString().slice(-6)}`;
        
        // Run test flows
        await testPlayer1Flow(player1Contract, player1Signer, gameId);
        await testPlayer2Flow(player2Contract, player2Signer, gameId);
        await testGameCompletion(player1Contract, player1Signer, gameId);

        // Get all games for player 1
        console.log("\nGetting all games for Player 1...");
        const playerGames = await chainRead.getPlayerGames(
            player1Contract,
            await player1Signer.getAddress()
        );
        console.log("Player 1 Games:", playerGames);

        console.log("\nFull game flow test completed successfully!");

    } catch (error) {
        console.error("Test failed:", error);
        throw error; // Re-throw to see full error stack
    }
}

// Main execution
async function main() {
    await testFullGameFlow();
}

main().catch(console.error);