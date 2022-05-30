import { Soldier } from './soldier.mjs';
import { Party } from './party.mjs';
import { myCreeps } from './arenaData.mjs';
import { ATTACK, RANGED_ATTACK, HEAL } from 'game/constants';
import * as C from 'game/constants';

export const partyGrp = {};

const organize = {
    ptL: [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL],
    ptR: [ATTACK, ATTACK, HEAL, HEAL, HEAL, HEAL]
};


export const organizeParty = () => {
    const mySoldiers = myCreeps.map(i => new Soldier(i));

    for (const partyName in organize) {
        partyGrp[partyName] = new Party(partyName);
    }

    // パーティ編成
    const table = {};
    for (const partyName in partyGrp) {
        table[partyName] = organize[partyName].map(i => { return { role: i, assign: null }; });
    }
    for (const soldier of mySoldiers) {
        for (const partyName in partyGrp) {
            const emptyFrame = table[partyName].find(frame => frame.role == soldier.role && !frame.assign);
            if (emptyFrame) {
                emptyFrame.assign = soldier;
                soldier.join(partyGrp[partyName]);
                break;
            }
        }
    }
    //リーダー設定
    for (const partyName in partyGrp) {
        const party = partyGrp[partyName];
        if (party.leader.role !== C.ATTACK) {
            let leader = party.members.find(m => m.role === C.ATTACK);
            if (!leader) {
                leader = party.members.find(m => m.role === C.RANGED_ATTACK);
            }
            party.setLeader(leader);
        }
    }

    for (const partyName in partyGrp) {
        console.log(partyGrp[partyName].summarize());
    }

}