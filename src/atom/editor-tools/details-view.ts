/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import SC=require("../util/ScrollViewUI")
import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import hl=require("raml-1-parser")
import details2=require("./details2")
import details=require("./details")
import schemaUI=require("./schemaUI")
import editorTools=require("./editor-tools")
import dialogs=require("../dialogs/dialogs")
import fs=require("fs")
import atom = require('../core/atomWrapper');
import _=require("underscore")
import pair = require("../../util/pair");

import universeHelpers = hl.universeHelpers;

export class RamlDetails extends SC.Scrollable {

    constructor(private allowStructureChanges: boolean = true) {
        super();
        (<any>this).addClass('raml-details');

    }

    getTitle() {
        return "Details";
    }

    disposables = new CompositeDisposable();

    _isAttached: boolean;

    private _node:hl.IHighLevelNode;

    container: UI.Panel;
    attached(){
        try {
            this.element.innerHTML="<div></div>";
            this._children=[];
            this.container = UI.vc();
            this.addChild(this.container);
            this.ui().appendChild(this.container.ui());
            super.attached();
        } catch (e){

        }
    }

    wasSchema:boolean;

    private setSchema(node:hl.IHighLevelNode) {
        if (this.wasSchema){
            this.schemaView.dispose();
            this.schemaView=null;
        }
        var key = node.attr("key"),
            value = node.attr("value");

        var ssto = 12;

        if (value == null) {
            this.container.clear();
            var errLabel = UI.h3("Selected schema has incorrect node so cannot be displayed.");
            UI.applyStyling(UI.TextClasses.WARNING, errLabel);
            errLabel.setStyle("text-align", "center").margin(0, 0, 24, 12);
            this.container.addChild(errLabel);
            return;
        }
        //FIXME
        setInterval(()=>{
            if (ssto++ != 12) return;
            if (value) {
                value.setValue(schemaText);
                schemaUI._updatePreview(treeView, schemaText);
            }
        }, 100);

        var schemaText = value.value();

        this.container.clear();

        var textView = dialogs.smallEditor((e,v)=>{
            if (value.lowLevel().includePath()){
                try {
                    var sm = path.dirname(node.lowLevel().unit().absolutePath());
                    var relative = path.resolve(sm, value.lowLevel().includePath());
                    if (!value.lowLevel().includeReference()) {
                        fs.writeFileSync(relative, v);
                    }
                } catch (e){
                    console.log(e);
                }
            }
            // if (v!=schemaText) textView.setText(schemaText); // read-only variant
            schemaText = v;
            ssto = 0;
        });
        dialogs._updateEditor(textView, schemaText);

        var treeView = schemaUI._schemaPreview();
        schemaUI._updatePreview(treeView, schemaText);

        var schemaTab = new UI.TabFolder();
        schemaTab.add("Tree view", UI.Icon.GIT_MERGE, treeView);
        schemaTab.add("Text view", UI.Icon.FILE_TEXT, textView);
        this.container.addChild(schemaTab);

        window['detailsnode'] = node;
        if (details.oldItem){
            details.oldItem.detach();
            details.oldItem=null;
        }
        this.schemaView=textView;
        this.wasSchema=true;
    }
    schemaView:UI.BasicComponent<any>;


    private setResource(node: hl.IParseResult) {
        if (this.wasSchema){
            this.schemaView.dispose();
            this.schemaView=null;
        }
        this.wasSchema=false;
        var hnode = <hl.IHighLevelNode> node;
        window["detailsnode"] = hnode;
        if (hnode == null || hnode.lowLevel() == null) this.displayEmpty();
        console.log("Displaying details for node " + hnode.name());
        details.updateDetailsPanel(hnode, this.container, true);
    }

    update() {
        if(window["detailsnode"]) {
            this.setResource(window["detailsnode"]);
        }
    }

    displayEmpty() {
        this.container.clear();
        if (!editorTools.aquireManager().ast) {
            this.container.addChild(UI.h3("Our API is fabulously empty").margin(8, 8, 20, 8));
            var create = new UI.Button("Create new API", UI.ButtonSizes.LARGE, UI.ButtonHighlights.SUCCESS, UI.Icon.REPO_CLONE, ()=>dialogs.newApi());
            create.margin(8, 8, 20, 0);
            this.container.addChild(create);
        }
    }
    destroy (): void {
        editorTools.aquireManager()._details=null;
        this.disposables.dispose();
        this._node=null;
        this.container.dispose();
        this.container=null;
        window["detailsnode"]=null;
        this._children=[];
        if (details.oldItem){
            details.oldItem.detach();
        }
        if (this.wasSchema){
            this.schemaView.dispose();
            this.schemaView=null;
        }
        details.oldItem=null;
    }

    show(node:hl.IHighLevelNode, force: boolean = false) {
        if (!force && this._node === node) return;
        this._node = node;
        try {
            if (isSchema(node))
                this.setSchema(this._node);
            else
                this.setResource(node);
        } catch (e) {}
    }
}

function isSchema(p: hl.IHighLevelNode) {
    if (!p){
        return false;
    }
    return universeHelpers.isGlobalSchemaType(p.definition());
}
