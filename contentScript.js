'use strict';

chrome.runtime.onMessage.addListener(message => {
    if (message === 'toggle') {
        toggleGame();
    }
});

let game = null;

function toggleGame() {
    if (game) {
        game.uninstall();
        game = null;
    } else {
        game = new Game();
        game.onExit = () => {
            game.uninstall();
            game = null;
        }
        try {
            game.install();
        } catch (e) {
            game.uninstall();
            game = null;
            console.error(e);
            alert(`Error: ${e.message}`);
        }
    }
}