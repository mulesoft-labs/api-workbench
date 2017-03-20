/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import rp=require("raml-1-parser")
import stubs=rp.stubs;
import lowLevel=rp.ll;
import hl=rp.hl;

import universes=rp.universes;

import search=rp.search;


import _=require("underscore")
import provider=require("../suggestion/provider")
import UI=require("atom-ui-lib")

import xmlutil=require("../../util/xmlutil")
import extract=require("./extractElementsDialog")
import shemagen=require("../../util/schemaGenerator")
import SpacePenViews = require('atom-space-pen-views')
import def=rp.ds
var services=def

import move=require("./moveElementsDialog")
import tooltip=require("../core/tooltip-manager")
import yaml = require("yaml-ast-parser")
import linterUI = require("../core/linter-ui")

import editorTools = require("../editor-tools/editor-tools")
import {universeHelpers} from "raml-1-parser/dist/index";

interface QuickFix{
    title:string
    executor:()=>void
}
export function createGlobalSchema(attr:hl.IAttribute){
    var r=attr.parent().root();
    var t:def.NodeClass=<def.NodeClass>attr.property().range().universe().type("GlobalSchema");
    var sc=stubs.createStubNode(t,(<any>t.universe().type("Api")).property("schemas"),""+attr.value());
    sc.attrOrCreate("value").setValue("!include "+"schemas/"+attr.value()+".json")
    r.add(sc);
    var ed=atom.workspace.getActiveTextEditor();
    ed.getBuffer().setText(r.lowLevel().unit().contents());
    var sdir=path.resolve(path.dirname(ed.getPath()),"schemas");
    if (!fs.existsSync(sdir)){
        fs.mkdirSync(sdir);
    }
    var shFile=path.resolve(sdir,attr.value()+".json");
    fs.writeFileSync(shFile,`
{
  "$schema" : "http://json-schema.org/draft-04/schema" ,
  "type" : "object" ,
  "properties" : {
   }
}
`)
   atom.workspace.open(shFile,{});
}

export function createGlobalSchemaFromNameAndContent(root:hl.IHighLevelNode,name:string,schp:string,content:string, absolutePath?: string){
    if (universeHelpers.isRAML10Node(root)) {
        createGlobalSchemaFromNameAndContent10(root, name, schp, content, absolutePath);
    } else if (universeHelpers.isRAML08Node(root)) {
        createGlobalSchemaFromNameAndContent08(root, name, schp, content, absolutePath);
    }
}

function createSchemaFile(content : string, schemaPath : string, absolutePath? : string) {
    var ed=getActiveEditor()
    var sdir=absolutePath ? path.dirname(absolutePath) : path.resolve(path.dirname(ed.getPath()),path.dirname(schemaPath));
    if (!fs.existsSync(sdir)){
        fs.mkdirSync(sdir);
    }
    var shFile=absolutePath ? absolutePath : path.resolve(path.dirname(ed.getPath()),schemaPath);
    fs.writeFileSync(shFile,content)
}

export function createGlobalSchemaFromNameAndContent10(root:hl.IHighLevelNode,name:string,
                                                       schemaPath:string,content:string, absolutePath?: string){
    var t:def.NodeClass=<def.NodeClass>root.definition().universe().type(universes.Universe10.TypeDeclaration.name);
    var sc=stubs.createStubNode(t,
        (<any>t.universe().type(universes.Universe10.Api.name)).property(universes.Universe10.Api.properties.types.name),
        ""+name);

    sc.attrOrCreate(universes.Universe10.TypeDeclaration.properties.type.name).setValue("!include "+schemaPath)

    root.add(sc);

    createSchemaFile(content, schemaPath, absolutePath);
}

export function createGlobalSchemaFromNameAndContent08(root:hl.IHighLevelNode,name:string,schp:string,content:string, absolutePath?: string){
    var t:def.NodeClass=<def.NodeClass>root.definition().universe().type(universes.Universe08.GlobalSchema.name);
    var sc=stubs.createStubNode(t,
        (<any>t.universe().type(universes.Universe08.Api.name)).property(universes.Universe08.Api.properties.schemas.name),
        ""+name);

    sc.attrOrCreate(universes.Universe08.GlobalSchema.properties.value.name).setValue("!include "+schp)

    root.add(sc);

    createSchemaFile(content, schp, absolutePath);
}

