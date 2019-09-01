chrome.runtime.onMessage.addListener(message => {
    if (message === 'toggle') {
        toggleGame();
    }
});

class Game {
    /** @param {HTMLElement} gameViewport */
    constructor(gameViewport) {
        this.gameViewport = gameViewport;
        this.viewportRect = gameViewport.getBoundingClientRect();
        this.installed = false;
        this.lastTimestamp = null;
    }

    install() {
        const brickElements = [...this.gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(elem, this.viewportRect))
            .filter(brick => brick);
        console.log(this.bricks);
        this.ball = new Ball(this.viewportRect.left, this.viewportRect.top);
        this.ball.install();
        this.installed = true;

        this.update();
    }

    update(timestamp) {
        if (this.installed) {
            requestAnimationFrame(ts => this.update(ts));
        }
        if (this.lastTimestamp == null) {
            this.lastTimestamp = timestamp;
        }

        this.ball.move();
        if (this.ball.x < this.viewportRect.left) {
            this.ball.x = this.viewportRect.left;
            this.ball.vx = -this.ball.vx;
        }
        if (this.ball.x >= this.viewportRect.right) {
            this.ball.x = this.viewportRect.right - 1;
            this.ball.vx = -this.ball.vx;
        }
        if (this.ball.y < this.viewportRect.top) {
            this.ball.y = this.viewportRect.top;
            this.ball.vy = -this.ball.vy;
        }
        if (this.ball.y >= this.viewportRect.bottom) {
            this.ball.y = this.viewportRect.bottom - 1;
            this.ball.vy = -this.ball.vy;
        }

        for (const brick of this.bricks) {
            if (this.ball.collidesWith(brick.rect)) {
                brick.hide();
            }
        }
        this.ball.render();
    }

    uninstall() {
        this.ball.uninstall();
        for (const brick of this.bricks) {
            brick.show();
        }
        this.installed = false;
    }
}

class Brick {
    /**
     * @param {HTMLElement} domElement
     * @param {DOMRect} rect
     */
    constructor(domElement, rect) {
        this.domElement = domElement;
        this.rect = rect;
    }

    /**
     * @param {HTMLElement} domElement 
     * @param {DOMRect} viewportRect 
     */
    static create(domElement, viewportRect) {
        const rect = domElement.getBoundingClientRect();
        if (rect.bottom < viewportRect.top || rect.top >= viewportRect.bottom) {
            return null;
        }
        return new Brick(domElement, rect);
    }

    hide() {
        this.domElement.style.display = 'none';
    }

    show() {
        this.domElement.style.display = '';
    }
}

class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.vx = 1;
        this.vy = 1;
    }

    install() {
        this.domElement = document.createElement('div');
        this.domElement.style.width = `${this.width}px`;
        this.domElement.style.height = `${this.height}px`;
        this.domElement.style.position = 'fixed';
        this.domElement.style.backgroundColor = 'black';
        this.domElement.style.zIndex = '100';
        document.body.appendChild(this.domElement);
    }

    uninstall() {
        this.domElement.remove();
    }

    move() {
        this.x += this.vx;
        this.y += this.vy;
    }

    render() {
        this.domElement.style.left = `${this.x - this.width / 2}px`;
        this.domElement.style.top = `${this.y - this.height / 2}px`;
    }

    /** @param {DOMRect} rect */
    collidesWith(rect) {
        return this.x >= rect.left && this.x < rect.right &&
            this.y >= rect.top && this.y < rect.bottom;
    }

    /** @param {DOMRect} rect */
    collisionVector(rect) {
        if ()
    }
}

function dotProduct(v1, v2) {
    return { x: v1.x * v2.x, y: v1.y * v2.y };
}

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
        game.install();
    }
}