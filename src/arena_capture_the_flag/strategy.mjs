import { partyGrp } from './organizer.mjs';
import * as arenaData from './arenaData.mjs';
import * as utils from 'game/utils';
import { isBoardReversal, namedPoints, namedBounds, openedPoints } from './arenaMap.mjs';
import { Bounds, Rect, Triangle } from './myUtils.mjs';

const POWER_ADVANTAGE = 'POWER_ADVANTAGE';
const POWER_DISADVANTAGE = 'POWER_DISADVANTAGE';
const NO_EFFORT_CONFIRMED = 'NO_EFFORT_CONFIRMED';
const ALERT_DEFENSE_LINE = 'ALERT_DEFENSE_LINE';
const INFERIOR = 'INFERIOR';
const ENEMY_ATTEMPTING_ONE_POINT_BREAKTHROUGH = 'ENEMY_ATTEMPTING_ONE_POINT_BREAKTHROUGH';
const MOVING = 'MOVING';
const ALL_MEN_ARE_AT_HOME = 'ALL_MEN_ARE_AT_HOME';

const isMySideOfCenterLine = isBoardReversal
    ? c => c.x + c.y > 99
    : c => c.x + c.y < 99;

class TwoBridgePositions {
    entry() {
        for (const ptName in partyGrp) {
            if (ptName === 'ptL') {
                partyGrp[ptName].orderDeploy('left_bridge_start');//既定のwaypoint名を指定。オプションでrushを指定など。
            } else if (ptName === 'ptR') {
                partyGrp[ptName].orderDeploy('right_bridge_start');
            }
        }
        this.startTick = utils.getTicks();
    }

    checkEvents() {
        const events = [];
        //防御線の検出
        const leftBattleArea = new Bounds(namedPoints.left_bridge_start, { x: 10, y: 10 });
        const rightBattleArea = new Bounds(namedPoints.right_bridge_start, { x: 10, y: 10 });
        leftBattleArea.visualize();
        rightBattleArea.visualize();
        if (
            arenaData.isFrontlineBroken(leftBattleArea)
            || arenaData.isFrontlineBroken(rightBattleArea)
        ) {
            events.push({ name: ALERT_DEFENSE_LINE });
        }

        //敵の一点突破態勢の検出
        //判定に使う範囲
        //＼３｜２／
        //４＼｜／１
        //－－－－－
        //５／｜＼８
        //／６｜７＼
        //第1象限の右下側
        const octant1th = new Triangle({ x: 99, y: 0 }, { x: 50, y: 49 }, { x: 99, y: 49 });
        //第3象限の右下側
        const octant6th = new Triangle({ x: 0, y: 99 }, { x: 49, y: 50 }, { x: 49, y: 99 });
        //第1象限の左上側
        const octant2th = new Triangle({ x: 99, y: 0 }, { x: 50, y: 49 }, { x: 50, y: 0 });
        //第3象限の左上側
        const octant5th = new Triangle({ x: 0, y: 99 }, { x: 49, y: 50 }, { x: 0, y: 50 });

        const enemyLeftWingArea = isBoardReversal ? octant2th : octant6th;
        const enemyRightWingArea = isBoardReversal ? octant5th : octant1th;
        enemyLeftWingArea.visualize();
        enemyRightWingArea.visualize();
        let right = 0, left = 0;
        for (const creep of arenaData.enemyCreeps) {
            if (enemyLeftWingArea.contains(creep)) {
                left++;
            } else if (enemyRightWingArea.contains(creep)) {
                right++;
            }
        }
        if (Math.max(left, right) >= 12) {
            if (arenaData.enemyCreeps.some(isMySideOfCenterLine)) {
                events.push({ name: ENEMY_ATTEMPTING_ONE_POINT_BREAKTHROUGH });
            }
        }

        //動きなしの検出
        //200tick経過後、記録している過去(5tick)の戦力比が変わっていない
        if (utils.getTicks() - this.startTick > 200) {
            if (arenaData.forceRatio.every(r => r === arenaData.forceRatio[0])) {
                events.push({ name: NO_EFFORT_CONFIRMED });
            }
        }
        return events;
    }

    update() { }

    exit() { }
}

class AttackPosition {
    entry() {
        const meetingPoint = utils.findClosestByRange(
            isBoardReversal ? { x: 45, y: 45 } : { x: 54, y: 54 },
            openedPoints.filter(p => !isMySideOfCenterLine(p)))
        for (const ptName in partyGrp) {
            partyGrp[ptName].orderDeploy(meetingPoint);
        }
        this.startTick = utils.getTicks();
    }

    checkEvents() {
        const events = [];
        //防御線の検出
        if (arenaData.enemyCreeps.some(c => !namedBounds.enemy_territory.contains(c))) {
            events.push({ name: ALERT_DEFENSE_LINE })
        }
        if (Object.values(partyGrp).some(pt => pt.isMoving())) {
            events.push({ name: MOVING });
        }

        return events;
    }

    update() { }

    exit() { }
}


class DefensePosition {
    entry() {
        for (const ptName in partyGrp) {
            partyGrp[ptName].orderDefense();
        }
    }

    checkEvents() {
        const events = [];
        //防御線の検出
        namedBounds.my_territory.visualize();
        if (arenaData.enemyCreeps.some(c => namedBounds.my_territory.contains(c))) {
            events.push({ name: ALERT_DEFENSE_LINE });
        }

        if (arenaData.myCreeps.every(c => namedBounds.my_home_base.contains(c))) {
            events.push({ name: ALL_MEN_ARE_AT_HOME })
        }

        return events;
    }

    update() { }

    exit() { }

}