export function saveExample(r:hl.IHighLevelNode,schp:string,content:string){
    var ed=getActiveEditor();
    var sdir=path.resolve(path.dirname(ed.getPath()),path.dirname(schp));
    if (!fs.existsSync(sdir)){
        fs.mkdirSync(sdir);
    }
    var shFile=path.resolve(path.dirname(ed.getPath()),schp);
    fs.writeFileSync(shFile,content)
}


class NewProjectDialog{

    protected sourceValue:string;
    protected apititle:string="New API"
    protected version:string="v1"
    protected baseUri:string="http://api.samplehost.com"

    protected _raml1:boolean=true;
    protected _defStructure:boolean=true;
    protected _createSampleResource:boolean=true;
    constructor(protected title:string="Create RAML Project"){
        this.sourceValue = path.resolve(this.generateDefaultProjectParentFolder(), "newRamlProject");
    }

    generateDefaultProjectParentFolder() : string {
        return UI.fdUtils.getHome();
    }

    extraContent(s:UI.Section){

    }

    validateProjectLocation(value) {
        var toValidate : string = value ? value.trim() : "";

        if(!toValidate) {
            return UI.errorStatus("Path should't be empty");
        }

        var parentDirectory = path.dirname(toValidate)
        if (!parentDirectory || parentDirectory == ".") return UI.errorStatus("Can not find path parent")

        if(!fs.existsSync(parentDirectory)) return UI.errorStatus("Parent directory does not exist")

        return UI.okStatus()
    }

    validateTitle(value) {
        var toValidate : string = value ? value.trim() : "";

        if (!toValidate || toValidate.length < 1) {
            return UI.errorStatus("Title field is required");
        }

        return UI.okStatus()
    }

    show(){
        var zz=null;
        var section=UI.section(this.title,UI.Icon.BOOK,false,false,UI.h3("Please select location to place your project:")).pad(10,10)

        var panel = new UI.Panel(UI.LayoutType.BLOCK);

        var statusLabel:UI.Label = UI.label("", null, UI.TextClasses.ERROR)
        var slf=new UI.CustomField("", statusLabel,x=>x);
        slf.setDisplay(this.validateProjectLocation(this.sourceValue).code == UI.StatusCode.ERROR)
        panel.addChild(slf)

        var projectLocationInput = UI.texfField("",this.sourceValue,x=>this.sourceValue=x.getBinding().get())
        projectLocationInput.getBinding().addValidator(()=>this.validateProjectLocation(this.sourceValue))
        projectLocationInput.setStyle("width","400px");
        projectLocationInput.getBinding().addListener(value=> {

            //var st = projectLocationInput.getBinding().status()
            var st = this.validateProjectLocation(value)
            if (st.code != UI.StatusCode.ERROR) {
                //this.updateUI(q, x)
                statusLabel.setText("");
                statusLabel.setIcon(UI.Icon.NONE)
                slf.setDisplay(false)
            }
            else {
                statusLabel.setText(st.message);
                statusLabel.setIcon(UI.Icon.BUG)
                slf.setDisplay(true)
            }
        })

        panel.addChild(
            //UI.hc(
                projectLocationInput

                //UI.buttonSimple("Browse",
                //    ()=>UI.fdUtils..openFolderDialog("Select project location",
                //            newLocation=> {
                //                this.sourceValue=newLocation
                //                projectLocationInput.getBinding().set(newLocation)
                //                //var atomEditor = projectLocationInput.getActualField()
                //                //var atomEditorUI = atomEditor.ui()
                //                //var atomEditorUIModel = atomEditorUI.getModel();
                //                //atomEditorUIModel.setText(newLocation)
                //            },
                //            true, this.sourceValue)
                //).margin(10,0).setStyle("margin-bottom", "0.75em")
            //).setPercentWidth(100)
        )

        panel.addChild(UI.h3("Title of your API:"));

        var titleStatusLabel = UI.label("", null, UI.TextClasses.ERROR);

        var titleStatusMessage = new UI.CustomField("", titleStatusLabel, x => x);

        titleStatusMessage.setDisplay(false);

        panel.addChild(titleStatusMessage);

        var titleTextField = UI.texfField("", this.apititle, x => this.apititle = x.getBinding().get());

        titleTextField.getBinding().addValidator(() => this.validateTitle(this.apititle));

        titleTextField.getBinding().addListener(value => {
            var status = this.validateTitle(value);

            if (status.code !== UI.StatusCode.ERROR) {
                titleStatusLabel.setText("");
                titleStatusLabel.setIcon(UI.Icon.NONE)
                titleStatusMessage.setDisplay(false)
            } else {
                titleStatusLabel.setText(status.message);
                titleStatusLabel.setIcon(UI.Icon.BUG)
                titleStatusMessage.setDisplay(true)
            }
        })

        panel.addChild(titleTextField);
        panel.addChild(UI.h3("Version of your API"));
        panel.addChild(UI.texfField("",this.version,x=>this.version=x.getBinding().get()))
        panel.addChild(UI.h3("Base URI of your API"));
        panel.addChild(UI.texfField("",this.baseUri,x=>this.baseUri=x.getBinding().get()))

        section.addChild(panel);

        var r1=UI.checkBox("Use RAML 1.0")
        r1.setValue(this._raml1)
        r1.getBinding().addListener(x=>this._raml1=r1.getValue());
        section.addChild(r1)
        var r2=UI.checkBox("Create default directory structure")
        r2.setValue(this._defStructure)
        r2.getBinding().addListener(x=>this._defStructure=r2.getValue());
        section.addChild(r2)
        var r3=UI.checkBox("Create sample resource and method")
        r3.setValue(this._createSampleResource)
        r3.getBinding().addListener(x=>this._createSampleResource=r3.getValue());
        section.addChild(r3)
        var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex");
        buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"))
        buttonBar.addChild(UI.button("Cancel",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{zz.destroy()}).margin(10,10))
        buttonBar.addChild(UI.button("Create",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE,x=>{
            if(this.validateTitle(this.apititle).code === UI.StatusCode.ERROR) {
                return;
            }

            if(this.validateProjectLocation(this.sourceValue).code === UI.StatusCode.ERROR) {
                return;
            }

            this.onOk(zz);
            zz.destroy();
        }))
        section.addChild(buttonBar);

        zz=(<any>atom).workspace.addModalPanel( { item: section.renderUI() });
    }

