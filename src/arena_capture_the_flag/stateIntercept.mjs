import { ORDER } from './soldier.mjs';

export const PARTY_STATE_INTERCEPT = 'INTERCEPT';

export class StateIntercept {
    constructor(pt, placement) {
        this.pt = pt;
        this.name = PARTY_STATE_INTERCEPT;
        this.placement = placement; //e.g. [{ assign: 1, role: C.ATTACK, x: 0, y: 0 }]
    }

    update() {
        const pt = this.pt;
        //持ち場を割り当てそれぞれの目的地に設定する
        for (const men of pt.members) {
            let point = this.placement.find(p => p.assign === men.id);
            if (!point) {
                point = this.placement.find(p => !p.assign && p.role === men.role);
                point.assign = men.id;
            }
            men.setDestination(point);
            men.order = ORDER.FOLLOW;
        }
    }
}