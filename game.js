class Game {
    constructor() {
        this.installed = false;
        this.lastTimestamp = null;
        this.ballInMovement = false;
        this.failing = false;
        this.failingStart = null;
        this.finishing = false;
        this.finishingStart = null;
        this.waitingForStage = false;
        this.waitingForStageStart = null;
        this.highScore = 0;
        this.score = 0;
        this.lives = 3;
        this.clicked = false;
        this.bricks = [];
        this.onExit = () => { };
    }

    install() {
        const ballRadius = 5;
        const paddleWidth = 16;
        const paddleHeight = 50;

        this.gameOverlay = document.createElement('div');
        Object.assign(this.gameOverlay.style, {
            position: 'fixed',
            left: '0px',
            right: '0px',
            top: '0px',
            bottom: '0px',
            zIndex: '1000',
        });
        this.gameOverlay.addEventListener('mouseenter', e => this.onMouseUpdate(e));
        this.gameOverlay.addEventListener('mousemove', e => this.onMouseUpdate(e));
        this.gameOverlay.addEventListener('click', e => this.onClick(e));
        document.body.appendChild(this.gameOverlay);

        this.glass1 = document.createElement('div');
        Object.assign(this.glass1.style, {
            position: 'absolute',
            left: '0px',
            right: '0px',
            top: '0px',
            backgroundColor: '#FFFA',
        });
        this.gameOverlay.appendChild(this.glass1);

        this.glass2 = document.createElement('div');
        Object.assign(this.glass2.style, {
            position: 'absolute',
            left: '0px',
            bottom: '0px',
            backgroundColor: '#FFFA',
        });
        this.gameOverlay.appendChild(this.glass2);

        this.nextWeekButton = document.querySelector('button[aria-label="next week" i]');
        this.mainDrawerButton = document.querySelector('[role=button][aria-label="main drawer" i]');
        if (!this.nextWeekButton || !this.mainDrawerButton) {
            throw new Error('I have no memory of this place… Try switching to a week view.');
        }

        this.ball = new Ball(ballRadius);
        this.ball.install(this.gameOverlay);

        this.paddle = new Paddle(ballRadius, paddleWidth, paddleHeight);
        this.paddle.install(this.gameOverlay);

        this.score = 0;
        this.installed = true;

        chrome.storage.sync.get({ highScore: 0 }, ({ highScore }) => this.highScore = highScore);
    }

    async initializeStage() {
        const gameViewport = document.querySelector(
            '[data-start-date-key][data-end-date-key]:not([data-disable-all-day-creation])');
        if (!gameViewport) {
            throw new Error('I have no memory of this place… Try switching to a week view.');
        }
        this.viewportRect = gameViewport.getBoundingClientRect();

        this.glass1.style.height = `${this.viewportRect.top}px`;
        this.glass2.style.top = `${this.viewportRect.top}px`;
        this.glass2.style.width = `${this.viewportRect.left}px`;

        const paddleLineOffset = 80;
        this.viewportRect.x -= paddleLineOffset;
        this.viewportRect.width += paddleLineOffset;
        // Take only top, right, and bottom edge.
        this.viewportEdges = rectEdges(this.viewportRect, /* convex = */ false).slice(0, 3);

        if (this.statusDisplay) {
            this.statusDisplay.uninstall();
        }
        this.statusDisplay = new StatusDisplay(
            5, 5, 300, this.viewportRect.top - 10, this.paddle.width, this.paddle.height);
        this.statusDisplay.install(this.gameOverlay);

        this.paddle.moveTo(this.viewportRect.left, (this.viewportRect.top + this.viewportRect.bottom) / 2);

        for (const brick of this.bricks) {
            brick.uninstall();
        }
        const brickElements = [...gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(
                elem, this.viewportRect, this.ball.radius, brick => this.onBrickDestroyed(brick)))
            .filter(brick => brick);
        this.ballInMovement = false;
    }

    nextFrame() {
        return new Promise((resolve, reject) => {
            requestAnimationFrame(timestamp => {
                if (this.installed) {
                    resolve(timestamp);
                } else {
                    reject(new GameUninstalled());
                }
            });
        });
    }

    async repeatUntilMs(fn, duration, startTimestamp) {
        for (let ts = 0; ts < duration; ts = await this.nextFrame() - startTimestamp) {
            fn(ts);
        }
    }

    async waitUntilMs(duration, startTimestamp) {
        return this.repeatUntilMs(() => { }, duration, startTimestamp);
    }

    async run() {
        try {
            if (this.mainDrawerButton.getAttribute('aria-expanded') !== 'true') {
                this.mainDrawerButton.click();
                const timestamp = await this.nextFrame();
                await this.waitUntilMs(1000, timestamp);
            }

            this.initializeStage();
            this.animateAll();

            while (this.lives >= 0) {
                await this.waitForClick();
                this.ballInMovement = true;
                this.ball.velocity = { x: 0.3, y: 0.3 };

                while (true) {
                    const timestamp = await this.nextFrame();
                    if (this.failed()) {
                        await this.repeatUntilMs(ts => this.ball.opacity = Math.max(1 - ts / 500, 0), 500, timestamp);
                        await this.waitUntilMs(1000, timestamp);
                        this.ball.opacity = 1;
                        this.ballInMovement = false;
                        this.lives--;
                        break;

                    } else if (this.levelClear()) {
                        this.finishing = true;
                        await this.repeatUntilMs(ts => this.ball.opacity = Math.max(1 - ts / 500, 0), 500, timestamp);
                        await this.waitUntilMs(1000, timestamp);
                        this.ball.opacity = 1;
                        this.ballInMovement = false;
                        this.nextWeekButton.click();
                        await this.waitUntilMs(2000, timestamp);
                        this.initializeStage();
                        break;
                    }
                }
            }

            alert('Game over!');
            if (this.score > this.highScore) {
                this.highScore = this.score;
                chrome.storage.sync.set({ highScore: this.highScore });
            }
            this.onExit(this);
        } catch (e) {
            if (!(e instanceof GameUninstalled)) {
                throw e;
            }
        }
    }

    levelClear() {
        const numBricksAlive = this.bricks.reduce((cnt, brick) => brick.destroyed ? cnt : cnt + 1, 0);
        return numBricksAlive === 0;
    }

    failed() {
        return this.ball.center.x < this.paddle.center.x;
    }

    async waitForClick() {
        this.clicked = false;
        while (!this.clicked) {
            await this.nextFrame();
        }
    }

    async animateAll(timestamp) {
        try {
            let lastTimestamp = await this.nextFrame();
            while (true) {
                const timestamp = await this.nextFrame();
                const timeDelta = timestamp - lastTimestamp;
                lastTimestamp = timestamp;

                if (this.ballInMovement) {
                    this.ball.update(timeDelta, [this.paddle, ...this.viewportEdges, ...this.bricks]);
                } else {
                    this.ball.center = {
                        x: this.paddle.center.x + this.paddle.width / 2 + this.ball.radius,
                        y: this.paddle.center.y + this.paddle.height / 4,
                    };
                }
                this.statusDisplay.update(this.highScore, this.score, this.lives);

                this.statusDisplay.render();
                this.paddle.render();
                this.ball.render();
            }
        } catch (e) {
            if (!(e instanceof GameUninstalled)) {
                throw e;
            }
        }
    }

    /**
     * @param {MouseEvent} event
     */
    onMouseUpdate(event) {
        const y = Math.min(
            this.viewportRect.bottom - this.paddle.height / 2,
            Math.max(
                this.viewportRect.top + this.paddle.height / 2 + 1,
                event.clientY,
            )
        )
        this.paddle.moveTo(this.viewportRect.left, y);
    }

    onClick() {
        this.clicked = true;
    }

    onBrickDestroyed(brick) {
        this.score += brick.value;
    }

    uninstall() {
        if (this.paddle) {
            this.paddle.uninstall();
        }
        if (this.ball) {
            this.ball.uninstall();
        }
        for (const brick of this.bricks) {
            brick.uninstall();
        }
        if (this.gameOverlay) {
            this.gameOverlay.remove();
        }
        this.installed = false;
    }
}

