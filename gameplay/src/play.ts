// play.ts
import PromptSync = require("prompt-sync");
import { issuesData } from "./db/issues";
import { ideologies } from './db/ideologies';
import type { Nation, Ideology, Personality, Issue, Option, Decision } from './types';
import { 
  createGame, 
  createNation,
  updateNationStats, 
  selectPersonalities, 
  getGame, 
  euclideanDistance, 
  displayGameInfo, 
  compareNations,
  getRandomIdeology,
} from './helpers';
import { playAINation } from './agents/governor';
import { storeGame } from './storage';
import { ethers } from 'ethers';
import {
  createContract,
  chainRead,
  chainWrite
} from './contract/chain';
import cli  = require('cli-color');

const clc = cli;
const prompt = PromptSync({ sigint: true });

// Blockchain Configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL; 
const PLAYER1_PRIVATE_KEY = process.env.PLAYER1_PRIVATE_KEY;
const PLAYER2_PRIVATE_KEY = process.env.PLAYER2_PRIVATE_KEY;

if (!CONTRACT_ADDRESS || !RPC_URL || !PLAYER1_PRIVATE_KEY || !PLAYER2_PRIVATE_KEY) {
  throw new Error("Missing environment variables. Please check your .env file.");
}

// Setup provider and signers
const provider = new ethers.JsonRpcProvider(RPC_URL);
const player1Signer = new ethers.Wallet(PLAYER1_PRIVATE_KEY, provider);
const player2Signer = new ethers.Wallet(PLAYER2_PRIVATE_KEY, provider);

console.log('contract address is',CONTRACT_ADDRESS);

// Create contract instances
const player1Contract = createContract(CONTRACT_ADDRESS, player1Signer);
const player2Contract = createContract(CONTRACT_ADDRESS, player2Signer);
console.log("Contract instances created");


function replacePlaceholders(text: string, nationName: string): string {
  return text.replace(/\${nationName}/g, nationName);
}

function promptForIssue(issue: Issue, nationName: string, issueIndex: number): { option: Option; decision: Decision } | null {
  const issueNumber = issueIndex + 1;
  console.log(clc.blue(`\n=== Issue no. ${issueNumber} - ${issue.name} ===`));
  console.log(clc.yellow("---------------------------------------------------------"));
  console.log(replacePlaceholders(issue.description, nationName));
  console.log(clc.yellow("---------------------------------------------------------"));

  issue.options.forEach((option: Option) => {
    console.log(`\nOption ${option.id}: ${option.name}`);
    console.log(`Description: ${replacePlaceholders(option.description, nationName)}`);
  });
  console.log(clc.yellow("---------------------------------------------------------"));

  const input = prompt(`\nChoose an option (1 - ${issue.options.length}): `);
  const choice = parseInt(input, 10);

  if (isNaN(choice) || choice < 1 || choice > issue.options.length) {
    console.log("Invalid choice. Skipping this issue.");
    return null;
  }

  const chosenOption = issue.options.find(o => o.id === choice);
  if (!chosenOption) return null;

  const decision: Decision = {
    issueId: issue.id,
    issueName: issue.name,
    chosenOptionId: chosenOption.id,
    chosenOptionName: chosenOption.name,
    description: replacePlaceholders(chosenOption.description, nationName)
  };

  return { option: chosenOption, decision };
}

function determineNearestIdeology(stats: Nation['stats']): Ideology {
  const currentPoint = {
    x: stats.economicFreedom,
    y: stats.civilRights,
    z: stats.politicalFreedom
  };

  let closestIdeology = ideologies[0];
  let minDistance = Number.MAX_VALUE;

  for (const ideology of ideologies) {
    const ideologyPoint = {
      x: ideology.economicFreedom,
      y: ideology.civilRights,
      z: ideology.politicalFreedom
    };

    const distance = euclideanDistance(currentPoint, ideologyPoint);
    if (distance < minDistance) {
      minDistance = distance;
      closestIdeology = ideology;
    }
  }

  return closestIdeology;
}

