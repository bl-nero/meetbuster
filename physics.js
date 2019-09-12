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

/**
 * @typedef {Object} CollisionResult
 * @property {Vector} displacement
 * @property {Vector} velocity
 */

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

class DomElementCollider {
    /**
     * @param {HTMLElement} domElement
     * @param {number} ballRadius
     */
    constructor(domElement, ballRadius) {
        const rect = domElement.getBoundingClientRect();
        const elementStyle = window.getComputedStyle(domElement);
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
    }

    /**
     * @param {Vector} position 
     * @param {Vector} displacement 
     * @return {Collision}
     */
    detectCollision(position, displacement) {
        return detectClosestCollision([...this.edges, ...this.corners], position, displacement);
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