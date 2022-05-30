import { utils, constants } from 'game';
import { verboseText } from './visualManager.mjs'
import { enemyCreeps, myCreeps, colliders } from './arenaData.mjs';
import * as myUtils from './myUtils.mjs';

export const ORDER = {
    FIGHT: 'FIGHT',//敵の排除を優先する
    FOLLOW: 'FOLLOW'//目的地への到達を優先する
}
//オブジェクト指向で改善する必要がある
//creepをラップして委譲したいがよくわからない
export class Soldier {
    constructor(creep) {
        this.creep = creep;
        this.role = this.getRole();
        this.party = null;//party it belong
        this.target = null;//creep、Soldierなど文脈による TODO 援護すべき対象と攻撃すべき対象を区別する
        this.order = ORDER.FIGHT;
        this.destination = null;//destination
        this.billboardPosition = null;
        this.billboardMessage = '';
    }

    //委譲による実装
    get exists() { return this.creep.exists; }
    get id() { return this.creep.id; }
    get body() { return this.creep.body; }
    get fatigue() { return this.creep.fatigue; }
    get hitsMax() { return this.creep.hitsMax; }
    get hits() { return this.creep.hits; }
    get my() { return this.creep.my; }
    get store() { return this.creep.store; }
    get x() { return this.creep.x; }
    get y() { return this.creep.y; }

    moveTo(target, opts) {
        //moveToだとビルボード表示を追随させられないので、ビルボード表示を追随させる処理も含めた代替メソッド。
        const path = this.findPathTo(target, opts);
        if (path.length > 0) {
            const dir = utils.getDirection(path[0].x - this.x, path[0].y - this.y);
            const err = this.move(dir, false);
            //console.log(`[DEBUG]moveTo ${this.id}->${target.id} ${myUtils.locTag`${target}`} err:${err}`);
            return err;
        } else {
            this.billboardPosition = { x: this.x, y: this.y - 0.5 };
            return constants.OK;
        }
    }

    move(direction) {
        const dir = myUtils.dirToVector(direction);
        const err = this.creep.move(direction);
        this.billboardPosition = (err === constants.OK) ?
            { x: this.x + dir.x, y: this.y + dir.y - 0.5 } :
            { x: this.x, y: this.y - 0.5 };
        return err;
    }

    findClosestByRange(positions) {
        return this.creep.findClosestByRange(positions);
    }

    findPathTo(pos, opts) {
        return this.creep.findPathTo(pos, opts);
    }

    attack(target) {
        const err = this.creep.attack(target);
        //console.log(`[DEBUG]Attack ${this.id}->${this.target} err:${err}`);
        return err;
    }

    rangedAttack(target) {
        const err = this.creep.rangedAttack(target);
        //console.log(`[DEBUG]Ranged Attack ${this.id}->${this.target} err:${err}`);
        return err;
    }

    rangedMassAttack() {
        const err = this.creep.rangedMassAttack();
        //console.log(`[DEBUG]Ranged Attack ${this.id} err:${err}`);
    }

    heal(target) {
        const err = this.creep.heal(target);
        //console.log(`[DEBUG]Heal ${this.id}->${this.target} err:${err}`);
        return err;
    }

    rangedHeal(target) {
        const err = this.creep.rangedHeal(target);
        //console.log(`[DEBUG]Ranged Heal ${this.id}->${this.target} err:${err}`);
        return err;
    }

    join(party) {
        party.accept(this);
        this.party = party;
    }

    update() {
        if (this.target && !this.target.exists) {
            this.setTarget(null);
        }

        if (this.order === ORDER.FOLLOW) {
            this.follow();
        }

        else if (this.order === ORDER.FIGHT) {
            this.fight();
        }
    }

    visualize() {
        this.billboardMessage = `${this.id}`;
        this.billboardPosition = { x: this.x, y: this.y - 0.5 };
        if (this === this.party.leader) {
            this.billboardMessage += 'L';
        }
        if (this.order === ORDER.FOLLOW) {
            this.billboardMessage += '💨';
        } else if (this.order === ORDER.FIGHT) {
            this.billboardMessage += '💥'
        }
        this.billboardMessage += myUtils.locTag`${this.destination}`;
        this.billboardMessage += this.target?.id ?? '';
        //ビルボード表示
        verboseText.text(this.billboardMessage, this.billboardPosition, { font: '0.4', opacity: '0.5' });
    }

    getRole() {
        if (this.body.some(bodyPart => bodyPart.type == constants.RANGED_ATTACK)) {
            return constants.RANGED_ATTACK;
        } else if (this.body.some(bodyPart => bodyPart.type == constants.ATTACK)) {
            return constants.ATTACK;
        } else if (this.body.some(bodyPart => bodyPart.type == constants.HEAL)) {
            return constants.HEAL;
        } else {
            return '';
        }
    }

