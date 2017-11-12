
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
 * Output UI state.
 */
export interface ICompleteBodyOutputUIState {
    /**
     * Body name.
     */
    name : string,

    /**
     * Whether JSON content type needs to be generated
     */
    needJSON : boolean,

    /**
     * Whether XML content type needs to be generated
     */
    needXML : boolean,

    /**
     * JSON example contents
     */
    jsexample : string,

    /**
     * XML example contents
     */
    xmlexample : string,

    /**
     * JSON schema contents
     */
    jsschema : string,

    /**
     * XML schema contents
     */
    xmlschema : string
}

class JsonSchemaGenerator {

    generateSchema(obj:any):Object{

        var sch:Object = {}
        sch['required'] = true
        sch['$schema'] = 'http://json-schema.org/draft-03/schema'

        this.pass(obj, sch);
        return sch
    }

    private pass(value:any, property:Object){

        var valueType:string = this.detectType(value);
        property['type'] = valueType
        if (!value || value == null) {

        }
        else if (Array.isArray(value)) {
            this.passArray(value, property);
        }
        else if (value instanceof Object) {
            this.passObject(value, property);
        }
    }

    private passObject(obj:Object, sch:Object) {
        Object.keys(obj).forEach( x => this.registerProperty(x,obj[x],sch) )
    }

    private registerProperty(propName:string, value:any, sch:Object){

        var properties:Object = sch['properties']
        if(!properties){
            properties = {}
            sch['properties'] = properties
        }

        var property:Object = properties[propName]
        if(!property){
            property = {}
            properties[propName] = property
        }
        property['required'] = false
        this.pass(value, property);
    }

    private passArray(array:any[], property:Object){

        var items = property['items']
        if(!items){
            items = []
            property['items'] = items
        }

        var l:number = array.length;
        var itemSet = []
        array.forEach( value => {

            var item:Object = {}
            this.pass(value,item);
            itemSet.push(item)
        })
        items.push(itemSet[0])
    }

    private detectType(value:any):string {
        if(Array.isArray(value)) {
            return 'array'
        }
        return typeof value
    }
}
export function generateSchema(text:string,mediaType:string):string{
    var generator = new JsonSchemaGenerator()
    var obj = JSON.parse(text);
    var schemaObject = generator.generateSchema(obj)
    var schemaString = JSON.stringify(schemaObject,null,2)
    return schemaString
}

class FillBodyDialog {

    protected name:string = ""
    private resolve;
    private reject;
    private resultPromise;

    constructor(protected title:string = "Fill body") {
        this.resultPromise = new Promise((resolve: (value?: ICompleteBodyOutputUIState) => void,
                                          reject: (error?: any) => void) => {

            this.resolve = resolve;
            this.reject = reject;
        });
    }

    extraContent(s:libUIModule.Section) {

    }

    needXML:boolean = true;
    needJSON:boolean = true;
    createButton:libUIModule.Button;

    updateButtons() {
        if (!this.createButton) {
            return;
        }
        if (this.name.length == 0) {
            this.createButton.setDisabled(true);
            this.em.setDisplay(true)
            this.em.setText("Please type name of your payload");
            return;
        }
        if (this.needJSON) {
            try {
                JSON.parse(this.jsexample);
            } catch (e) {
                this.createButton.setDisabled(true);
                this.em.setDisplay(true)
                this.em.setText("JSON example is not correct");
                return;
            }
            // try {
            //     var so = su.getJSONSchema(this.jsschema, null);
            //
            // } catch (e) {
            //     this.createButton.setDisabled(true);
            //     this.em.setDisplay(true)
            //     this.em.setText("JSON schema is not correct");
            //     return;
            // }
        }
        if (this.needXML) {
            // try {
            //     xmlutil(this.xmlexample);
            // } catch (e) {
            //     this.createButton.setDisabled(true);
            //     this.em.setDisplay(true)
            //     this.em.setText("XML example is not correct");
            //     return;
            // }
            // try {
            //     var so = su.getXMLSchema(this.xmlschema);
            //
            // } catch (e) {
            //     this.createButton.setDisabled(true);
            //     this.em.setDisplay(true)
            //     this.em.setText("XML schema is not correct");
            //     return;
            // }
        }
        this.em.setDisplay(false);
        this.createButton.setDisabled(false);
    }

    em:libUIModule.Label;

