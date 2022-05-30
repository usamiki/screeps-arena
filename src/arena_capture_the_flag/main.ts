import { utils } from 'game';
import { TOWER_RANGE } from 'game/constants';
import { enemyFlag } from './arenaMap.mjs'
import * as arenaData from './arenaData.mjs'
import * as visualManager from './visualManager.mjs'
import * as arenaMap from './arenaMap.mjs';
import * as organizer from './organizer.mjs'
import { strategy } from './strategy.mjs';
import { myTowers, myCreeps, enemyCreeps } from './arenaData.mjs';

//指揮系統を作る
//Strategy -> Party -> Soldier

export const loop = () => {
    visualManager.clear();

    if (utils.getTicks() == 1) {
        onStart();
    } else {
        arenaData.update();
    }

    strategy.update();

    for (const tower of myTowers) {
        for (const creep of myCreeps) {
            if (creep.hits < creep.hitsMax && tower.getRangeTo(creep) <= TOWER_RANGE) {
                tower.heal(creep);
            }
        }
        for (const enemy of enemyCreeps) {
            if (tower.getRangeTo(enemy) <= TOWER_RANGE) {
                tower.attack(enemy);
            }
        }
    }


    for (const partyName in organizer.partyGrp) {
        organizer.partyGrp[partyName].update();
    }

}

const onStart = () => {
    arenaMap.onStart();
    arenaData.onStart();
    organizer.organizeParty();

    console.log('\n mission target: ID.' + enemyFlag.id +
        '(' + enemyFlag.x + ',' + enemyFlag.y + ')');
}