    follow() {
        //移動を最優先しつつ、途中でできる行動をとる
        this.moveTo(this.destination);
        if (this.role == constants.HEAL) {
            this.tryHeal();
        } else if (this.role == constants.RANGED_ATTACK) {
            this.tryRangedAttack();
        } else {
            this.tryAttack();
        }
    }

    fight() {
        if (this.role === constants.RANGED_ATTACK) {
            //攻撃対象を選ぶ(適当)
            this.setTarget(this.searchEnemy());
            if (this.target) {
                const dir = this.considerDirection();
                if (dir) {
                    this.move(dir);
                }
                this.tryRangedAttack(this.target);
            } else {
                //目標が見当たらなければ進む
                this.moveTo(this.destination);
            }
        } else if (this.role === constants.ATTACK) {
            //攻撃対象を選ぶ(適当)
            this.setTarget(this.searchEnemy());
            if (this.target) {
                const err = this.attack(this.target);
                if (err === constants.ERR_NOT_IN_RANGE) {
                    this.moveTo(this.target);
                } else {
                    console.log(`[DEBUG]Attack ${this.id}->${this.target} err:${err}`);
                }
            } else {
                //目標が見当たらなければ進む
                this.moveTo(this.destination);
            }
        } else if (this.role === constants.HEAL) {
            //回復対象を選ぶ
            if (this.hits / this.hitsMax < 0.5) {
                //自分のHPが半分を切っている場合は自分.
                this.setTarget(this);
            } else if (this.target && this.target.hits / this.target.hitsMax < 0.5) {
                //現在のターゲットのHPが半分を切っている場合は現在のターゲット.
            } else {
                //回復対象を選ぶ計算式(適当)
                //失ったHPの割合 * 100 - 自分との距離 * 2 が最大の対象(自分も含めて).
                const members = this.party.members.filter(men => men.hits < men.hitsMax);
                const getHealPriority = (men) => { men.hits * 100 / men.hitsMax - utils.getRange(this, men) * 2 };
                this.setTarget(members
                    .map(men => { return getHealPriority(men) })
                    .reduce((a, b) => Math.max(a, b), null));
            }

            //移動は差し当たり簡単に
            const to = this.findClosestByRange(this.party.members.filter(m => m.role !== constants.HEAL));
            if (to) {
                this.moveTo(to);
            } else {
                this.moveTo(this.destination)
            }
            this.tryHeal();
        }
    }


    searchEnemy() {
        return this.findClosestByRange(utils.findInRange(this, enemyCreeps, 10));
    }

    searchMember() {
        const members = this.party.members.filter(men => men != this);
        return this.findClosestByRange(utils.findInRange(this, members, 15));
    }

    followLeader() {
        this.moveTo(this.party.leader);
    }

    //細かく作っていく前に、SoldierをCreepのプロトタイプ拡張として書き直す必要がある. そうでないと循環参照が避けられない.
    //全方向を評価する
    considerDirection() {
        const nearby = [
            { x: this.x, y: this.y, dir: null },
            { x: this.x, y: this.y - 1, dir: constants.TOP },
            { x: this.x, y: this.y + 1, dir: constants.BOTTOM },
            { x: this.x - 1, y: this.y, dir: constants.LEFT },
            { x: this.x + 1, y: this.y, dir: constants.RIGHT },
            { x: this.x - 1, y: this.y - 1, dir: constants.TOP_LEFT },
            { x: this.x - 1, y: this.y + 1, dir: constants.BOTTOM_LEFT },
            { x: this.x + 1, y: this.y - 1, dir: constants.TOP_RIGHT },
            { x: this.x + 1, y: this.y + 1, dir: constants.BOTTOM_RIGHT }
        ]

        let bestPos;
        let bestValue = -999;
        for (const pos of nearby) {
            const value = this.considerCell(pos);
            if (value > bestValue) {
                bestValue = value;
                bestPos = pos;
            }
        }
        return bestPos.dir;
    }

    //障害物を考慮せずローカルな位置取りを見つける
    considerCell(pos) {
        const terrain = utils.getTerrainAt(pos)
        if (terrain === constants.TERRAIN_WALL) {
            return -999;
        }
        let value = 0;
        if (terrain === constants.TERRAIN_SWAMP) {
            value = value - 2;
        }
        //障害物を考慮
        if (pos.x !== this.x && pos.y !== this.y) {
            if (colliders.some(c => { return c.x === pos.x && c.y === pos.y })) {
                return -999;
            }
        }

        return this.considerRangeToTarget(pos, value);
    }