    show() {
        var zz = null;
        this.em = UI.label("Please type name of your payload", UI.Icon.BUG, UI.TextClasses.ERROR, UI.HighLightClasses.NONE);
        var section = UI.section(this.title, UI.Icon.BOOK, false, false, this.em, UI.h3("Please type name for your payload")).pad(10, 10)
        section.addChild(UI.texfField("", this.name, x=> {
            this.name = x.getBinding().get();
            this.updateButtons();
        }))
        var r1 = UI.checkBox("Create XML body");
        r1.setValue(this.needXML);
        r1.getBinding().addListener(x=> {
            this.needXML = r1.getValue();
            this.updateButtons();
        });
        section.addChild(r1);
        var r2 = UI.checkBox("Create JSON body");
        r2.setValue(this.needJSON);
        r2.getBinding().addListener(x=> {
            this.needJSON = r2.getValue();
            this.updateButtons();
        });
        section.addChild(r2);

        var buttonBar = UI.hc().setPercentWidth(100).setStyle("display", "flex");
        buttonBar.addChild(UI.label("", null, null, null).setStyle("flex", "1"))
        buttonBar.addChild(UI.button("Cancel", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.NO_HIGHLIGHT, UI.Icon.NONE, x=> {
            zz.destroy()
        }).margin(10, 10))

        this.createButton = UI.button("Create", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
            this.onOk(zz);
            zz.destroy();
        });
        buttonBar.addChild(this.createButton)
        var tf = new UI.TabFolder();
        this.createButton.setDisabled(true)
        this.createTextSection(tf, "JSON Example", "source.json", "jsexample");
        this.createTextSection(tf, "JSON Schema", "source.json", "jsschema");
        this.createTextSection(tf, "XML Example", "text.xml", "xmlexample");
        this.createTextSection(tf, "XML Schema", "text.xml", "xmlschema");
        tf.setOnSelected(()=> {
            var c = tf.selectedComponent();
            var te = (<libUIModule.AtomEditorElement><any>c.children()[1]);
            te.setText((<any>this)[(<libUIModule.BasicComponent<any>>c).id()]);

        })
        section.addChild(tf);
        section.addChild(buttonBar);
        zz = (<any>IDE).workspace.addModalPanel({item: section.renderUI()});
    }

    jsexample:string = '{\n "message":"Hello world"\n}'
    xmlexample:string = "";
    xmlschema:string = "";
    jsschema:string = "";

    private createTextSection(tf:libUIModule.TabFolder, caption:string, lang:string, code:string) {
        var hs = UI.vc();
        hs.setCaption(caption)
        hs.setId(code)
        var ts = new UI.AtomEditorElement("", x=>x);
        ts.setMini(false);
        ts.getBinding().addListener(x=> {
            this[code] = ts.getValue();
            this.updateButtons()
        })
        //ts.setCaption(code)
        ts.setText("" + (<any>this)[code]);
        ts.setCaption(caption)
        ts.setGrammar(lang)
        ts.setStyle("height", "400px");
        ts.setStyle("border", "solid");
        ts.setStyle("border-width", "1px");
        hs.addChild(UI.h3("Please type your example here:"))

        hs.addChild(ts);
        if (code == 'jsexample') {
            var b = UI.button("Generate JSON schema", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
                try {
                    var rs = generateSchema(this.jsexample, "application/json")
                    this.jsschema = rs;
                    tf.setSelectedIndex(1)
                }
                catch (e) {
                    this.jsschema = e.message;
                    tf.setSelectedIndex(1)
                }
            });
            hs.addChild(b.margin(5, 5, 5, 5));
        }
        // if (code == 'xmlexample') {
        //     var b = UI.button("Generate JSON example", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
        //         try {
        //             var rs = xmlutil(this.xmlexample)
        //             this.jsexample = JSON.stringify(rs, null, 2);
        //             tf.setSelectedIndex(0)
        //         }
        //         catch (e) {
        //             this.jsexample = e.message;
        //             tf.setSelectedIndex(0)
        //         }
        //     });
        //     hs.addChild(b.margin(5, 5, 5, 5));
        // }
        tf.add(caption, null, hs);
    }

    protected onOk(zz) {
        this.resolve({
            name: this.name,
            needJSON: this.needJSON,
            needXML: this.needXML,
            jsexample: this.jsexample,
            xmlexample: this.xmlexample,
            jsschema: this.jsschema,
            xmlschema: this.xmlschema,
        });
    }

    public getResult() : Promise<ICompleteBodyOutputUIState> {
        return this.resultPromise;
    }
}
export function run() : Promise<any> {
    let dialog = new FillBodyDialog();
    dialog.show();

    return dialog.getResult();
}
