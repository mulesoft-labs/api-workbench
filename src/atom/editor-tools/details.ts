/// <reference path="../../../typings/main.d.ts" />
import fs = require ('fs')
import path=require('path')
import _=require("underscore")
import UI=require("atom-ui-lib")
import SpacePenViews = require('atom-space-pen-views')
import dialogs=require("../dialogs/dialogs")
import editorTools=require("./editor-tools")
import detailElements=require("./detailElements")

export type DetailsContext = detailElements.DetailsContext;

var HTTPANDHTTPS="HTTP, HTTPS"
var HTTPHTTPS="HTTP/HTTPS"
import ramlServer = require("api-language-server");

export var nodes={
    Api:{
        properties:["title","version","baseUri","mediaType","protocols"],
        actions:[
        ]
    }
    ,
    Resource:{
        properties:["relativeUri","displayName","description","is","type"]
    },
    Method:{
        properties:["method","displayName","description","is","type","protocols","securedBy"]
    }
    ,
    DataElement:{
        properties:["name","displayName","description","default","required"]
    },
    Response:{
        properties:["code","description"]
    }
}
export var filterOut={
    properties:["location","annotations","repeat","locationKind","signature"]

}

var  focusedPropertyName: string = null;
var focusedPosition: number = -1;
var toFocus : UI.TextField = null;

export var oldItem;
export function updateDetailsPanel(detailsReport: ramlServer.DetailsItemJSON,
                                   context: detailElements.DetailsContext, panel: UI.Panel,
                                   updateTextOnDone: boolean = false) {
    panel.clear();
    var cfg=(<any>atom).config
    var l=(<any>atom).styles.emitter.handlersByEventName;
    var sadd:any[]=[].concat(l['did-add-style-element']);
    var sremove:any[]=[].concat(l['did-remove-style-element']);
    var schange:any[]=[].concat(l['did-update-style-element']);
    var cfgCh:any[]=[].concat(cfg.emitter.handlersByEventName['did-change']);
    var grammars=((<any>atom).grammars.emitter || (<any>atom).grammars.textmateRegistry.emitter);
    var addGrammar:any[]=[].concat(grammars["did-add-grammar"]);
    var updateGrammar:any[]=[].concat(grammars["did-update-grammar"]);
    var emptyGrammarListeners=[].concat((<any>atom).grammars.nullGrammar.emitter.handlersByEventName["did-update"]);
    try {
        var empty = true;

        var item = detailElements.buildItem(detailsReport, context, false);
        // item.addListener(x=> {
        //     editorTools.aquireManager().updateText(null);
        // })
        var rend;
        try {
            rend = item.render({});
        } finally {
            if (oldItem) {
                oldItem.detach();
            }

            oldItem = item;

            if (rend) {
                panel.addChild(rend);
            }

            empty = false;
        }

        if (toFocus) {
            var field = toFocus.getActualField().ui();
            field.focus();
            (<any> field).getModel().setCursorBufferPosition(focusedPosition);
            toFocus = null;
            focusedPosition = null;
            focusedPropertyName = null;
        }

        if (empty) {
            var errLabel = UI.h3("Object has no additional properties.");
            UI.applyStyling(UI.TextClasses.WARNING, errLabel);
            errLabel.setStyle("text-align", "center").margin(0, 0, 24, 12);
            panel.addChild(errLabel);
        }

    } catch(Error){
        throw Error;
    } finally {

        cfg.emitter.handlersByEventName['did-change']=cfgCh;
        l['did-add-style-element']=sadd;
        l['did-remove-style-element']=sremove;
        l['did-update-style-element']=schange;
        grammars["did-add-grammar"]=addGrammar;
        grammars["did-update-grammar"]=updateGrammar;
        (<any>atom).grammars.nullGrammar.emitter.handlersByEventName["did-update"]=emptyGrammarListeners;
    }
}





// function getSchemaType(value: string)
// {
//     var schema = schemautil.createSchema(value, null);
//     if (!schema || !schema.getType) return "Invalid";
//     switch (schema.getType()) {
//         case "source.json":
//             return "JSON";
//         case "text.xml":
//             return "XML";
//         default :
//             return "Unknown type";
//     }
// }
// export function getStringValue(x : string | hl.IStructuredValue) : string {
//     if (typeof x ==="object") return (<hl.IStructuredValue>x).valueName();
//     else return <string>x;
// }
//
// export function propertyInfo(node: hl.IHighLevelNode, name: string) {
//     var prop = node.definition().property(name);
//     if (prop.isValueProperty() == false) return null;
//     var isMulti = prop.isMultiValue();
//     var required = prop.isRequired();
//     var value : string;
//     var values = [];
//     var type : string;
//     var ipath: string;
//     var rangeName = prop.range().nameId();
//
//     if (isMulti) {
//         values = node.attributes(name).map(x=>x.value());
//         value = values.map(x=>getStringValue(x)).join(", ");
//         switch (rangeName) {
//             case "StringType":
//                 type = 'enum';
//                 if (!node.definition().getAdapter(def.RAMLService).isUserDefined()&&name=="protocols"){
//                     type="protocols"
//                 }
//                 break;
//             case "TraitRef":
//                 type = 'trait';
//                 break;
//             default:
//                 type = 'unknown';
//         }
//     } else {
//         var attr = node.attr(name);
//         value = attr && attr.value() ? attr.value() : "";
//
//         switch (rangeName) {
//             case "MarkdownString":
//                 type = 'markdown';
//                 values = value.split("\n");
//                 value =  values[0];
//                 break;
//             case "SchemaString":
//                 type = 'schema';
//                 if (value.indexOf("\n") >= 0) {
//                     values = [value];
//                     value = "(" + getSchemaType(value) + " Schema)";
//                 }
//                 break;
//             case "ExampleString":
//                 type = 'schexample';
//                 try {
//                     ipath = attr.lowLevel().includePath();
//                 } catch(e) { ipath = ""; }
//                 values = [value, ipath];
//                 value =  "Example" + (ipath != "" ? " (referenced from " + ipath + ")" : "");
//                 break;
//             case "ResourceTypeRef":
//                 type = "type";
//                 break;
//             default:
//                 type = 'string';
//         }
//         if (type == "string") {
//             if (value.indexOf("\n") >= 0) {
//                 values = value.split("\n");
//                 value = "(" + values.length + " lines) " + values[0].substring(0, 20) + " ...";
//                 type = "multiline";
//             }
//             if (attr)
//                 ipath = attr.lowLevel().includePath();
//
//             if (ipath) {
//                 value = "(included from " + ipath +")";
//                 type = "include";
//             }
//         }
//     }
//     var ret = {
//         value: value,
//         values: values,
//         type: type,
//         include: ipath,
//         required: required,
//     };
//     return ret;
// }
// export function stringView(node: hl.IHighLevelNode, name: string) {
//     return getStringValue(propertyInfo(node, name).value);
// }