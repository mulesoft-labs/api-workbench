import completeBodyUI = require("./actions/completeBody/ui")

interface ActionUI {
    run() : Promise<any>;
}

export function getUICode(actionID: string): ActionUI {
    if (actionID == "completeBody") {
        return completeBodyUI;
    }

    return null;
}