class GameUninstalled extends Error {
    constructor(message) {
        super(message);
        this.name = 'GameUninstalled';
    }
}

class StatusDisplay {
    constructor(left, top, width, height, paddleWidth, paddleHeight) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
        this.paddleWidth = paddleWidth;
        this.paddleHeight = paddleHeight;
    }

    /**
     * @param {HTMLElement} parent 
     */
    install(parent) {
        this.root = document.createElement('div');
        Object.assign(this.root.style, {
            boxSizing: 'border-box',
            position: 'absolute',
            top: `${this.top}px`,
            left: `${this.left}px`,
            width: `${this.width}px`,
            height: `${this.height}px`,
            border: '2px solid #888',
            borderRadius: '5px',
            backgroundColor: 'white',
            fontSize: '30px',
            padding: '10px',
            textAlign: 'right',
        });
        parent.appendChild(this.root);

        this.highScoreDisplay = this.addLabel('High score:');
        this.scoreDisplay = this.addLabel('Score:');

        this.livesDisplay = document.createElement('div');
        Object.assign(this.livesDisplay.style, {
            display: 'flex',
            justifyContent: 'flex-end',
        })
        this.root.appendChild(this.livesDisplay);

        this.lifeIcons = [];
    }

    addLabel(text) {
        const parent = document.createElement('div');
        Object.assign(parent.style, {
            display: 'flex',
            justifyContent: 'space-between',
        });
        this.root.appendChild(parent);

        const label = document.createElement('div');
        label.textContent = text;
        parent.appendChild(label);

        const valueElement = document.createElement('div');
        parent.appendChild(valueElement);
        return valueElement;
    }

    update(highScore, score, lives) {
        this.highScore = highScore;
        this.score = score;
        this.lives = lives;
    }

    render() {
        this.scoreDisplay.textContent = `${this.score}`;
        this.highScoreDisplay.textContent = `${this.highScore}`;
        while (this.lifeIcons.length < this.lives) {
            const icon = createPaddleElement(this.paddleWidth, this.paddleHeight);
            this.lifeIcons.push(icon);
            icon.style.margin = '5px';
            this.livesDisplay.appendChild(icon);
        }
        this.lifeIcons.forEach((icon, index) => {
            icon.style.display = index < this.lives ? '' : 'none';
        });
    }

    uninstall() {
        this.root.remove();
    }
}

