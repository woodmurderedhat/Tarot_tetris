/**
 * This file manages the overall game state. It handles the spawning of new pieces, collision detection, and scoring.
 * It also manages the game over state and restarts the game.
 * 
 * Tarot Visual Effect Manager: Arcade-inspired visual effects for tarot cards.
 */

// --- Tarot Visual Effect Manager ---
window.__tarotVisualEffects = window.__tarotVisualEffects || [];

/**
 * Add a tarot visual effect.
 * @param {string} type - The effect type (e.g., 'screen-shake', 'scanlines', 'neon-glow', etc.)
 * @param {number} duration - Duration in ms
 * @param {object} [options] - Additional effect options
 */
function addTarotVisualEffect(type, duration, options = {}) {
    window.__tarotVisualEffects.push({
        type,
        duration,
        options,
        start: performance.now()
    });
}

/**
 * Render active tarot visual effects (arcade style overlays).
 * Call this after drawing the board and pieces.
 */
function renderTarotEffects(ctx) {
    const now = performance.now();
    // Remove expired effects
    window.__tarotVisualEffects = window.__tarotVisualEffects.filter(effect => now - effect.start < effect.duration);

    for (const effect of window.__tarotVisualEffects) {
        const t = (now - effect.start) / effect.duration;
        switch (effect.type) {
            case 'screen-shake':
                // Apply a small shake to the canvas
                const shake = Math.sin(now / 30) * 8 * (1 - t);
                ctx.save();
                ctx.translate(shake, 0);
                ctx.restore();
                break;
            case 'scanlines':
                // Draw scanlines overlay
                ctx.save();
                ctx.globalAlpha = 0.18 * (1 - t);
                for (let y = 0; y < ctx.canvas.height; y += 4) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, y, ctx.canvas.width, 2);
                }
                ctx.globalAlpha = 1.0;
                ctx.restore();
                break;
            case 'neon-glow':
                // Neon border glow
                ctx.save();
                ctx.shadowColor = effect.options.color || '#ffaa00';
                ctx.shadowBlur = 40 * (1 - t);
                ctx.lineWidth = 8;
                ctx.strokeStyle = effect.options.color || '#ffaa00';
                ctx.strokeRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.restore();
                break;
            case 'particle-burst':
                // Simple particle burst (centered)
                ctx.save();
                const cx = ctx.canvas.width / 2;
                const cy = ctx.canvas.height / 2;
                for (let i = 0; i < 24; i++) {
                    const angle = (i / 24) * 2 * Math.PI;
                    const r = 40 + 80 * t;
                    ctx.beginPath();
                    ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 6 * (1 - t), 0, 2 * Math.PI);
                    ctx.fillStyle = effect.options.color || '#ffaa00';
                    ctx.globalAlpha = 0.7 * (1 - t);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
                ctx.restore();
                break;
            case 'flash':
                // Full screen flash
                ctx.save();
                ctx.globalAlpha = 0.5 * (1 - t);
                ctx.fillStyle = effect.options.color || '#fff';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.globalAlpha = 1.0;
                ctx.restore();
                break;
            // Add more effect types as needed
        }
    }
}

const canvas = document.getElementById('tetris');
const context = canvas ? canvas.getContext('2d') : null;

if (!canvas) {
    console.error("Canvas element not found!");
    alert("Error: Canvas element is missing. Please check the HTML structure.");
}

if (!context) {
    console.error("Failed to get 2D rendering context!");
    alert("Error: Unable to initialize the game. Please try reloading the page.");
}

const board = new Board();
let piece;
let score = 0;
let gameOver = false;
let lastTime = 0;
let dropInterval = 500; // Default speed (milliseconds)
let level = 1;
let linesClearedThisLevel = 0;
const linesToLevelUp = 10;
let combo = 0;

const playerNameInput = document.getElementById('player-name');
const scoreElement = document.getElementById('score');
const gameInfoElement = document.getElementById('game-info');
const startGameButton = document.getElementById('start-game-button');
const levelElement = document.getElementById('level');

// Add a "hold" feature to save a piece for later use
let heldPiece = null;
let canHold = true;

