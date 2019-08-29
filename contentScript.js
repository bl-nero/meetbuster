console.log("I'm alive!");

chrome.runtime.onMessage.addListener(message => {
    if (message === 'toggle') {
        toggleGame();
    }
});

let inGame = false;

function toggleGame() {
    inGame = !inGame;
    console.log(`In game: ${inGame}`);
}