function calculateChanges(originalNation: Nation, finalNation: Nation) {
  return {
    economicFreedom: finalNation.stats.economicFreedom - originalNation.stats.economicFreedom,
    civilRights: finalNation.stats.civilRights - originalNation.stats.civilRights,
    politicalFreedom: finalNation.stats.politicalFreedom - originalNation.stats.politicalFreedom,
    gdp: finalNation.stats.gdp - originalNation.stats.gdp
  };
}

function getImpactEmoji(value: number): string {
  if (value >= 5) return "🚀";
  if (value >= 2) return "📈";
  if (value >= -1) return "😐";
  if (value >= -4) return "📉";
  return "💥";
}

function getGDPEmoji(value: number): string {
  if (value >= 200) return "🤑";
  if (value >= 50) return "💰";
  if (value >= -49) return "💵";
  if (value >= -200) return "🪙";
  return "📉";
}

function displayNationStatus(nation: Nation) {
  console.log(`\n=== The State of ${nation.name} ===`);
  console.log(`Current Ideology: ${nation.ideology.name}`);
  console.log(`Ruler Type: ${nation.rulerType}`);
  if (nation.personality) {
    console.log(`Leader: ${nation.personality.name}`);
  }
  console.log(`Economic Freedom:    ${nation.stats.economicFreedom} ${getImpactEmoji(nation.stats.economicFreedom)}`);
  console.log(`Civil Rights:        ${nation.stats.civilRights} ${getImpactEmoji(nation.stats.civilRights)}`);
  console.log(`Political Freedom:   ${nation.stats.politicalFreedom} ${getImpactEmoji(nation.stats.politicalFreedom)}`);
  console.log(`GDP:                 ${nation.stats.gdp} ${getGDPEmoji(nation.stats.gdp)}`);
}

