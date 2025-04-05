import { initializeGame } from './gameLogic.js';
import { updateGameInfo } from './gameUI.js';
import { initializeTarotDeck } from './tarot.js';

const startGameButton = document.getElementById('start-game-button');
const playerNameInput = document.getElementById('player-name');

if (startGameButton) {
    startGameButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (!playerName) {
            alert('Please enter your name to start the game.');
            return;
        }
        document.body.classList.add('game-started');
        initializeTarotDeck();
        initializeGame();
        updateGameInfo('Game Started');
    });
} else {
    console.warn("Start game button not found.");
}