    protected createIfNotExist(p:string){
        var ps=path.resolve(this.sourceValue,p);
        if (!fs.existsSync(ps)){
            fs.mkdirSync(ps);
        }
    }

    protected onOk(zz) {

        if (!fs.existsSync(this.sourceValue)) {
            fs.mkdirSync(this.sourceValue);
        }
        if (this._defStructure) {
            this.createIfNotExist("schemas");
            this.createIfNotExist("examples");
            this.createIfNotExist("traits");
            this.createIfNotExist("resourceTypes");
            this.createIfNotExist("securitySchemes");
            this.createIfNotExist("documentation");
            if (this._raml1) {
                this.createIfNotExist("notebooks");
                this.createIfNotExist("scripts");
            }
        }
        var content = createRAMLFile(this.apititle, this.version, this.baseUri, this._createSampleResource, this._raml1);
        var ps=path.resolve(this.sourceValue,"api.raml");
        fs.writeFileSync(ps,content);
        (<any>atom).open({pathsToOpen:[this.sourceValue,ps]});
    }
}


export function createRAMLFile(title: string, version: string, baseUri: string, sample: boolean = true, raml1: boolean = true) {
    var apiLines = [ (raml1 ? "#%RAML 1.0" : "#%RAML 0.8"), `title: ${title}`];
    if (version) apiLines.push(`version: ${version}`);
    if (baseUri) apiLines.push(`baseUri: ${baseUri}`);

    var typesLines = [
            'types:',
            '  TestType:',
            '    type: object',
            '    properties:',
            '      id: number',
            '      optional?: string',
            '      expanded:',
            '        type: object',
            '        properties:',
            '          count: number'
        ],
        resourceLines = [
            '/helloWorld:',
            '  get:',
            '    responses:',
            '      200:',
            '        body:',
            '          application/json:',
            '            example: |',
            '              {',
            '                "message" : "Hello World"',
            '              }'
        ];

    var result: string[] = apiLines;
    if (sample) {
       if (raml1) result = result.concat(typesLines);
       result = result.concat(resourceLines);
    }
    return result.join('\n') + '\n';
}

export function newProject(){
   new NewProjectDialog().show()
}

// export function moveResource(h:hl.IHighLevelNode){
//     new move.MoveElementsDialog(h, "Resource Type",true).show()
// }