function holdPiece() {
    if (!canHold) return;
    if (heldPiece) {
        const temp = heldPiece;
        heldPiece = piece;
        piece = temp;
        piece.position = { x: 3, y: 0 }; // Reset position
    } else {
        heldPiece = piece;
        spawnPiece();
    }
    canHold = false; // Prevent holding multiple times in a row
    updateHoldUI();
}

function updateHoldUI() {
    const holdContainer = document.getElementById('hold-container');
    if (!holdContainer) {
        console.warn("Hold container not found.");
        return;
    }
    holdContainer.innerHTML = '';
    if (heldPiece) {
        heldPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const block = document.createElement('div');
                    block.style.gridRowStart = y + 1;
                    block.style.gridColumnStart = x + 1;
                    block.className = 'block';
                    block.style.backgroundColor = '#ff5722'; // Example color
                    holdContainer.appendChild(block);
                }
            });
        });
    }
}

// Add a "ghost piece" to show where the current piece will land
function drawGhostPiece(context) {
    if (!piece || !piece.type) return;
    const ghostPiece = new Piece(piece.type);
    ghostPiece.shape = piece.shape.map(row => [...row]);
    ghostPiece.position = { ...piece.position };
    ghostPiece.typeIndex = piece.typeIndex;

    // Move ghost down until it can't move further
    while (ghostPiece.canMoveDown(board)) {
        ghostPiece.moveDown();
    }

    // Only draw the ghost if it's not overlapping the current piece
    if (ghostPiece.position.y !== piece.position.y) {
        const colors = ['#ff5722', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0', '#00bcd4', '#e91e63'];
        const ghostColor = colors[ghostPiece.typeIndex % colors.length];
        ghostPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    context.fillStyle = ghostColor + '4D'; // Add transparency (hex 4D = ~30%)
                    context.globalAlpha = 0.3;
                    context.fillRect((ghostPiece.position.x + x) * 30, (ghostPiece.position.y + y) * 30, 30, 30);
                    context.globalAlpha = 1.0;
                }
            });
        });
    }
}

// Function to set the game speed
function setGameSpeed(speed) {
    dropInterval = speed;
}

// Update the score display
function updateScore() {
    if (scoreElement) {
        scoreElement.textContent = `Score: ${score}`;
    } else {
        console.warn("Score element not found.");
    }
}

// Update game info
function updateGameInfo(info) {
    if (gameInfoElement) {
        gameInfoElement.textContent = `Game Info: ${info}`;
        gameInfoElement.setAttribute('aria-live', 'polite'); // Announce updates for screen readers
    } else {
        console.warn("Game info element not found.");
    }
}

// Function to update the level display
function updateLevel() {
    if (levelElement) {
        levelElement.textContent = `Level: ${level}`;
    } else {
        console.warn("Level element not found.");
    }
}

// Initialize the level display
updateLevel();

// Improved game initialization
function initializeGame() {
    // Always reset unlocked tetriminoes to default at the start of a new game
    window.unlockedTetrominoes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    score = 0;
    level = 1;
    linesClearedThisLevel = 0;
    dropInterval = 500;
    gameOver = false;
    combo = 0;
    board.reset();
    initializeTarotDeck();
    playerHand = [];
    spawnPiece();
    updateScore();
    updateLevel();
    updateGameInfo('Game Initialized');
    updateTarotUI();
    lastTime = performance.now();
}

// Enhanced game start logic
if (startGameButton) {
    startGameButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (!playerName) {
            alert('Please enter your name to start the game.');
            return;
        }
        document.body.classList.add('game-started');
        // Show tarot sidebar
        const tarotDock = document.getElementById('tarot-dock');
        if (tarotDock) {
            tarotDock.classList.remove('hidden');
        }
        leaderboard.displayScores();
        initializeGame();
        requestAnimationFrame(update);
    });
} else {
    console.warn("Start game button not found.");
}

// Improved game over handling
function handleGameOver() {
    gameOver = true;
    updateGameInfo('Game Over');
    // Hide tarot sidebar
    const tarotDock = document.getElementById('tarot-dock');
    if (tarotDock) {
        tarotDock.classList.add('hidden');
    }
    const playerName = playerNameInput.value.trim() || 'Player';
    leaderboard.addScore(playerName, score);
    leaderboard.displayScores();
    alert(`Game Over! ${playerName}, your score: ${score}`);
}

