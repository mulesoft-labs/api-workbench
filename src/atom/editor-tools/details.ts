/// <reference path="../../../typings/main.d.ts" />
import fs = require ('fs')
import path=require('path')
import rp=require("raml-1-parser")
import def=rp.ds;
import lowLevel=rp.ll;
import hl=rp.hl;
import _=require("underscore")
import UI=require("atom-ui-lib")
import SpacePenViews = require('atom-space-pen-views')
import schemautil=rp.schema;
import dialogs=require("../dialogs/dialogs")
import editorTools=require("./editor-tools")
import details2=require("./details2")
var HTTPANDHTTPS="HTTP, HTTPS"
var HTTPHTTPS="HTTP/HTTPS"

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

//export function property2(node: hl.IHighLevelNode, name: string, descriptionLabel?: UI.TextElement<any>, updateTextOnDone: boolean = false) {
//    var pinfo = propertyInfo(node, name);
//
//    return property(name, pinfo.required, pinfo.type, pinfo.value, pinfo.values, node, descriptionLabel, updateTextOnDone);
//}
var  focusedPropertyName: string = null;
var focusedPosition: number = -1;
var toFocus : UI.TextField = null;

export var oldItem;
export function updateDetailsPanel(node: hl.IHighLevelNode, panel: UI.Panel, updateTextOnDone: boolean = false) {
    panel.clear();
    var cfg=(<any>atom).config
    var l=(<any>atom).styles.emitter.handlersByEventName;
    var sadd:any[]=[].concat(l['did-add-style-element']);
    var sremove:any[]=[].concat(l['did-remove-style-element']);
    var schange:any[]=[].concat(l['did-update-style-element']);
    var cfgCh:any[]=[].concat(cfg.emitter.handlersByEventName['did-change']);
    var grammars=(<any>atom).grammars.emitter.handlersByEventName;
    var addGrammar:any[]=[].concat(grammars["did-add-grammar"]);
    var updateGrammar:any[]=[].concat(grammars["did-update-grammar"]);
    var emptyGrammarListeners=[].concat((<any>atom).grammars.nullGrammar.emitter.handlersByEventName["did-update"]);
    try {
        var empty = true;
        var pcmp = (a:hl.IProperty, b:hl.IProperty) => {
            var ap = (<def.Property>a).getAdapter(def.RAMLPropertyService).priority(),
                bp = (<def.Property>b).getAdapter(def.RAMLPropertyService).priority();
            if (ap != bp) return bp - ap;
            else return a.nameId().localeCompare(b.nameId());
        }
        if (false && nodes[node.definition().nameId()] && !node.definition().getAdapter(def.RAMLService).isUserDefined()) {
            // var info = nodes[node.definition().nameId()];
            // info.properties.forEach(pn=> {
            //     try {
            //         //panel.addChild(property2(node, pn, <UI.TextElement<any>> descLabel2, updateTextOnDone));
            //         empty = false;
            //     } catch (e) {
            //         console.log("Error while updating details panel for node ", node, "(property ", pn, "): ", e);
            //     }
            // });
        }
        else {
            var item = details2.buildItem(node, false);
            item.addListener(x=> {
                editorTools.aquireManager().updateText(null);
            })
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
            var errLabel = UI.h3("Object `" + node.name() + "` has no additional properties.");
            UI.applyStyling(UI.TextClasses.WARNING, errLabel);
            errLabel.setStyle("text-align", "center").margin(0, 0, 24, 12);
            panel.addChild(errLabel);
        }
        ;
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


//export function property(name: string, required: boolean, type: string, value: string, values: any[], node: hl.IHighLevelNode, descriptionLabel: UI.TextElement<any>, updateText: boolean = false) {
//    var bonclick = (e)=>{};
//    var attr = node.attr(name);
//    var useModalEditor = false;
//
//    var tfValue = new UI.BasicBinding(dialogs.getStringValue(value));
//    var updateViewModel = function(value) {
//        if (updateText) editorTools.aquireManager().updateText(node.lowLevel());
//
//        fire = false;
//        if (type=="protocols"){
//            if (value==HTTPANDHTTPS){
//                value=HTTPHTTPS
//            }
//        }
//        tfValue.set(value);
//        fire = true;
//    }
//    var disabledMessage: string = null;
//    var res;
//    switch (type) {
//        case 'markdown':
//            bonclick = dialogs.markdown(name, values, (newValue) => {
//                node.attrOrCreate(name).setValue(value = newValue);
//                updateViewModel(stringView(node, name));
//            });
//            useModalEditor = true;
//            break;
//        case 'schema':
//            bonclick = dialogs.schemaEditDialog(name, values.length > 0 ? values[0] : value, (newValue) => {
//                node.attrOrCreate(name).setValue(newValue);
//                if (updateText) editorTools.aquireManager().updateText();
//                updateViewModel(stringView(node, name));
//            });
//            useModalEditor = true;
//            break;
//        case 'schexample':
//            bonclick = dialogs.exampleEditorDialog(name, values[1], values[0], (newValue) => {
//                var value = newValue;
//                if (fs.exists(newValue))
//                    value = "!include " + path.relative(node.lowLevel().unit().path(), newValue);
//                node.attrOrCreate(name).setValue(value);
//                updateViewModel(stringView(node, name));
//            });
//            useModalEditor = true;
//            break;
//        case 'enum':
//            bonclick = dialogs.enumEditDialog(name, values, (values)=>{
//                node.attributes(name).forEach(attr => attr.remove());
//                values.forEach(val => node.attrOrCreate(name).addValue(val));
//                updateViewModel(stringView(node, name));
//            });
//            useModalEditor = true;
//            break;
//        case 'protocols':
//            break;
//        case 'type':
//            bonclick = dialogs.typeEditDialog(name, value, node, (newValue) => {
//                node.attrOrCreate(name).setValue(newValue);
//                updateViewModel(stringView(node, name));
//            });
//            if (editorTools.aquireManager().ast.elementsOfKind('resourceTypes').length < 1) disabledMessage = "No resource types defined";
//            else useModalEditor = true;
//            break;
//        case 'trait':
//            bonclick = dialogs.traitsEditDialog(name, values, node, (newTraits) => {
//                node.attributes(name).forEach(attr => attr.remove());
//
//                newTraits
//                    .filter(trait => trait.enabled)
//                    .filter(trait => typeof trait.value == "string") // FIXME should only be trait => trait.enabled
//                    .forEach(trait => node.attrOrCreate(name).addValue(trait.value));
//
//                updateViewModel(stringView(node, name));
//            });
//
//            useModalEditor = true;
//            break;
//        default:
//    }
//
//    var fire = true;
//    var updateValueDeferred = (newValue)=>{ uvdTimeout = 0; }
//
//    if (!useModalEditor && node.definition().property(name).getAdapter(services.RAMLPropertyService).enumValues(node).length > 0 || name == 'code') {
//        var ores = new UI.SelectField(name + (required ? "*" : ""), (e, v) => {
//            if (fire == false) return;
//            if (v == "(no value)") v = "";
//            if (type=="protocols"){
//                node.attributes(name).forEach(attr => attr.remove());
//                if( v==HTTPHTTPS){
//                    ["HTTP","HTTPS"].forEach(val => node.attrOrCreate(name).addValue(val));
//                }
//                else{
//                    if (v) {
//                        node.attrOrCreate(name).setValue(v);
//                    }
//                }
//                updateViewModel(stringView(node, name));
//                return;
//            }
//            updateValueDeferred(v);
//        });
//        var options = [];
//        if (name == 'code')
//            options = Object.keys(dialogs.getStatusCodeDescriptions());
//        else {
//            var enumValues = node.definition().property(name).getAdapter(services.RAMLPropertyService).enumValues(node);
//            options = node.definition().property(name).getAdapter(services.RAMLPropertyService).isKey() ? enumValues : ["(no value)"].concat(enumValues);
//
//            if (type=='protocols'){
//                if (tfValue.get()==HTTPANDHTTPS){
//                    tfValue.set(HTTPHTTPS)
//                }
//                options =["(no value)","HTTP","HTTPS",HTTPHTTPS]
//            }
//        }
//
//        ores.getActualField().setOptions(options);
//        ores.setBinding(tfValue);
//
//        res = ores;
//    } else {
//        if (!res) {
//            res = new UI.TextField(name + (required ? "*" : ""), tfValue, (e, v)=> {
//                if (fire == false) return;
//                if (useModalEditor && res && res.getActualField())
//                    res.getActualField().setText(value, false); // do not re-call onChange
//                else
//                    updateValueDeferred(v);
//            }, null, editorTools.aquireManager().placeholder ? name + " has no value" : '');
//            if (name == focusedPropertyName) toFocus = res;
//        }
//    }
//    var uvdTimeout = 12;
//
//    setInterval(()=>{
//        if (uvdTimeout++ != 10) return;
//        var newValue = res.getActualField().getValue();
//        var attrEx = node.attr(name)
//        var attr = node.attrOrCreate(name);
//        attr.setValue(newValue);
//        if (updateText) {
//            if (res instanceof UI.TextField) {
//                focusedPropertyName = name;
//                focusedPosition = (<any> res.getActualField()).ui().getModel().getCursorBufferPosition();
//            }
//            editorTools.aquireManager().updateText(newValue == '' || attr == null ? node.lowLevel() : attr.lowLevel());
//
//        }
//
//    }, 50);
//
//    res.getActualField().addClass("ate").addClass(type).setStyle("margin-bottom", "0px !important");
//    res.margin(0, 0, 0, 6);
//    if (useModalEditor) {
//        res.getActualField().ui().addEventListener('focus', (e) => {
//            bonclick(e);
//            res.getActualField().ui().blur();
//        });
//        res.addChild(UI.button("(edit)", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.NO_HIGHLIGHT, null, bonclick).margin(4, 0, 0, 0));
//    } else if (disabledMessage) {
//        if (editorTools.aquireManager().placeholder) res.getActualField().setPlaceholder(disabledMessage);
//        res.getActualField().ui().addEventListener('focus', (e) => res.getActualField().ui().blur());
//    }
//    if (descriptionLabel) {
//        res.ui().addEventListener('mouseenter', () => {
//            descriptionLabel.setStyle("opacity", "1")
//            descriptionLabel.setText(node.definition().property(name).description());
//        });
//        res.ui().addEventListener('mouseleave', () => {
//            descriptionLabel.setStyle("opacity", "0");
//        });
//    }
//    return res;
//}



function getSchemaType(value: string)
{
    var schema = schemautil.createSchema(value, null);
    if (!schema || !schema.getType) return "Invalid";
    switch (schema.getType()) {
        case "source.json":
            return "JSON";
        case "text.xml":
            return "XML";
        default :
            return "Unknown type";
    }
}
export function getStringValue(x : string | hl.IStructuredValue) : string {
    if (typeof x ==="object") return (<hl.IStructuredValue>x).valueName();
    else return <string>x;
}

export function propertyInfo(node: hl.IHighLevelNode, name: string) {
    var prop = node.definition().property(name);
    if (prop.isValueProperty() == false) return null;
    var isMulti = prop.isMultiValue();
    var required = prop.isRequired();
    var value : string;
    var values = [];
    var type : string;
    var ipath: string;
    var rangeName = prop.range().nameId();

    if (isMulti) {
        values = node.attributes(name).map(x=>x.value());
        value = values.map(x=>getStringValue(x)).join(", ");
        switch (rangeName) {
            case "StringType":
                type = 'enum';
                if (!node.definition().getAdapter(def.RAMLService).isUserDefined()&&name=="protocols"){
                    type="protocols"
                }
                break;
            case "TraitRef":
                type = 'trait';
                break;
            default:
                type = 'unknown';
        }
    } else {
        var attr = node.attr(name);
        value = attr && attr.value() ? attr.value() : "";

        switch (rangeName) {
            case "MarkdownString":
                type = 'markdown';
                values = value.split("\n");
                value =  values[0];
                break;
            case "SchemaString":
                type = 'schema';
                if (value.indexOf("\n") >= 0) {
                    values = [value];
                    value = "(" + getSchemaType(value) + " Schema)";
                }
                break;
            case "ExampleString":
                type = 'schexample';
                try {
                    ipath = attr.lowLevel().includePath();
                } catch(e) { ipath = ""; }
                values = [value, ipath];
                value =  "Example" + (ipath != "" ? " (referenced from " + ipath + ")" : "");
                break;
            case "ResourceTypeRef":
                type = "type";
                break;
            default:
                type = 'string';
        }
        if (type == "string") {
            if (value.indexOf("\n") >= 0) {
                values = value.split("\n");
                value = "(" + values.length + " lines) " + values[0].substring(0, 20) + " ...";
                type = "multiline";
            }
            if (attr)
                ipath = attr.lowLevel().includePath();

            if (ipath) {
                value = "(included from " + ipath +")";
                type = "include";
            }
        }
    }
    var ret = {
        value: value,
        values: values,
        type: type,
        include: ipath,
        required: required,
    };
    return ret;
}
export function stringView(node: hl.IHighLevelNode, name: string) {
    return getStringValue(propertyInfo(node, name).value);
}