export async function setupGame(): Promise<string> {
  console.log(clc.yellow("A new game has been instantiated!"));
  console.log(clc.blue("The game creator has been assigned as Player 1"));
  console.log(clc.green("========================================"));

  const personalities = selectPersonalities(5);
  console.log(clc.yellow("\nAlong with human players, the following AI leaders have been selected to join the game:"));
  console.log("Selected Random AI Leaders:");
  console.log("========================================");
  personalities.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name} - ${p.description}`);
  });

  console.log(clc.green("\n========================================"));

  const gameId = createGame(personalities);

  console.log(clc.red("please wait while we the game on Mantle..."));
  // Store game on blockchain
  try {
    if (player1Contract) {
      await chainWrite.createGame(player1Contract, gameId);
      console.log("Game successfully created on Mantle!");
    }
  } catch (error) {
    console.error("Warning: Failed to store game on blockchain:", error);
    // Continue with game creation even if blockchain storage fails
  }

  console.log(`\nGame created! Your game ID is: ${gameId}`);
  console.log(clc.red("Please share this ID with your friend to join the game, and save it for later!"));
  
  return gameId;
}

async function promptForNationName(): Promise<string> {
  console.log(clc.blue("What would you like to name your nation?"))
  const name = prompt("> ").trim();
  if (!name) {
    throw new Error("Nation name cannot be empty");
  }
  return name;
}

async function promptForIdeology(): Promise<Ideology> {
  console.log(clc.yellow("\nChoose your ideology (enter number 1-27):"));
  console.log(clc.green("========================================"));
  ideologies.forEach(i => {
    console.log(`${i.uid}. ${i.name}`);
  });

  while (true) {
    const choice = parseInt(prompt("> "));
    const ideology = ideologies.find(i => i.uid === choice);
    if (ideology) return ideology;
    console.log("Invalid choice. Please try again.");
  }
}

export async function createPlayerNation(gameId: string, isPlayer1: boolean = true): Promise<Nation | null> {
  const game = getGame(gameId);
  if (!game) {
    console.error("Game not found!");
    return null;
  }

  const nationName = await promptForNationName();
  const ideology = await promptForIdeology();

  try {
    if (!isPlayer1) {
      // Player 2 joins game on blockchain
      console.log("Joining game on blockchain...");
      await chainWrite.joinGame(player2Contract, gameId);
      console.log("Successfully joined game on blockchain!");
    }
  } catch (error) {
    console.error("Warning: Failed to join game on blockchain:", error);
    // Continue with game creation even if blockchain operation fails
  }
  
  return createNation(gameId, nationName, ideology, 'human');
}

export async function createAINations(gameId: string): Promise<void> {
  const game = getGame(gameId);
  if (!game) return;

  for (const personality of game.selectedPersonalities) {
    const initialIdeology = getRandomIdeology();
    const aiNation = createNation(gameId, personality.nationName, initialIdeology, 'AI', personality);

    if (aiNation) {
      const updatedNation = await playAINation(aiNation);
      
      const currentGame = getGame(gameId);
      if (currentGame) {
        const aiIndex = currentGame.aiNations.findIndex(n => n.name === personality.nationName);
        if (aiIndex !== -1) {
          currentGame.aiNations[aiIndex] = updatedNation;
          storeGame(gameId, currentGame);
        }
      }
    }
  }
}

export async function playGame(nation: Nation, gameId: string) {
  console.log(clc.blue(`\nAs the leader of your nation ${nation.name}!, you will face various issues that will shape its future.\n`));
  console.log(clc.yellow("You will be presented with a series of issues, each with multiple options.\n"));
  console.log(clc.yellow("Your choices will impact your nation's stats and ideology."));
  console.log(clc.green("========================================"));

  const originalNation: Nation = { ...nation };
  let currentNation: Nation = { 
    ...nation, 
    decisions: [] 
  };
  
  const game = getGame(gameId);
  if (!game) return null;
  
  const contract = game.player1Nation?.name === nation.name ? player1Contract : player2Contract;

  const relevantIssues = issuesData.issues.slice(0, 3);
  
  let issueIndex = 0;
  for (const issue of relevantIssues) {
    const result = promptForIssue(issue, nation.name, issueIndex);
    issueIndex++;
    if (result) {
      currentNation = updateNationStats(currentNation, result.option.impact);
      currentNation.decisions.push(result.decision);

      console.log(clc.red("Please wait while we log your decision on Mantle..."));
      
      // Log decision on blockchain
      try {
        await chainWrite.addDecision(
          contract,
          gameId,
          result.decision.issueId,
          result.decision.chosenOptionId
        );
        console.log(clc.green("Decision successfully logged on blockchain!"));
      } catch (error) {
        console.error("Warning: Failed to log decision on blockchain:", error);
        // Continue game even if blockchain logging fails
      }
    }
  }

  const newIdeology = determineNearestIdeology(currentNation.stats);
  const changes = calculateChanges(originalNation, currentNation);
  
  console.log(clc.blue("\n=== Aggregate Changes ==="));
  console.log(`Previous Government Type: ${originalNation.ideology.name}`);
  console.log(`New Government Type: ${newIdeology.name}`);
  console.log(clc.yellow("---------------------------------------------------------"));
  console.log("\nChanges in Freedom Indices:");
  console.log(`Economic Freedom: ${changes.economicFreedom >= 0 ? '+' : ''}${changes.economicFreedom}`);
  console.log(`Civil Rights: ${changes.civilRights >= 0 ? '+' : ''}${changes.civilRights}`);
  console.log(`Political Freedom: ${changes.politicalFreedom >= 0 ? '+' : ''}${changes.politicalFreedom}`);
  console.log(`GDP: ${changes.gdp >= 0 ? '+' : ''}${changes.gdp}`);
  console.log(clc.yellow("---------------------------------------------------------"));

  if (originalNation.ideology.name !== newIdeology.name) {
    console.log(clc.red(`\n🔄 Your nation has evolved from a ${originalNation.ideology.name} to a ${newIdeology.name}!`));
  } else {
    console.log(clc.red(`\n✨ Your nation remains a ${newIdeology.name}`));
  }

  currentNation = {
    ...currentNation,
    ideology: newIdeology
  };

  const updatedGame = getGame(gameId);
  if (updatedGame) {
    if (updatedGame.player1Nation?.name === nation.name) {
      updatedGame.player1Nation = currentNation;
    } else if (updatedGame.player2Nation?.name === nation.name) {
      updatedGame.player2Nation = currentNation;
    }
    
    storeGame(gameId, updatedGame);
    displayGameInfo(gameId);
    compareNations(gameId);
  }

  return currentNation;
}