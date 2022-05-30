import { ORDER } from './soldier.mjs';
import * as pathFinder from 'game/path-finder'
import { Bounds } from './myUtils.mjs';
import { infoLine } from './visualManager.mjs';
export const PARTY_STATE_MARCH = 'MARCH';

//固まって移動
export class StateMarch {
    constructor(pt) {
        this.pt = pt;
        this.name = PARTY_STATE_MARCH;
        this.REGULARITY_BEST = 7;
        this.wayPoints = [];
    }

    update() {
        const pt = this.pt;

        //wayPointsに終点の設定、再設定
        let end = this.wayPoints[this.wayPoints.length - 1];
        if (!end || end.x !== pt.destination.x || end.y !== pt.destination.y) {
            if (!pt.destination) {
                console.log('[ERROR]stateMarch.update pt.destination');
            }
            this.wayPoints = [pt.destination];

            //wayPointsに中間点の設定
            end = this.wayPoints[this.wayPoints.length - 1];
            const result = pathFinder.searchPath(pt.members[0], pt.destination);
            const middlePoints = [];
            for (let wayLength = 20; wayLength < result.path.length; wayLength += 20) {
                middlePoints.push(result.path[wayLength - 1]);
            }
            this.wayPoints.unshift(...middlePoints);
        }

        //wayPointsの到着を評価
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
