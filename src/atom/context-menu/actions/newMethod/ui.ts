
import libUIModule = require("atom-ui-lib")

/**
 * ui-libs instance
 */
declare let UI : typeof libUIModule

/**
 * IDE UI instance
 */
declare let IDE: any;

/**
 * Input UI state.
 */
export interface INewMethodInputUIState {

    /**
     * Map from method name to method description.
     */
    methodDescriptions: {[methodName: string] : string};

    /**
     * Map from status code name to code description.
     */
    statusCodeDescriptions: {[statusCodeName: string] : string};

    typeValues: {isSchema: boolean, types: string[]}
}

/**
 * Output UI state.
 */
export interface INewMethodOutputUIState {
    method: string;
    realBodyType: string
    code: string;
    bodyTypeString: string;
    bodyType: string;
    actualType: string;
    isSchema: string;
}

var _dialogPanels: libUIModule.Panel[] = [];
var mdp = null;

function _dialog(panel: libUIModule.Panel, onDone: () => boolean, toFocus?: libUIModule.UIComponent, stretch: boolean = false) {
    return _dialog2(panel, [
        { name: "Ok",   isPrimary:true,    highlight: UI.ButtonHighlights.PRIMARY,         action: onDone },
        { name: "Cancel",   highlight: UI.ButtonHighlights.NO_HIGHLIGHT,    action: ()=>true }
    ], toFocus, stretch);
}

function _dialog2(panel: libUIModule.Panel, actions: { name: string; isPrimary?:boolean;highlight: libUIModule.ButtonHighlights; action: () => boolean}[], toFocus?: libUIModule.UIComponent, stretch: boolean = false) {
    var buttonBar = UI.hc().setPercentWidth(100);

    actions.reverse().forEach(a => {
        var button = UI.button(a.name, UI.ButtonSizes.NORMAL, a.highlight, UI.Icon.NONE, x=> { if (a.action()) _closeDialog(); });
        if (a.isPrimary){
            var st=panel.getBinding().status();
            if (st) {
                if (st.code == UI.StatusCode.ERROR) {
                    button.setDisabled(true);
                }
            }
            panel.getBinding().addStatusListener((x)=>{
                var st = panel.getBinding().status();
                if (st) {
                    if (st.code != UI.StatusCode.ERROR) {
                        button.setDisabled(false);
                    }
                    else {
                        button.setDisabled(true);
                    }
                }
            })
        }
        button.setStyle("float", "right")
            .margin(4,10);

        buttonBar.addChild(button);
    });

    panel.addChild(buttonBar);

    var ui = panel.ui();

    return (e) => {
        _dialogPanels.push(panel);

        var eventListener = () => {
            if(!stretch) {
                return;
            }

            var parent = ui.parentElement;

            var height = document.body.clientHeight;

            if(!parent) {
                return;
            }

            var style = window.getComputedStyle(parent);

            ["paddingBottom", "paddingTop", "marginBottom", "marginTop"].forEach(property => {
                height -= parseFloat(style[property] || 0);
            });

            ui.style.height = height + "px";
            ui.style.overflowY = "scroll";
        }

        window.addEventListener('resize', eventListener);

        mdp = (<any>IDE).workspace.addModalPanel({ item: ui});

        mdp.onDidDestroy(() => {
            window.removeEventListener('resize', eventListener);
        });

        eventListener();

        if (toFocus) toFocus.ui().focus();
    };
}

function _closeDialog() {
    _dialogPanels.pop();
    if (_dialogPanels.length == 0)
        mdp.destroy();
    else
        mdp = IDE.workspace.addModalPanel({item: _dialogPanels[_dialogPanels.length -1].ui() });
}

