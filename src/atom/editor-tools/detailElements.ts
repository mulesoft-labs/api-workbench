/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')


import _=require("underscore")
import provider=require("../suggestion/provider")
import UI=require("atom-ui-lib")
import xmlutil=require("../../util/xmlutil")
import shemagen=require("../../util/schemaGenerator")
import SpacePenViews = require('atom-space-pen-views')
import tooltip=require("../core/tooltip-manager")
import contextActions = require("raml-actions")
import assistUtils = require("../dialogs/assist-utils");
import ramlServer = require("raml-language-server");

var lastSelectedCaption:string;
var inRender:boolean=false;

interface RenderingOptions{
    showDescription?:boolean;
    showHeader?:boolean;
    collapsible?:boolean;
}

export abstract class Item{

    parent:Item;

    listeners:((i:Item)=>void) [] =[]

    abstract dispose():void

    constructor(protected _title:string,public description:string=""){

    }

    needsSeparateLabel(){
        return false;
    }

    detach(){
        this.dispose();
        this.children().forEach(x=>x.detach());
    }

    addListener(r:(i:Item)=>void){
        this.listeners.push(r);
    }

    removeListener(r:(i:Item)=>void){
        this.listeners=this.listeners.filter(x=>x!=r);
    }

    add(i:Item){

        throw new Error("Not supported")
    }

    root(){
        if (this.parent){
            return this.parent.root();
        }
        return this;
    }

    title(){
        return this._title;
    }

    children():Item[]{
        return [];
    }

    setDescription(desc:string){
        this.description=desc;
    }

    setTitle(t:string){
        this._title=t;
    }

    render(r:RenderingOptions={}):UI.UIComponent{
        throw new Error("Not Implemented")
    }

    item(name:string):Item{
        return null;
    }

    setError(text:string){

    }

    clearErrors(){

    }

}

export class TypeDisplayItem extends Item{

    constructor(private detailsNode:ramlServer.DetailsItemJSON){
        super("Type " + detailsNode.title,"");
    }
    render(r:RenderingOptions){
        let container=new UI.WrapPanel();

        container.setCaption(this.title());

        return container;
        //return typeDisplay.render(this.detailsNode);
    }
    dispose(){

    }
}
class Category extends Item{

    _children:Item[]=[]
    descriptionLabel:UI.UIComponent;
    subCategories: UI.UIComponent;
    _result:UI.Panel;

    add(i:Item){
        i.parent=this;
        this._children.push(i);
    }

    children(){
        return this._children;
    }
    plainChildren(){
        return this._children.filter(x=>!(x instanceof Category));
    }
    categories(){
        return this._children.filter(x=>(x instanceof Category));
    }

    item(name:string):Item{
        var it:Item;
        this._children.forEach(x=>{
            if (x.title()==name){
                it=x;
            }
            var rr=x.item(name);
            if (rr){
                it=rr;
            }
        });
        return it;
    }

    render(r:RenderingOptions={}):UI.UIComponent{
        var section=this.createSection(r);
        this._result=section;
        if (this.description&&r.showDescription){
            this.descriptionLabel=UI.label(this.description);
            section.addChild(this.descriptionLabel);
        }
        this.contributeTop(section);
        this.plainChildren().forEach(x=>this.addChild(section,x));

        var wrappedChild=this.createWrappedChild(section);
        this.subCategories=wrappedChild;
        var cats=this.categories()
        var remap={}
        cats.forEach(x=>remap[x.title()]=x);
        var newCats=[];
        if (remap["General"]){
            newCats.push(remap["General"]);
            delete remap["General"];
        }
        if (remap["Facets"]){
            newCats.push(remap["Facets"]);
            delete remap["Facets"];
        }
        for (var c in remap){
            newCats.push(remap[c]);
        }
        newCats.forEach(x=>this.addChild(wrappedChild,x));
        return section;
    }

    detach(){
        super.detach();
        this._result.dispose();
    }

