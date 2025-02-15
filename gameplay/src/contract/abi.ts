// contractAbi.ts
export const NATION_BUILDER_ABI = [
    // Read functions
    "function getGameState(bytes32 gameId) view returns (uint8 status, address player1, address player2, bool player1Moved, bool player2Moved, uint256 lastUpdateTime)",
    "function getPlayerStats(bytes32 gameId, bool isPlayer1) view returns (tuple(uint8 economicFreedom, uint8 civilRights, uint8 politicalFreedom, int256 gdp))",
    "function getPlayerDecisions(bytes32 gameId, address player) view returns (tuple(uint8 issueId, uint8 chosenOptionId)[])",
    "function getWinner(bytes32 gameId) view returns (address winner, uint256 winningScore, bool isGameCompleted)",
    "function getPlayerGames(address player) view returns (bytes32[])",
    
    // Write functions
    "function createGame(bytes32 gameId)",
    "function joinGame(bytes32 gameId)",
    "function addDecision(bytes32 gameId, uint8 issueId, uint8 chosenOptionId)",
    "function submitStats(bytes32 gameId, tuple(uint8 economicFreedom, uint8 civilRights, uint8 politicalFreedom, int256 gdp) stats)",
    "function updateGameStatus(bytes32 gameId, uint8 newStatus)",
    "function setWinner(bytes32 gameId, address winner, uint256 score)",

    // Events
    "event GameCreated(bytes32 indexed gameId, address indexed player1)",
    "event Player2Joined(bytes32 indexed gameId, address indexed player2)",
    "event DecisionsMade(bytes32 indexed gameId, address indexed player)",
    "event GameStatusUpdated(bytes32 indexed gameId, uint8 newStatus)",
    "event WinnerDeclared(bytes32 indexed gameId, address indexed winner, uint256 score)"
];