class Game {
    /** @param {HTMLElement} gameViewport */
    constructor(gameViewport) {
        this.gameViewport = gameViewport;
        this.viewportRect = gameViewport.getBoundingClientRect();
        this.viewportRect.x -= 36;
        this.viewportRect.width += 36;
        // Take only top, right, and bottom edge.
        this.viewportEdges = rectEdges(this.viewportRect, /* convex = */ false).slice(0, 3);
        this.installed = false;
        this.lastTimestamp = null;
        this.ballInMovement = false;
        this.failing = false;
        this.failingStart = null;
        this.score = 0;
        this.lives = 3;
        this.onExit = () => {};
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

        this.statusDisplay = new StatusDisplay(
            5, 5, this.viewportRect.left - 10, this.viewportRect.top - 10, paddleWidth, paddleHeight);
        this.statusDisplay.install(this.gameOverlay);

        const brickElements = [...this.gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(
                elem, this.viewportRect, ballRadius, brick => this.onBrickDestroyed(brick)))
            .filter(brick => brick);

        this.ball = new Ball(this.viewportRect.left, this.viewportRect.top, ballRadius);
        this.ball.install(this.gameOverlay);

        this.paddle = new Paddle(
            { x: this.viewportRect.left, y: (this.viewportRect.top + this.viewportRect.bottom) / 2 },
            ballRadius,
            paddleWidth,
            paddleHeight);
        this.paddle.install(this.gameOverlay);

        this.score = 0;
        this.installed = true;
        requestAnimationFrame(ts => this.update(ts));
    }

    update(timestamp) {
        if (!this.installed) {
            return;
        }
        if (this.lastTimestamp == null) {
            this.lastTimestamp = timestamp;
        }

        if (this.ballInMovement) {
            this.ball.update([this.paddle, ...this.viewportEdges, ...this.bricks]);
        } else {
            this.ball.center = {
                x: this.paddle.center.x + this.paddle.width / 2 + this.ball.radius,
                y: this.paddle.center.y + this.paddle.height / 4,
            };
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
        } else if (this.ball.center.x < this.paddle.center.x) {
            // this.ballInMovement = false;
            this.failing = true;
            this.failingStart = timestamp;
        }
        this.statusDisplay.update(this.score, this.lives);

        this.statusDisplay.render();
        this.paddle.render();
        this.ball.render();
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
        this.paddle.moveTo(y);
    }

    onClick() {
        if (!this.ballInMovement) {
            this.ballInMovement = true;
            this.ball.velocity = { x: 5, y: 5 };
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
        this.onDestroyed = onDestroyed || (() => {});

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
     * @param {number} x 
     * @param {number} y 
     * @param {number} radius 
     */
    constructor(x, y, radius) {
        this.center = { x, y };
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
     * @param {Array<Edge|Brick|Paddle>} colliders 
     * @param {Array<Brick>} bricks 
     */
    update(colliders) {
        let currentCenter = this.center;
        let currentVelocity = this.velocity;
        let destination = addVec(currentCenter, this.velocity);
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
                subtractPoints(destination, currentCenter));

            if (closestCollision) {
                processCollisions = true;
                currentCenter = closestCollision.getIntersectionPoint();
                const collisionResult = closestCollision.collide(currentVelocity);
                destination = addVec(currentCenter, collisionResult.displacement);
                currentVelocity = collisionResult.velocity;
            }
        }

        this.center = destination;
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
     * @param {DOMRect} viewportRect
     * @param {number} width
     * @param {number} height
     */
    constructor(position, ballRadius, width, height) {
        this.center = position;
        this.ballRadius = ballRadius;
        this.width = width;
        this.height = height;
        this.domElement = createPaddleElement(this.width, this.height);
        this.domElement.style.position = 'absolute';
    }

    moveTo(y) {
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