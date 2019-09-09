/**
 * @typedef {Object} Vector
 * @property {number} x
 * @property {number} y
 */

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
 * @param {Vector} vec 
 */
function checkForNaNVec(vec) {
    if (isNaN(vec.x) || isNaN(vec.y)) {
        throw Error('A wild NaN appeared!');
    }
}