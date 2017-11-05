/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import SC=require("../util/ScrollViewUI")
import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import details=require("./details")
import schemaUI=require("./schemaUI")
import editorTools=require("./editor-tools")
import dialogs=require("../dialogs/dialogs")
import fs=require("fs")
import atom = require('../core/atomWrapper');
import _=require("underscore")
import pair = require("../../util/pair");
import ramlServer = require("raml-language-server");
import {
    Reconciler
} from "./reconciler"

export class RamlDetails extends SC.Scrollable {

    private reconciler: Reconciler;

    constructor(private allowStructureChanges: boolean = true) {
        super();
        (<any>this).addClass('raml-details');

        const connection = ramlServer.getNodeClientConnection();
        connection.onDetailsReport(report=>this.onDetailsReport(report))

        this.reconciler = new Reconciler(connection, 800);
    }

    getTitle() {
        return "Details";
    }

    disposables = new CompositeDisposable();

    _isAttached: boolean;

    // private _node:hl.IHighLevelNode;
    private _unitPath: string;
    private _position: number;

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

    // private setSchema(unitPath: string, position: number) {
    //     if (this.wasSchema){
    //         this.schemaView.dispose();
    //         this.schemaView=null;
    //     }
    //     var key = node.attr("key"),
    //         value = node.attr("value");
    //
    //     var ssto = 12;
    //
    //     if (value == null) {
    //         this.container.clear();
    //         var errLabel = UI.h3("Selected schema has incorrect node so cannot be displayed.");
    //         UI.applyStyling(UI.TextClasses.WARNING, errLabel);
    //         errLabel.setStyle("text-align", "center").margin(0, 0, 24, 12);
    //         this.container.addChild(errLabel);
    //         return;
    //     }
    //     //FIXME
    //     setInterval(()=>{
    //         if (ssto++ != 12) return;
    //         if (value) {
    //             value.setValue(schemaText);
    //             schemaUI._updatePreview(treeView, schemaText);
    //         }
    //     }, 100);
    //
    //     var schemaText = value.value();
    //
    //     this.container.clear();
    //
    //     var textView = dialogs.smallEditor((e,v)=>{
    //         if (value.lowLevel().includePath()){
    //             try {
    //                 var sm = path.dirname(node.lowLevel().unit().absolutePath());
    //                 var relative = path.resolve(sm, value.lowLevel().includePath());
    //                 if (!value.lowLevel().includeReference()) {
    //                     fs.writeFileSync(relative, v);
    //                 }
    //             } catch (e){
    //                 console.log(e);
    //             }
    //         }
    //         // if (v!=schemaText) textView.setText(schemaText); // read-only variant
    //         schemaText = v;
    //         ssto = 0;
    //     });
    //     dialogs._updateEditor(textView, schemaText);
    //
    //     var treeView = schemaUI._schemaPreview();
    //     schemaUI._updatePreview(treeView, schemaText);
    //
    //     var schemaTab = new UI.TabFolder();
    //     schemaTab.add("Tree view", UI.Icon.GIT_MERGE, treeView);
    //     schemaTab.add("Text view", UI.Icon.FILE_TEXT, textView);
    //     this.container.addChild(schemaTab);
    //
    //     window['detailsnode'] = node;
    //     if (details.oldItem){
    //         details.oldItem.detach();
    //         details.oldItem=null;
    //     }
    //     this.schemaView=textView;
    //     this.wasSchema=true;
    // }
    schemaView:UI.BasicComponent<any>;


    private setResource(detailsNode: ramlServer.DetailsItemJSON, context: details.DetailsContext) {
        if (this.wasSchema){
            this.schemaView.dispose();
            this.schemaView=null;
        }
        this.wasSchema=false;

        window["detailsnode"] = detailsNode;
        window["detailscontext"] = context;

        if (detailsNode == null) this.displayEmpty();
        details.updateDetailsPanel(detailsNode, context, this.container, true);
    }

    update() {
        if(window["detailsnode"]) {
            this.setResource(window["detailsnode"], window["detailscontext"]);
        }
    }

    displayEmpty() {
        this.container.clear();
        // if (!editorTools.aquireManager().ast) {
        //     this.container.addChild(UI.h3("Our API is fabulously empty").margin(8, 8, 20, 8));
        //     var create = new UI.Button("Create new API", UI.ButtonSizes.LARGE, UI.ButtonHighlights.SUCCESS, UI.Icon.REPO_CLONE, ()=>dialogs.newApi());
        //     create.margin(8, 8, 20, 0);
        //     this.container.addChild(create);
        // }
    }
    destroy (): void {
        editorTools.aquireManager()._details=null;
        this.disposables.dispose();
        this._unitPath=null;
        this._position=null;
        this.container.dispose();
        this.container=null;
        window["detailsnode"]=null;
        window["detailscontext"]=null;
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

    show(unitPath: string, position: number, force: boolean = false) {
        if (!force && this._unitPath == unitPath && this._position === position) return;
        this._unitPath = unitPath;
        this._position = position;
        const reconciler = this.reconciler;

        try {

            // if (isSchema(node))
            //     this.setSchema(this._node);
            // else
            //     this.setResource(node);

            ramlServer.getNodeClientConnection().getDetails(unitPath, position).then(detailsNode=>{
                this.setResource(detailsNode, {
                    uri: unitPath,
                    position: position,
                    reconciler
                });
            })

        } catch (e) {}
    }

    onDetailsReport(report : ramlServer.IDetailsReport) {
        if (report.uri != this._unitPath) return;
        const reconciler = this.reconciler;

        //if (this._position == report.position) return;

        ramlServer.getNodeClientConnection().getLatestVersion(report.uri).then(latestVersion=>{

            //ignoring outdated reports
            if (report.version != null && report.version < latestVersion) return;

            this.setResource(report.details, {
                uri: report.uri,
                position: report.position,
                reconciler
            });
        })
    }
}

// function isSchema(p: hl.IHighLevelNode) {
//     if (!p){
//         return false;
//     }
//     return universeHelpers.isGlobalSchemaType(p.definition());
// }