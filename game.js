class Game {
    /** @param {HTMLElement} gameViewport */
    constructor(gameViewport) {
        this.gameViewport = gameViewport;
        this.viewportRect = gameViewport.getBoundingClientRect();
        this.viewportEdges = rectEdges(this.viewportRect, /* convex = */ false);
        this.installed = false;
        this.lastTimestamp = null;
    }

    install() {
        const ballRadius = 5;
        const brickElements = [...this.gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(elem, this.viewportRect, ballRadius))
            .filter(brick => brick);
        this.ball = new Ball(this.viewportRect.left, this.viewportRect.top + dy, ballRadius);
        this.ball.install();
        this.installed = true;

        requestAnimationFrame(ts => this.update(ts));
    }

    update(timestamp) {
        if (this.installed) {
            requestAnimationFrame(ts => this.update(ts));
        }
        if (this.lastTimestamp == null) {
            this.lastTimestamp = timestamp;
        }

        this.ball.update(this.viewportEdges, this.bricks);
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
    constructor(domElement, rect, ballRadius) {
        this.domElement = domElement;
        const elementStyle = window.getComputedStyle(this.domElement);
        const cornerNames = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        const borderRadii = cornerNames.map(name => parsePx(elementStyle.getPropertyValue(`border-${name}-radius`), 4));
        const cornerRadii = borderRadii.map(borderRadius => borderRadius + ballRadius);
        this.edges = rectEdges(rect, /* convex = */ true, ballRadius, borderRadii);
        this.corners = [
            new Corner(
                { x: rect.left + borderRadii[0], y: rect.top + borderRadii[0] },
                cornerRadii[0],
            ),
            new Corner(
                { x: rect.right - borderRadii[1] - 1, y: rect.top + borderRadii[1] },
                cornerRadii[1],
            ),
            new Corner(
                { x: rect.right - borderRadii[2] - 1, y: rect.bottom - borderRadii[2] - 1 },
                cornerRadii[2],
            ),
            new Corner(
                { x: rect.left + borderRadii[3], y: rect.bottom - borderRadii[3] - 1 },
                cornerRadii[3],
            )
        ];
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
        return new Brick(domElement, rect, ballRadius);
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
        const internalCollision = detectClosestCollision(
            [...this.edges, ...this.corners], position, displacement);
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

    install() {
        this.domElement = document.createElement('div');
        this.domElement.style.width = `${this.radius * 2}px`;
        this.domElement.style.height = `${this.radius * 2}px`;
        this.domElement.style.position = 'fixed';
        this.domElement.style.backgroundColor = 'black';
        this.domElement.style.borderRadius = '50%';
        this.domElement.style.zIndex = '100';
        document.body.appendChild(this.domElement);
    }

    uninstall() {
        this.domElement.remove();
    }

    /**
     * @param {Array<Edge>} viewportEdges 
     * @param {Array<Brick>} bricks 
     */
    update(viewportEdges, bricks) {
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
                [...bricks, ...viewportEdges],
                currentCenter,
                subtractPoints(destination, currentCenter));

            if (closestCollision) {
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