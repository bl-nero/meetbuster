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

        this.update();
    }

    update(timestamp) {
        if (this.installed) {
            requestAnimationFrame(ts => this.update(ts));
        }
        if (this.lastTimestamp == null) {
            this.lastTimestamp = timestamp;
        }

        this.ball.update(this.viewportRect, this.bricks);
        // for (const brick of this.bricks) {
        //     if (this.ball.collidesWith(brick.rect)) {
        //         brick.hide();
        //     }
        // }
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
        this.edges = [{
            ends: [{ x: rect.left, y: rect.top }, { x: rect.right - 1, y: rect.top }],
            normal: { x: 0, y: -1 },
        }, {
            ends: [{ x: rect.right - 1, y: rect.top }, { x: rect.right - 1, y: rect.bottom - 1 }],
            normal: { x: 1, y: 0 },
        }, {
            ends: [{ x: rect.right - 1, y: rect.bottom - 1 }, { x: rect.left, y: rect.bottom - 1 }],
            normal: { x: 0, y: 1 },
        }, {
            ends: [{ x: rect.left, y: rect.bottom - 1 }, { x: rect.left, y: rect.top }],
            normal: { x: -1, y: 0 },
        }];
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

    update(viewportRect, bricks) {
        bricks = [...bricks];
        let currentCenter = this.center;
        let targetVelocity = this.velocity;
        let destination = addVec(currentCenter, this.velocity);
        let processAllBricks = true;
        let numCycles = 0;
        while (processAllBricks) {
            numCycles++;
            processAllBricks = false;
            bricks.forEach((brick, brickIndex) => {
                if (!brick) {
                    return;
                }
                for (const edge of brick.edges) {
                    const intersectionPoint = findIntersectionPoint(
                        edge.ends[0], edge.ends[1], currentCenter, destination);
                    if (intersectionPoint) {
                        // if (numCycles > 1) {
                        //     console.log(`Collision in cycle ${numCycles}`);
                        // }
                        processAllBricks = true;
                        bricks[brickIndex] = null;
                        currentCenter = intersectionPoint;
                        //console.log(intersectionPoint);
                        //debugDotAt(intersectionPoint);
                        const remainingVector = subtractPoints(destination, intersectionPoint);
                        //console.log('Remaining', remainingVector);
                        const reflectedRemainingVector = bounceVector(remainingVector, edge.normal);
                        targetVelocity = bounceVector(targetVelocity, edge.normal);
                        destination = addVec(reflectedRemainingVector, intersectionPoint);
                        // console.log(remainingVector, reflectedRemainingVector, destination);
                    }
                }
            });
            this.center = destination;
            this.velocity = targetVelocity;
        }

        if (this.center.x < viewportRect.left) {
            this.center.x = viewportRect.left;
            this.velocity.x = -this.velocity.x;
        }
        if (this.center.x >= viewportRect.right) {
            this.center.x = viewportRect.right - 1;
            this.velocity.x = -this.velocity.x;
        }
        if (this.center.y < viewportRect.top) {
            this.center.y = viewportRect.top;
            this.velocity.y = -this.velocity.y;
        }
        if (this.center.y >= viewportRect.bottom) {
            this.center.y = viewportRect.bottom - 1;
            this.velocity.y = -this.velocity.y;
        }
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