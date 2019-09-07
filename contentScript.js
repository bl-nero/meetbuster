'use strict';

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
        this.corners = [{
            center: { x: rect.left + borderRadii[0], y: rect.top + borderRadii[0] },
            radius: cornerRadii[0],
        }, {
            center: { x: rect.right - borderRadii[1] - 1, y: rect.top + borderRadii[1] },
            radius: cornerRadii[1],
        }, {
            center: { x: rect.right - borderRadii[2] - 1, y: rect.bottom - borderRadii[2] - 1 },
            radius: cornerRadii[2],
        }, {
            center: { x: rect.left + borderRadii[3], y: rect.bottom - borderRadii[3] - 1 },
            radius: cornerRadii[3],
        }];
        console.log(this.edges, this.corners);
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
    }

    show() {
        this.domElement.style.display = '';
    }
}

function parsePx(str, defaultValue) {
    const matches = str.match(/(\d)+px/);
    if (matches.length < 2) {
        return defaultValue;
    }
    return parseInt(matches[1]);
}

function rectEdges(rect, convex, margin = 0, borderRadii = [0, 0, 0, 0]) {
    const normalMultiplier = convex ? 1 : -1;
    const left = rect.left - margin;
    const top = rect.top - margin;
    const right = rect.right - 1 + margin;
    const bottom = rect.bottom - 1 + margin;
    return [{
        ends: [{ x: left + borderRadii[0], y: top }, { x: right - borderRadii[1], y: top }],
        normal: numMulVec(normalMultiplier, { x: 0, y: -1 }),
    }, {
        ends: [{ x: right, y: top + borderRadii[1] }, { x: right, y: bottom - borderRadii[2] }],
        normal: numMulVec(normalMultiplier, { x: 1, y: 0 }),
    }, {
        ends: [{ x: right - borderRadii[2], y: bottom }, { x: left + borderRadii[3], y: bottom }],
        normal: numMulVec(normalMultiplier, { x: 0, y: 1 }),
    }, {
        ends: [{ x: left, y: bottom - borderRadii[3] }, { x: left, y: top + borderRadii[0] }],
        normal: numMulVec(normalMultiplier, { x: -1, y: 0 }),
    }];
}

class Ball {
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

    update(viewportEdges, bricks) {
        let currentCenter = this.center;
        let targetVelocity = this.velocity;
        let destination = addVec(currentCenter, this.velocity);
        let processCollisions = true;
        let numCycles = 0;
        while (processCollisions) {
            numCycles++;
            if (numCycles > 20) {
                console.log(`Cycle ${numCycles}!`);
            }
            processCollisions = false;
            let closestDistance = Infinity;
            let closestIntersectionPoint = null;
            let collisionNormal = null;
            bricks.forEach((brick, brickIndex) => {
                if (!brick) {
                    return;
                }
                // Yeah, I know. Extremely inefficient. Will optimize later if needed.
                for (const edge of brick.edges) {
                    if (dotProduct(edge.normal, targetVelocity) >= 0) {
                        continue;
                    }
                    const intersectionPoint = findIntersectionPoint(
                        edge.ends[0], edge.ends[1], currentCenter, destination);
                    if (!intersectionPoint) {
                        continue;
                    }
                    const distanceToIntersection = distance(currentCenter, intersectionPoint);
                    if (distanceToIntersection < closestDistance) {
                        if (numCycles > 1) {
                            console.log(`Collision in cycle ${numCycles}`);
                        }
                        processCollisions = true;
                        collisionNormal = edge.normal;
                        closestDistance = distanceToIntersection;
                        closestIntersectionPoint = intersectionPoint;
                    }
                }
                for (const corner of brick.corners) {
                    const intersectionPoint = findCircleIntersectionPoint(corner, currentCenter, destination);
                    if (!intersectionPoint) {
                        continue;
                    }
                    // XXX: Everything bellow is bullshit, basically.
                    collisionNormal = subtractPoints(intersectionPoint, corner.center);
                    checkForNaNVec(collisionNormal);
                    if (dotProduct(collisionNormal, targetVelocity) >= 0) {
                        continue;
                    }
                    const distanceToIntersection = distance(currentCenter, intersectionPoint);
                    if (distanceToIntersection < closestDistance) {
                        if (numCycles > 1) {
                            console.log(`Collision in cycle ${numCycles}`);
                        }
                        processCollisions = true;
                        closestDistance = distanceToIntersection;
                        closestIntersectionPoint = intersectionPoint;
                    }
                }
            });
            viewportEdges.forEach((edge, edgeIndex) => {
                if (!edge) {
                    return;
                }
                if (dotProduct(edge.normal, targetVelocity) >= 0) {
                    return;
                }
                const intersectionPoint = findIntersectionPoint(
                    edge.ends[0], edge.ends[1], currentCenter, destination);
                if (!intersectionPoint) {
                    return;
                }
                const distanceToIntersection = distance(currentCenter, intersectionPoint);
                if (distanceToIntersection < closestDistance) {
                    if (numCycles > 1) {
                        console.log(`Collision in cycle ${numCycles}`);
                    }
                    processCollisions = true;
                    collisionNormal = edge.normal;
                    closestDistance = distanceToIntersection;
                    closestIntersectionPoint = intersectionPoint;
                }
            });

            if (closestIntersectionPoint) {
                currentCenter = closestIntersectionPoint;
                const remainingVector = subtractPoints(destination, closestIntersectionPoint);
                const reflectedRemainingVector = bounceVector(remainingVector, collisionNormal);
                targetVelocity = bounceVector(targetVelocity, collisionNormal);
                checkForNaNVec(targetVelocity);
                destination = addVec(reflectedRemainingVector, closestIntersectionPoint);
            }
        }

        this.center = destination;
        this.velocity = targetVelocity;
    }

    render() {
        this.domElement.style.left = `${this.center.x - this.radius}px`;
        this.domElement.style.top = `${this.center.y - this.radius}px`;
    }
}

function distance(p, q) {
    return vecLength({ x: p.x - q.x, y: p.y - q.y });
}

function vecLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y)
}

function bounceVector(v, normal) {
    return addVec(
        numMulVec(
            -2 * dotProduct(v, normal) / dotProduct(normal, normal),
            normal),
        v);
}

function numMulVec(num, v) {
    return { x: v.x * num, y: v.y * num };
}

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

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