    createSection(r:RenderingOptions):UI.Panel{
        if (r.showHeader) {
            return new UI.Section(<any>UI.h3(this.title()), false)
        }
        var pnl=new UI.Panel();
        pnl.setCaption(this.title());
        return pnl;
    }

    createWrappedChild(section:UI.UIComponent){
        return section;
    }

    addChild(section:UI.UIComponent, item:Item){
        var child=item.render();
        if (section instanceof UI.TabFolder){
            var tf=<UI.TabFolder>section;
            tf.add(child.caption(),UI.Icon.NONE,child);
        }
        else {
            if (item.needsSeparateLabel()){
                var firstLabel = UI.label(item.title());

                firstLabel.margin(0, 5, 0, 0);

                section.addChild(firstLabel);
                section.addChild(UI.label(item.description));
            }
            section.addChild(child);
        }
    }

    contributeTop(section:UI.Panel){

    }

    dispose():void{

    }

    setError(text:string){

    }

    clearErrors(){
        this._children.forEach(x=>x.clearErrors())
    }

    update(i:Item){

    }
}

class TopLevelNode extends Category{

    errorLabel:UI.TextElement<any>
    ep:UI.Panel=null;
    _panel:UI.Panel;
    _options:RenderingOptions;

    constructor(protected detailsNode:ramlServer.DetailsItemJSON){
        super(detailsNode.title,detailsNode.description);
    }

    detach(){
        super.detach();
        this._result.dispose();
    }

    createWrappedChild(section:UI.UIComponent){
        var tf=new UI.TabFolder()
        tf.setOnSelected(()=>{
            if (!inRender) {
                lastSelectedCaption = (tf.selectedComponent().caption());
            }
        });
        section.addChild(tf);
        return tf;
    }

    subCategoryByNameOrCreate(name:string){
        var item=_.find(this.children(),x=>x.title()==name);
        if (!item){
            var rs=new Category(name);
            this.add(rs);
            return rs;
        }
        return item;
    }

    addItemToCategory(name:string,it:Item){
        if (name==null){
            this._children.push(it);
            it.parent=this;
            return;
        }
        this.subCategoryByNameOrCreate(name).add(it);
    }

    contributeTop(section:UI.Panel){
        this.errorLabel=UI.label("",UI.Icon.BUG,UI.TextClasses.ERROR);
        this.ep=UI.hc(this.errorLabel);
        this.ep.setDisplay(false)
        section.addChild(this.ep);
    }

    render(r: RenderingOptions={}){
        inRender=true;
        try {
            var result = super.render(r);
            this._options = r;
            this._panel = <any>result;
            var tf = <UI.TabFolder>this.subCategories;
            for (var n = 0; n < tf.tabsCount(); n++) {
                var item = tf.get(n);
                if (item.header == lastSelectedCaption) {
                    tf.setSelectedIndex(n);
                    return result;
                }
            }
            var documentation="";
            if (this.detailsNode.description){
                documentation=this.detailsNode.description;
            }

            if (documentation.length&&!r.showDescription){
                result.addChild(UI.html("<hr/>"))
                result.addChild(UI.label(documentation,UI.Icon.INBOX,UI.TextClasses.SUBTLE))
            }
            this.update(this);
            return result;
        } finally {
            inRender=false;
        }
    }

    dispose():void{
        this.detailsNode=null;
    }

