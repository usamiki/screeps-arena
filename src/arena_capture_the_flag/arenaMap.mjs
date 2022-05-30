import * as C from 'game/constants'
import { utils } from 'game';
import { Flag } from 'game/prototypes';
import { verboseSticky } from './visualManager.mjs';
import { Bounds, CompositeBounds, Rect, Triangle } from './myUtils.mjs';

export let enemyFlag = null;
export let myFlag = null;
export let isBoardReversal = false; //反転の場合、敵が(0,0)側

export let openedPoints;

export const ARENA_SIZE = 100;

export const namedPoints = {
    top_left: { x: 0, y: 0 },
    top_right: { x: 99, y: 0 },
    bottom_left: { x: 0, y: 99 },
    bottom_right: { x: 99, y: 99 },
    left_bridge_start: { x: 63, y: 32 },
    left_bridge_middle: { x: 65, y: 34 },
    left_bridge_end: { x: 67, y: 37 },
    left_bridge_end_back: { x: 65, y: 45 },
    right_bridge_start: { x: 32, y: 62 },
    right_bridge_middle: { x: 34, y: 65 },
    right_bridge_end: { x: 36, y: 67 }
};

export const namedBounds = {
    my_side: new Triangle({ x: 0, y: 99 }, { x: 99, y: 0 }, { x: 0, y: 0 }),
    enemy_side: new Triangle({ x: 99, y: 0 }, { x: 0, y: 99 }, { x: 99, y: 99 }),
    my_territory: new Rect({ x: 0, y: 0 }, { x: 28, y: 28 }),
    enemy_territory: new Rect({ x: 71, y: 71 }, { x: 99, y: 99 }),
    my_home_base: new  Rect({ x: 0, y: 0 }, { x: 10, y: 10 }),
    enemy_side_except_territory: new CompositeBounds(
        [new Triangle({ x: 99, y: 0 }, { x: 0, y: 99 }, { x: 99, y: 99 })],
        [new Rect({ x: 75, y: 75 }, { x: 99, y: 99 })]
    ),
}

export const basePlacements = {
    left_bridge_start: [
        { assign: null, role: C.RANGED_ATTACK, x: 63, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 62, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 61, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 31 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 32 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 33 },
        { assign: null, role: C.HEAL, x: 62, y: 28 },
        { assign: null, role: C.HEAL, x: 59, y: 32 },
    ],
    right_bridge_start: [
        { assign: null, role: C.ATTACK, x: 32, y: 62 },
        { assign: null, role: C.ATTACK, x: 31, y: 63 },
        { assign: null, role: C.HEAL, x: 32, y: 61 },
        { assign: null, role: C.HEAL, x: 31, y: 61 },
        { assign: null, role: C.HEAL, x: 31, y: 62 },
        { assign: null, role: C.HEAL, x: 30, y: 62 },
        { assign: null, role: C.HEAL, x: 30, y: 63 },
    ],
    attack_position: [
        { assign: null, role: C.ATTACK, x: 31, y: 62 },
        { assign: null, role: C.ATTACK, x: 32, y: 61 },
        { assign: null, role: C.RANGED_ATTACK, x: 63, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 62, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 61, y: 29 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 31 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 32 },
        { assign: null, role: C.RANGED_ATTACK, x: 60, y: 33 },
        { assign: null, role: C.HEAL, x: 62, y: 28 },
        { assign: null, role: C.HEAL, x: 59, y: 32 },
        { assign: null, role: C.HEAL, x: 31, y: 61 },
        { assign: null, role: C.HEAL, x: 30, y: 61 },
        { assign: null, role: C.HEAL, x: 30, y: 60 },
        { assign: null, role: C.HEAL, x: 31, y: 60 },
        { assign: null, role: C.HEAL, x: 32, y: 60 },
    ]
}

export const onStart = () => {
    const flags = utils.getObjectsByPrototype(Flag);
    myFlag = flags.find(i => i.my);
    myFlag.name = 'myFlag';
    enemyFlag = flags.find(i => !i.my);
    enemyFlag.name = 'enemyFlag';
    isBoardReversal = enemyFlag.x < 50;
    if (isBoardReversal) {
        for (const p in namedPoints) {
            namedPoints[p].x = 99 - namedPoints[p].x;
            namedPoints[p].y = 99 - namedPoints[p].y;
        }
        for (const pos in basePlacements) {
            for (const p of basePlacements[pos]) {
                p.x = 99 - p.x;
                p.y = 99 - p.y;
            }
        }
        for (const bounds in namedBounds) {
            namedBounds[bounds] = reverseBounds(namedBounds[bounds]);
        }
    }
    openedPoints = findOpenedPlace();
}

