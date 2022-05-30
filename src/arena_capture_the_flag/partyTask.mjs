import { ORDER } from './soldier.mjs';
import * as pathFinder from 'game/path-finder'
import { Bounds } from './myUtils.mjs';
import { infoLine } from './visualManager.mjs';
import * as utils from 'game/utils';
import { enemyCreeps, myCreeps } from './arenaData.mjs'
import { myFlag } from './arenaMap.mjs';

//taskを階層化して合成すると柔軟になるかも
//移動はウェイポイントの配列であらわすより複数の移動タスクのsequenceとして表すなど

export class Idle {
    isCompleted() {
        return false
    }
    update() { }
}


//固まって移動する
export class March {
    constructor(pt) {
        this.pt = pt;
        this.REGULARITY_BEST = 7;
        this.wayPoints = [];
    }

    isCompleted() {
        return this.wayPoints.length == 1 && this.isWayPointReached();
    }

    update() {
        const pt = this.pt;

        //wayPointsの終点が目的地に一致しない場合、wayPointsを設定(その予定はないが、移動中に目的地の変更は可能)
        let end = this.wayPoints[this.wayPoints.length - 1];
        if (!end || end.x !== pt.destination.x || end.y !== pt.destination.y) {
            if (!pt.destination) {
                console.log('[ERROR]stateMarch.update pt.destination');
            }
            //wayPointsに終点の設定
            this.wayPoints = [end = pt.destination];

            //wayPointsに中間点の設定. PTの現在位置はリーダーの位置とする.
            const searchResult = pathFinder.searchPath(pt.members[0], end);
            const middlePoints = [];
            const WAY_LENGTH = 20;
            for (let len = WAY_LENGTH; len < searchResult.path.length; len += WAY_LENGTH) {
                middlePoints.push(searchResult.path[len - 1]);
            }
            this.wayPoints.unshift(...middlePoints);
        }

        //wayPointsの到着を評価. 最後のwayPointは移動完了後の処理を簡単にするので削除しない.
        if (this.wayPoints.length > 1 && this.isWayPointReached()) {
            this.wayPoints.shift();
        }

        //各メンバーに移動指示を設定
        for (const men of pt.members) {
            men.setDestination(this.wayPoints[0]);
            men.order = ORDER.FOLLOW;
        }

        //ルートの可視化
        const points = [pt.leader].concat(this.wayPoints);
        for (let i = 1; i < points.length; i++) {
            infoLine.line(points[i - 1], points[i]);
        }
    }

    isWayPointReached(range = 4, strictness = 0.7) {
        if (this.wayPoints.length === 0) {
            return true;
        }
        let ok = 0;
        const bound = new Bounds(this.wayPoints[0], { x: range, y: range });
        for (const men of this.pt.members) {
            if (bound.contains(men)) {
                ok++;
            }
        }
        return (ok / this.pt.members.length) > (strictness);
    }

}

//配置を維持する.
export class Deploy {
    constructor(pt) {
        this.pt = pt;
    }

    isCompleted() { return false; }

    update() {
        const pt = this.pt;
        if (pt.placement && pt.placement.length > 0) {
            //持ち場を割り当てそれぞれの目的地に設定する
            for (const men of pt.members) {
                let point = pt.placement.find(p => p.assign === men.id);//placement = e.g. [{ assign: 1, role: C.ATTACK, x: 0, y: 0 }]
                if (!point) {
                    point = pt.placement.find(p => !p.assign && p.role === men.role);
                }
                if (point) {
                    point.assign = men.id;
                    men.setDestination(point);
                    men.order = ORDER.FOLLOW;
                }
            }
        }
    }
}

//定点へ殺到する
export class Rush {

    constructor(pt) {
        this.pt = pt;
        this.wayPoints = [];
    }

    isCompleted() {
        return this.pt.members.some(m => m.x === this.pt.destination.x && m.y === this.pt.destination.y)
            && this.pt.isDestinationReached();
    }

    update() {
        const pt = this.pt;
        const WAY_LENGTH = 20;

        //wayPointsの終点が目的地に一致しない場合、wayPointsを設定
        let end = this.wayPoints[this.wayPoints.length - 1];
        if (!end || end.x !== pt.destination.x || end.y !== pt.destination.y) {
            if (!pt.destination) {
                console.log('[ERROR]stateMarch.update pt.destination');
            }
            //wayPointsに終点の設定
            this.wayPoints = [end = pt.destination];

            //wayPointsに中間点の設定. PTの現在位置はリーダーの位置とする.
            const searchResult = pathFinder.searchPath(pt.members[0], end);
            const middlePoints = [];
            for (let len = WAY_LENGTH; len < searchResult.path.length; len += WAY_LENGTH) {
                middlePoints.push(searchResult.path[len - 1]);
            }
            this.wayPoints.unshift(...middlePoints);
        }

        const points = this.wayPoints.reverse();
        //それぞれ目標地点に向かわせる.
        for (const men of pt.members) {
            men.order = ORDER.FOLLOW;
            let next = points.find(p => utils.getRange(men, p) <= WAY_LENGTH) ?? points[0];
            men.setDestination(next);
        }
    }
}

//サーチ&デストロイ
export class SearchAndDestroy {
    //PT, 索敵範囲, 優先ターゲット方法
    constructor(pt, bounds, targetingStyle) {
        this.pt = pt;
        this.bounds = bounds;
        this.targetingStyle = targetingStyle;
    }

    isCompleted() { return false; }

    update() {
        const pt = this.pt;
        const enemiesInRange = this.bounds ? enemyCreeps.filter(c => this.bounds.contains(c)) : enemyCreeps;
        let target;
        if (this.targetingStyle === 'flag') {
            let min = 99;
            for (const e of enemiesInRange) {
                const r = utils.getRange(e, myFlag);
                if (r < min) {
                    min = r;
                    target = e;
                }
            }
        } else {
            target = utils.findClosestByRange(pt.members[0], enemiesInRange);
        }
        if (target) {
            if (pt.isClustered) {
                for (const men of pt.members) {
                    men.setDestination(target);
                    men.order = ORDER.FIGHT;
                }
            } else {
                for (const men of pt.members) {
                    men.setDestination(pt.leader);
                    men.order = ORDER.FOLLOW;
                }
            }
        }
    }
}

//旗の防御
export class Defense {
    constructor(pt, bounds) {
        this.pt = pt;
        this.bounds = bounds;
        this.placements = [
            { assign: null, x: myFlag.x, y: myFlag.y },
            { assign: null, x: myFlag.x + 1, y: myFlag.y + 1 },
            { assign: null, x: myFlag.x + 1, y: myFlag.y },
            { assign: null, x: myFlag.x + 1, y: myFlag.y - 1 },
            { assign: null, x: myFlag.x, y: myFlag.y - 1 },
            { assign: null, x: myFlag.x - 1, y: myFlag.y - 1 },
            { assign: null, x: myFlag.x - 1, y: myFlag.y },
            { assign: null, x: myFlag.x - 1, y: myFlag.y + 1 },
            { assign: null, x: myFlag.x, y: myFlag.y + 1 },
        ]
    }

    isCompleted() { return false; }

    update() {
        const pt = this.pt;
        //旗の周囲に展開する
        const onFlag = myCreeps.find(m => m.x === myFlag.x && m.y === myFlag.y);
        for (const m of pt.members) {
            if (m) {
                if (m.creep !== onFlag) {
                    m.ORDER = ORDER.FIGHT;
                }
            } else {
                m.setDestination(myFlag);
                m.ORDER = ORDER.FOLLOW;
            }
        }
    }
}