    update(i:Item){
        // if (!this._panel){
        //     return;
        // }
        // if (i instanceof PropertyEditorInfo){
        //     var prInfo=<PropertyEditorInfo>i;
        //     if (prInfo.property.getAdapter(def.RAMLPropertyService).isTypeExpr()||prInfo.property.isDescriminator()){
        //         rp.utils.updateType(this.node);
        //         var extras=<Category>this.item("Facets");
        //         if (extras&&extras._result) {
        //             extras._result.clear();
        //         }
        //
        //         var item=buildItem(this.node,false);
        //         var newExtras=<Category>item.item("Facets");
        //         if (newExtras) {
        //             if (extras&&extras._result) {
        //                 extras._children = newExtras._children;
        //                 extras._children.forEach(x=>x.parent = extras);
        //                 if (extras._children.length > 0) {
        //                     extras._result.setDisplay(true);
        //                     //workaroung events flow issue in UI.ts
        //                 }
        //                 newExtras.children().forEach(x=> {
        //                     extras._result.addChild(x.render(this._options))
        //                 })
        //             }
        //             else{
        //                 this._children.push(newExtras);
        //                 if (this._panel) {
        //                     this._panel.addChild(newExtras.render(this._options))
        //                 }
        //             }
        //         }
        //         else{
        //             if (extras&&extras._result) {
        //                 extras._result.setDisplay(false);
        //             }
        //         }
        //     }
        // }
        // var kp=null;
        // this.node.definition().allProperties().forEach(x=>{
        //     if (x.getAdapter(def.RAMLPropertyService).isKey()){
        //         kp=x;
        //     }
        // })
        // if (kp){
        //     var keyItem=<PropertyEditorInfo>this.item(kp.nameId());
        //     if (keyItem){
        //         var m=keyItem.fld;
        //         var vl=m.getBinding().get();
        //         if ((!vl)||vl.trim().length==0){
        //             this._panel.getBinding().setStatus(UI.errorStatus(""));
        //         }
        //         else{
        //             this._panel.getBinding().setStatus(UI.okStatus());
        //         }
        //     }
        // }
        //
        // var errors;
        //
        // if(this.node.property() && universehelpers.isExampleProperty(this.node.property())) {
        //     var parent = this.node.parent()
        //
        //     if(parent) {
        //         var parsed = parent.parsedType();
        //
        //         var exampleMeta =  _.find((<any>parsed).metaInfo || [], (meta: any): boolean => {
        //             return meta && meta._name === 'example';
        //         });
        //
        //         if(exampleMeta) {
        //             var validateObject = exampleMeta.validateSelf(this.node.types().getAnnotationTypeRegistry());
        //
        //             errors = ((validateObject && validateObject.getErrors()) || []).map(error => {
        //                 return this.node.createIssue(error);
        //             });
        //         }
        //     }
        // } else {
        //     errors = this.node.errors();
        // }
        //
        // this.clearErrors();
        // this.ep.setDisplay(false)
        // if (!resourceRegistry.hasAsyncRequests() && errors&&errors.length>0){
        //     var notFound=[];
        //     errors.forEach(error=>{
        //         if (error.extras&&error.extras.length>0){
        //             error=error.extras[0];
        //         }
        //         var item = error.node && this.item(error.node.name());
        //         if (item){
        //             item.setError(error.message);
        //         }
        //         else{notFound.push(error);}
        //     })
        //     if (notFound.length>0){
        //         this.errorLabel.setIcon(UI.Icon.BUG)
        //         var et=notFound.map(x=>x.node.name()+":"+x.message).join(",");
        //         if (et.length>100){
        //             et=et.substring(0,100)+"...";
        //         }
        //         this.errorLabel.setText(et)
        //         this.ep.setDisplay(true);
        //     }
        //     else{
        //         this.ep.setDisplay(false);
        //     }
        // }
    }
}

class CheckBox2 extends UI.CheckBox implements UI.IField<any>{

    setLabelWidth(n:number){
        this.setStyle("margin-left",(n+2)+"ch");
    }
}
class PropertyEditorInfo extends Item{

    constructor(protected outlineNode : ramlServer.DetailsValuedItemJSON){
        super(outlineNode.title,outlineNode.description);
    }

    dispose(){
        this.outlineNode=null;
        this.fld.getBinding().removeListener(this.update)
    }

    // getDefaultValue() {
    //     return defaultValues.getDefaultValue(this.node, this.property);
    // }
    //
    // hasDefault() {
    //     return defaultValues.hasDefault(this.property);
    // }

    errorLabel:UI.TextElement<any>
    descLabel:UI.TextElement<any>

