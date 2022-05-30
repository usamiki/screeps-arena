import { utils } from 'game';
import { Creep, StructureTower } from 'game/prototypes';
import * as C from 'game/constants'
import { isBoardReversal } from './arenaMap.mjs'
import { verboseLine } from './visualManager.mjs';

export let colliders = [];
export let enemyCreeps = [];
export let creeps = [];
export let myCreeps = [];
export let enemyTowers = [];
export let myTowers = [];
export let forceRatio = [0, 0, 0, 0, 0];//現在を[0]とする過去5tickの履歴
export let myForce = [0, 0, 0, 0, 0];
export let enemyForce = [0, 0, 0, 0, 0];


// 0 : unknown
// 1 : plain
// 2 : enemy
// 3 : array

export const onStart = () => {
    update();//他のモジュールのonStart()より前に値が出揃っている必要がある.
}

export const update = () => {
    creeps = utils.getObjectsByPrototype(Creep);
    if (creeps.some(e => { return !e.exists })) {//死んだCreepは取得されないことの確認.
        console.log('[Error]AssertionError at ArenaData update');
    }
    enemyCreeps = creeps.filter(c => !c.my);
    myCreeps = creeps.filter(c => c.my);
    const towers = utils.getObjectsByPrototype(StructureTower);
    myTowers = towers.filter(c => c.my);
    enemyTowers = towers.filter(c => c.my);
    colliders = creeps.concat(towers);
    updateCreepExtension();
    updateForceRatio();
    const info = `[INFO]ArenaData {my:${myCreeps.length}, en:${enemyCreeps.length}, ` +
        `ratio:${new Intl.NumberFormat().format(forceRatio[0])} (${myForce[0]}:${enemyForce[0]})}`;
    console.log(info);
}

const BODYPART_VALUE = {
    [C.ATTACK]: 120,
    [C.HEAL]: 150,
    [C.RANGED_ATTACK]: 150,
    [C.MOVE]: 80,
    [C.TOUGH]: 50,
    [C.WORK]: 0,
    [C.CARRY]: 0,
}

//creepの戦力値は、各パーツのコスト * 各パーツの残HPの合計とする
const evaluateCreep = (creep) => {
    return creep.body.reduce(
        (sum, bodyPart) => {
            return sum + BODYPART_VALUE[bodyPart.type] * bodyPart.hits
        }
        , 0 //sumの初期値
    )
}

//全体戦力比更新
export const updateForceRatio = () => {
    enemyForce.unshift(enemyCreeps.map(evaluateCreep).reduce((a, b) => a + b, 0));
    enemyForce.pop();
    myForce.unshift(myCreeps.map(evaluateCreep).reduce((a, b) => a + b, 0));
    myForce.pop();
    if (enemyForce[0] === 0) {
        forceRatio.unshift(Infinity);
        forceRatio.pop();
    } else {
        forceRatio.unshift(Math.log2(myForce[0] / enemyForce[0]));
        forceRatio.pop();
    }
}

//戦域での戦力比の計算
// bounds : any object with contains() and visualize()
export const localForceRatio = (bounds) => {

    //範囲の可視化
    bounds.visualize({ stroke: 'orange' });

    const t = enemyCreeps.filter(c => bounds.contains(c)).map(evaluateCreep);
    const e = t.reduce((a, b) => a + b, 0);
    if (e === 0) return Infinity;
    const m = myCreeps.filter(c => bounds.contains(c)).map(evaluateCreep).reduce((a, b) => a + b, 0);
    return Math.log2(m / e);
}

//戦域で味方の後方へ突破されたのを検出
export const isFrontlineBroken = (battleAreaBounds) => {
    const enemy = enemyCreeps.filter(c => battleAreaBounds.contains(c));
    if (enemy.length === 0) return false;
    const mine = myCreeps.filter(c => battleAreaBounds.contains(c));
    if (mine.length === 0) return true;
    //最後方の味方の位置を検出ラインとする（x,y座標ごとに）
    const shouldNotCross = isBoardReversal ?
        mine.reduce((acc, c) => {
            acc.x = Math.max(acc.x, c.x);
            acc.y = Math.max(acc.y, c.y);
            return acc;
        }, { x: -Infinity, y: -Infinity })
        :
        mine.reduce((acc, c) => {
            acc.x = Math.min(acc.x, c.x);
            acc.y = Math.min(acc.y, c.y);
            return acc;
        }, { x: Infinity, y: Infinity });
    let ret;
    if (isBoardReversal) {
        ret = enemy.some(c => shouldNotCross.x < c.x || shouldNotCross.y < c.y);
    } else {
        ret = enemy.some(c => shouldNotCross.x > c.x || shouldNotCross.y > c.y);
    }
    //可視化
    verboseLine.line(
        { x: shouldNotCross.x, y: battleAreaBounds.min.y },
        { x: shouldNotCross.x, y: battleAreaBounds.max.y },
        { color: ret ? 'red' : 'white' });
    verboseLine.line(
        { x: battleAreaBounds.min.x, y: shouldNotCross.y },
        { x: battleAreaBounds.max.x, y: shouldNotCross.y },
        { color: ret ? 'red' : 'white' });
    return ret;
}

//Creepの追加プロパティ
// creep.moveHistory 移動履歴[x,y]を格納する長さ5の配列. [0]は現在位置.
const updateCreepExtension = () => {
    for (const creep of creeps) {
        if (!creep.moveHistory) {
            creep.moveHistory = [[creep.x, creep.y], [creep.x, creep.y], [creep.x, creep.y], [creep.x, creep.y], [creep.x, creep.y]];
        } else {
            creep.moveHistory.unshift([creep.x, creep.y]);
            creep.moveHistory.pop();
        }
    }
}