//ある程度開けた地点(60箇所くらい)を見つける. 集合可能地点として使う.
export const findOpenedPlace = () => {
    //t1は座標が平地であるかどうか
    const t1 = [];
    for (let x = 0; x < ARENA_SIZE; x++) {
        t1[x] = [];
        for (let y = 0; y < ARENA_SIZE; y++) {
            t1[x][y] = utils.getTerrainAt({ x: x, y: y }) === 0;
        }
    }

    //t2は候補地点. 最初はt1から平地でないセルに近い(3セル以内)部分を除外. 複数の島状の領域が残る.
    let t2 = [];
    for (let x = 0; x < ARENA_SIZE; x++) {
        t2[x] = [];
        for (let y = 0; y < ARENA_SIZE; y++) {
            t2[x][y] =
                t1[x][y] &&
                // //まずマップの端っこを除外してエラー除け. 端から4セルは除外
                4 <= x && x < ARENA_SIZE - 4 && 4 <= y && y < ARENA_SIZE - 4 &&
                //隣接する8方向の3セルについて平地が連続するか
                t1[x - 1][y] && t1[x - 2][y] && t1[x - 3][y] &&
                t1[x + 1][y] && t1[x + 2][y] && t1[x + 3][y] &&
                t1[x][y - 1] && t1[x][y - 2] && t1[x][y - 3] &&
                t1[x][y + 1] && t1[x][y + 2] && t1[x][y + 3] &&
                t1[x - 1][y - 1] && t1[x - 1][y + 1] && t1[x + 1][y - 1] && t1[x + 1][y + 1] &&
                t1[x - 2][y - 2] && t1[x - 2][y + 2] && t1[x + 2][y - 2] && t1[x + 2][y + 2] &&
                t1[x - 3][y - 3] && t1[x - 3][y + 3] && t1[x + 3][y - 3] && t1[x + 3][y + 3];
        }
    }

    let t3 = [];
    let changed = true;
    while (changed) {
        changed = false;

        //t3はt2で局地的に最も多くのtrueに隣接しているtrueのセルを見つける.
        for (let x = 0; x < ARENA_SIZE; x++) {
            t3[x] = [];
            for (let y = 0; y < ARENA_SIZE; y++) {
                if (!t2[x][y]) {
                    t3[x][y] = 0;
                } else {
                    //t3にはt2で隣接する候補地点の数を記録. 加算ではfalse = 0, true = 1である.
                    t3[x][y] =
                        t2[x - 1][y - 1] + t2[x - 1][y] + t2[x - 1][y + 1] +
                        t2[x][y - 1] + t2[x][y + 1] +
                        t2[x + 1][y - 1] + t2[x + 1][y] + t2[x + 1][y + 1];
                }
            }
        }
        //t3により、隣の候補地点と比較して、隣接している候補地点が多い候補地点を残す(「島」の周囲から消していく)
        for (let x = 0; x < ARENA_SIZE; x++) {
            for (let y = 0; y < ARENA_SIZE; y++) {
                if (t3[x][y] === 0) {
                    t2[x][y] = false;
                } else {
                    const max = Math.max(
                        t3[x - 1][y - 1], t3[x - 1][y], t3[x - 1][y + 1],
                        t3[x][y - 1], t3[x][y], t3[x][y + 1],
                        t3[x - 1][y - 1], t3[x - 1][y], t3[x - 1][y + 1]
                    );
                    if (t3[x][y] !== max) {
                        t2[x][y] = false;
                        changed = true; //ひとつも消された候補点がなければchanged=falseでループを抜ける
                    } else {
                        t2[x][y] = true;
                    }
                }
            }
        }
    }

    //残った候補地点が隣接する場合適当に1つだけ残す(この場合全体的に多少右下寄りになる)
    for (let x = 0; x < ARENA_SIZE; x++) {
        for (let y = 0; y < ARENA_SIZE; y++) {
            if (t2[x][y] &&
                (t2[x + 1][y] || t2[x - 1][y + 1] || t2[x][y + 1] || t2[x + 1][y + 1])
            ) {
                t2[x][y] = false;
            }
        }
    }

    //Visualize
    if (utils.getTicks() == 1) {
        for (let x = 0; x < ARENA_SIZE; x++) {
            for (let y = 0; y < ARENA_SIZE; y++) {
                if (t2[x][y])
                    verboseSticky.circle({ x: x, y: y });
            }
        }
    }

    const result = [];
    for (let x = 0; x < ARENA_SIZE; x++) {
        for (let y = 0; y < ARENA_SIZE; y++) {
            if (t2[x][y])
                result.push({ x: x, y: y });
        }
    }

    return result;
}


export const reverseBounds = (bounds) => {
    if (bounds instanceof Bounds) {
        return new Bounds(
            { x: 99 - bounds.center.x, y: 99 - bounds.center.y },
            bounds.extents
        );
    } else if (bounds instanceof Rect) {
        return new Rect(
            { x: 99 - bounds.maxX, y: 99 - bounds.maxY },
            { x: 99 - bounds.minX, y: 99 - bounds.minY }
        );
    } else if (bounds instanceof Triangle) {
        return new Triangle(
            { x: 99 - bounds.a.x, y: 99 - bounds.a.y },
            { x: 99 - bounds.b.x, y: 99 - bounds.b.y },
            { x: 99 - bounds.c.x, y: 99 - bounds.c.y }
        );
    } else if (bounds instanceof CompositeBounds) {
        return new CompositeBounds(
            bounds.includes.map(b => reverseBounds(b)),
            bounds.excludes.map(b => reverseBounds(b))
        );
    }
}