class Brick {
    /**
     * @param {HTMLElement} domElement
     * @param {number} ballRadius
     * @param {function(Brick)} onDestroyed
     */
    constructor(domElement, ballRadius, onDestroyed) {
        this.domElement = domElement;
        this.collider = new DomElementCollider(domElement, ballRadius);
        this.destroyed = false;
        this.onDestroyed = onDestroyed || (() => { });

        const style = getComputedStyle(this.domElement);
        this.value = style.backgroundColor === 'rgb(255, 255, 255)' ? 1 : 3;
        this.hp = this.value;
        this.originalOpacity = this.domElement.style.opacity;
        this.domElement.style.opacity = 1;
    }

    /**
     * @param {HTMLElement} domElement 
     * @param {DOMRect} viewportRect 
     * @param {function(Brick)} onDestroyed
     */
    static create(domElement, viewportRect, ballRadius, onDestroyed) {
        const rect = domElement.getBoundingClientRect();
        if (rect.bottom < viewportRect.top || rect.top >= viewportRect.bottom) {
            return null;
        }
        return new Brick(domElement, ballRadius, onDestroyed);
    }

    takeDamage() {
        --this.hp;
        this.domElement.style.opacity = `${this.hp / this.value}`;
        if (this.hp <= 0) {
            this.destroyed = true;
            this.onDestroyed(this);
        }
    }

    uninstall() {
        this.domElement.style.opacity = this.originalOpacity;
        this.destroyed = false;
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        if (this.destroyed) {
            return null;
        }
        const internalCollision = this.collider.detectCollision(position, displacement);
        if (!internalCollision) {
            return null;
        }
        return new BrickCollision(internalCollision, this);
    }
}