// Optimized piece spawning
function spawnPiece() {
    piece = new Piece();
    piece.position = { x: 3, y: 0 };
    addTarotCardToHand();

    if (board.collides(piece) || board.isBoardFull()) {
        handleGameOver();
    }
    canHold = true;
}

/**
 * Instantly drops the current piece to the bottom, merges it, clears lines, updates score, and spawns a new piece.
 */
function hardDropPiece() {
    if (gameOver || !piece) return;
    let dropDistance = 0;
    while (piece.canMoveDown(board)) {
        piece.moveDown();
        dropDistance++;
    }
    board.mergePiece(piece);
    const linesCleared = clearLines();
    if (linesCleared > 0) {
        score += calculateScore(linesCleared);
        updateScore();
    }
    spawnPiece();
    // Optionally, you could add a score bonus for hard drop distance:
    // score += dropDistance * 2;
    // updateScore();
}

let coyoteTime = 300; // 300ms coyote time
let coyoteTimerActive = false;

// Enhanced update loop
function update(time = 0) {
    if (gameOver) return;

    const deltaTime = time - lastTime;
    if (deltaTime > dropInterval) {
        if (piece.canMoveDown(board)) {
            piece.moveDown();
        } else {
            board.mergePiece(piece);
            const linesCleared = clearLines();
            if (linesCleared > 0) {
                score += calculateScore(linesCleared);
                updateScore();
            }
            spawnPiece();
        }
        lastTime = time;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    board.draw(context);
    drawGhostPiece(context);
    if (piece) {
        piece.draw(context);
    }
    // --- Render tarot visual effects overlay ---
    renderTarotEffects(context);

    requestAnimationFrame(update);
}

// Restore clearLines and increaseLevel (needed for game logic)
function clearLines() {
    const linesToClear = board.checkFullLines();
    if (!Array.isArray(linesToClear)) {
        console.error("checkFullLines did not return an array:", linesToClear);
        return 0;
    }

    const numLinesCleared = linesToClear.length;
    if (numLinesCleared > 0) {
        combo++; // Increase combo counter
        score += combo * 50; // Add combo bonus to score
        updateScore();
    } else {
        combo = 0; // Reset combo if no lines are cleared
    }
    
    for (let line of linesToClear) {
        if (line >= 0 && line < board.grid.length) {
            board.grid.splice(line, 1);
            board.grid.unshift(Array(board.columns).fill(0));
        } else {
            console.warn(`Line index out of bounds: ${line}`);
        }
    }

    linesClearedThisLevel += numLinesCleared;
    if (linesClearedThisLevel >= linesToLevelUp) {
        increaseLevel();
    }

    updateTarotUI(); // Ensure tarot UI is updated after clearing lines
    return numLinesCleared;
}

function increaseLevel() {
    level++;
    updateLevel();
    linesClearedThisLevel = 0;
    // Increase game speed (reduce drop interval)
    dropInterval = Math.max(100, dropInterval - 50);
    updateGameInfo(`Level Up! New level: ${level}`);
}

function calculateScore(linesCleared) {
    if (!piece) {
        console.warn("Piece is undefined when calculating score.");
        return 0;
    }
    const pieceScore = piece.getScoreValue(); // Get the unique score value of the current piece
    return linesCleared * pieceScore;
}








// Dynamically adjust canvas size based on screen size
function resizeCanvas() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        const width = Math.min(window.innerWidth * 0.8, 300);
        const height = width * 2; // Maintain 1:2 aspect ratio
        canvas.width = width;
        canvas.height = height;
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial resize

/* Arcade Ad System is now modularized in src/arcadeads.js */

/* Initialize Arcade Ad System */
initArcadeAds({
    awardScoreBonus: function(bonus) {
        score += bonus;
    },
    updateScore: updateScore,
    getAddTarotCardToHand: function() {
        return typeof window.addTarotCardToHand === "function" ? window.addTarotCardToHand : null;
    }
});