    fld:UI.BasicComponent<any>;
    clearErrors(){
        this.setError(null);
    }
    setError(text:string){
        if (text){
            this.errorLabel.setText(text);
            this.errorLabel.setDisplay(true);
        }
        else{
            if (this.errorLabel) {
                this.errorLabel.setDisplay(false);
            }
        }
    }

    fromEditorToModel(newValue? : any, oldValue? : any){
        // var field=this.fld;
        //
        // var vl=this.toLocalValue(field.getBinding().get());
        //
        // if (vl==null){
        //     vl="";
        // }
        //
        // if (vl===true){
        //     vl="true"
        // }
        //
        // if (vl===false){
        //     vl="";
        // }
        //
        // var attr=this.node.attr(this.property.nameId());
        //
        // var av="";
        //
        // if (attr){
        //     var l = this.toLocalValue(this.toUIValue(attr.value()));
        //
        //     if (l){
        //         av=""+l;
        //     }
        // }
        //
        // if (av==vl){
        //     return;
        // }
        // if (vl.length>0) {
        //     if (attr&&attr.lowLevel().includePath()){
        //         var path=attr.lowLevel().includePath();
        //         var actualUnit=attr.lowLevel().unit().resolve(path);
        //         if (actualUnit){
        //             var apath=actualUnit.absolutePath();
        //             fs.writeFileSync(apath,vl);
        //         }
        //         return;
        //     }
        //
        //     if(this.node.lowLevel().includePath() && !this.node.lowLevel().unit().resolve(this.node.lowLevel().includePath())) {
        //         return;
        //     }
        //
        //     attr = this.node.attrOrCreate(this.property.nameId());
        //
        //     attr.remove();
        //
        //     attr = this.node.attrOrCreate(this.property.nameId());
        //
        //     attr.setValue("" + vl);
        //
        //     delete this.node['_ptype'];
        // }
        // else{
        //     if (attr){
        //         if (!this.property.getAdapter(def.RAMLPropertyService).isKey()) {
        //             attr.remove();
        //         }
        //     }
        // }
        //
        // if (attr.lowLevel() && attr.lowLevel().unit() && attr.lowLevel().unit() != this.node.lowLevel().unit()) {
        //     provider.saveUnit(attr.lowLevel().unit());
        // }
        //
        // var root=this.root()
        // if (root){
        //     root.update(this);
        // }
    }

    toLocalValue(inputValue) {
        return inputValue;
    }

    toUIValue(value) {
        return value;
    }

    fromModelToEditor() {

        this.fld.getBinding().set(this.outlineNode.valueText);
    }
    rendered:boolean=false
    update=(newValue, oldValue)=>{
        if(!this.rendered) {
            return;
        }

        this.fromEditorToModel(newValue, oldValue);
    }

    render(){
        var container=new UI.WrapPanel();

        this.errorLabel=UI.label("",UI.Icon.BUG,UI.TextClasses.ERROR);
        this.errorLabel.setDisplay(false);
        this.errorLabel.setStyle("margin-left",(this._title.length+1)+"ch")

        var field=this.createField();

        this.fld=<UI.BasicComponent<any>>field;

        field.getBinding().addListener(this.update)

        container.setCaption(this.title());

        this.fromModelToEditor();

        container.addChild(field);

        container.addChild(this.errorLabel);

        this.rendered = true;

        return container;
    }

    createField():UI.IField<any>{
        return UI.texfField(this.needsSeparateLabel()?"":this.outlineNode.title,"",x=>{});
    }
}

