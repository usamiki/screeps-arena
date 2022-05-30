import * as utils from 'game/utils';
import { enemyCreeps } from './arenaData.mjs'
import { ORDER } from './soldier.mjs';

export const PARTY_STATE_AGGRESSION = 'AGGRESSION';

export class StateAggression {
    constructor(pt) {
        this.pt = pt;
        this.name = PARTY_STATE_AGGRESSION;
    }

    update() {
        //PTの目的地から離れない限り戦闘優先
        const pt = this.pt;
        const point = pt.getAverageAttackerPoint();
        if (point) {
            pt.focus = utils.findClosestByRange(point, enemyCreeps);
        }
        for (const men of pt.members) {
            if (utils.getRange(men, pt.destination) < 15) {
                men.order = ORDER.FIGHT;
            } else {
                men.order = ORDER.FOLLOW;
            }
            men.setDestination(pt.destination);
        }
    }
}