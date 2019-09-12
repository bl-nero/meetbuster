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
        const parent = document.querySelector(
            '[data-start-date-key][data-end-date-key]:not([data-disable-all-day-creation])');
        if (!parent) {
            alert('I have no memory of this place…');
        }
        game = new Game(parent);
        game.onExit = () => {
            game.uninstall();
            game = null;
        }
        game.install();
    }
}