class SimpleMultiEditor extends PropertyEditorInfo{
    fromEditorToModel(){
        // var field=this.fld;
        // var vl=field.getBinding().get();
        // if (vl==null){
        //     vl="";
        // }
        // var attrs=this.node.attributes(this.property.nameId());
        // var av=attrs.map(x=>escapeValue(""+x.value())).join(", ");
        // if (av==vl){
        //     return;
        // }
        // var ww=vl.split(",");
        // var vl=ww.filter(x=>x.trim().length>0).map(x=>x.trim());
        //
        // if(this.node.lowLevel().includePath() && !this.node.lowLevel().unit().resolve(this.node.lowLevel().includePath())) {
        //     return;
        // }
        //
        // var attribute = this.node.attrOrCreate(this.property.nameId());
        // attribute.setValues(vl)
        //
        // var root=this.root()
        // if (root){
        //     root.update(this);
        // }
    }
    fromModelToEditor(){
        this.fld.getBinding().set(this.outlineNode.valueText);
    }
}
function escapeValue(v:string){
    if (v.length>0) {
        if (v.charAt(0) == "'") {
            return '"' + v + '"';
        }
        if (v.charAt(0) == '"') {
            return '"' + v + '"';
        }
    }
    if (v.indexOf(' ')!=-1||v.indexOf(',')!=-1){
        if (v.indexOf('"')==-1){
            return '"'+v+'"'
        }
        if (v.indexOf("'")==-1){
            return "'"+v+"'"
        }
    }
    return v;
}

class CheckBoxField extends PropertyEditorInfo{
    createField(){
        return new CheckBox2(this.outlineNode.title,UI.Icon.NONE,x=>{});
    }

    toUIValue(value: string): any {
        if(!value) {
            return false;
        }

        if((<any>value) === true || value.trim() === 'true') {
            return true;
        }

        return false;
    }

    toLocalValue(value: any): any {
        return value + "";
    }
}

// class ActionsItem extends Item{
//
//     constructor(private node:hl.IHighLevelNode){
//         super("Actions","");
//     }
//     render(r:RenderingOptions){
//         return suggestions.generateSuggestionsPanel(this.node);
//     }
//     dispose(){
//         this.node=null;
//     }
//
// }
// class ContextActionsItem extends Item{
//     constructor(node:hl.IHighLevelNode,name:string,private actions:contextActions.IContextDependedAction[]){
//         super(name,"");
//     }
//     dispose(){
//
//     }
//
//     render(r:RenderingOptions){
//         var result=UI.hc();
//         result.addChild(UI.h3(this.title()))
//         this.actions.forEach(x=>{
//             result.addChild(UI.button(x.name,UI.ButtonSizes.EXTRA_SMALL,UI.ButtonHighlights.SUCCESS,UI.Icon.CHECKLIST,a=>x.onClick()).margin(3,3,3,3))
//         })
//         return result;
//     }
// }

class MarkdownFieldUI extends UI.AtomEditorElement implements UI.IField<any>{

    constructor(text:string, onchange:UI.EventHandler) {
        super(text, onchange);
        this.margin(0, 0, 6, 12);
        this.setMini(false);
        this.setStyle("min-height","100px");
        //this.setStyle("max-height","200px");
        this.setStyle("border","solid");
        this.setStyle("border-width","1px")
        this.setStyle("border-radius","2px");
        this.setStyle("font-size","1.15em")
        this.setStyle("border-color","rgba(0,0,0,0.2)");
        this.setGrammar('source.mdcustom');
    }

    setLabelWidth(){

    }
    setLabelHeight(){

    }
    setRequired(v:boolean){

    }
}
class XMLField extends UI.AtomEditorElement implements UI.IField<any>{

    constructor(text:string, onchange:UI.EventHandler) {
        super(text, onchange);
        this.margin(0, 0, 6, 12);
        this.setMini(false);
        this.setStyle("min-height","100px");
        //this.setStyle("max-height","200px");

        this.setStyle("border","solid");
        this.setStyle("border-width","1px")
        this.setStyle("border-radius","2px");
        this.setStyle("font-size","1.15em")
        this.setStyle("border-color","rgba(0,0,0,0.2)");
        this.setGrammar('text.xml');
    }



    setLabelWidth(){

    }
    setLabelHeight(){

    }
    setRequired(v:boolean){

    }
}
class JSONField extends UI.AtomEditorElement implements UI.IField<any>{