class BrickCollision {
    /**
     * @param {Collision} internalCollision 
     * @param {Brick} brick
     */
    constructor(internalCollision, brick) {
        this.internalCollision = internalCollision;
        this.brick = brick;
    }

    /**
     * @return {Vector}
     */
    getIntersectionPoint() {
        return this.internalCollision.getIntersectionPoint();
    }

    /**
     * @param {Vector} velocity 
     * @return {CollisionResult}
     */
    collide(velocity) {
        this.brick.takeDamage();
        return this.internalCollision.collide(velocity);
    }
}

class Ball {
    /**
     * @param {number} radius 
     */
    constructor(radius) {
        this.center = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.radius = radius;
        this.opacity = 1;
    }

    install(parent) {
        this.domElement = document.createElement('div');
        this.domElement.style.width = `${this.radius * 2}px`;
        this.domElement.style.height = `${this.radius * 2}px`;
        this.domElement.style.position = 'absolute';
        this.domElement.style.backgroundColor = 'black';
        this.domElement.style.borderRadius = '50%';
        parent.appendChild(this.domElement);
    }

    uninstall() {
        this.domElement.remove();
    }

    /**
     * @param {number} timeDelta
     * @param {Array<Edge|Brick|Paddle>} colliders 
     */
    update(timeDelta, colliders) {
        let currentCenter = this.center;
        let currentVelocity = this.velocity;
        let displacement = numMulVec(timeDelta, this.velocity);
        let processCollisions = true;
        let numCycles = 0;
        while (processCollisions) {
            numCycles++;
            if (numCycles > 10) {
                console.log(`Cycle ${numCycles}!`);
                debugger;
            }
            processCollisions = false;
            const closestCollision = detectClosestCollision(
                colliders,
                currentCenter,
                displacement);

            if (closestCollision) {
                processCollisions = true;
                currentCenter = closestCollision.getIntersectionPoint();
                const collisionResult = closestCollision.collide(currentVelocity);
                displacement = collisionResult.displacement;
                currentVelocity = collisionResult.velocity;
            }
        }

        this.center = addVec(currentCenter, displacement);
        this.velocity = currentVelocity;
    }

    render() {
        this.domElement.style.transform =
            `translate(${this.center.x - this.radius}px, ${this.center.y - this.radius}px)`;
        this.domElement.style.opacity = `${this.opacity}`;
    }
}

class Paddle {
    /**
     * @param {number} ballRadius
     * @param {number} width
     * @param {number} height
     */
    constructor(ballRadius, width, height) {
        this.center = { x: 0, y: 0 };
        this.ballRadius = ballRadius;
        this.width = width;
        this.height = height;
        this.domElement = createPaddleElement(this.width, this.height);
        this.domElement.style.position = 'absolute';
    }

    moveTo(x, y) {
        this.center.x = x;
        this.center.y = y;
    }

    install(parent) {
        parent.appendChild(this.domElement);
    }

    update() {

    }

    render() {
        this.domElement.style.transform =
            `translate(${this.center.x - this.width / 2}px, ${this.center.y - this.height / 2}px)`;
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        const collider = new DomElementCollider(this.domElement, this.ballRadius);
        return collider.detectCollision(position, displacement);
    }

    uninstall() {
        this.domElement.remove();
    }
}

function createPaddleElement(width, height) {
    const element = document.createElement('div');
    Object.assign(element.style, {
        backgroundColor: '#888',
        borderRadius: `${height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
    });
    return element;
}

/**
 * @param {Vector} point 
 * @param {string} color 
 */
function debugDotAt(point, color = 'blue') {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.left = `${point.x - 1}px`;
    el.style.top = `${point.y - 1}px`;
    el.style.width = '3px';
    el.style.height = '3px';
    el.style.backgroundColor = color;
    el.style.zIndex = '400';
    document.body.appendChild(el);
}

/**
 * @param {string} str 
 * @param {number} defaultValue 
 * @return {number}
 */
function parsePx(str, defaultValue) {
    const matches = str.match(/(\d)+px/);
    if (matches.length < 2) {
        return defaultValue;
    }
    return parseInt(matches[1]);
}