export function splitOnLines(text:string):string[]{
    var lines = text.match(/^.*((\r\n|\n|\r)|$)/gm);
    return lines;
}
export function cleanEmptyLines(text:string):string{
    var lines=splitOnLines(text);
    var rs:string[]=[]
    for (var i=0;i<lines.length;i++){
        if (lines[i].trim().length>0){
            rs.push(lines[i]);
        }
    }
    return rs.join("");
}
//FIXME remove it from here duplication with jsyaml2lowLevel.ts
function stripIndent(text:string,indent:string){
    var lines = splitOnLines(text);
    var rs=[];
    for (var i=0;i<lines.length;i++){
        if (i==0){
            rs.push(lines[0]);
        }
        else{
            rs.push(lines[i].substring(indent.length));
        }
    }
    return rs.join("");
}
var leadingIndent = function (node:lowLevel.ILowLevelASTNode, text:string) {
    var leading = "";
    var pos = node.start() - 1;
    while (pos > 0) {
        var ch = text[pos];
        if (ch == '\r' || ch == '\n') break;
        leading = ch + leading;
        pos--;
    }
    return leading;
};
function indent(line:string){
    var rs="";
    for (var i=0;i<line.length;i++){
        var c=line[i];
        if (c=='\r'||c=='\n'){
            continue;
        }
        if (c==' '||c=='\t'){
            rs+=c;
            continue;
        }
        break;
    }
    return rs;
}

export function getActiveEditor() {
    var activeEditor = atom.workspace.getActiveTextEditor()
    if (activeEditor) {
        return activeEditor
    }

    if (editorTools.aquireManager())
        return <AtomCore.IEditor>editorTools.aquireManager().getCurrentEditor()

    return null
}

export class MoveToNewFileDialog{

    constructor(private node:hl.IHighLevelNode){

    }
    destination:string;

    show(){
        var zz:any=null;
        var node=this.node;
        var vc=UI.section("Move node content to new file ",UI.Icon.GIST_NEW,false,false);
        var errorLabel=UI.label("please enter correct destination path",UI.Icon.BUG,UI.TextClasses.ERROR,UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(errorLabel));
        vc.addChild(UI.label("Please enter destination path"));
        var txt=UI.texfField("","",x=>{
            if (!txt){
                return;
            }
            this.destination=txt.getBinding().get();
            var isError=this.destination.trim().length==0
            if (!isError) {
                if (path.extname(this.destination) != '.raml') {
                    isError = true;
                }
            }
            if (!isError) {
                var dir = path.resolve(path.dirname(getActiveEditor().getPath()), path.dirname(this.destination));
                if (!fs.existsSync(dir)) {
                    isError = true;
                }
                else{
                    var st=fs.statSync(dir)
                    if (!st.isDirectory()){
                        isError=true;
                    }
                }
            }

            errorLabel.setDisplay(isError);
            okButton.setDisabled(isError);
        });
        vc.addChild(UI.vc(txt));
        var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex");
        buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"))
        buttonBar.addChild(UI.button("Cancel",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{zz.destroy()}).margin(10,10))
        var okButton=UI.button("Move",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE,x=>{
            var d=path.resolve(path.dirname(getActiveEditor().getPath()), this.destination);
            var dump=this.node.lowLevel().dump();
            var ci=splitOnLines(dump);
            var li=ci.length>1?indent(ci[1]):indent(ci[0]);
            dump=dump.substring(this.node.lowLevel().keyEnd()-this.node.lowLevel().start()+1).trim();
            dump=stripIndent(dump,li);
            dump="#%RAML 0.8 "+this.node.definition().nameId()+"\n"+dump;
            fs.writeFileSync(d,dump);
            //no we need to replace content of the node with text;

            var txt=node.lowLevel().unit().contents();
            var endPart=txt.substring(node.lowLevel().end());
            var startPart=txt.substring(0,node.lowLevel().keyEnd()+1);
            var vl=startPart+" !include "+this.destination+endPart;
            getActiveEditor().setText(vl);
            zz.destroy();
        });
        okButton.setDisabled(true)
        buttonBar.addChild(okButton);
        vc.addChild(buttonBar)
        var html=vc.renderUI();
        zz=(<any>atom).workspace.addModalPanel( { item: html});
        html.focus();
    }


}
export function moveOut(h:hl.IHighLevelNode){
    new MoveToNewFileDialog(h).show()
}