    constructor(text:string, onchange:UI.EventHandler) {
        super(text, onchange);
        this.margin(0, 0, 6, 12);
        this.setMini(false);
        this.setStyle("min-height","100px");
        //this.setStyle("max-height","200px");

        this.setStyle("border","solid");
        this.setStyle("border-width","1px")
        this.setStyle("border-radius","2px");
        this.setStyle("font-size","1.15em")
        this.setStyle("border-color","rgba(0,0,0,0.2)");
        this.setGrammar('source.json');
    }



    setLabelWidth(){

    }
    setLabelHeight(){

    }
    setRequired(v:boolean){

    }
}
class MarkdownField extends PropertyEditorInfo{
    createField(){
        var editor = new MarkdownFieldUI("",x=>{});
        return editor;
    }

    needsSeparateLabel(){
        return true;
    }

}
class ExampleField extends PropertyEditorInfo{
    constructor(outlineNode: ramlServer.DetailsValuedItemJSON) {
        super(outlineNode);
    }

    createField(){
        var editor = new JSONField(this.outlineNode.valueText,x=>{});
        return editor;
    }

    needsSeparateLabel(){
        return true;
    }

    fromModelToEditor(){

    }

    fromEditorToModel(newValue? : any, oldValue? : any){

    }
}
class XMLExampleField extends PropertyEditorInfo{

    constructor(outlineNode: ramlServer.DetailsValuedItemJSON) {
        super(outlineNode);
    }

    createField(){
        var editor = new XMLField(this.outlineNode.valueText,x=>{});
        return editor;
    }

    needsSeparateLabel(){
        return true;
    }

    fromModelToEditor(){

    }

    fromEditorToModel(newValue? : any, oldValue? : any){

    }
}
class XMLSchemaField extends PropertyEditorInfo{
    createField(){
        var editor = new XMLField("",x=>{});
        return editor;
    }

    needsSeparateLabel(){
        return true;
    }
}
class JSONSchemaField extends PropertyEditorInfo{
    createField(){
        let editor = new JSONField("",x=>{});
        return editor;
    }

    needsSeparateLabel(){
        return true;
    }
}
class SelectBox extends PropertyEditorInfo{

    constructor(protected outlineNode : ramlServer.DetailsItemWithOptionsJSON) {
        super(outlineNode)
    }

    createField(){
        let options= this.outlineNode.options?this.outlineNode.options:[];

        let select= new UI.SelectField(this.outlineNode.title,x=>{},"",UI.Icon.NONE,options);

        select.getActualField().setOptions(options)

        return select;
    }

}

class TypeSelectBox extends SelectBox {

    fromEditorToModel(newValue? : any, oldValue? : any){
        // //current implementation only allows changing the facets of certain types for safety
        // //TODO change this to arbitrary facets (remove type filtering)
        //
        // var oldNames : string[] = [];
        // var savedAttrs = [];
        // if (newValue && oldValue) {
        //     try {
        //         this.node.definition().allSuperTypes().forEach(superType=> {
        //             if (this.isAllowedTypeToReplaceFacets(superType)) {
        //                 this.addTypeFacets(superType, oldNames)
        //             }
        //         })
        //
        //         savedAttrs = [].concat(this.node.attrs())
        //     } catch (err) {console.log(err)}
        // }
        //
        // super.fromEditorToModel();
        //
        // if (newValue && oldValue) {
        //     try {
        //         //collecting facets allowed to remove
        //         var currentUniverse = this.node.definition().universe();
        //         var names : string[] = [];
        //
        //         this.node.definition().allSuperTypes().forEach(superType=>{
        //             if (this.isAllowedTypeToReplaceFacets(superType)) {
        //                 this.addTypeFacets(superType, names)
        //             }
        //         })
        //
        //         if (oldNames.length > 0 && names.length > 0) {
        //             savedAttrs.forEach(attribute => {
        //                 if (_.find(oldNames, facetName => facetName == attribute.name())
        //                     && !_.find(names, facetName => facetName == attribute.name())) {
        //
        //                     this.node.remove(attribute)
        //                 }
        //             })
        //         }
        //     } catch (err) {console.log(err)}
        // }
    }

