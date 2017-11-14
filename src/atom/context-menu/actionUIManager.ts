import completeBodyUI = require("./actions/completeBody/ui")
import newMethodUI = require("./actions/newMethod/ui")

import simpleActionUi = require("./actions/simpleAction/ui")

interface ActionUI {
    run(initialState?: any): Promise<any>;
}

export function getUICode(actionID: string): ActionUI {
    if(actionID == "completeBody") {
        return completeBodyUI;
    }

    if(actionID == "newMethod") {
        return newMethodUI;
    }

    if(actionID == "Create new Response") {
        return simpleActionUi;
    }

    if(actionID == "Create new URI Parameter") {
        return simpleActionUi;
    }

    if(actionID == "Create new Query Parameter") {
        return simpleActionUi;
    }

    if(actionID == "Create new Header") {
        return simpleActionUi;
    }

    if(actionID == "Create new Response Header") {
        return simpleActionUi;
    }

    if(actionID == "Create new Response Body") {
        return simpleActionUi;
    }

    if(actionID == "Create new Property") {
        return simpleActionUi;
    }

    if(actionID == "Create new Body") {
        return simpleActionUi;
    }

    return null;
}