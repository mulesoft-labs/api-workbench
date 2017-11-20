import libUIModule = require("atom-ui-lib")

declare let UI: any;
declare let IDE: any;
declare let UIBuilder: any;

export function run(initialState): Promise<any> {
    if(initialState.isParentNull) {
        return Promise.resolve({
            canceled: true
        });
    }
    
    var changes: any = {};

    var item = UIBuilder.buildItem(initialState.detailsTree, {
        uri: "localchanges",
        position: -1,
        reconciler: {
            schedule: runnable => runnable.run()
        },
        localModel: changes
    });

    item.setTitle(initialState.title);

    var panel = item.render({
        showDescription: true
    });

    panel.margin(8, 8, 8, 8);

    return new Promise((resolve) => {
        UI.simpleModalDialog(panel, () => {
            resolve(changes);

            return true;
        }, () => {
            resolve({
                canceled: true
            });

            return true;
        });
    });
}