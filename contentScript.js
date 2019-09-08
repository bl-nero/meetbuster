'use strict';

/**
 * @typedef {Object} Vector
 * @property {number} x
 * @property {number} y
 */

chrome.runtime.onMessage.addListener(message => {
    if (message === 'toggle') {
        toggleGame();
    }
});

let dy = 0;

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

/**
 * @return {Collision}
 */
function detectClosestCollision(colliders, position, displacement) {
    const collisions = colliders.map(collider => collider.detectCollision(position, displacement))
        .filter(c => c);
    let closestCollisionDistance = Infinity;
    let closestCollision = null;
    for (const collision of collisions) {
        const distanceToCollision = distance(position, collision.getIntersectionPoint());
        if (distanceToCollision < closestCollisionDistance) {
            closestCollision = collision;
            closestCollisionDistance = distanceToCollision;
        }
    }
    return closestCollision;
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

/**
 * @param {DOMRect} rect 
 * @param {boolean} convex 
 * @param {number} margin 
 * @param {Array<number>} borderRadii 
 * @return {Array<Edge>}
 */
function rectEdges(rect, convex, margin = 0, borderRadii = [0, 0, 0, 0]) {
    const normalMultiplier = convex ? 1 : -1;
    const left = rect.left - margin;
    const top = rect.top - margin;
    const right = rect.right - 1 + margin;
    const bottom = rect.bottom - 1 + margin;
    return [
        new Edge(
            [{ x: left + borderRadii[0], y: top }, { x: right - borderRadii[1], y: top }],
            numMulVec(normalMultiplier, { x: 0, y: -1 })),
        new Edge(
            [{ x: right, y: top + borderRadii[1] }, { x: right, y: bottom - borderRadii[2] }],
            numMulVec(normalMultiplier, { x: 1, y: 0 })),
        new Edge(
            [{ x: right - borderRadii[2], y: bottom }, { x: left + borderRadii[3], y: bottom }],
            numMulVec(normalMultiplier, { x: 0, y: 1 })),
        new Edge(
            [{ x: left, y: bottom - borderRadii[3] }, { x: left, y: top + borderRadii[0] }],
            numMulVec(normalMultiplier, { x: -1, y: 0 }))
    ];
}

class Edge {
    /**
     * @param {Array<Vector>} ends 
     * @param {Vector} normal 
     */
    constructor(ends, normal) {
        this.ends = ends;
        this.normal = normal;
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        if (dotProduct(this.normal, displacement) >= 0) {
            return null;
        }
        const intersectionPoint = findIntersectionPoint(
            this.ends[0], this.ends[1], position, addVec(position, displacement));
        if (!intersectionPoint) {
            return null;
        }
        return new Collision(position, displacement, intersectionPoint, this.normal);
    }
}

/**
 * @typedef {Object} CollisionResult
 * @property {Vector} displacement
 * @property {Vector} velocity
 */

class Corner {
    /**
     * @param {Vector} center 
     * @param {number} radius 
     */
    constructor(center, radius) {
        this.center = center;
        this.radius = radius;
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        const intersectionPoint = findCircleIntersectionPoint(this, position, addVec(position, displacement));
        if (!intersectionPoint) {
            return null;
        }
        const normal = subtractPoints(intersectionPoint, this.center);
        checkForNaNVec(normal);
        if (dotProduct(normal, displacement) >= 0) {
            return null;
        }
        return new Collision(position, displacement, intersectionPoint, normal);
    }
}

class Collision {
    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @param {Vector} intersectionPoint 
     * @param {Vector} normal 
     */
    constructor(position, displacement, intersectionPoint, normal) {
        this.position = position;
        this.displacement = displacement;
        this.intersectionPoint = intersectionPoint;
        this.normal = normal;
    }

    /**
     * @return {Vector}
     */
    getIntersectionPoint() {
        return this.intersectionPoint;
    }

    /**
     * @param {Vector} velocity 
     * @return {CollisionResult}
     */
    collide(velocity) {
        const destination = addVec(this.position, this.displacement);
        const remainingVector = subtractPoints(destination, this.intersectionPoint);
        return {
            displacement: bounceVector(remainingVector, this.normal),
            velocity: bounceVector(velocity, this.normal),
        };
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

/**
 * @param {Vector} p 
 * @param {Vector} q 
 * @return {number}
 */
function distance(p, q) {
    return vecLength({ x: p.x - q.x, y: p.y - q.y });
}

/**
 * @param {Vector} v 
 * @return {number}
 */
function vecLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y)
}

/**
 * @param {Vector} v 
 * @param {Vector} normal 
 * @return {Vector}
 */
function bounceVector(v, normal) {
    const result = addVec(
        numMulVec(
            -2 * dotProduct(v, normal) / dotProduct(normal, normal),
            normal),
        v);
    checkForNaNVec(result);
    return result;
}

/**
 * @param {number} num 
 * @param {Vector} v 
 * @return {Vector}
 */
function numMulVec(num, v) {
    return { x: v.x * num, y: v.y * num };
}

/**
 * @param {Vector} v1 
 * @param {Vector} v2 
 * @return {number}
 */
function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

/**
 * @param {Vector} p 
 * @param {Vector} v 
 * @return {Vector}
 */
function addVec(p, v) {
    return { x: p.x + v.x, y: p.y + v.y };
}

function findCircleIntersectionPoint(circle, src, dest) {
    // u is a vector that points from circle center to src, v points from src to
    // dest.
    const u = subtractPoints(src, circle.center);
    const v = subtractPoints(dest, src);
    // Now we solve a complicated quadratic equation. Never mind what it is and
    // where it came from. There's certainly a more effective way to calculate
    // it, but solving this shit by hand was fun, and that's all that counts.
    const a = (v.x * v.x + v.y * v.y);
    if (a === 0) {  // TODO: maybe "approximately equal?"
        return null; // Not even a quadratic equation
    }
    const b = 2 * dotProduct(v, u);
    const c = u.x * u.x + u.y * u.y - circle.radius * circle.radius;
    const delta = b * b - 4 * a * c;
    if (delta < 0) {
        return null;
    }
    const sqrtDelta = Math.sqrt(delta);
    const tCandidates = [(-b - sqrtDelta) / (2 * a), (-b + sqrtDelta) / (2 * a)].filter(t => t >= 0 && t <= 1);
    if (tCandidates.length === 0) {
        return;
    }
    const t = Math.min(...tCandidates);
    const result = addVec(src, numMulVec(t, v));
    checkForNaNVec(result);
    return result;
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
 * @param {Vector} vec 
 */
function checkForNaNVec(vec) {
    if (isNaN(vec.x) || isNaN(vec.y)) {
        throw Error('A wild NaN appeared!');
    }
}

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