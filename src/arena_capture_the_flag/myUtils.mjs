import { arenaInfo } from 'game';
import * as constants from 'game/constants'
import { getCpuTime, getTicks, getTerrainAt } from 'game/utils';
import { searchPath } from 'game/path-finder'
import { verboseLine } from './visualManager.mjs';

export const isAround = (you, dest, range) => {
    if (!you.x || !you.y || !dest.x || !dest.y || !(range > 0)) {
        console.log(`[ERROR]isAround : (${you.x},${you.y}) - (${dest.x},${dest.y}), range:${range}`);
        return false;
    }
    return (Math.abs(you.x - dest.x) <= range && Math.abs(you.y - dest.y) <= range);
}

export const locTag = (strings, point) => {
    if (!point) {
        return strings[0] + point;
    }
    if (strings.length === 1) {
        return `${strings[0]}(${point.x ?? ''},${point.y ?? ''})`;
    } else {
        return `${strings[0]}(${point.x ?? ''},${point.y ?? ''})${strings[1]}`;
    }
}

const cache = [];//cost = cache[100x + y]

export const isCompletedCalcFlagApproachCost = () => { return cache.length === 100 * 100; }

// 全セルから味方のフラッグへの移動コストを計算しキャッシュする.
// 複数ループに分割して実行。残りCPU時間をいっぱいまで使うのでloopの最後に実行する
// return 計算が完了したか.
export const calcFlagApproachCost = (flag) => {
    const assertTrue = flag && 0 < flag.x && flag.x < 100 && 0 < flag.y && flag.y < 100;
    if (!assertTrue) {
        console.log(`[ERROR]calcFlagApproachCost: flag:${flag}`);
        return false;
    }

    let len = cache.length;
    if (len < 100 * 100) {
        const cpuLimit = getTicks() == 1 ? arenaInfo.cpuTimeLimitFirstTick : arenaInfo.cpuTimeLimit;
        const start = len - 1;
        let skipCnt = 0;
        while ((len = cache.length) < 100 * 100) {
            if (getCpuTime() / cpuLimit < 0.95) {
                const x = ~~(len / 100);
                const y = len - 100 * x;
                try {
                    //cache[len]で末尾に１つ追加
                    if (getTerrainAt({ x, y }) === constants.TERRAIN_WALL) {
                        cache[len] = 4294967295;//デフォルトのsearchPathで到達不能だとこれが入ってるので
                        skipCnt++;
                    } else {
                        cache[len] = searchPath({ x, y }, flag).cost;
                    }
                } catch (e) {
                    console.log(`[ERROR]calcFlagApproachCost: searchPath (${x},${y}) -> (${flag.x},${flag.y})`);
                }
            } else {
                console.log(`[DEBUG]calcFlagApproachCost: yield. cpuTime:${getCpuTime()},progress:${cache.length}/10000 (+${cache.length - Math.max(start, 0)}(${skipCnt} walls))`);
                //増分のダンプ
                //console.log(`[DEBUG]` + cache.slice(Math.max(start, 0), cache.length));
                return len === 100 * 100;
            }
        }
        console.log(`[INFO]calcFlagApproachCost: done. cpuTime:${getCpuTime()},progress:${cache.length}/10000`);
    }
    return len === 100 * 100;
}

export const getCostToFlag = (from) => {
    return cache[from.x * 100 + from.y];
}


export const isSamePosition = (a, b) => {
    return (a.x === b.x && a.y === b.y);
}

export const dirToVector = (direction) => {
    switch (direction) {
        case constants.TOP:
            return { x: 0, y: -1 }
        case constants.BOTTOM:
            return { x: 0, y: 1 }
        case constants.RIGHT:
            return { x: 1, y: 0 }
        case constants.LEFT:
            return { x: -1, y: 0 }
        case constants.TOP_RIGHT:
            return { x: 1, y: -1 }
        case constants.BOTTOM_RIGHT:
            return { x: 1, y: 1 }
        case constants.TOP_LEFT:
            return { x: -1, y: -1 }
        case constants.BOTTOM_LEFT:
            return { x: -1, y: 1 }
        default:
            return { x: 0, y: 0 }
    }
}

//おおむねUnityのBoundsの仕様をまねる
export class Bounds {
    //sizeではなくextentsを指定
    constructor(center, extents) {
        this.center = center;
        this.extents = extents;
    }

    get min() {
        return { x: this.center.x - this.extents.x, y: this.center.y - this.extents.y }
    }
    get max() {
        return { x: this.center.x + this.extents.x, y: this.center.y + this.extents.y }
    }

    contains(point) {
        const minX = this.center.x - this.extents.x;
        const maxX = this.center.x + this.extents.x;
        const minY = this.center.y - this.extents.y;
        const maxY = this.center.y + this.extents.y;
        return minX <= point.x && point.x <= maxX &&
            minY <= point.y && point.y <= maxY;
    }

    visualize(style) {
        const lt = this.min;
        const lb = { x: this.center.x - this.extents.x, y: this.center.y + this.extents.y };
        const rb = this.max;
        const rt = { x: this.center.x + this.extents.x, y: this.center.y - this.extents.y };

        verboseLine.poly([lt, lb, rb, rt, lt], style);
    }
}

export class Rect {
    constructor(min, max) {
        this.minX = min.x;
        this.minY = min.y;
        this.maxX = max.x;
        this.maxY = max.y;
    }

    contains(point) {
        return this.minX <= point.x && point.x <= this.maxX &&
            this.minY <= point.y && point.y <= this.maxY;
    }

    visualize(style) {
        const lt = { x: this.minX, y: this.minY };
        const lb = { x: this.minX, y: this.maxY };
        const rb = { x: this.maxX, y: this.maxY };
        const rt = { x: this.maxX, y: this.minY };

        verboseLine.poly([lt, lb, rb, rt, lt], style);
    }
}

export class Triangle {
    constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    // 参考
    // http://www.thothchildren.com/chapter/5b267a436298160664e80763
    // https://stackoverflow.com/questions/2049582/how-to-determine-if-a-point-is-in-a-2d-triangle
    // 境界線上を含む
    contains(point) {
        const sign = (p1, p2, p3) => //一直線上にある時0になるっぽい.
        {
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        }

        const b1 = sign(point, this.a, this.b) <= 0;
        const b2 = sign(point, this.b, this.c) <= 0;
        const b3 = sign(point, this.c, this.a) <= 0;
        return ((b1 == b2) && (b2 == b3));
    }

    visualize(style) {
        verboseLine.poly([this.a, this.b, this.c, this.a], style);
    }
}

export class CompositeBounds {
    constructor(includes, excludes) {
        this.includes = includes;
        this.excludes = excludes;
    }

    contains(point) {
        return this.includes.every(b => b.contains(point)) && this.excludes.every(b => !b.contains(point));
    }

    visualize(style) {
        for (const b of this.includes) {
            b.visualize(style);
        }
        for (const b of this.excludes) {
            b.visualize(style);
        }
    }
}