class EnsuringSafety {
    entry() {
        for (const ptName in partyGrp) {
            partyGrp[ptName].orderBattle(namedBounds.my_side, 'flag');
        }
    }

    checkEvents() {
        const events = [];
        if (arenaData.enemyCreeps.some(c => isMySideOfCenterLine(c))) {
            events.push({ name: ALERT_DEFENSE_LINE });
        }
        return events;
    }

    update() { }

    exit() { }
}


class ManeuverAttack {
    entry() {
        for (const ptName in partyGrp) {
            partyGrp[ptName].orderBattle(namedBounds.enemy_side_except_territory);
        }
    }

    checkEvents() {
        const events = [];
        //防御線の検出
        if (arenaData.enemyCreeps.some(c => !namedBounds.enemy_territory.contains(c))) {
            events.push({ name: ALERT_DEFENSE_LINE })
        }
        return events;
    }

    update() { }

    exit() { }

}

class AttackEnemyBase {
    entry() {
        for (const ptName in partyGrp) {
            partyGrp[ptName].orderFlagApproach();
        }
    }

    checkEvents() {
        const events = [];
        return events;
    }

    update() { }

    exit() { }
}


//or条件は複数のレコードで, and条件はconditionEvery配列で表現する. or,andの組み合わせは不可. 
const strategyStateTransitionTable =
    [
        {
            from: null, to: TwoBridgePositions,
            conditionEvery: [],
            conditionNone: []
        },//conditionはeventの配列
        {
            from: TwoBridgePositions, to: DefensePosition,
            conditionEvery: [{ name: ALERT_DEFENSE_LINE }],
            conditionNone: []
        },
        {
            from: TwoBridgePositions, to: DefensePosition,
            conditionEvery: [{ name: INFERIOR }],
            conditionNone: []
        },
        {
            from: TwoBridgePositions, to: DefensePosition,
            conditionEvery: [{ name: ENEMY_ATTEMPTING_ONE_POINT_BREAKTHROUGH }],
            conditionNone: []
        },
        {
            from: TwoBridgePositions, to: AttackPosition,
            conditionEvery: [{ name: NO_EFFORT_CONFIRMED }, { name: POWER_ADVANTAGE }],
            conditionNone: []
        },
        {
            from: DefensePosition, to: EnsuringSafety,
            conditionEvery: [{ name: ALL_MEN_ARE_AT_HOME }],
            conditionNone: [{ name: ALERT_DEFENSE_LINE }, { name: POWER_DISADVANTAGE }]
        },
        {
            from: EnsuringSafety, to: AttackPosition,
            conditionEvery: [],
            conditionNone: [{ name: ALERT_DEFENSE_LINE }]
        },
        {
            from: EnsuringSafety, to: DefensePosition,
            conditionEvery: [{ name: POWER_DISADVANTAGE }],
            conditionNone: []
        },
        {
            from: AttackPosition, to: DefensePosition,
            conditionEvery: [{ name: POWER_DISADVANTAGE }],
            conditionNone: []
        },
        {
            from: AttackPosition, to: ManeuverAttack,
            conditionEvery: [{ name: ALERT_DEFENSE_LINE }],
            //conditionNone: []
            conditionNone: [{ name: MOVING }]//いったん防御線を緩めに設定するので移動中かどうかは考慮無し?
        },
        {
            from: AttackPosition, to: AttackEnemyBase,
            conditionEvery: [{ name: POWER_ADVANTAGE }],
            conditionNone: [{ name: MOVING }]
        },
        {
            from: ManeuverAttack, to: AttackPosition,
            conditionEvery: [],
            conditionNone: [{ name: ALERT_DEFENSE_LINE }]
        }
    ];

const checkCommonEvents = () => {
    const events = [];
    if (arenaData.forceRatio[0] < -0.1) {
        events.push({ name: POWER_DISADVANTAGE });//eventはnameが必須. オプションで修飾. 修飾はプリミティブ限定.
    } else if (arenaData.forceRatio[0] > 0.1) {
        events.push({ name: POWER_ADVANTAGE });
    }

    //継続的に削られている状況で不利判定
    if (arenaData.forceRatio[0] < arenaData.forceRatio[1]
        && arenaData.forceRatio[1] < arenaData.forceRatio[2]
        && arenaData.forceRatio[2] < arenaData.forceRatio[3]
    ) {
        events.push({ name: INFERIOR });
    }
    return events;
};

//conditionのすべてのプロパティがchallengerのプロパティに一致する
const satisfies = (condition, challenger) => {
    for (const prop in condition) {
        if (condition[prop] !== challenger[prop]) {
            if (prop !== 'name') {
                console.log(`[DEBUG] ${condition.name} - ${prop} is not same.`);
            }
            return false;
        }
    }
    return true;
}

export const strategy = {
    state: //initial dummy state
    {
        constructor: null,
        checkEvents: function () { return [] },
        update: function () { },
        exit: function () { }
    },

    update: function () {
        const events = checkCommonEvents();
        events.unshift(...this.state.checkEvents());
        this.tryTransition(events); //1tickにつき遷移は1回だけ
        this.state.update();
    },

    tryTransition: function (events) {
        console.log(`[INFO]events: ${events.map(e => e.name)}`);
        const transition = strategyStateTransitionTable.find(t =>
            t.from === this.state.constructor &&
            t.conditionEvery.every(cnd => events.some(ev => satisfies(cnd, ev))) &&
            !t.conditionNone.some(cnd => events.some(ev => satisfies(cnd, ev)))
        );
        if (transition) {
            console.log(`[INFO]state transition: ${this.state.constructor?.name} -> ${transition.to.name}`);
            this.state.exit();
            this.state = new transition.to(); //新しく状態インスタンスを作成
            this.state.entry();
        }
    },

}