    // private isAllowedTypeToReplaceFacets(currentTypeDef : hl.ITypeDefinition) : boolean {
    //     return currentTypeDef.key() == universe.Universe10.StringTypeDeclaration ||
    //         currentTypeDef.key() == universe.Universe10.BooleanTypeDeclaration ||
    //         currentTypeDef.key() == universe.Universe10.NumberTypeDeclaration ||
    //         currentTypeDef.key() == universe.Universe10.IntegerTypeDeclaration;
    // }

    // private addTypeFacets(currentTypeDef : hl.ITypeDefinition , names : string[]) : void {
    //     currentTypeDef.properties().map(property=>property.nameId()).forEach(name=>names.push(name));
    // }
}

class TreeField extends UI.Panel implements UI.IField<any>{

    constructor(outlineNode : ramlServer.DetailsItemJSON) {
        super();

        var renderer={


            render(node : ramlServer.DetailsValuedItemJSON){

                var left=UI.label(node.title,UI.Icon.CIRCUIT_BOARD,UI.TextClasses.HIGHLIGHT);

                var right=UI.label(node.valueText?(":"+node.valueText):"",
                    UI.Icon.NONE,UI.TextClasses.SUCCESS);

                var result=UI.hc(left,right);

                return result;
            }
        };

        var getChildren = (node : ramlServer.DetailsValuedItemJSON) => {
            return node.children?node.children:[];
        }

        var viewer=UI.treeViewer(getChildren, renderer, x => x.title);

        var inputValue={
            children(){
                return [outlineNode];
            }
        }

        viewer.setInput(<any>inputValue);

        this.addChild(UI.label(outlineNode.title))

        this.addChild(viewer);
    }



    setLabelWidth(){

    }
    setLabelHeight(){

    }
    setRequired(v:boolean){

    }
}
class StructuredField extends PropertyEditorInfo{

    createField(){

        let children = this.outlineNode.children;
        if (!children || children.length != 1) return null;

        var tm= new TreeField(children[0]);
        return tm;
    }
}

class LowLevelTreeField extends PropertyEditorInfo{

    createField(){
        let children = this.outlineNode.children;
        if (!children || children.length != 1) return null;

        var tm= new TreeField(children[0]);
        return tm;
    }
}

