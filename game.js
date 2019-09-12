class Game {
    /** @param {HTMLElement} gameViewport */
    constructor(gameViewport) {
        this.gameViewport = gameViewport;
        this.viewportRect = gameViewport.getBoundingClientRect();
        this.viewportRect.x -= 40;
        this.viewportRect.width += 40;
        this.viewportEdges = rectEdges(this.viewportRect, /* convex = */ false);
        console.log(this.viewportRect, this.viewportEdges);
        this.installed = false;
        this.lastTimestamp = null;
        this.ballInMovement = false;
    }

    install() {
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

        const ballRadius = 5;

        const brickElements = [...this.gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(elem, this.viewportRect, ballRadius))
            .filter(brick => brick);

        this.ball = new Ball(this.viewportRect.left, this.viewportRect.top + dy, ballRadius);
        this.ball.install(this.gameOverlay);

        this.paddle = new Paddle(
            { x: this.viewportRect.left , y: (this.viewportRect.top + this.viewportRect.bottom) / 2},
            ballRadius, 16, 50);
        this.paddle.install(this.gameOverlay);

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
                x: this.paddle.center.x + this.paddle.width / 2 + this.ball.radius / 2,
                y: this.paddle.center.y + this.paddle.height / 2,
            };
        }
        this.paddle.render();
        this.ball.render();
        requestAnimationFrame(ts => this.update(ts));
    }

    /**
     * @param {MouseEvent} event
     */
    onMouseUpdate(event) {
        this.paddle.moveTo(event.clientY);
    }

    onClick() {
        this.ballInMovement = true;
    }

    uninstall() {
        this.paddle.uninstall();
        this.ball.uninstall();
        for (const brick of this.bricks) {
            brick.show();
        }
        this.gameOverlay.remove();
        this.installed = false;
    }
}

class Brick {
    /**
     * @param {HTMLElement} domElement
     * @param {number} ballRadius
     */
    constructor(domElement, ballRadius) {
        this.domElement = domElement;
        this.collider = new DomElementCollider(domElement, ballRadius);
        this.hidden = false;
    }

    /**
     * @param {HTMLElement} domElement 
     * @param {DOMRect} viewportRect 
     */
    static create(domElement, viewportRect, ballRadius) {
        const rect = domElement.getBoundingClientRect();
        if (rect.bottom < viewportRect.top || rect.top >= viewportRect.bottom) {
            return null;
        }
        return new Brick(domElement, ballRadius);
    }

    hide() {
        this.domElement.style.display = 'none';
        this.hidden = true;
    }

    show() {
        this.domElement.style.display = '';
        this.hidden = false;
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        if (this.hidden) {
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
        this.brick.hide();
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
        this.velocity = { x: 5, y: 5 };
        this.radius = radius;
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
    }
}

class Paddle {
    /**
     * @param {number} ballRadius
     * @param {DOMRect} viewportRect
     * @param {number} height
     */
    constructor(position, ballRadius, width, height) {
        this.center = position;
        this.ballRadius = ballRadius;
        this.width = width;
        this.height = height;
        this.domElement = document.createElement('div');
        this.domElement.style.backgroundColor = '#888';
        this.domElement.style.borderRadius = `${height / 2}px`;
        this.domElement.style.width = '16px';
        this.domElement.style.height = `${height}px`;
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