    considerRangeToTarget(pos, value) {
        const existsTarget = this.target && this.target.exists && this.target !== this;

        if (this.role === constants.RANGED_ATTACK) {
            if (existsTarget) {
                const range = utils.getRange(pos, this.target);
                if (range === 1) {
                    value = value - 2;
                } else if (range === 3) {
                    value = value + 1;
                } else if (range === 2) {
                    value = value + 2;
                } else {
                    //距離が空きすぎていれば間合いを詰めるほうへ
                    const targetPath = this.findPathToTarget();
                    if (targetPath[0]) {
                        if (pos.x === targetPath[0].x && pos.y === targetPath[0].y) {
                            value += 2;
                        }
                    } else {
                        console.log('[ERROR]considerRangeToTarget-ranged-targetPath');
                    }
                }
            }
        }
        if (this.role === constants.HEAL || this.role === constants.ATTACK) {
            if (existsTarget) {
                const range = utils.getRange(pos, this.target);
                if (range === 1) {
                    value = value + 2;
                } else {
                    //距離が空きすぎていれば間合いを詰めるほうへ
                    const targetPath = this.findPathToTarget();
                    if (targetPath[0]) {
                        if (pos.x === targetPath[0].x && pos.y === targetPath[0].y) {
                            value += 1;
                        }
                    } else {
                        console.log('[ERROR]considerRangeToTarget-atk_or_heal-targetPath');
                    }
                }
            }
        }
        return value;
    }

    findPathToTarget() {
        if (this.lastPathToTargetTick !== utils.getTicks() || this.lastTarget !== this.target) {
            //このTickでターゲットへのルートが計算済みでない場合計算する
            this.lastTarget = this.target;
            this.lastPathToTargetTick = utils.getTicks();
            this.pathToTarget = this.findPathTo(this.target);
        }
        if (!this.pathToTarget) {
            console.log('[ERROR]findPathToTarget');
        }
        return this.pathToTarget;
    }

    tryHeal() {
        let err;
        if (this.target && this.target.my && this.target.hits < this.target.hitsMax) {
            err = this.heal(this.target);
        }
        if (err === constants.ERR_NOT_IN_RANGE) {
            err = this.rangedHeal(this.target);
        }
        if (!err || err === constants.ERR_NOT_IN_RANGE) {
            //自分も含めて隣接するうち最も損傷した味方をできるだけ回復
            const t = myCreeps.filter(c => myUtils.isAround(this, c, 3) && c.hits < c.hitsMax);
            if (t.length > 0) {
                const tgt = t.reduce((prev, cur) => { return prev.hits < cur.hits ? prev : cur });
                err = this.heal(tgt);
                if (err === constants.ERR_NOT_IN_RANGE) {
                    this.rangedHeal(tgt);
                }
            }
        }
        return err;
    }

    tryRangedAttack() {
        let err;
        //できるだけフォーカスを合わせる
        const fvAB = this.party.focusVoteABSorted;
        for (const fv of fvAB) {
            const range = utils.getRange(this, fv.creep);
            if (range <= 1) {
                err = this.rangedMassAttack();
            } else if (range <= 3) {
                err = this.rangedAttack(fv.creep);
            }
            if (err === constants.OK) {
                this.party.focusVote(fv.creep);
                return err;
            } else if (err === constants.ERR_NO_BODYPART) {
                return err;
            }
        }
        //フォーカス可能でなければ手近な探して攻撃する
        //範囲内の最も損傷した敵を攻撃
        const t = enemyCreeps.filter(c => myUtils.isAround(this, c, 3));
        if (t.length > 0) {
            const tar = t.reduce((prev, cur) => { return prev.hits < cur.hits ? prev : cur });
            const range = utils.getRange(this, tar);
            if (range <= 1) {
                err = this.rangedMassAttack();
            } else {
                err = this.rangedAttack(tar);
            }
            if (err === constants.OK) {
                this.party.focusVote(tar);
            }
            return err;
        }
        return constants.ERR_NOT_IN_RANGE;
    }

    tryAttack() {
        let err = constants.ERR_NOT_IN_RANGE;
        //隣接するうち最も損傷した敵を攻撃
        const t = enemyCreeps.filter(c => myUtils.isAround(this, c, 1));
        if (t.length > 0) {
            const tar = t.reduce((prev, cur) => { return prev.hits < cur.hits ? prev : cur });
            err = this.attack(tar);
            if (err === constants.OK) {
                this.party.focusVote(tar);
            }
        }
        return err;
    }

    setDestination(destination) {
        // if (this.destination !== destination) {
        //     const a = this.destination ? `${this.destination.id}:${myUtils.locTag`${this.destination}`}` : null;
        //     const b = destination ? `${destination.id}:${myUtils.locTag`${destination}`}` : null;
        //     console.log(`[DEBUG]${this.id} destination update:${a} -> ${b}`);
        // }
        this.destination = destination;
    }

    setTarget(target) {
        // if (this.target !== target) {
        //     const a = this.target ? this.target.id : null;
        //     const b = target ? target.id : null;
        //     console.log(`[DEBUG]${this.id} target update:${a} -> ${b}`);
        // }
        this.target = target;
    }



}