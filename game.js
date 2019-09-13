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
        this.score = 0;
        this.lives = 3;
        this.bricks = [];
        this.onExit = () => { };
    }

    install() {
        const ballRadius = 5;
        const paddleWidth = 16;
        const paddleHeight = 50;

        this.gameOverlay = document.createElement('div');
        this.gameOverlay.style.position = 'fixed';
        this.gameOverlay.style.left = '0px';
        this.gameOverlay.style.right = '0px';
        this.gameOverlay.style.top = '0px';
        this.gameOverlay.style.bottom = '0px';
        this.gameOverlay.style.zIndex = '1000';
        this.gameOverlay.addEventListener('mouseenter', e => this.onMouseUpdate(e));
        this.gameOverlay.addEventListener('mousemove', e => this.onMouseUpdate(e));
        this.gameOverlay.addEventListener('click', e => this.onClick(e));
        document.body.appendChild(this.gameOverlay);

        this.nextWeekButton = document.querySelector('[role=button][aria-label="next week" i]');
        if (!this.nextWeekButton) {
            throw new Error('I have no memory of this place…');
        }

        this.ball = new Ball(ballRadius);
        this.ball.install(this.gameOverlay);

        this.paddle = new Paddle(ballRadius, paddleWidth, paddleHeight);
        this.paddle.install(this.gameOverlay);

        this.score = 0;
        this.installed = true;

        this.initializeStage();
        requestAnimationFrame(ts => this.update(ts));
    }

    initializeStage() {
        const gameViewport = document.querySelector(
            '[data-start-date-key][data-end-date-key]:not([data-disable-all-day-creation])');
        if (!gameViewport) {
            throw new Error('I have no memory of this place…');
        }
        this.viewportRect = gameViewport.getBoundingClientRect();
        this.viewportRect.x -= 36;
        this.viewportRect.width += 36;
        // Take only top, right, and bottom edge.
        this.viewportEdges = rectEdges(this.viewportRect, /* convex = */ false).slice(0, 3);

        if (this.statusDisplay) {
            this.statusDisplay.uninstall();
        }
        this.statusDisplay = new StatusDisplay(
            5, 5, this.viewportRect.left - 10, this.viewportRect.top - 10, this.paddle.width, this.paddle.height);
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

    update(timestamp) {
        if (!this.installed) {
            return;
        }
        if (this.lastTimestamp == null) {
            this.lastTimestamp = timestamp;
        }

        const timeDelta = timestamp - this.lastTimestamp;

        if (this.ballInMovement) {
            this.ball.update(timeDelta, [this.paddle, ...this.viewportEdges, ...this.bricks]);
        } else {
            this.ball.center = {
                x: this.paddle.center.x + this.paddle.width / 2 + this.ball.radius,
                y: this.paddle.center.y + this.paddle.height / 4,
            };
        }

        const numBricksAlive = this.bricks.reduce((cnt, brick) => brick.destroyed ? cnt : cnt + 1, 0);
        if (numBricksAlive === 0 && !this.finishing) {
            this.finishingStart = timestamp;
            this.finishing = true;
        }

        if (this.failing) {
            const timeSinceFailingStart = timestamp - this.failingStart;
            this.ball.opacity = Math.max(1 - (timeSinceFailingStart) / 500, 0);
            if (timeSinceFailingStart >= 1000) {
                this.failing = false;
                this.ball.opacity = 1;
                this.ballInMovement = false;
                this.lives--;
                if (this.lives < 0) {
                    alert('Game over!');
                    this.onExit(this);
                    return;
                }
            }
        } else if (this.finishing) {
            const timeSinceFinishingStart = timestamp - this.finishingStart;
            if (!this.waitingForStage) {
                this.ball.opacity = Math.max(1 - (timeSinceFinishingStart) / 500, 0);
                if (timeSinceFinishingStart >= 1000) {
                    this.ball.opacity = 1;
                    this.ballInMovement = false;
                    this.nextWeekButton.click();
                    this.waitingForStage = true;
                    this.waitingForStageStart = timestamp;
                }
            } else {
                const timeSinceWaitingForStage = timestamp - this.waitingForStageStart;
                if (timeSinceWaitingForStage >= 1000) {
                    this.initializeStage();
                    this.waitingForStage = false;
                    this.finishing = false;
                }
            }
        } else if (this.ball.center.x < this.paddle.center.x) {
            // this.ballInMovement = false;
            this.failing = true;
            this.failingStart = timestamp;
        }
        this.statusDisplay.update(this.score, this.lives);

        this.statusDisplay.render();
        this.paddle.render();
        this.ball.render();
        this.lastTimestamp = timestamp;
        requestAnimationFrame(ts => this.update(ts));
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
        if (!this.ballInMovement && !this.finishing) {
            this.ballInMovement = true;
            this.ball.velocity = { x: 0.3, y: 0.3 };
        }
    }

    onBrickDestroyed(brick) {
        this.score += brick.value;
    }

    uninstall() {
        this.paddle.uninstall();
        this.ball.uninstall();
        for (const brick of this.bricks) {
            brick.uninstall();
        }
        this.gameOverlay.remove();
        this.installed = false;
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
            fontSize: '50px',
            padding: '10px',
            textAlign: 'right',
        });
        parent.appendChild(this.root);

        this.scoreDisplay = document.createElement('div');
        this.root.appendChild(this.scoreDisplay);

        this.livesDisplay = document.createElement('div');
        Object.assign(this.livesDisplay.style, {
            display: 'flex',
            justifyContent: 'flex-end',
        })
        this.root.appendChild(this.livesDisplay);

        this.lifeIcons = [];
    }

    update(score, lives) {
        this.score = score;
        this.lives = lives;
        while (this.lifeIcons.length < lives) {
            const icon = createPaddleElement(this.paddleWidth, this.paddleHeight);
            this.lifeIcons.push(icon);
            icon.style.margin = '5px';
            this.livesDisplay.appendChild(icon);
        }
    }

    render() {
        this.scoreDisplay.textContent = `${this.score}`;
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
        this.domElement.style.left = `${this.center.x - this.radius}px`;
        this.domElement.style.top = `${this.center.y - this.radius}px`;
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
        this.domElement.style.left = `${this.center.x - this.width / 2}px`;
        this.domElement.style.top = `${this.center.y - this.height / 2}px`;
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