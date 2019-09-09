'use strict';

chrome.runtime.onMessage.addListener(message => {
    if (message === 'toggle') {
        toggleGame();
    }
});

let dy = 0;
let game = null;

function toggleGame() {
    if (game) {
        game.uninstall();
        game = null;
        //dy++;
    } else {
        const parent = document.querySelector(
            '[data-start-date-key][data-end-date-key]:not([data-disable-all-day-creation])');
        if (!parent) {
            alert('I have no memory of this place…');
        }
        console.log(`dy = ${dy}`);
        game = new Game(parent);
        game.install();
    }
}