export function newMethod(inputState: INewMethodInputUIState, method?: string) {

    var mdesc = inputState.methodDescriptions
    var cdesc = inputState.statusCodeDescriptions;


    var NO_RESPONCE = "No response";
    var NO_RESPONCE_BT = "No response body type";
    var code = null, bodyType = null;
    if (method == null) method = "get";


    var mdescLabel = new UI.LabelField();
    var cdescLabel = new UI.LabelField();

    [mdescLabel, cdescLabel].forEach(x=>x.addClass('wizard-description'));

    mdescLabel.getActualField().margin(0, 0, 18, 8);
    cdescLabel.getActualField().margin(0, 0, 8, 8);


    var methodSelect = new UI.SelectField("Method:", (e, v) => {
        method = v
        mdescLabel.setText(`Method ${v} ${mdesc[v]}`);
    }, null);
    methodSelect.getActualField().setOptions(Object.keys(mdesc));
    methodSelect.getActualField().setValue(method, true);

    var responseSelect = new UI.SelectField("Status code:", (e, v) => {
        if (v == NO_RESPONCE) {
            v = null;
            responseTypeSelect.getActualField().setValue(NO_RESPONCE_BT);
        }
        code = v;
        responseTypeSelect.setDisabled(v == null);
        cdescLabel.setText(v ? `Status code ${v} ${cdesc[v]}` : '');
    }, null);
    responseSelect.getActualField().setOptions([NO_RESPONCE].concat(Object.keys(cdesc)));

    var responseTypeSelect = new UI.SelectField("Generate default response with media type:", (e, v) => {
        if (v == NO_RESPONCE_BT) {
            v = null;
            typeOfValue.setDisabled(true)
        }
        else typeOfValue.setDisabled(false)
        bodyType = v;
    }, null);
    responseTypeSelect.getActualField().setOptions([NO_RESPONCE_BT, "application/json", "application/xml", "application/x-www-form-urlencoded"]);
    responseTypeSelect.setDisabled(true);
    responseTypeSelect.margin(0, 0, 0, 12);


    var realBodyType=null
    var bodyTypeSelect = new UI.SelectField("Generate default body with media type:", (e, v) => {
        if (v == NO_RESPONCE_BT) {
            v = null;
            bodyTypeOfValue.setDisabled(true)
        }
        else bodyTypeOfValue.setDisabled(false)
        realBodyType = v;
    }, null);
    bodyTypeSelect.getActualField().setOptions([NO_RESPONCE_BT, "application/json", "application/xml", "application/x-www-form-urlencoded"]);
    bodyTypeSelect.margin(0, 0, 0, 12);

    var actualType:string = null;
    var bodyTypeString: string=null;
    var typeOfValue = new UI.SelectField("Generate default response body with type:", (e, v) => {
        if (v == NO_RESPONCE_BT) v = null;
        actualType = v;
    }, null);
    typeOfValue.setDisabled(true);
    typeOfValue.margin(0, 0, 0, 12);
    var __ret= inputState.typeValues;
    var isSchema = __ret.isSchema;
    var types = __ret.types;
    if (types) {
        types = [""].concat(types);
        typeOfValue.getActualField().setOptions(types);
    }
    var bodyTypeOfValue = new UI.SelectField("Generate default body with type:", (e, v) => {
        if (v == NO_RESPONCE_BT) v = null;
        bodyTypeString = v;
    }, null);
    bodyTypeOfValue.setDisabled(true);
    bodyTypeOfValue.margin(0, 0, 0, 12);
    var isSchema = __ret.isSchema;
    var types = __ret.types;
    if (types) {
        types = [""].concat(types);
        bodyTypeOfValue.getActualField().setOptions(types);
    }
    var responseSection = UI.section("");
    responseSection.addChild(UI.h3("Body"))
    responseSection.addChild(bodyTypeSelect);
    responseSection.addChild(bodyTypeOfValue)
    responseSection.addChild(UI.h3("Response"))
    responseSection.addChild(responseSelect);
    responseSection.addChild(cdescLabel);
    responseSection.addChild(responseTypeSelect);
    responseSection.addChild(typeOfValue);
    responseSection.ui();
    var panel = UI.section("Creating a new method", UI.Icon.CODE, false, false,
        methodSelect, mdescLabel, responseSection
    );


    var __ret = inputState.typeValues;

    //panel.addChild(typeOfValue)

    var savedResolve;
    var savedReject;

    const resultPromise = new Promise((resolve: (value?: INewMethodOutputUIState) => void,
                                      reject: (error?: any) => void) => {

        savedResolve = resolve;
        savedReject = reject;
    });

    _dialog(panel, ()=> {
        savedResolve({
            method: method,
            realBodyType: realBodyType,
            code: code,
            bodyTypeString: bodyTypeString,
            bodyType: bodyType,
            actualType: actualType,
            isSchema: isSchema
        })

        return true;
    })(this);

    return resultPromise;
}

export function run(inputState: INewMethodInputUIState) : Promise<any> {
    return newMethod(inputState);
}