import completeBodyUI = require("./actions/completeBody/ui")
import newMethodUI = require("./actions/newMethod/ui")
import newResponseUI = require("./actions/newResponse/ui")

interface ActionUI {
    run(initialState?: any): Promise<any>;
}

export function getUICode(actionID: string): ActionUI {
    if(actionID == "completeBody") {
        return completeBodyUI;
    }

    if(actionID == "Create new Response") {
        return newResponseUI;
    }

    if(actionID == "newMethod") {
        return newMethodUI;
    }
    
    return null;
}