// function category(p:hl.IProperty,node:hl.IHighLevelNode):string{
//     if (p.getAdapter(def.RAMLPropertyService).isKey()||p.isRequired()){
//         return null;
//     }
//     if (p.domain()&&!p.domain().getAdapter(def.RAMLService).isUserDefined()) {
//         if (universehelpers.isDocumentationProperty(p) ||
//             universehelpers.isUsageProperty(p) ||
//             universehelpers.isDescriptionProperty(p) ||
//             universehelpers.isDisplayNameProperty(p) ||
//             universehelpers.isTitleProperty(p)) {
//             return "Documentation";
//         }
//         if (universehelpers.isAnnotationsProperty(p) ||
//             universehelpers.isIsProperty(p) ||
//             universehelpers.isSecuredByProperty(p) ||
//             (universehelpers.isTypeProperty(p)&&!p.getAdapter(def.RAMLPropertyService).isTypeExpr())) {
//             return "References";
//         }
//         if (universehelpers.isProtocolsProperty(p)){
//             return "General";
//         }
//     }
//
//     if (universehelpers.isTypeProperty(p)){
//         if (p.domain()&&!p.domain().getAdapter(def.RAMLService).isUserDefined()){
//             return null;
//         }
//     }
//     if (node.property()) {
//         if (p.domain() && p.domain() != node.property().range()) {
//             return "Facets";
//         }
//     }
//     return "General";
// }
//
// var valueOptions = function (x:hl.IProperty, node:hl.IHighLevelNode):string[] {
//     var vls = search.enumValues(x,node);
//     if (universehelpers.isNameProperty(x)){
//         if (node.definition().isAssignableFrom(universe.Universe10.TypeDeclaration.name)){
//             if (node.property()&&universehelpers.isBodyProperty(node.property())){
//                 if (!(node.property() instanceof def.UserDefinedProp)) {
//                     if (node.parent()&&
//                         universehelpers.isMethodType(node.parent().definition())){
//                         return ["application/json", "application/xml","multipart/form-data","application/x-www-form-urlencoded"]
//                     }
//                     return ["application/json", "application/xml"]
//                 }
//             }
//         }
//     }
//     if ((!vls) || vls.length == 0) {
//         var sug = (<def.Property>x).suggester()
//         if (sug) {
//             vls = sug(node);
//
//         }
//         if ((!vls) || vls.length == 0) {
//             vls = (<def.Property>x).getOftenKeys();
//
//         }
//     }
//     return _.unique(vls);
// };
//
// function addExampleControl(property: hl.IProperty, node : hl.IHighLevelNode,
//                            exampleElement : hl.IHighLevelNode, example : def.rt.nominalTypes.IExpandableExample,
//                            container : TopLevelNode) {
//
//     if (example.isYAML()) {
//         container.addItemToCategory(category(property, node),
//             new LowLevelTreeField(property, node, exampleElement.lowLevel(), example.name()));
//     } else if (example.isJSONString()) {
//         container.addItemToCategory(category(property, node),
//             new ExampleField(property, node, example.asString(), example.name()));
//     } else if (example.isXMLString()) {
//         container.addItemToCategory(category(property, node),
//             new XMLExampleField(property, node, example.asString(), example.name()));
//     }
// }

export function buildItem(detailsNode:ramlServer.DetailsItemJSON,dialog:boolean){
    let root=new TopLevelNode(detailsNode);

    if(detailsNode.children) {
        for (let child of detailsNode.children) {

            if (child.type == "CATEGORY") {

                let categoryName = child.title;
                if (child.children) {
                    for (let childOfChild of child.children) {
                        buildItemInCategory(childOfChild, root, categoryName);
                    }
                }

            } else {
                buildItemInCategory(child, root, null);
            }

        }
    }

    return root;
}

function buildItemInCategory(
    detailsNode: ramlServer.DetailsItemJSON, root: TopLevelNode, categoryName:string) {

    let item = null;

    if(detailsNode.type == "CHECKBOX"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new CheckBoxField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "JSONSCHEMA"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new JSONSchemaField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "XMLSCHEMA"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new XMLSchemaField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "MARKDOWN"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new MarkdownField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "SELECTBOX"
        && (<ramlServer.DetailsItemWithOptionsJSON>detailsNode).options !== null) {
        item = new SelectBox(<ramlServer.DetailsItemWithOptionsJSON>detailsNode);
    }
    else if(detailsNode.type == "MULTIEDITOR"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new SimpleMultiEditor(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "TREE") {
        item = new TreeField(detailsNode);
    }
    else if(detailsNode.type == "STRUCTURED") {
        item = new StructuredField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "TYPEDISPLAY") {
        item = new TypeDisplayItem(detailsNode);
    }
    else if(detailsNode.type == "TYPESELECT"
        && (<ramlServer.DetailsItemWithOptionsJSON>detailsNode).valueText !== null) {
        item = new TypeSelectBox(<ramlServer.DetailsItemWithOptionsJSON>detailsNode);
    }
    else if(detailsNode.type == "JSONEXAMPLE"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new ExampleField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "XMLEXAMPLE"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new XMLExampleField(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }
    else if(detailsNode.type == "ATTRIBUTETEXT"
        && (<ramlServer.DetailsValuedItemJSON>detailsNode).valueText !== null) {
        item = new PropertyEditorInfo(<ramlServer.DetailsValuedItemJSON>detailsNode);
    }

    if (item != null) {
        root.addItemToCategory(categoryName, item);
    } else {
        console.log("Can not recognize element " + detailsNode.type);
    }
}