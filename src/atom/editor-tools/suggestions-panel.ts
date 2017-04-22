/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import hl=require("raml-1-parser");
var universes=hl.universes
import stubs=hl.stubs
import _=require("underscore")
import ds=hl.ds;
import editorTools=require("./editor-tools")
class Inserter {

    constructor(private value: string, private property:hl.IProperty, private node:hl.IHighLevelNode){

    }
    insert(){
        var rn=<ds.NodeClass>this.property.range();
        var key=this.value;
        if (this.property.nameId()==universes.Universe10.Method.properties.body.name){
            key="application/json";
        }
        if (this.property.nameId()==universes.Universe10.MethodBase.properties.responses.name){
            key="200";
        }

        //TODO we need to take care of keys globally, including collections
        //if (this.property.nameId() == universes.Universe10.TypeDeclaration.properties.xml.name
        //    && this.node.definition().isAssignableFrom(universes.Universe10.TypeDeclaration.name)) {
        //    key = universes.Universe10.XMLSerializationHints.properties.name.name;
        //}

        var newNode=stubs.createStubNode(rn,this.property,key);
        editorTools.aquireManager()._cleanOutline=true;
        //this is a hack TODO FIX ME we should remove it after we will fix partial reconcile on outline
        this.node.add(newNode);
        editorTools.aquireManager().patchCurrentNode(this.node);
    }
}

export function generateSuggestionsPanel(node:hl.IHighLevelNode):UI.UIComponent{
    var cm=node.definition().allProperties();
    var result=UI.vc();
    var hc=UI.hc();
    result.addChild(UI.h3("Insertions and Delete: "));
    result.addChild(hc)

    var isInclude = node.lowLevel() && node.lowLevel().includePath && node.lowLevel().includePath();

    cm.forEach(x=>{
        if(isInclude && x.nameId() === universes.Universe10.Api.properties.uses.name) {
            return;
        }

        if (x.isValueProperty()){
            return;
        }
        if (x.getAdapter(ds.RAMLPropertyService).isMerged()){
            return;
        }
        if (_.find(node.lowLevel().children(),y=>y.key()==x.nameId())){
            return;
        }
        if (node.lowLevel().includesContents()) {
            return;
        }

        var inserter=new Inserter("",x,node)
        hc.addChild(UI.button(x.nameId(),UI.ButtonSizes.EXTRA_SMALL,UI.ButtonHighlights.INFO,UI.Icon.NONE,x=>inserter.insert()).margin(3,3,3,3));
    })
    cm.forEach(x=>{
        if (x.isValueProperty()){
            return;
        }
        if (x.getAdapter(ds.RAMLPropertyService).isMerged()){
            var enums=x.enumOptions();
            if (enums){
                enums.forEach(y=>{
                    if (_.find(node.lowLevel().children(),z=>z.key()==y)){
                        return;
                    }

                    if (node.lowLevel().includesContents()) {
                        return;
                    }

                    var inserter=new Inserter(y,x,node)
                    hc.addChild(UI.button(y,UI.ButtonSizes.EXTRA_SMALL,UI.ButtonHighlights.WARNING,UI.Icon.NONE,x=>inserter.insert()).margin(3,3,3,3));
                })
            }
            return;
        }
    })
    hc.addChild(UI.button("Delete",UI.ButtonSizes.EXTRA_SMALL,UI.ButtonHighlights.ERROR,UI.Icon.NONE,x => {
        if(node.parent()) {
            node.parent().remove(node);
        } else {
            node.lowLevel().unit().updateContent('');
            
            editorTools.aquireManager().updateText();

            editorTools.aquireManager().updateDetails();
        }
    }).margin(3,3,3,3));
    return result;
}