export function revalidate() {
    var currentEditor = getActiveEditor();
    if (!currentEditor) return;

    linterUI.relint(currentEditor);
}

export function renameRAMLElement() {
    var ed = getActiveEditor();
    var quickFixes:QuickFix[] = [];
    if (ed) {
        if (path.extname(ed.getPath()) == '.raml') {
            var request = {editor: ed, bufferPosition: ed.getCursorBufferPosition()};
            var node = provider.getAstNode(request, false);
            if (!node) {
                return;
            }
            var offset = request.editor.getBuffer().characterIndexForPosition(request.bufferPosition);
            var kind = search.determineCompletionKind(ed.getBuffer().getText(), offset);
            if (kind == search.LocationKind.VALUE_COMPLETION) {
                var hlnode = <hl.IHighLevelNode>node;

                var attr = _.find(hlnode.attrs(), x=>x.lowLevel().start() < offset && x.lowLevel().end() >= offset && !x.property().getAdapter(services.RAMLPropertyService).isKey());
                if (attr) {
                    if (attr.value()) {
                        var p:hl.IProperty = attr.property();
                        //FIXME INFRASTRUCTURE NEEDED
                        var v = attr.value();
                        var targets = search.referenceTargets(p,hlnode);
                        var t:hl.IHighLevelNode = _.find(targets, x=>x.name() == attr.value())
                        if (t) {
                            UI.prompt("New name for " + attr.value(), newVal=> {
                                findUsagesImpl((n, r)=> {
                                    //todo update nodes
                                    r.reverse().forEach(x=> {
                                        var ua = x;
                                        ua.asAttr().setValue(newVal)
                                    })
                                    n.attr(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId()).setValue(newVal);
                                    var ed = getActiveEditor();
                                    ed.getBuffer().setText(n.lowLevel().unit().contents());

                                })
                            }, attr.value());
                        }
                    }
                    //console.log(attr.value());
                }
            }
            if (kind == search.LocationKind.KEY_COMPLETION || kind == search.LocationKind.SEQUENCE_KEY_COPLETION) {
                var hlnode = <hl.IHighLevelNode>node;

                        UI.prompt("New name for " + hlnode.name(), newVal=> {
                            findUsagesImpl((n, r)=> {
                                var oldValue = n.attrValue(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId())

                                //todo update nodes
                                r.reverse().forEach(x=> {
                                    var ua = x;

                                    renameInProperty(ua.asAttr(), oldValue, newVal)
                                })
                                n.attr(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId()).setValue(newVal);
                                var ed = getActiveEditor();
                                ed.getBuffer().setText(n.lowLevel().unit().contents());

                            })
                        }, hlnode.name());
            }
        }
    }
}

function renameInProperty(property : hl.IAttribute, contentToReplace : string, replaceWith : string) {
    var oldPropertyValue = property.value();
    if (typeof oldPropertyValue == 'string') {

        var oldPropertyStringValue = <string> oldPropertyValue;

        var newPropertyStringValue = oldPropertyStringValue.replace(contentToReplace, replaceWith)
        property.setValue(newPropertyStringValue)
        if (oldPropertyStringValue.indexOf(contentToReplace) == -1) {
            if (property.name().indexOf(contentToReplace)!=-1){
                var newValue = (<string>property.name()).replace(contentToReplace, replaceWith);
                property.setKey(newValue);
            }
        }
        return;
    } else if (oldPropertyValue && (typeof oldPropertyValue ==="object")) {
        var structuredValue = <hl.IStructuredValue> oldPropertyValue;

        var oldPropertyStringValue = structuredValue.valueName();
        if (oldPropertyStringValue.indexOf(contentToReplace) != -1) {
            var convertedHighLevel = structuredValue.toHighLevel();

            if(convertedHighLevel) {
                var found=false;
                if (convertedHighLevel.definition().isAnnotationType()){
                    var prop=getKey((<def.AnnotationType>convertedHighLevel.definition()),structuredValue.lowLevel())
                    prop.setValue("("+replaceWith+")");
                    return;
                }
                convertedHighLevel.attrs().forEach(attribute => {
                    if(attribute.property().getAdapter(services.RAMLPropertyService).isKey()) {
                        var oldValue = attribute.value();
                        if (typeof oldValue == 'string') {
                            found=true;
                            var newValue = (<string>oldValue).replace(contentToReplace, replaceWith);
                            attribute.setValue(newValue);
                        }
                    }
                })

                return;
            }
            //var lowLevelNode = structuredValue.lowLevel();
            //if ((<any>lowLevelNode).yamlNode) {
            //    var yamlNode : yaml.YAMLNode = (<any>lowLevelNode).yamlNode();
            //    if(yamlNode.kind == yaml.Kind.MAPPING) {
            //        var key = (<yaml.YAMLMapping>yamlNode).key
            //        if (key && key.value && key.value.indexOf(contentToReplace) != -1){
            //            oldPropertyStringValue = key.value
            //            var newStringValue = oldPropertyStringValue.replace(contentToReplace, replaceWith);
            //            key.value = newStringValue;
            //            return;
            //        }
            //    }
            //}


        }
    }

    //default case
    property.setValue(replaceWith)
}
function getKey(t: def.AnnotationType,n:lowLevel.ILowLevelASTNode){
    var up=new def.UserDefinedProp("name", null);
    //up.withDomain(this);
    up.withRange(this.universe().type(universes.Universe10.StringType.name));
    up.withFromParentKey(true);
    var node=t.getAdapter(services.RAMLService).getDeclaringNode();
    //node:ll.ILowLevelASTNode, parent:hl.IHighLevelNode, private _def:hl.IValueTypeDefinition, private _prop:hl.IProperty, private fromKey:boolean = false
    return stubs.createASTPropImpl(n,node,up.range(),up,true);
    //rs.push(up);
}

