window.onload = function() {
    var game = new Chess();
    var board = Chessboard('board', {
        draggable: true,
        position: 'start',
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
        onDrop: handleMove
    });

    var studyMoves = [];
    var currentMove = 0;
    var games = [];
    var parsedHeaders = [];
    var selectedGameIndex = null;
    var analyzing = false;  // Analysis tracking
    var stockfish = new Worker('js/stockfish.js');  // Initialize Stockfish

    // Listen for Stockfish output and display it
    stockfish.onmessage = function(event) {
        var message = event.data;
        console.log("Stockfish output:", message);

        if (message.startsWith('bestmove')) {
            var bestMove = message.split(' ')[1];
            document.getElementById('stockfish-output').innerText = 'Best move: ' + bestMove;
        }
    };

    // Flip board functionality
    var flipBoardBtn = document.getElementById('flip-board');
    if (flipBoardBtn) {
        flipBoardBtn.addEventListener('click', function() {
            board.flip();
        });
    }

    function handleMove(source, target) {
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        if (move === null) return 'snapback';
        studyMoves.push(move.san);
        currentMove = studyMoves.length;
        updateMoves();

        // Analyze the new position with Stockfish if analysis is ongoing
        if (analyzing) {
            analyzePosition(game.fen());
        }
    }

    // Analyze a FEN position with Stockfish
    function analyzePosition(fen) {
        stockfish.postMessage('position fen ' + fen);  // Send FEN to Stockfish
        stockfish.postMessage('go depth 15');  // Analyze the position with depth 15
    }

    // Start and Stop Analysis buttons
    document.getElementById('start-analysis').addEventListener('click', function() {
        analyzing = true;
        analyzePosition(game.fen());  // Start analyzing the current position
        document.getElementById('stockfish-output').innerText = 'Analyzing position...';
    });

    document.getElementById('stop-analysis').addEventListener('click', function() {
        analyzing = false;
        stockfish.postMessage('stop');  // Stop Stockfish analysis
        document.getElementById('stockfish-output').innerText = 'Analysis stopped.';
    });

    // PGN File Input listener
    var pgnFileInput = document.getElementById('pgnFileInput');
    if (pgnFileInput) {
        pgnFileInput.addEventListener('change', function(event) {
            var file = event.target.files[0];
            var reader = new FileReader();
            reader.onload = function(e) {
                var pgn = e.target.result;
                games = parseGames(pgn);
                displayGameList();
                loadGame(0);  // Load the first game
                document.getElementById('first-move').click();  // Trigger first move button automatically
            };
            reader.readAsText(file);
        });
    }

    // Load PGN Button listener
    var loadPgnBtn = document.getElementById('loadPgnBtn');
    if (loadPgnBtn) {
        loadPgnBtn.addEventListener('click', function() {
            var pgn = document.getElementById('pgnInput').value;
            games = parseGames(pgn);
            displayGameList();
            loadGame(0);  // Load the first game
            document.getElementById('first-move').click();  // Trigger first move button automatically
        });
    }

    // Load FEN Button listener
    var loadFenBtn = document.getElementById('loadFenBtn');
    if (loadFenBtn) {
        loadFenBtn.addEventListener('click', function() {
            var fen = document.getElementById('fenInput').value;
            game.load(fen);
            board.position(fen, false);  // Disable animation for FEN loading
        });
    }

    // Parse PGN games
    function parseGames(pgn) {
        var gameList = pgn.split(/\n\n(?=\[Event)/);
        parsedHeaders = gameList.map(parseHeaders);
        return gameList.slice(0, 100);  // Limit to 100 games
    }

    // Parse headers from PGN
    function parseHeaders(pgn) {
        var headers = {};
        var headerPattern = /\[(\w+)\s+"([^"]+)"\]/g;
        var match;
        while ((match = headerPattern.exec(pgn)) !== null) {
            headers[match[1]] = match[2];
        }
        return headers;
    }

    // Display game list
    function displayGameList() {
        var gameListContainer = document.getElementById('game-list');
        gameListContainer.innerHTML = '';
        parsedHeaders.forEach(function(headers, index) {
            var gameItem = document.createElement('div');
            gameItem.innerHTML = `
                <strong>${headers.White} (${headers.WhiteElo || 'N/A'})</strong> vs 
                <strong>${headers.Black} (${headers.BlackElo || 'N/A'})</strong><br>
                ${headers.Result} - ${headers.Date}
            `;
            gameItem.className = 'game-item';
            gameItem.dataset.index = index;
            gameItem.addEventListener('click', function() {
                selectGame(index);
            });
            gameListContainer.appendChild(gameItem);
        });
    }

    // Display game details (e.g., players, date, result)
    function displayGameDetails(index) {
        var gameDetails = parsedHeaders[index];
        var detailsContainer = document.getElementById('game-details');
        detailsContainer.innerHTML = `
            <strong>White:</strong> ${gameDetails.White} (${gameDetails.WhiteElo || 'N/A'})<br>
            <strong>Black:</strong> ${gameDetails.Black} (${gameDetails.BlackElo || 'N/A'})<br>
            <strong>Result:</strong> ${gameDetails.Result}<br>
            <strong>Date:</strong> ${gameDetails.Date}
        `;
    }

    // Select and load a game from the list
    function selectGame(index) {
        loadGame(index);
        displayGameDetails(index);  // Show game details when a game is selected

        // Highlight the selected game and reset previous highlight
        if (selectedGameIndex !== null) {
            document.querySelector(`[data-index="${selectedGameIndex}"]`).style.backgroundColor = '';
        }
        var selectedItem = document.querySelector(`[data-index="${index}"]`);
        selectedItem.style.backgroundColor = 'green';
        selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });  // Automatically scroll the selected game into view
        selectedGameIndex = index;

        document.getElementById('first-move').click();  // Trigger first move button automatically
    }

    // Load PGN and automatically reset to the first move
    function loadGame(index) {
        var pgn = games[index];
        game.reset();  // Ensure game is reset before loading the PGN
        game.load_pgn(pgn);
        studyMoves = game.history();
        currentMove = 0;  // Automatically start from the first move
        board.position(game.fen(), false);  // Disable animation for setting position
        updateMoves();
        highlightCurrentMove();  // Automatically highlight the first move
    }

    // Update the move list and highlight the current move
    function updateMoves() {
        var moveListContainer = document.getElementById('move-list');
        moveListContainer.innerHTML = '';  // Clear previous moves

        var movesParagraph = '';  // Store all moves in a single string

        // Add all moves to the paragraph (with clickable spans)
        for (var i = 0; i < studyMoves.length; i++) {
            let isWhiteMove = i % 2 === 0;
            movesParagraph += `<span class="move-item" data-index="${i}" style="cursor: pointer;">${isWhiteMove ? `${Math.floor(i / 2) + 1}. ${studyMoves[i]}` : `${studyMoves[i]}`}</span> `;
        }

        // Update the move list as a paragraph
        moveListContainer.innerHTML = `<p>${movesParagraph}</p>`;

        // Add event listener to make each move clickable
        document.querySelectorAll('.move-item').forEach(function(item) {
            item.addEventListener('click', function(event) {
                var moveIndex = event.target.dataset.index;
                goToMove(parseInt(moveIndex));  // Go to the selected move
            });
        });

        highlightCurrentMove();
    }

    // Highlight the current move in the paragraph
    function highlightCurrentMove() {
        var moveItems = document.querySelectorAll('.move-item');
        moveItems.forEach(function(item) {
            item.classList.remove('current-move');  // Remove previous highlight
            item.style.backgroundColor = '';  // Reset background
        });

        var currentMoveElement = document.querySelector(`.move-item[data-index="${currentMove - 1}"]`);
        if (currentMoveElement) {
            currentMoveElement.classList.add('current-move');
            currentMoveElement.style.backgroundColor = 'yellow';  // Highlight the current move
        }
    }

    // Go to a specific move
    function goToMove(index) {
        game.reset();  // Reset the game to the starting position
        for (var i = 0; i <= index; i++) {
            game.move(studyMoves[i]);  // Replay moves up to the clicked move
        }
        currentMove = index + 1;
        board.position(game.fen(), false);  // Disable animation
        updateMoves();  // Ensure the move list reflects the new state
        highlightCurrentMove();
    }

    // Keyboard event handling for navigation and prevent page scrolling
    document.addEventListener('keydown', function(event) {
        switch (event.key) {
            case 'ArrowRight':  // Right arrow - Next move
                event.preventDefault();  // Prevent page scrolling
                if (currentMove < studyMoves.length) {
                    document.getElementById('next-move').click();  // Trigger next move
                }
                break;
            case 'ArrowLeft':  // Left arrow - Previous move
                event.preventDefault();  // Prevent page scrolling
                if (currentMove > 0) {
                    document.getElementById('prev-move').click();  // Trigger previous move
                }
                break;
            case 'ArrowUp':  // Up arrow - Previous game
                event.preventDefault();  // Prevent page scrolling
                if (selectedGameIndex > 0) {
                    document.getElementById('prev-game').click();  // Trigger previous game
                }
                break;
            case 'ArrowDown':  // Down arrow - Next game
                event.preventDefault();  // Prevent page scrolling
                if (selectedGameIndex < games.length - 1) {
                    document.getElementById('next-game').click();  // Trigger next game
                }
                break;
            default:
                break;
        }
    });

    // Navigation buttons for moves
    document.getElementById('prev-move').addEventListener('click', function() {
        if (currentMove > 0) {
            currentMove--;
            game.undo();  // Undo the last move
            board.position(game.fen(), false);  // Disable animation
            highlightCurrentMove();
        }
    });

    document.getElementById('next-move').addEventListener('click', function() {
        if (currentMove < studyMoves.length) {
            game.move(studyMoves[currentMove]);
            currentMove++;
            board.position(game.fen(), false);  // Disable animation
            highlightCurrentMove();
        }
    });

    // First move and last move buttons
    document.getElementById('first-move').addEventListener('click', function() {
        game.reset();  // Reset the game to the initial position
        currentMove = 0;
        board.position(game.fen(), false);  // Disable animation
        updateMoves();
    });

    document.getElementById('last-move').addEventListener('click', function() {
        game.reset();
        for (var i = 0; i < studyMoves.length; i++) {
            game.move(studyMoves[i]);  // Replay all the moves
        }
        currentMove = studyMoves.length;
        board.position(game.fen(), false);  // Disable animation
        updateMoves();
    });

    // Previous Game and Next Game buttons
    document.getElementById('prev-game').addEventListener('click', function() {
        if (selectedGameIndex > 0) {
            selectGame(selectedGameIndex - 1);  // Load the previous game
        }
    });

    document.getElementById('next-game').addEventListener('click', function() {
        if (selectedGameIndex < games.length - 1) {
            selectGame(selectedGameIndex + 1);  // Load the next game
        }
    });
};
