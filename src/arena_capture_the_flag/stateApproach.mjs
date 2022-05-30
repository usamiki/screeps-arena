import * as myUtils from './myUtils.mjs';
import { ORDER } from './soldier.mjs';

export const PARTY_STATE_APPROACH = 'APPROACH';

//定点へ攻勢
export class StateApproach {

    constructor(self) {
        this.self = self;
        this.name = PARTY_STATE_APPROACH;
    }

    update() {
        const pt = this.self;
        if (!this.isMet(pt)) {
            //集合優先
            for (const men of pt.members) {
                men.order = ORDER.FOLLOW;
                men.setDestination(pt.leader);
            }
        } else {
            //目標地点を全CREEPの目的地に設定する
            for (const men of pt.members) {
                men.order = ORDER.FOLLOW;
                men.setDestination(pt.destination);
            }
        }
    }

    isMet(pt) {
        let ok = 1;
        for (let i = 1; i < pt.members.length; i++) {
            if (myUtils.isAround(pt.members[i], pt.leader, 3)) {
                ok++;
            }
        }
        return ok / pt.members.length > 0.7;
    }
}
