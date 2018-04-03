/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import contextActions = require("raml-actions")
import parser2 = require("raml-1-parser")
import rp = contextActions.parser
import lowLevel=rp.ll;
import hl=rp.hl;
import hl2=parser2.hl;
import search=rp.search;
import stubs=rp.stubs;
import universeHelpers = rp.universeHelpers;
import su=rp.schema;
import wrapper = rp.api10;
import apiModifier = rp.parser.modify;
import _=require("underscore")
import UI=require("atom-ui-lib")
import xmlutil=require("../../util/xmlutil")
import extract=require("../dialogs/extractElementsDialog")
import shemagen=require("../../util/schemaGenerator")
import SpacePenViews = require('atom-space-pen-views')
import def=rp.ds
import move=require("../dialogs/moveElementsDialog")
import tooltip=require("../core/tooltip-manager")
import commonContextActions = require("./commonContextActions")
import assistUtils = require("../dialogs/assist-utils")
import textutil = require("../../util/textutil")
import editorTools=require("../editor-tools/editor-tools")

export class MoveToNewFileDialog {

    constructor(private callback : (destination:string)=>void) {

    }

    destination:string;

    show() {
        var zz:any = null;

        var vc = UI.section("Move node content to new file ", UI.Icon.GIST_NEW, false, false);
        var errorLabel = UI.label("Please enter destination file path", UI.Icon.BUG, UI.TextClasses.ERROR, UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(errorLabel));
        vc.addChild(UI.label("Please enter destination path"));

        var okButton = UI.button("Move", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
            zz.destroy();
            this.callback(this.destination);
        });
        
        var txt = UI.texfField("", "", x=> {
            if (!txt) {
                return;
            }

            var errorMessage = null;

            this.destination = txt.getBinding().get();
            if (this.destination.trim().length == 0) {
                errorMessage = "Please enter destination file path";
            }
            else if (!path.extname(this.destination) || path.extname(this.destination).trim().length <= 2) {
                errorMessage = "Please enter destination file extension";
            }
            else {
                var dir = path.resolve(path.dirname(assistUtils.getActiveEditor().getPath()), path.dirname(this.destination));
                if (!fs.existsSync(dir)) {
                    errorMessage = "Parent directory does not exist"
                }
                else {
                    var st = fs.statSync(dir)
                    if (!st.isDirectory()) {
                        errorMessage = "Parent path is not a directory"
                    }

                    if(!errorMessage) {
                        var canWrite = true;

                        try {
                            (<any>fs).accessSync(dir, (<any>fs).W_OK);
                        } catch(exception) {
                            canWrite = false;
                        }

                        if(!canWrite) {
                            errorMessage = "Can't write to specified directory, access denied. Please, check your permissions."
                        }
                    }
                }
            }

            if (errorMessage) {
                errorLabel.setDisplay(true);
                errorLabel.setText(errorMessage);
                okButton.setDisabled(true);
            } else {
                errorLabel.setDisplay(false);
                okButton.setDisabled(false);
            }

        });
        vc.addChild(UI.vc(txt));
        var buttonBar = UI.hc().setPercentWidth(100).setStyle("display", "flex");
        buttonBar.addChild(UI.label("", null, null, null).setStyle("flex", "1"))
        buttonBar.addChild(UI.button("Cancel", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.NO_HIGHLIGHT, UI.Icon.NONE, x=> {
            zz.destroy()
        }).margin(10, 10))
        
        okButton.setDisabled(true)
        buttonBar.addChild(okButton);
        vc.addChild(buttonBar)
        var html = vc.renderUI();
        zz = (<any>atom).workspace.addModalPanel({item: html});
        html.focus();
    }
}

class FillBodyDialog {

    protected name:string = ""

    constructor(private callback : (uiState:contextActions.uiActions.ICompleteBodyUIState)=>void,
                protected title:string = "Fill body") {

    }

    extraContent(s:UI.Section) {

    }

    needXML:boolean = true;
    needJSON:boolean = true;
    createButton:UI.Button;

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
            try {
                var so = su.getJSONSchema(this.jsschema, null);

            } catch (e) {
                this.createButton.setDisabled(true);
                this.em.setDisplay(true)
                this.em.setText("JSON schema is not correct");
                return;
            }
        }
        if (this.needXML) {
            try {
                xmlutil(this.xmlexample);
            } catch (e) {
                this.createButton.setDisabled(true);
                this.em.setDisplay(true)
                this.em.setText("XML example is not correct");
                return;
            }
            try {
                var so = su.getXMLSchema(this.xmlschema);

            } catch (e) {
                this.createButton.setDisabled(true);
                this.em.setDisplay(true)
                this.em.setText("XML schema is not correct");
                return;
            }
        }
        this.em.setDisplay(false);
        this.createButton.setDisabled(false);
    }

    em:UI.Label;

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
            var te = (<UI.AtomEditorElement><any>c.children()[1]);
            te.setText((<any>this)[(<UI.BasicComponent<any>>c).id()]);

        })
        section.addChild(tf);
        section.addChild(buttonBar);
        zz = (<any>atom).workspace.addModalPanel({item: section.renderUI()});
    }

    jsexample:string = '{\n "message":"Hello world"\n}'
    xmlexample:string = "";
    xmlschema:string = "";
    jsschema:string = "";

    private createTextSection(tf:UI.TabFolder, caption:string, lang:string, code:string) {
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
                    var rs = shemagen.generateSchema(this.jsexample, "application/json")
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
        if (code == 'xmlexample') {
            var b = UI.button("Generate JSON example", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
                try {
                    var rs = xmlutil(this.xmlexample)
                    this.jsexample = JSON.stringify(rs, null, 2);
                    tf.setSelectedIndex(0)
                }
                catch (e) {
                    this.jsexample = e.message;
                    tf.setSelectedIndex(0)
                }
            });
            hs.addChild(b.margin(5, 5, 5, 5));
        }
        tf.add(caption, null, hs);
    }


    protected onOk(zz) {
        var uiState : contextActions.uiActions.ICompleteBodyUIState = {
            name: this.name,
            needJSON: this.needJSON,
            needXML: this.needXML,
            jsexample: this.jsexample,
            xmlexample: this.xmlexample,
            jsschema: this.jsschema,
            xmlschema: this.xmlschema,
        }

        this.callback(uiState);
    }
}

export function register() {

    // contextActions.uiActions.registerMoveContentsAction((uiFinishedCallback : (destination:string)=>void)=>{
    //     new MoveToNewFileDialog(uiFinishedCallback).show()
    // });
    //
    // contextActions.uiActions.registerCompleteBodyAction(
    //     (uiFinishedCallback : (uiState:contextActions.uiActions.ICompleteBodyUIState)=>void)=>{
    //     new FillBodyDialog(uiFinishedCallback).show()
    // });
}