import * as C from 'game/constants'
import { enemyCreeps } from './arenaData.mjs';
import * as myUtils from './myUtils.mjs'
import * as utils from 'game/utils'
import { namedPoints, basePlacements, enemyFlag, myFlag } from './arenaMap.mjs';
import { Idle, March, Deploy, Rush, SearchAndDestroy } from './partyTask.mjs'

const compareFocusVoteDesc = (a, b) => {
    if (a.vote > b.vote) {
        return -1;
    }
    if (a.vote < b.vote) {
        return 1;
    }
    return 0;
}


//Party class
export class Party {
    constructor(name) {
        this.name = name;
        this.members = [];
        this.destination = null;
        this.focusVoteA = [];//このtickでの攻撃予定対象の記録 record {creep: creep, vote: number}
        this.focusVoteB = [];//前のtickでの攻撃予定対象の記録
        this.task = null;
        this.placement = null;
        this.plan = [];
    }

    //focusVoteAとBを合算し、投票0の場合を除く
    get focusVoteABSorted() {
        return this.focusVoteA.concat(this.focusVoteB).reduce(
            (acc, cur) => {
                const fv = acc.find(fv => fv.creep.id === cur.creep.id);
                if (fv) {
                    fv.vote += cur.vote;
                } else {
                    acc.push(cur);
                }
                return acc;
            }, [])
            .filter(fv => fv.vote > 0)
            .sort(compareFocusVoteDesc);
    }

    //攻撃対象を記録
    focusVote(creep) {
        for (const fv of this.focusVoteA) {
            if (fv.creep === creep) {
                fv.vote += 1;
                break;
            }
        }
    }

    orderDeploy(destination) {
        this.clearTask();
        if (typeof destination === 'string') {
            this.destination = namedPoints[destination];
            this.placement = basePlacements[destination];
        } else {
            this.destination = destination;
            this.placement = null;
        }
        if (!this.isDestinationReached()) {
            this.plan.push(new March(this));
        }
        if (this.placement) {
            this.plan.push(new Deploy(this));
        }
    }

    orderDefense() {
        this.clearTask();
        this.destination = myFlag;
        this.plan.push(new Rush(this));
    }

    orderBattle(battleArea, targetingStyle) {
        this.clearTask();
        this.plan.push(new SearchAndDestroy(this, battleArea, targetingStyle));
    }

    orderFlagApproach() {
        this.clearTask();
        this.destination = enemyFlag;
        this.plan.push(new Rush(this));
    }

    //メンバー追加
    accept(member) {
        this.members.push(member);
    }

    update() {
        this.updateMembersInfo();
        this.updateFocusHistory();
        this.updateTask();
        for (const men of this.members) {
            men.update();
        }
    }

    updateMembersInfo() {
        //remove dead members
        const len1 = this.members.length;
        this.members = this.members.filter(i => i.exists);
        const len2 = this.members.length;
        if (len1 != len2) {
            console.log(`[INFO]member lost:${len2 - len1}`);
        }
    }

    updateFocusHistory() {
        this.focusVoteB = this.focusVoteA;
        this.focusVoteA = enemyCreeps.map(creep => { return { creep: creep, vote: 0 } });
    }

    updateTask() {
        if (!this.task || this.task.isCompleted()) {
            this.task = this.plan.shift();
            if (!this.task) {
                this.task = new Idle();
            }
        }
        this.task.update();
    }

    isDestinationReached(range = 5, strictness = 0.7) {
        if (!this.destination) {
            console.log('[ERROR]isDestinationReached destination ' + this.destination);
            return false;
        }
        if (this.members.length == 0) {
            console.log('[ERROR]isDestinationReached 0 member');
            return false;
        }

        let ok = 0;
        for (const men of this.members) {
            if (myUtils.isAround(men, this.destination, range)) {
                ok++;
            }
        }
        return (ok / this.members.length) > (strictness);
    }

    isClustered() {
        let ok = 1;
        for (let i = 1; i < this.members.length; i++) {
            if (utils.getRange(this.members[i], this.leader) < 3) {
                ok++;
            }
        }
        return ok / this.members.length > 0.7;
    }

    //戦術レベルでの移動中判定（仮）
    isMoving() {
        return this.task.constructor === March || this.task.constructor === Rush;
    }

    get leader() { return this.members[0]; }

    //現在のリーダー(membersの先頭)とリーダーに指定したメンバーのインデックスをスワップする
    setLeader(leader) {
        for (let i = 0; i < this.members.length; i++) {
            if (this.members[i] === leader) {
                const a = this.members[0];
                this.members[0] = leader;
                this.members[i] = a;
                return;
            }
        }
        console.log(`[ERROR]Party-setLeader`);
    }

    clearTask() {
        this.plan = [];
        this.task = null;
    }

    summarize() {
        return `${this.name}:${this.members.length} members. \
        [${this.members.map(men => `${men.id}:${men.role}`)}]`;
    }

    get [Symbol.toStringTag]() {
        return this.name + ':' + this.members.length + ' members';
    }

    getAverageAttackerPoint() {
        let x = 0, y = 0, c = 0;
        for (const men of this.members) {
            if (men.role === C.ATTACK || men.role === C.RANGED_ATTACK) {
                x += men.x;
                y += men.y;
                c++;
            }
        }
        if (c === 0) {
            return undefined;
        }
        return { x: Math.round(x / c), y: Math.round(y / c) }
    }
}

