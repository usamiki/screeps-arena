import { Visual } from 'game/visual';

export const errorText = new Visual(99, true);
export const verboseText = new Visual(40, true);
export const infoLine = new Visual(20, true);
export const verboseLine = new Visual(10, true);
export const verboseSticky = new Visual(10, true);

export const clear = () => {
    errorText.clear();
    verboseText.clear();
    infoLine.clear();
    verboseLine.clear();
}