var getKeyValue = function (offset, txt) {
    var m = offset;

    for (var i = offset; i >= 0; i--) {
        var c = txt.charAt(i);
        if (c == ' ' || c == '\r' || c == '\n' || c == '\t') {
            m = i + 1;
            break;
        }
    }
    var res = "";
    for (var i = m; m < txt.length; i++) {
        var c = txt.charAt(i);
        if (c == ' ' || c == '\r' || c == '\n' || c == '\t' || c == ':') {
            break;
        }
        res += c;
    }
    return res;
};
export function select(){
    var ed=getActiveEditor();
    var request={editor:ed,bufferPosition:ed.getCursorBufferPosition()};
    var node=provider.getAstNode(request,false);
    if (!node){
        return;
    }
    var start=ed.getBuffer().positionForCharacterIndex(node.lowLevel().start());
    var end=ed.getBuffer().positionForCharacterIndex(node.lowLevel().end());
    ed.setSelectedBufferRange({start:start,end:end},{});
}
//export function expandSignature(attr:hl.IAttribute){
//    var tr=signature.convertToTrait(signature.parse(attr));
//    //console.log('trait:\n' + tr.highLevel().lowLevel().dump());
//    var res = attr.parent();
//    //pr.remove(attr); // incorrect usage!!! remove attributes as below
//    attr.remove();
//    tr.highLevel().elements().forEach(x=>{
//        res.add(<any>x)
//    });
//    var ed=getActiveEditor();
//    ed.setText(attr.root().lowLevel().unit().contents());
//}



export function findUsagesImpl(f:(x:hl.IHighLevelNode,t:hl.IParseResult[])=>any=display){
    var ed=getActiveEditor();
    if (ed){
        if (path.extname(ed.getPath())=='.raml'){
            var request={editor:ed,bufferPosition:ed.getCursorBufferPosition()};
            var p=request.editor.getPath();
            var prj=rp.project.createProject(path.dirname(p));
            var unit=prj.unit(path.basename(p));
            var offset=request.editor.getBuffer().characterIndexForPosition(request.bufferPosition);
            var text=request.editor.getBuffer().getText();
            unit.updateContent(text);
            var decl=search.findUsages(unit,offset);
            if (decl.node) {
                f(decl.node, _.filter(decl.results, result => (result && result.parent && result.parent() !== decl.node)));
            }
        }
    }
}
export function findUsages(){
    findUsagesImpl(display);
}
class SearchResultView extends SpacePenViews.ScrollView {


    scriptPath:string;
    constructor(private query:string,private _result:hl.IParseResult[] ) {
        super();
    }
    initialize () {
        super.initialize.apply(this, arguments)
        return true;
    }

    static content (): HTMLElement {
        return this.div({ class: 'raml-console pane-item', tabindex: -1 })
    }

    isAttached=false;

