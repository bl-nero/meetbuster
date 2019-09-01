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
        const brickElements = [...this.gameViewport.querySelectorAll('[data-eventchip]')];
        this.bricks = brickElements
            .map(elem => Brick.create(elem, this.viewportRect))
            .filter(brick => brick);
        this.ball = new Ball(this.viewportRect.left, this.viewportRect.top + dy);
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
    constructor(domElement, rect) {
        this.domElement = domElement;
        this.rect = rect;
        this.edges = rectEdges(rect, /* convex = */ true);
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

function rectEdges(rect, convex) {
    const normalMultiplier = convex ? 1 : -1;
    return [{
        ends: [{ x: rect.left, y: rect.top }, { x: rect.right - 1, y: rect.top }],
        normal: numMulVec(normalMultiplier, { x: 0, y: -1 }),
    }, {
        ends: [{ x: rect.right - 1, y: rect.top }, { x: rect.right - 1, y: rect.bottom - 1 }],
        normal: numMulVec(normalMultiplier, { x: 1, y: 0 }),
    }, {
        ends: [{ x: rect.right - 1, y: rect.bottom - 1 }, { x: rect.left, y: rect.bottom - 1 }],
        normal: numMulVec(normalMultiplier, { x: 0, y: 1 }),
    }, {
        ends: [{ x: rect.left, y: rect.bottom - 1 }, { x: rect.left, y: rect.top }],
        normal: numMulVec(normalMultiplier, { x: -1, y: 0 }),
    }];
}

class Ball {
    constructor(x, y) {
        this.center = { x, y };
        this.velocity = { x: 5, y: 5 };
        this.radius = 5;
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
        bricks = [...bricks];
        viewportEdges = [...viewportEdges];
        let currentCenter = this.center;
        let targetVelocity = this.velocity;
        let destination = addVec(currentCenter, this.velocity);
        let processAllBricks = true;
        let numCycles = 0;
        while (processAllBricks) {
            numCycles++;
            processAllBricks = false;
            let closestBrick = null;
            let closestEdge = null;
            let closestDistance = Infinity;
            let closestBrickIndex = -1;
            let closestViewportEdgeIndex = -1;
            let closestIntersectionPoint = null;
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
                        processAllBricks = true;
                        closestBrickIndex = brickIndex;
                        closestEdge = edge;
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
                    processAllBricks = true;
                    closestBrickIndex = -1;
                    closestViewportEdgeIndex = edgeIndex;
                    closestEdge = edge;
                    closestDistance = distanceToIntersection;
                    closestIntersectionPoint = intersectionPoint;
                }
            });
            if (closestBrickIndex !== -1) {
                bricks[closestBrickIndex] = null;  // Don't process the same brick twice.
            } else if (closestViewportEdgeIndex !== -1) {
                viewportEdges[closestViewportEdgeIndex] = null;
            }

            if (closestEdge) {
                currentCenter = closestIntersectionPoint;
                //console.log(closestIntersectionPoint);
                //debugDotAt(closestIntersectionPoint);
                const remainingVector = subtractPoints(destination, closestIntersectionPoint);
                //console.log('Remaining', remainingVector);
                const reflectedRemainingVector = bounceVector(remainingVector, closestEdge.normal);
                targetVelocity = bounceVector(targetVelocity, closestEdge.normal);
                destination = addVec(reflectedRemainingVector, closestIntersectionPoint);
                // console.log(remainingVector, reflectedRemainingVector, destination);
            }
        }

        this.center = destination;
        this.velocity = targetVelocity;
    }

    render() {
        this.domElement.style.left = `${this.center.x - this.radius}px`;
        this.domElement.style.top = `${this.center.y - this.radius}px`;
    }

    /** @param {DOMRect} rect */
    collidesWith(rect) {
        return this.x >= rect.left && this.x < rect.right &&
            this.y >= rect.top && this.y < rect.bottom;
    }

    /** @param {DOMRect} rect */
    collisionVector(normal) {

    }
}

function distance(p, q) {
    return Math.sqrt(p.x * p.x + p.y * p.y)
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

function debugDotAt(point) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.left = `${point.x - 1}px`;
    el.style.top = `${point.y - 1}px`;
    el.style.width = '3px';
    el.style.height = '3px';
    el.style.backgroundColor = 'blue';
    el.style.zIndex = '400';
    document.body.appendChild(el);
}

let game = null;

function toggleGame() {
    if (game) {
        game.uninstall();
        game = null;
        dy++;
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