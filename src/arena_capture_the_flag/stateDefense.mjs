import { ORDER } from './soldier.mjs';

export const PARTY_STATE_DEFENSE = 'DEFENSE';

//定点（自軍フラッグ）を防衛
export class StateDefense {
    constructor(self) {
        this.self = self;
        this.name = PARTY_STATE_DEFENSE;
    }

    update() {
        const pt = this.self;
        //目標地点を全CREEPの目的地に設定する
        for (const men of pt.members) {
            men.order = ORDER.FOLLOW;
            men.setDestination(pt.destination);
        }
    }

}