    attached (): void {
        if (this.isAttached) {
            return
        }
        this.load();
        this.isAttached = true
    }
    panel:any;

    setInput(query:string,_result:hl.IParseResult[]){
        this.query=query;
        this._result=_result;
        this.load();
    }
    load(){
        var section=UI.section("Find usages for "+this.query,UI.Icon.SEARCH)
        var view=UI.list(this._result,x=>{
            var p1 = getActiveEditor().getBuffer().positionForCharacterIndex(x.getLowLevelStart());

            var res= UI.hc(UI.a(x.id(),y=>{
               openPropertyNode(getActiveEditor(),x);
           }),UI.label(x.lowLevel().unit().path()+" line:",UI.Icon.NONE,UI.TextClasses.SUBTLE).pad(5,5),
           UI.label(""+p1.row,UI.Icon.NONE,UI.TextClasses.SUCCESS))
           return res;
        });
        view.setStyle("max-height","400px");
        section.addChild(view);
        section.addChild(UI.button("Close",UI.ButtonSizes.SMALL,UI.ButtonHighlights.PRIMARY,UI.Icon.NONE,x=>{this.panel.destroy();sv=null}))
        this.html(section.renderUI());
    }
}
var sv:SearchResultView;

function display(query:hl.IHighLevelNode, n:hl.IParseResult[]){
    if (sv){
        sv.setInput(query.name(),n);
    }
    else {
        sv = new SearchResultView(query.name() + ":" + query.definition().nameId(), n)
        sv.panel = (<any>atom.workspace).addBottomPanel({item: sv});
    }
}
//TODO REFACTOR COMMON LOGIC TO COFE
var openPropertyNode = function (ed:AtomCore.IEditor, t:hl.IParseResult) {
    var p1 = ed.getBuffer().positionForCharacterIndex(t.getLowLevelStart());
    var p2 = ed.getBuffer().positionForCharacterIndex(t.getLowLevelEnd());
    ed.setSelectedBufferRange({start: p1, end: p2}, {});
};
//TODO REFACTOR COMMON LOGIC TO COFE
var openNode = function (ed:AtomCore.IEditor, t:hl.IParseResult) {
   openLowLevelNode(ed,t.lowLevel());
};
//TODO REFACTOR COMMON LOGIC TO COFE
var openLowLevelNode = function (ed:AtomCore.IEditor, t:lowLevel.ILowLevelASTNode) {
    if (t.unit().absolutePath()!=ed.getPath()){
        atom.workspace.open(t.unit().absolutePath(),{}).then(x=>{

            ed=getActiveEditor();
            openLowLevelNode(ed,t);
        });
        return;
    }
    var p1 = ed.getBuffer().positionForCharacterIndex(t.start());
    var p2 = ed.getBuffer().positionForCharacterIndex(t.end());
    p2.column = p1.column + t.key()?t.key().length:0;
    p2.row = p1.row;
    ed.setSelectedBufferRange({start: p1, end: p2}, {});
};

export function gotoDeclaration(){
    var ed=getActiveEditor();
    if (ed){
        if (path.extname(ed.getPath())=='.raml'){
            var request={editor:ed,bufferPosition:ed.getCursorBufferPosition()};
            var p=request.editor.getPath();
            var prj=rp.project.createProject(path.dirname(p));
            var unit=prj.unit(path.basename(p));
            var offset=request.editor.getBuffer().characterIndexForPosition(request.bufferPosition);
            var text=request.editor.getBuffer().getText();
            unit.updateContent(text);
            var decl=search.findDeclaration(unit,offset);

            if(!decl) {
                var canBeReference = search.deepFindNode(unit.highLevel(), offset,offset, false);
                
                var parentProperty = canBeReference && canBeReference.parent() && canBeReference.parent().property();

                decl = universeHelpers.isUsesProperty(parentProperty) && search.findDeclaration(unit, offset, search.LocationKind.PATH_COMPLETION);
            }

            if(decl) {
                if(!(<any>decl).absolutePath){
                    openLowLevelNode(ed,(<hl.IParseResult>decl).lowLevel());
                } else {
                    var absolutePath = (<lowLevel.ICompilationUnit>decl).absolutePath();

                    if(absolutePath && absolutePath.toLowerCase().indexOf('http') === 0) {
                        return;
                    }

                    atom.workspace.open(absolutePath, {});
                }
            }
        }
    }
}
