/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import rp=require("raml-1-parser")
import stubs=rp.stubs;
import lowLevel=rp.ll;
import hl=rp.hl;
import _=require("underscore")
import provider=require("../suggestion/provider")
import UI=require("atom-ui-lib")
import editorTools = require("../editor-tools/editor-tools");
import outlineView=require("../editor-tools/outline-view")

import def=rp.ds;
import assist=require("./assist-utils")
import yaml=require("yaml-ast-parser")
import universeHelpers = rp.universeHelpers;
import universeModule = rp.universes;
import search = rp.search;
import universes=rp.universes

import util = require("../../util/index");

export class ExtractTypesAndTraitsDialog{

    constructor(private node:hl.IHighLevelNode,private name:string,private _resourceType:boolean){

    }

    filters:NodeFilters=new NodeFilters();

    getActiveEditor() {
        return assist.getActiveEditor()
    }

    show(){
        var zz:any=null;
        var node=this.node;
        var vc=UI.section("Extract "+this.name+":",UI.Icon.GIST_NEW,false,false);
        vc.addChild(UI.label("Extracted element name:").pad(5,0))
        var errorLabel=UI.label("Please type valid name for "+this.name,UI.Icon.BUG,UI.TextClasses.ERROR,UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(errorLabel));
        var tf=UI.texfField("","",x=>{
            if (!okButton){
                return;
            }
            var isErr=tf.getBinding().get().trim().length==0;
            okButton.setDisabled(isErr);
            errorLabel.setDisplay(isErr)
            stub.attr("name").setValue(tf.getBinding().get());
        });
        vc.addChild(tf);
        vc.addChild(UI.label("Move elements which should be extracted to the right panel"));
        var el=UI.hc();
        vc.setPercentWidth(100);
        el.setPercentWidth(100);
        var filterFunc=(x:hl.IHighLevelNode)=>{
            if(this._resourceType) {
                if (universeHelpers.isResourceType(x.definition())) {
                    return false;
                }
            }
            if (_.find(this.filters.removals,y=>x==y)){
                return false;
            }
            return true;
        };
        var stub = this.createNodeStub(node);
        var v=createSmallSelectionPanel(node,filterFunc,"400px","47%");
        var v1=createSmallSelectionPanel(stub,x=>true,"400px","47%","right");
        var moveRight=UI.button(">",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=v.getSelection().elements;
            this.moveRight(z, stub, node, v, v1);
        });
        var moveLeft=UI.button("<",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=v1.getSelection().elements;
            this.moveLeft(z, stub, node,v,v1);
        });
        var allRight=UI.button(">>",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=node.elements().filter(x=>filterFunc(x));
            this.moveRight(z,stub,node,v,v1);
        });
        var allLeft=UI.button("<<",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=stub.elements();
            this.moveLeft(z,stub,node,v,v1);

        });
        el.addChild(UI.vc(moveRight,moveLeft,allRight,allLeft));
        el.addChild(v);
        el.addChild(v1);
        vc.addChild(el);
        v.addSelectionListener({

            selectionChanged:(ev:UI.SelectionChangedEvent<any>)=> {
                var rs:hl.IHighLevelNode[]=<any>ev.selection.elements;
                var m=(_.find(rs, x=>x.parent() != node)!=undefined )
                moveRight.setDisabled(m||(rs.length == 0));
            }
        });
        v1.addSelectionListener(
            {
                selectionChanged:(ev:UI.SelectionChangedEvent<any>)=> {

                    var nodesToMove:hl.IHighLevelNode[]=<any>ev.selection.elements;

                    var unregisteredNode = _.find(nodesToMove, nodeToMove => {
                        var registeredNode = _.find(this.filters.removals, movedNode => nodeToMove.id() == movedNode.id());
                        return registeredNode == undefined
                    }) != undefined;

                    //var m=(_.find(rs, x=>x.parent() != stub)!=undefined )
                    moveLeft.setDisabled(unregisteredNode||(nodesToMove.length == 0));
                }
            })
        moveLeft.setDisabled(true);
        moveRight.setDisabled(true);
        var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex");
        buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"))
        buttonBar.addChild(UI.button("Cancel",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{zz.destroy()}).margin(10,10))
        var okButton=UI.button("Extract",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE,x=>{

            this.apply(node, stub, tf.getBinding().get())

            //this.onOk(zz);
            zz.destroy();
        })
        okButton.setDisabled(true)
        buttonBar.addChild(okButton);
        vc.addChild(buttonBar)
        var html=vc.renderUI();
        zz=(<any>atom).workspace.addModalPanel( { item: html});
        html.focus();
    }

    private apply(node:hl.IHighLevelNode, stub:hl.IHighLevelNode,
        newTypeName : string) {
        this.filters.removals.forEach(x=>node.remove(x));

        var stub2 = this.createNodeStub(node)
        stub.elements().forEach(child => (<any>stub2).add(child))
        stub2.attr("name").setValue(newTypeName);

        var typeOrTraitValueToReplace = "_________TEMPORARY_TYPE_OR_TRAIT_VALUE_________"
        var replacements : string[] = [];

        var superAttributeName = this._resourceType ?
            universeModule.Universe10.ResourceType.properties.type.name :
            universeModule.Universe10.Trait.properties.is.name;

        var superAttributes = node.attributes(superAttributeName);
        var superAttrProperty = stub2.definition().property(superAttributeName);
        if (superAttributes && superAttributes.length > 0) {
            for (var i = 0; i < superAttributes.length; i++) {

                var superAttribute = superAttributes[i];

                var superAttributeLL = superAttribute.lowLevel();
                var start = superAttributeLL.valueStart();
                var end = superAttributeLL.valueEnd();
                if (start <= 0) {
                    start = superAttributeLL.start();
                    end = superAttributeLL.end();
                }

                var typeOrTraitValueToReplaceWith =
                    superAttributeLL.unit().contents().substr(
                        start, end-start);

                replacements.push(typeOrTraitValueToReplaceWith);

            }

            for (var i = 0; i < superAttributes.length; i++) {
                var superAttribute = superAttributes[i];
                node.remove(superAttribute);
            }

            var stubAttributeValue = typeOrTraitValueToReplace;
            if (superAttributes.length > 1) {
                stubAttributeValue = "[" + stubAttributeValue + "]";
            }
            var stubSuperAttribute =
                stubs.createAttr(superAttrProperty,
                    stubAttributeValue);

            stub2.add(stubSuperAttribute);

            node.resetChildren();
            stub2.resetChildren();
        }

        if (this._resourceType) {
            node.add(
                stubs.createAttr(node.definition().property(superAttributeName),
                    stub.name()))
        } else {
            node.add(
                stubs.createAttr(node.definition().property(superAttributeName),
                    "[" + stub.name() + "]"))
        }

        node.root().add(stub2);

        var cl=node.lowLevel().unit().contents();
        if (replacements.length == 1) {
            var totalRepalcement = replacements[0];
            if (superAttrProperty.isMultiValue()) {
                totalRepalcement = "[" + totalRepalcement + "]";
            }

            cl = cl.replace(typeOrTraitValueToReplace, totalRepalcement);
        } else if (replacements.length > 1) {
            var totalReplacement = "";
            for (var i = 0; i < replacements.length - 1; i++) {
                totalReplacement += replacements[i] + ", ";
            }
            totalReplacement += replacements[replacements.length - 1];

            cl = cl.replace(typeOrTraitValueToReplace, totalReplacement);
        }

        this.getActiveEditor().setText(assist.cleanEmptyLines(cl));
    }

    private createNodeStub(node) {
        var universe = node.definition().universe();
        var rtypes = node.root().definition().property("resourceTypes");
        var traits = node.root().definition().property("traits");

        var stub =stubs.createStubNode( (<def.NodeClass>universe.type("ResourceType")),rtypes);
        if (!this._resourceType) {
            stub = stubs.createStubNode((<def.NodeClass>universe.type("Trait")),traits)
        }
        return stub;
    }

    private moveLeft(z, stub,node, v,  v1) {
        if (z.length > 0) {
            z.forEach(x=>this.filters.removals = this.filters.removals.filter(y=>y.id() != x.id()));
            z.forEach(x=>{
                stub.remove(<hl.IHighLevelNode>x);
                var k = 0
                k++
            });
        }
        stub.resetChildren();
        v.setInput(node);
        v1.setInput(stub);
    }

    private moveRight(z, stub, node, v, v1) {
        if (z.length > 0) {
            this.filters.removals = this.filters.removals.concat(<hl.IHighLevelNode[]>z);
        }
        z.forEach(x=>stub.add(x.copy()));
        stub.resetChildren();
        v.setInput(node);
        v1.setInput(stub)
    }

}

class NodeFilters{
    removals:hl.IHighLevelNode[]=[];

}

export function createSmallSelectionPanel(node:hl.IHighLevelNode,filter:(x:hl.IHighLevelNode)=>boolean,height:string,width:string,float:string="left"){
    var v=createVIewer(node,filter);
    v.setTagName("atom-panel");
    v.setStyle("width",width);
    v.setStyle("border","solid");
    v.setStyle("border-width","1px");
    v.setStyle("height",height);
    v.setStyle("overflow","scroll");
    if (float) {
        v.setStyle("float", float)
    }
    v.margin(3,3,3,3)
    return v;
}

export class HLRenderer implements UI.ICellRenderer<hl.IParseResult>{

    constructor(private opener: (x: hl.IParseResult) => void) {

    }
    render(model: hl.IParseResult): UI.BasicComponent<any> {
        try {
            if (model.isAttr()) {
                var attr = <hl.IAttribute>model;
                return UI.hc(UI.label(attr.name() + ":" + attr.value()), UI.a("", x=> {
                    var p1 = editorTools.aquireManager().getCurrentEditor().getBuffer().positionForCharacterIndex(model.lowLevel().start());
                    var p2 = editorTools.aquireManager().getCurrentEditor().getBuffer().positionForCharacterIndex(model.lowLevel().end());
                    editorTools.aquireManager().getCurrentEditor().setSelectedBufferRange({ start: p1, end: p1 }, {});

                }, UI.Icon.ARROW_SMALL_LEFT, null, null));

            }
            if (model.isUnknown()) {
                return UI.label("unknown");
            }
            var icon = UI.Icon.DASH;
            var highLight = UI.TextClasses.NORMAL;
            var node = <hl.IHighLevelNode>model;
            var pc=node.definition().key();
            if (pc === universes.Universe08.Resource||pc===universes.Universe10.Resource) {
                icon = UI.Icon.PRIMITIVE_SQUARE;
                highLight = UI.TextClasses.HIGHLIGHT;
            }
            if (pc === universes.Universe08.Method||pc===universes.Universe10.Method) {
                icon = UI.Icon.PRIMITIVE_DOT
                highLight = UI.TextClasses.WARNING;
            }
            if (pc === universes.Universe08.AbstractSecurityScheme||pc===universes.Universe10.AbstractSecurityScheme) {
                icon = UI.Icon.LOCK;
                highLight = UI.TextClasses.HIGHLIGHT;
            }
            if (pc === universes.Universe08.AbstractSecurityScheme||pc==universes.Universe10.AbstractSecurityScheme) {
                icon = UI.Icon.FILE_SUBMODULE;
                highLight = UI.TextClasses.NORMAL;
            }
            if (pc==universes.Universe10.TypeDeclaration && universeHelpers.isAnnotationTypesProperty(node.property())) {
                icon = UI.Icon.TAG;
                highLight = UI.TextClasses.HIGHLIGHT;
            }
            if (node.definition().isAssignableFrom(universes.Universe10.TypeDeclaration.name)||
                node.definition().isAssignableFrom(universes.Universe08.Parameter.name)) {
                if (node.property()&&node.property().nameId()==universes.Universe10.ObjectTypeDeclaration.properties.properties.name){
                    icon = UI.Icon.FILE_BINARY;
                    highLight = UI.TextClasses.SUCCESS;
                }
                else {
                    icon = UI.Icon.FILE_BINARY
                    highLight = UI.TextClasses.SUCCESS;
                }
            }
            var nm=model.name();
            var hnode=(<hl.IHighLevelNode>model);
            if (pc===universes.Universe08.DocumentationItem||pc===universes.Universe10.DocumentationItem){
                icon = UI.Icon.BOOK
                var a=hnode.attr("title");
                if (a){
                    nm=a.value();
                }
            }
            var extraText="";
            var extraClass=UI.TextClasses.NORMAL;

            var hc=UI.hc(UI.label(nm, icon, highLight))
            var tp=node.attr("type");
            if (tp){
                var vl=tp.value();
                if (vl==null){
                    vl="";
                }
                var sv="";
                if (typeof vl ==="object"){
                    sv=":"+(<hl.IStructuredValue>vl).valueName();
                }
                else{
                    sv=":"+vl;
                }
                hc.addChild(UI.label(sv, UI.Icon.NONE, UI.TextClasses.WARNING).margin(2,0,0,0));
            }
            if (node.lowLevel().unit()!=node.root().lowLevel().unit()){
                highLight=UI.TextClasses.SUBTLE;
                hc.addChild(UI.label("("+node.lowLevel().unit().path()+")",UI.Icon.NONE,highLight).margin(5,0,0,0));
            }
            hc.addClass("outline");
            return hc;
        } catch (e) {
            console.log(e);
            return UI.hc(UI.label("Illegal node", UI.Icon.ARROW_SMALL_LEFT, null, null));
        }
    }
}

export function createVIewer(h:hl.IHighLevelNode,filter:(x:hl.IHighLevelNode)=>boolean) {
    var v= UI.treeViewer((x:hl.IHighLevelNode)=>{
        return x.elements().filter(x=>filter(x))
    }, new HLRenderer(model=> {
    }));
    v.setInput(h);
    return v;
}

export class AbstractlMoveElementsDialog {

    constructor(private parentNode:hl.IHighLevelNode,private name:string){
    }

    /**
     * A list of moved nodes.
     */
    movedNodes : hl.IParseResult[] = []



    leftPanel : UI.TreeViewer<hl.IParseResult, hl.IParseResult>

    rightPanel : UI.TreeViewer<hl.IParseResult, hl.IParseResult>

    rootAtomPanel : any

    okButton : UI.Button

    errorLabel : UI.TextElement<any>

    stubRoot : hl.IHighLevelNode

    /**
     * Intended for overriding in subclass.
     * Is called for each node to check whether to display it, whether the node can be moved,
     * and whether node children needs to be checked.
     *
     * @param nodeToFilter
     * @returns {{visitChildren: boolean, display: boolean, canBeMove: boolean}}
     */
    checkNode (nodeToFilter: hl.IHighLevelNode) : {
        visitChildren:boolean
        display:boolean
        canBeMoved:boolean
    }
    {
        return {
            visitChildren : true,
            display : true,
            canBeMoved : true
        }
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate() : string {
        return null;
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel : UI.Section) {

    }

    /**
     * Is called when "Ok" is pressed.
     * @param movedNodes - nodes, which were moved. Plain list.
     * @param stubTreeRoot - nodes, which were moved, as a stub tree with a root
     * being a stub of the original dialog parent node. Nodes original hierarchy is preserved.
     */
    performOk(movedNodes : hl.IParseResult[], stubTreeRoot : hl.IHighLevelNode) {

    }

    /**
     * Call this to display the dialog.
     */
    show(){
        console.log("Original file tree:")
        if(this.getParentNode()) console.log(this.getParentNode().printDetails())

        if (!this.getParentNode()) {
            return
        }

        var extractSection=UI.section(this.name+":",UI.Icon.GIST_NEW,false,false);

        this.stubRoot = this.createStub(this.getParentNode())

        this.createValidationIndicator(extractSection)

        this.createHeader(extractSection)

        this.createPanels(extractSection)

        this.createButtonBar(extractSection)

        extractSection.setPercentWidth(100);


        var html=extractSection.renderUI();
        this.rootAtomPanel = (<any>atom).workspace.addModalPanel( { item: html});
        html.focus();

        this.performValidation()

    }

    performValidation() {
        var validationMessage = this.validate()


        if (this.okButton) {
            if (validationMessage)
                this.okButton.setDisabled(true)
            else
                this.okButton.setDisabled(false)
        }

        if (this.errorLabel) {
            if (validationMessage) {
                this.errorLabel.setDisplay(true)
                this.errorLabel.setText(validationMessage)
            } else {
                this.errorLabel.setDisplay(false)
                this.errorLabel.setText("")
            }
        }
    }



    createValidationIndicator(vc : UI.Section) {
        this.errorLabel=UI.label("",UI.Icon.BUG,UI.TextClasses.ERROR,UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(this.errorLabel));
    }

    getNodeId(node : hl.IParseResult ) : string {

        if (node.parent()){
            var parentId=this.getNodeId(node.parent());
            parentId+="."+node.name();
            var sameName=(node.parent()).asElement().directChildren().filter(x=>x.name()==node.name());
            if (sameName.length>1){
                var ind=sameName.indexOf(node);
                parentId+="["+ind+"]"
            }
            return parentId;
        } else if (node.name()) {
            if ((<any>node).definition && (<any>node).definition() && universeHelpers.isApiType((<any>node).definition())) {
                //no other way to get rid of a fake Api "key"
                return ""
            }
            return "."+node.name()
        }
        return "";
    }

    nodesEqualById(node1 : hl.IParseResult, node2 : hl.IParseResult) {
        return this.getNodeId(node1) == this.getNodeId(node2)
    }

    /**
     * The root of the tree, which is being dynamically build from the moved nodes.
     * The parents of the moved nodes are being copied to the tree, so the temp AST
     * is complete. The root itself is always a stub (not copy) of the root node provided at the dialog open.
     */
    createMovedNodesTree() : void {
        //cleaning the current tree by removing all the children of the root
        //this.stubRoot.children().forEach(x=>(<any>this.stubRoot).remove(x))

        //instead just re-creating parent stub node
        this.stubRoot = this.createStub(this.getParentNode())

        this.movedNodes.forEach(movedNode => {

            //collecting node parents till we meet the dialog root
            var parents : hl.IParseResult[] = []

            var currentParent = movedNode.parent()
            while (currentParent) {
                if (currentParent == this.getParentNode())
                    break;

                parents.push(currentParent)
                currentParent = currentParent.parent()
            }

            parents.reverse()

            //now creating copies of parents
            var currentStubPointer = this.stubRoot

            parents.forEach(currentParent=>{
                var stubAnalogueOfParent = _.find(currentStubPointer.children(), currentStubElement=>{
                    return this.nodesEqualById(currentStubElement, currentParent)
                })

                if (!stubAnalogueOfParent) {
                    //we did not find an analogue, so we should create one
                    stubAnalogueOfParent = this.createStub((<hl.IHighLevelNode>currentParent));

                    //lets add the new parent to the stub hierarchy

                    (<any>currentStubPointer).add(stubAnalogueOfParent);
                    stubAnalogueOfParent.setParent(currentStubPointer);
                }

                currentStubPointer = <hl.IHighLevelNode>stubAnalogueOfParent
            })

            //okay, we found or created all parents of the new moved node, lets create the node itself
            var newNode = this.createMovedNode((<hl.IHighLevelNode>movedNode));
            /*(<hl.IHighLevelNode>movedNode)*/
            currentStubPointer.add(newNode);
            newNode.setParent(currentStubPointer);
        })

        console.log("New tree moved:")
        console.log(this.stubRoot.printDetails())
    }

    createMovedNode(originalNode : hl.IHighLevelNode) : hl.IHighLevelNode {
        return originalNode.copy()
    }

    saveUnit(unit : lowLevel.ICompilationUnit) : void {
        provider.saveUnit(unit);
    }

    createStub(node : hl.IHighLevelNode) : hl.IHighLevelNode {

        var stub =stubs.createStubNode( (<def.NodeClass>node.definition()),node.property(), node.lowLevel().key());
        //if (node.parent() == null && node.lowLevel().key() == null){
        //    //cleaning out the fake key
        //    stub.children().forEach(x=>(<any>stub).remove(x))
        //}
        return stub;
    }

    createStubRoot(node: hl.IHighLevelNode, type: def.NodeClass) {
        var lowLevel = stubs.createMap();

        var result = stubs.createASTNodeImpl(lowLevel,null, type, null);

        result.children();

        return result;
    }

    createPanels(vc : UI.Section) {
        var el=UI.hc();

        vc.addChild(UI.label("Move elements which should be extracted to the right panel"));

        var leftDisplayFilter = (nodeToCheck :hl.IHighLevelNode)=>{
            if (!this.checkNode(nodeToCheck).display) return false

            if (_.find(this.movedNodes, movedNode => {
                    return movedNode == nodeToCheck /*|| this.isParentOf(nodeToCheck, movedNode)*/
                })) return false

            return true;
        };

        this.leftPanel=createSmallSelectionPanel(this.getParentNode(), leftDisplayFilter,"400px","47%");

        var rightDisplayFilter= (nodeToCheck :hl.IHighLevelNode)=>{
            if (!this.checkNode(nodeToCheck).display) return false

            //if (_.find(this.movedNodes, movedNode => movedNode == nodeToCheck)) return false

            return true;
        };
        this.rightPanel=createSmallSelectionPanel(this.stubRoot,rightDisplayFilter,"400px","47%","right");

        var moveRight=UI.button(">",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=this.leftPanel.getSelection().elements;
            this.moveRight(z);
        });

        var moveLeft=UI.button("<",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
            var z=this.rightPanel.getSelection().elements;
            this.moveLeft(z);
        });

        //var allRight=UI.button(">>",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
        //    var z=this.parentNode.elements().filter(x=>leftFilter(x));
        //    this.moveRight(z);
        //});
        //
        //var allLeft=UI.button("<<",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{
        //    var z=stub.elements();
        //    this.moveLeft(z);
        //
        //});

        el.addChild(UI.vc(moveRight,moveLeft/*,allRight,allLeft*/));
        el.addChild(this.leftPanel);
        el.addChild(this.rightPanel);
        vc.addChild(el);

        this.leftPanel.addSelectionListener({

            selectionChanged:(ev:UI.SelectionChangedEvent<any>)=> {
                var rs:hl.IHighLevelNode[]=<any>ev.selection.elements;
                //var m=(_.find(rs, x=>x.parent() != this.getParentNode())!=undefined )
                moveRight.setDisabled((rs.length == 0));
            }
        });

        this.rightPanel.addSelectionListener(
            {
                selectionChanged:(ev:UI.SelectionChangedEvent<any>)=> {
                    var rs:hl.IHighLevelNode[]=<any>ev.selection.elements;
                    //var m=(_.find(rs, x=>x.parent() != this.stubRoot)!=undefined )
                    moveLeft.setDisabled(rs.length == 0);
                }
            })

        moveLeft.setDisabled(true);
        moveRight.setDisabled(true);

        el.setPercentWidth(100);
    }

    createButtonBar(parentPanel : UI.Section) {
        var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex")

        buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"))

        buttonBar.addChild(UI.button("Cancel",UI.ButtonSizes.NORMAL,
            UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,
                x=>{this.rootAtomPanel.destroy()}).margin(10,10))

        this.okButton=UI.button("Extract",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE,x=>{
            this.performOk(this.movedNodes, this.stubRoot);
            this.rootAtomPanel.destroy();
        })

        this.okButton.setDisabled(true)
        buttonBar.addChild(this.okButton);

        parentPanel.addChild(buttonBar)
    }

    getParentNode() : hl.IHighLevelNode {
        return this.parentNode
    }

    isParentOf(potentialParent : hl.IParseResult, potentialChild : hl.IParseResult) : boolean {
        var current = potentialChild.parent()
        while (current != null) {

            if (current == potentialParent || this.nodesEqualById(current, potentialParent)) {
                return true
            }

            current = current.parent()
        }

        return false
    }

    mergeTrees(sourceTreeRoot : hl.IHighLevelNode, targetTreeRoot : hl.IHighLevelNode,
               mergeProperties = false) : void {

        if ((<any>sourceTreeRoot).directChildren()) {
            (<any>sourceTreeRoot).directChildren().forEach(child => {
                this.mergeNode(child, targetTreeRoot)
            })
        }
    }

    getActiveEditor() {
        return assist.getActiveEditor()
    }

    private mergeNode(sourceNode : hl.IParseResult, targetParent : hl.IParseResult,
                      mergeProperties = false) {

        if (!mergeProperties && !(sourceNode.isElement())) {
            return;
        }

        var targetChildren : hl.IParseResult[] = (<any>targetParent).directChildren();
        if (!targetChildren) {
            (<any>targetParent).add(sourceNode);
            sourceNode.setParent(targetParent);
            return;
        }

        var analogueChild : hl.IParseResult = _.find(targetChildren, child => {
            return this.nodesEqualById(child, sourceNode);
        })

        if (!analogueChild) {
            (<any>targetParent).add(sourceNode);
            sourceNode.setParent(targetParent);
            return;
        }

        if ((<any>sourceNode).directChildren()) {
            (<any>sourceNode).directChildren().forEach(sourceChild => {
                return this.mergeNode(sourceChild, analogueChild);
            })
        }
    }

    private moveLeft(nodesToMove : hl.IParseResult[]) {
        if (nodesToMove.length > 0) {
            this.movedNodes = this.movedNodes.filter(currentNode => {
                if (_.find(nodesToMove, nodeToMove => {
                        //removing the node itself and all of its children subsequently
                        return this.nodesEqualById(nodeToMove, currentNode)
                            || this.isParentOf(nodeToMove, currentNode)
                    })) return false
                return true
            })
            this.createMovedNodesTree()
        }

        this.leftPanel.setInput(this.getParentNode());

        this.stubRoot.resetChildren();

        this.rightPanel.setInput(this.stubRoot);

        this.performValidation()
    }

    private moveRight(nodesToMove : hl.IParseResult[]) {
        if (nodesToMove.length > 0) {

            //removing from already moved nodes any children of the nodes to move
            this.movedNodes = this.movedNodes.filter(currentNode => {
                if (_.find(nodesToMove, nodeToMove=>this.isParentOf(nodeToMove, currentNode))) return false
                return true
            })

            nodesToMove.forEach(x=>this.movedNodes.push(x))
            //this.movedNodes = this.movedNodes.concat(nodesToMove)
            this.createMovedNodesTree()
        }

        this.leftPanel.setInput(this.getParentNode());

        this.stubRoot.resetChildren();

        this.rightPanel.setInput(this.stubRoot);

        this.performValidation()
    }
}

export class ExtractLibraryDialog extends AbstractlMoveElementsDialog {

    libraryPath : UI.TextField

    libraryNamespace : UI.TextField

    constructor(parentNode:hl.IHighLevelNode, name:string){
        super(parentNode, name)
    }

    /**
     * Intended for overriding in subclass.
     * Is called for each node to check whether to display it, whether the node can be moved,
     * and whether node children needs to be checked.
     *
     * @param nodeToFilter
     * @returns {{visitChildren: boolean, display: boolean, canBeMove: boolean}}
     */
    checkNode (nodeToFilter: hl.IHighLevelNode) : {
        visitChildren:boolean
        display:boolean
        canBeMoved:boolean
    }
    {
        var range = null;
        if (nodeToFilter.property() && nodeToFilter.property().range()){
            range = nodeToFilter.property().range();
        }

        var prrr = nodeToFilter.property();
        var blah = universeHelpers.isTypesProperty(prrr);
        var isTp = universeHelpers.isTypeDeclarationType(range)
            && blah;
        if (range &&
            (
                universeHelpers.isResourceTypeType(range) ||
                universeHelpers.isTraitType(range) ||
                universeHelpers.isGlobalSchemaType(range) ||
                universeHelpers.isSecuritySchemaType(range) ||
                isTp
            )) {
            return {
                visitChildren: false,
                display: true,
                canBeMoved: true
            }
        }

        return {
            visitChildren: false,
            display: false,
            canBeMoved: false
        }
    }

    createStub(node : hl.IHighLevelNode) : hl.IHighLevelNode {

        if (node.definition().key() == universeModule.Universe10.Api ||
            node.definition().key() == universeModule.Universe08.Api) {
            var universe = rp.ds.getUniverse("RAML10");
            var nodeClass = <def.NodeClass>universe.type(universeModule.Universe10.Library.name);
            var stub = this.createStubRoot(node, nodeClass);

            return stub;
        }

        return super.createStub(node)
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate() : string {
        if (!this.libraryPath) return null

        if (!this.stubRoot) return null

        if (this.movedNodes.length == 0) {
            return "Add elements to move"
        }

        if (!this.libraryNamespace) return null

        if (!this.getLibraryQualifier()) {
            return "Enter library namespace"
        }

        if (this.getLibraryQualifier().trim().length == 0) {
            return "Enter library namespace"
        }

        var originalValue = <string>this.libraryPath.getBinding().get()

        var trimmed = originalValue.trim()
        if (trimmed.length == 0) {
            return "Empty library path"
        }

        if (path.extname(trimmed) != '.raml') {
            return "Library path should be a RAML file"
        }

        var dir = path.resolve(path.dirname(this.getActiveEditor().getPath()), path.dirname(trimmed));
        if (!fs.existsSync(dir)) {
            return "Library path directory does not exist"
        }

        var st=fs.statSync(dir)
        if (!st.isDirectory()){
            return "Library path parent is not a directory"
        }

        var absolutePath = path.resolve(path.dirname(this.getActiveEditor().getPath()), trimmed);

        if (fs.existsSync(absolutePath)) {
            return "Destination library already exists"
        }

        return null
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel : UI.Section) {

        parentPanel.addChild(UI.label("Library namespace:").pad(5,0))
        this.libraryNamespace = UI.texfField("",this.getDefaultLibraryNamespace(),x=>{
            this.performValidation()
        });
        parentPanel.addChild(this.libraryNamespace)

        parentPanel.addChild(UI.label("Library path:").pad(5,0))
        this.libraryPath = UI.texfField("",this.generateDefaultLibraryPath(),x=>{
            this.performValidation()
        });
        parentPanel.addChild(this.libraryPath)

    }

    /**
     * Is called when "Ok" is pressed.
     * @param movedNodes - nodes, which were moved. Plain list, original nodes.
     * @param stubTreeRoot - nodes, which were moved, as a stub tree with a root
     * being a stub of the original dialog parent node. Nodes original hierarchy is preserved.
     */
    performOk(movedNodes : hl.IParseResult[], stubTreeRoot : hl.IHighLevelNode) {

        var project = this.createProject()
        var libraryUnit= this.createLibraryUnit(project)

        var libraries = search.globalDeclarations(this.getParentNode()).filter(found => found && found.definition && found.definition().nameId() === universeModule.Universe10.Library.name);

        var universe = this.getParentNode().definition().universe();

        var libraryClass = <def.NodeClass>universe.type(universeModule.Universe10.Library.name);

        var currentFilePath = this.getParentNode().lowLevel().unit().absolutePath();

        var dist = path.resolve(path.dirname(currentFilePath), libraryUnit.absolutePath());

        findIncludesInside(stubTreeRoot.lowLevel()).forEach(include => {
            var includePath = include.includePath();

            if(path.isAbsolute(includePath)) {
                return;
            }

            var newPath = path.relative(path.dirname(dist), path.resolve(path.dirname(currentFilePath), includePath));
            
            var yamlNode: any = (<any>include)._node;
            
            if(yamlNode && yamlNode.value) {
                yamlNode.value.value = newPath;
                yamlNode.value.rawValue = newPath;
            }
        });

        movedNodes.forEach(movedNode => {
            var librariesToExport = libraries.filter(library => {
                return _.find(library.findReferences(), reference => this.isParentOf(movedNode, reference)) ? true : false
            });

            librariesToExport.forEach(library => {
                var currentPath = (<any>library.lowLevel())._node.value && (<any>library.lowLevel())._node.value.value;

                if(!currentPath) {
                    return;
                }

                var relativePath: string;

                if(isWebPath(currentPath) || path.isAbsolute(currentPath)) {
                    relativePath = currentPath;
                } else {
                    var currentDirectory = path.dirname(this.getParentNode().lowLevel().unit().absolutePath());

                    var relativePath = path.relative(path.dirname(libraryUnit.absolutePath()), path.resolve(currentDirectory, currentPath));
                }

                var lowLevel = stubs.createMapping(library.lowLevel().key(), "!include " + relativePath);

                var stubLibrary = stubs.createASTNodeImpl(lowLevel,null, libraryClass, null);

                (<any>stubTreeRoot).wrapperNode().addToProp(stubLibrary.wrapperNode(), universeModule.Universe10.FragmentDeclaration.properties.uses.name);
            });
        });

        this.updateLibraryUnit(libraryUnit, stubTreeRoot);

        this.saveUnit(libraryUnit);

        var modifiedUnits : lowLevel.ICompilationUnit[] = []
        modifiedUnits.push(this.getParentNode().lowLevel().unit())

        var libraryQualifier = this.getLibraryQualifier();

        movedNodes.forEach(movedNode => {
            //changing node references
            var movedNodeReferences : hl.IParseResult[] = (<hl.IHighLevelNode>movedNode).findReferences();

            if (movedNodeReferences) {
                movedNodeReferences.forEach(reference => {
                    if (!(reference.isAttr())) {
                        return;
                    }

                    if(_.find(movedNodes, movedNode => this.isParentOf(movedNode, reference))) {
                        return;
                    }

                    var property = <hl.IAttribute> reference;

                    var oldValue = property.value()
                    if (typeof oldValue != "string") {return}

                    var oldStringValue = <String> oldValue;

                    var textToReplace = (<hl.IHighLevelNode>movedNode).name();
                    var textToReplanceWith = libraryQualifier + "." + textToReplace;

                    var newStringValue = oldStringValue.replace(textToReplace, textToReplanceWith);

                    property.setValue(newStringValue);

                    var modifiedPropertyUnit = property.lowLevel().unit()

                    if(_.find(modifiedUnits, modifiedUnit=>modifiedUnit == modifiedPropertyUnit)) {
                        modifiedUnits.push(modifiedPropertyUnit)
                    }
                })

            }

            //deleting the node itself
            (<any>movedNode.parent()).remove(movedNode);
        })


        modifiedUnits.forEach(modifiedUnit => this.saveUnit(modifiedUnit))

        this.addUsesNode(libraryQualifier, this.getLibraryPath())
    }



    private generateDefaultLibraryPath() : string {
        var node = this.getParentNode()
        var currentFilePath = node.lowLevel().unit().absolutePath()
        var parent = path.dirname(currentFilePath)

        return path.resolve(parent, "NewLibrary.raml")
    }

    private getLibraryName() : string {
        return <string>this.libraryNamespace.getBinding().get()
    }

    private getLibraryQualifier() : string {
        return <string>this.libraryNamespace.getBinding().get()
    }

    private getDefaultLibraryNamespace() : string {
        return "NewLibrary"
    }

    private getLibraryPath() : string {
        var originalValue = <string>this.libraryPath.getBinding().get()

        var trimmed = originalValue.trim()
        if (trimmed.length == 0) {
            return null
        }

        if (path.extname(trimmed) != '.raml') {
            return null
        }

        var dir = path.resolve(path.dirname(this.getActiveEditor().getPath()), path.dirname(trimmed));
        if (!fs.existsSync(dir)) {
            return null
        }

        var st=fs.statSync(dir)
        if (!st.isDirectory()){
            return null
        }

        return path.resolve(path.dirname(this.getActiveEditor().getPath()), trimmed);
    }

    private createProject() : lowLevel.IProject {
        var targetLibraryPath = this.getLibraryPath()

        return rp.project.createProject(path.dirname(targetLibraryPath));
    }

    private createLibraryUnit(project : lowLevel.IProject) : lowLevel.ICompilationUnit {
        var targetLibraryPath = this.getLibraryPath()
        fs.writeFileSync(targetLibraryPath, "#%RAML 1.0 Library\n")

        return project.unit(path.basename(targetLibraryPath));
    }

    private updateLibraryUnit(libraryUnit : lowLevel.ICompilationUnit, stubTreeRoot : hl.IHighLevelNode) {
        var targetLibraryAst=<hl.IHighLevelNode>libraryUnit.highLevel();

        //adding top-level children from stub AST to the target library AST
        stubTreeRoot.children().forEach(child => {
            if (!child.getKind()) {
                return;
            }
            (<any>targetLibraryAst).add(child);
        })
    }

    private addUsesNode(libraryQualifier : string, fileName : string) {
        //TODO this must be done via AST manipulation, but it is impossible atm due to AST bugs

        var relativePath = path.relative(path.dirname(this.getParentNode().lowLevel().unit().absolutePath()), fileName)

        var existingFirstUsesNode = _.find(this.getParentNode().children(), child => {
            var childAny : any = child;
            return childAny.definition &&
                universeHelpers.isLibraryType(childAny.definition()) &&
                childAny.property() &&
                universeHelpers.isUsesProperty(childAny.property());
        })

        var usesMapping : lowLevel.ILowLevelASTNode = null
        var sequenceFound = false
        if (existingFirstUsesNode) {
            var currentNode = existingFirstUsesNode.lowLevel()
            while(currentNode != null) {
                if (<any>currentNode.kind() == yaml.Kind.MAPPING
                    && currentNode.key() == universeModule.Universe10.FragmentDeclaration.properties.uses.name) {
                    usesMapping = currentNode
                    break
                }

                if (<any>currentNode.kind() == yaml.Kind.SEQ) {
                    sequenceFound = true
                }

                currentNode = currentNode.parent()
            }
        }

        if (usesMapping) {
            //existing "uses" found, inserting there
            var positionToInsert = usesMapping.keyEnd() + 1

            var text = "\n  " +(sequenceFound?"- ":"")+ libraryQualifier + ": " + relativePath
            this.insertTextToActiveEditor(positionToInsert, text);
        } else {
            var titleNode = _.find(this.getParentNode().children(), child => {
                var childAny : any = child;
                return childAny.definition &&
                    universeHelpers.isStringTypeType(childAny.definition()) &&
                    childAny.property() &&
                    universeHelpers.isTitleProperty(childAny.property());
            })
            if (titleNode) {
                //title node found, inserting after it
                var positionToInsert : number = titleNode.lowLevel().valueEnd()

                var text = "\n" + "uses:" + "\n  " + libraryQualifier + ": " + relativePath
                this.insertTextToActiveEditor(positionToInsert, text);
            } else {
                //nothing happens, inserting in the end of the file
                var positionToInsert = this.getParentNode().lowLevel().end()

                var text = "\n" + "uses:" + "\n  " + libraryQualifier + ": " + relativePath
                this.insertTextToActiveEditor(positionToInsert, text);
            }
        }
    }

    private insertTextToActiveEditor(positionToInsert : number, text : string) {
        var txt = this.getParentNode().lowLevel().unit().contents();
        var endPart = txt.substring(positionToInsert);
        var startPart = txt.substring(0, positionToInsert);
        var vl = startPart + text + endPart;
        this.getActiveEditor().setText(vl);
    }

    createUsesNode(libraryQualifier : string, fileName : string) : hl.IHighLevelNode {

        var universe=this.getParentNode().definition().universe();

        var usesProperty = this.getParentNode().root().definition().property("uses");

        var usesNode =stubs.createStubNode((<def.NodeClass>universe.type("Library")),usesProperty,
            libraryQualifier);

        return usesNode
    }
}

export class ExtractOverlayDialog extends AbstractlMoveElementsDialog {

    overlayPath:UI.TextField

    constructor(parentNode:hl.IHighLevelNode, name:string) {
        super(parentNode, name)
    }

    createStub(node : hl.IHighLevelNode) : hl.IHighLevelNode {

        if (node.definition().key() == universeModule.Universe10.Api ||
            node.definition().key() == universeModule.Universe08.Api) {
            var universe = rp.ds.getUniverse("RAML10");
            var nodeClass = <def.NodeClass>universe.type(universeModule.Universe10.Overlay.name);
            var stub = this.createStubRoot(node, nodeClass);

            return stub;
        }

        return super.createStub(node)
    }

    /**
     * Intended for overriding in subclass.
     * Is called for each node to check whether to display it, whether the node can be moved,
     * and whether node children needs to be checked.
     *
     * @param nodeToFilter
     * @returns {{visitChildren: boolean, display: boolean, canBeMove: boolean}}
     */
    checkNode(nodeToFilter:hl.IHighLevelNode):{
        visitChildren:boolean
        display:boolean
        canBeMoved:boolean
    } {
        //we can move everything
        return {
            visitChildren: true,
            display: true,
            canBeMoved: true
        }
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {
        if (!this.overlayPath) return null

        if (!this.stubRoot) return null

        if (this.movedNodes.length == 0) {
            return "Add elements to move"
        }

        var originalValue = <string>this.overlayPath.getBinding().get()

        var trimmed = originalValue.trim()
        if (trimmed.length == 0) {
            return "Empty overlay path"
        }

        if (path.extname(trimmed) != '.raml') {
            return "Overlay path should be a RAML file"
        }

        var dir = path.resolve(path.dirname(this.getActiveEditor().getPath()), path.dirname(trimmed));
        if (!fs.existsSync(dir)) {
            return "Overlay path directory does not exist"
        }

        var st = fs.statSync(dir)
        if (!st.isDirectory()) {
            return "Overlay path parent is not a directory"
        }

        var absolutePath = path.resolve(path.dirname(this.getActiveEditor().getPath()), trimmed);

        if(fs.existsSync(absolutePath)) {
           return "Destination overlay already exists"
        }

        return null
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel:UI.Section) {

        parentPanel.addChild(UI.label("Overlay path:").pad(5, 0))
        this.overlayPath = UI.texfField("", this.generateDefaultOverlayPath(), x=> {
            this.performValidation()
        });
        parentPanel.addChild(this.overlayPath)

    }

    /**
     * Is called when "Ok" is pressed.
     * @param movedNodes - nodes, which were moved. Plain list, original nodes.
     * @param stubTreeRoot - nodes, which were moved, as a stub tree with a root
     * being a stub of the original dialog parent node. Nodes original hierarchy is preserved.
     */
    performOk(movedNodes:hl.IParseResult[], stubTreeRoot:hl.IHighLevelNode) {

        var project = this.createProject()
        var overlayUnit = this.createOverlayUnit(project)

        this.updateOverlayUnit(overlayUnit, stubTreeRoot)

        var overlayPath = this.getOverlayPath()
        var originalUnitPath = this.getParentNode().lowLevel().unit().absolutePath()

        var relativePath = path.relative(path.dirname(overlayPath), originalUnitPath)
        this.addMasterReference(overlayUnit, relativePath)

        this.saveUnit(overlayUnit)
    }

    private generateDefaultOverlayPath() : string {
        var node = this.getParentNode()
        var currentFilePath = node.lowLevel().unit().absolutePath()
        var parent = path.dirname(currentFilePath)

        return path.resolve(parent, "NewOverlay.raml")
    }

    private createProject() : lowLevel.IProject {
        var targetOverlayPath = this.getOverlayPath()

        return rp.project.createProject(path.dirname(targetOverlayPath));
    }

    private createOverlayUnit(project : lowLevel.IProject) : lowLevel.ICompilationUnit {
        var targetOverlayPath = this.getOverlayPath()
        fs.writeFileSync(targetOverlayPath, "#%RAML 1.0 Overlay\ntitle: Extension\n")

        return project.unit(path.basename(targetOverlayPath));
    }

    private updateOverlayUnit(overlayUnit : lowLevel.ICompilationUnit, stubTreeRoot : hl.IHighLevelNode) {
        var targetOverlayAst=<hl.IHighLevelNode>overlayUnit.highLevel();

        //adding top-level children from stub AST to the target overlay AST
        stubTreeRoot.children().forEach(child => {
            if (!child.getKind()) {
                return;
            }

            (<any>targetOverlayAst).add(child);
        })
    }

    private getOverlayPath() : string {
        var originalValue = <string>this.overlayPath.getBinding().get()

        var trimmed = originalValue.trim()
        if (trimmed.length == 0) {
            return null
        }

        if (path.extname(trimmed) != '.raml') {
            return null
        }

        var dir = path.resolve(path.dirname(this.getActiveEditor().getPath()), path.dirname(trimmed));
        if (!fs.existsSync(dir)) {
            return null
        }

        var st=fs.statSync(dir)
        if (!st.isDirectory()){
            return null
        }

        return path.resolve(path.dirname(this.getActiveEditor().getPath()), trimmed);
    }

    private addMasterReference(overlayUnit : lowLevel.ICompilationUnit, path : string) : void {

        var targetLibraryAst=<hl.IHighLevelNode>overlayUnit.highLevel();

        var masterRefAttribute = targetLibraryAst.attrOrCreate(universeModule.Universe10.Overlay.properties.extends.name )
        masterRefAttribute.setValue(path)
    }

    createMovedNode(originalNode : hl.IHighLevelNode) : hl.IHighLevelNode {
        //we do not want to make a complete copy of the moved node.
        //instead, we want an empty stub
        return this.createStub(originalNode)
    }

}

export class ModifyOverlayDialog extends AbstractlMoveElementsDialog {

    overlayASTRoot : hl.IHighLevelNode
    masterASTRoot : hl.IHighLevelNode
    overlayASTLeafNodes : hl.IHighLevelNode[]

    constructor(parentNode:hl.IHighLevelNode, name:string) {
        super(parentNode, name)

        this.overlayASTRoot = parentNode

        console.log("Overlay AST root:")
        console.log(this.overlayASTRoot.printDetails())

        this.masterASTRoot = this.createMasterAST()

        this.overlayASTLeafNodes = []
        this.calculateLeafNodes(this.overlayASTRoot, this.overlayASTLeafNodes)
    }

    getParentNode() : hl.IHighLevelNode {
        return this.masterASTRoot
    }

    /**
     * Intended for overriding in subclass.
     * Is called for each node to check whether to display it, whether the node can be moved,
     * and whether node children needs to be checked.
     *
     * @param nodeToFilter
     * @returns {{visitChildren: boolean, display: boolean, canBeMove: boolean}}
     */
    checkNode(nodeToFilter:hl.IHighLevelNode):{
        visitChildren:boolean
        display:boolean
        canBeMoved:boolean
    } {
        //we can move everything except leaf nodes already defined in out AST
        if (_.find(this.overlayASTLeafNodes, currentNode=>{
                return currentNode == nodeToFilter || this.nodesEqualById(currentNode, nodeToFilter)
            })){
            return {
                visitChildren: false,
                display: false,
                canBeMoved: false
            }
        }

        return {
            visitChildren: true,
            display: true,
            canBeMoved: true
        }
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {

        if (!this.stubRoot) return null

        if (this.movedNodes.length == 0) {
            return "Add elements to move"
        }

        return null
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel:UI.Section) {

    }

    /**
     * Is called when "Ok" is pressed.
     * @param movedNodes - nodes, which were moved. Plain list, original nodes.
     * @param stubTreeRoot - nodes, which were moved, as a stub tree with a root
     * being a stub of the original dialog parent node. Nodes original hierarchy is preserved.
     */
    performOk(movedNodes:hl.IParseResult[], stubTreeRoot:hl.IHighLevelNode) {

        var overlayUnit = this.getOverlayUnit()

        this.updateOverlayUnit(overlayUnit, stubTreeRoot)

        this.saveUnit(overlayUnit)
    }

    createMasterAST() : hl.IHighLevelNode {
        var masterAbsolutePath = this.findMasterAbsolutePath()
        if (!masterAbsolutePath) {
            return null
        }

        var project = this.createProject(masterAbsolutePath)
        var masterUnit = project.unit(path.basename(masterAbsolutePath));

        return <hl.IHighLevelNode>masterUnit.highLevel()
    }

    calculateLeafNodes(root : hl.IParseResult, toReportTo : hl.IParseResult[]) : void {
        if (!root) return

        var children:hl.IParseResult[] = (<any>root).directChildren()?(<any>root).directChildren():null
        if (root.isElement()) {
            if (children) {
                if (!_.find(children, child => child.isElement())) {
                    toReportTo.push(root)
                    return
                }
            } else {
                toReportTo.push(root)
                return
            }
        }

        if (children) children.forEach(child=>this.calculateLeafNodes(child, toReportTo))
    }

    findMasterAbsolutePath() : string {
        try {
            var masterRefAttribute = this.overlayASTRoot.attr("masterRef")
            if (!masterRefAttribute) {
                return null
            }

            var reference = masterRefAttribute.value()
            if (!reference) {
                return null
            }

            var overlayAbsolutePath = this.getOverlayUnit().absolutePath()
            var masterAbsolutePath = path.resolve(path.dirname(overlayAbsolutePath), reference)

            //if (!fs.existsSync(masterAbsolutePath)) {
            //    return null
            //}

            return masterAbsolutePath
        } catch (Error) {
            console.error(Error.message)
            return null
        }

    }

    private createProject(targetPath : string) : lowLevel.IProject {

        return rp.project.createProject(path.dirname(targetPath));
    }

    private getOverlayUnit() : lowLevel.ICompilationUnit {
        return this.overlayASTRoot.lowLevel().unit()
    }

    private updateOverlayUnit(libraryUnit : lowLevel.ICompilationUnit, stubTreeRoot : hl.IHighLevelNode) {
        var targetLibraryAst=<hl.IHighLevelNode>libraryUnit.highLevel();

        //merging the new nodes into existing overlay tree
        this.mergeTrees(stubTreeRoot, this.overlayASTRoot)
    }

    createMovedNode(originalNode : hl.IHighLevelNode) : hl.IHighLevelNode {
        //we do not want to make a complete copy of the moved node.
        //instead, we want an empty stub
        return this.createStub(originalNode)
    }

}

/**
 * Intended for subclassing, should not be instantiated.
 */
export class AbstractMoveTypePropertiesDialog extends AbstractlMoveElementsDialog {

    sourceType : hl.IHighLevelNode

    constructor(parentNode:hl.IHighLevelNode, name:string) {
        super(parentNode, name)
        this.sourceType = parentNode
    }

    /**
     * Intended for overriding, should return the target type.
     * Will only be called during performOk() execution, so it is assumed that
     * UI already have required user input before the calowLevel.
     * @returns {null}
     */
    getTargetType() : hl.IHighLevelNode {
        return null
    }

    /**
     * Intended for overriding in subclass.
     * Is called for each node to check whether to display it, whether the node can be moved,
     * and whether node children needs to be checked.
     *
     * @param nodeToFilter
     * @returns {{visitChildren: boolean, display: boolean, canBeMove: boolean}}
     */
    checkNode(nodeToFilter:hl.IHighLevelNode):{
        visitChildren:boolean
        display:boolean
        canBeMoved:boolean
    } {
        //we can move everything inside the type
        //and as the type is our root, we can move just everything
        return {
            visitChildren: true,
            display: true,
            canBeMoved: true
        }
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * This particular method should be called in a subclass before or after
     * its own check, and the results should be joined.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {

        if (this.movedNodes.length == 0) {
            return "Add elements to move"
        }

        return null
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel:UI.Section) {
    }

    /**
     * Is called when "Ok" is pressed.
     * @param movedNodes - nodes, which were moved. Plain list, original nodes.
     * @param stubTreeRoot - nodes, which were moved, as a stub tree with a root
     * being a stub of the original dialog parent node. Nodes original hierarchy is preserved.
     */
    performOk(movedNodes:hl.IParseResult[], stubTreeRoot:hl.IHighLevelNode) {

        var sourceUnit = this.sourceType.lowLevel().unit()

        var targetType = this.getTargetType()
        if (!targetType) {
            return
        }

        var targetUnit = targetType.lowLevel().unit()

        this.mergeTrees(stubTreeRoot, targetType)

        this.movedNodes.forEach(movedNode => {
            (<any>movedNode.parent()).remove(movedNode)
        })

        this.postMerge()

        this.saveUnit(sourceUnit)
        if (targetUnit)
            this.saveUnit(targetUnit)
    }

    postMerge() : void {

    }
}

export function findUserDefinedSupertypes(typeNode : hl.IHighLevelNode) : def.ITypeDefinition[] {
    var result : def.ITypeDefinition[] = []

    var nodeType = typeNode.localType();
    if (!nodeType || !nodeType.isUserDefined()) {
        return result
    }

    addUserDefinedSupertypes(nodeType, result)

    return result
}

function addUserDefinedSupertypes(type : hl.INodeDefinition, typesToAddTo : def.ITypeDefinition[]) : void {
    if (!type.isUserDefined()) {
        return
    }

    var superTypes = (type).superTypes()

    if (superTypes)
        superTypes.forEach(superType => {

            if (superType.isUserDefined()) {
                typesToAddTo.push(superType)
            }

            addUserDefinedSupertypes(<hl.INodeDefinition>superType, typesToAddTo)
        })
}

export class PullUpDialog extends AbstractMoveTypePropertiesDialog {

    private superTypeNames : string[] = []
    private superTypes : def.ITypeDefinition[]
    private selectedSuperType : string

    constructor(parentNode:hl.IHighLevelNode, name:string) {
        super(parentNode, name)

        this.superTypeNames = this.findSuperTypeNames()
    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel:UI.Section) {
        parentPanel.addChild(UI.label("Select supertype:").pad(5, 0))

        var select = new UI.Select("", selection => {
            this.selectedSuperType = select.getValue()
        });

        select.setOptions(this.superTypeNames);
        select.setValue(this.superTypeNames[0])
        this.selectedSuperType = this.superTypeNames[0]

        parentPanel.addChild(select)
    }

    show(){
        //if no supertypes are found, we're not displaying anything
        //Actually, state calculator should not allow action launching in this case
        if (this.superTypeNames.length == 0) {
            return
        }

        super.show()
    }

    /**
     * Intended for overriding, should return the target type.
     * Will only be called during performOk() execution, so it is assumed that
     * UI already have required user input before the calowLevel.
     * @returns {null}
     */
    getTargetType() : hl.IHighLevelNode {
        var foundSuperType = _.find(this.superTypes, superType=>{
            return superType.nameId() == this.selectedSuperType
        })

        if (!foundSuperType)
            return null

        return foundSuperType.getAdapter(def.RAMLService).getDeclaringNode();
    }

    private findSuperTypeNames() : string[] {
        var result : string[] = []

        this.superTypes = findUserDefinedSupertypes(this.sourceType)

        this.superTypes.forEach(superType => {
            result.push(superType.nameId())
        })

        return result
    }
}

export class ExtractSupertypeDialog extends AbstractMoveTypePropertiesDialog {

    private superTypeName : UI.TextField

    constructor(parentNode:hl.IHighLevelNode, name:string) {
        super(parentNode, name)

    }

    /**
     * Intended for overriding in subclass.
     * Add any UI here to be displayed above the node moving panels.
     * @param parentPanel
     */
    createHeader(parentPanel:UI.Section) {
        parentPanel.addChild(UI.label("Supertype name:").pad(5, 0))
        this.superTypeName = UI.texfField("", this.generateDefaultSupertypeName(), x=> {
            this.performValidation()
        });
        parentPanel.addChild(this.superTypeName)
    }

    private astRoot : hl.IHighLevelNode
    private typeWrapper : rp.api10.ObjectTypeDeclaration

    /**
     * Intended for overriding, should return the target type.
     * Will only be called during performOk() execution, so it is assumed that
     * UI already have required user input before the calowLevel.
     * @returns {null}
     */
    getTargetType() : hl.IHighLevelNode {
        var astRoot = this.sourceType.root()

        var universe=astRoot.definition().universe();
        var rtypes=astRoot.root().definition().property(universeModule.Universe10.LibraryBase.properties.types.name);

        //var typeStub=(<def.NodeClass>universe.getType("ObjectField")).createStubNode(rtypes, this.superTypeName.getBinding().get());

        var typeWrapper = rp.parser.modify.createObjectTypeDeclaration(this.superTypeName.getBinding().get())
        var typeStub = typeWrapper.highLevel()

        this.typeWrapper = typeWrapper;
        this.astRoot = astRoot;

        //astRoot.add(typeStub);

        //var unit = astRoot.lowLevel().unit();
        //this.saveUnit(unit);
        //
        //var newAstRoot = <hl.IHighLevelNode>hl.fromUnit(unit);
        //this.sourceType = <hl.IHighLevelNode> _.find(newAstRoot.children(), child=>{
        //    return (<hl.IHighLevelNode>child).property
        //    && (<hl.IHighLevelNode>child).property().range
        //    && (<hl.IHighLevelNode>child).property().range().name() == "DataElement"
        //    && (<hl.IHighLevelNode>child).property().name() == "types"
        //    && (<hl.IHighLevelNode>child).name() == this.superTypeName.getBinding().get()
        //})
        return typeStub

    }

    validate():string {
        var superValidate = super.validate()
        if (superValidate) {
            return superValidate
        }


        if (!this.superTypeName.getBinding().get() ||
            (<string>this.superTypeName.getBinding().get()).trim().length == 0) {
            return "Enter supertype name"
        }

        return null
    }

    postMerge() {
        (<any>this.astRoot.wrapperNode()).addToProp(this.typeWrapper, 'types');
        this.sourceType.attrOrCreate("type").setValue( this.typeWrapper.highLevel().name())


        //var runtimeDef = this.typeWrapper.highLevel().definition().toRuntime()
        //(<hlimpl.ASTNodeImpl>this.sourceType).patchType(runtimeDef)


    }

    private generateDefaultSupertypeName() : string {
        return this.sourceType.name() + "SuperType"
    }
}

function isWebPath(str):boolean {
    if (str == null) return false;

    return util.stringStartsWith(str,"http://") || util.stringStartsWith(str,"https://");
}

function findIncludesInside(node: lowLevel.ILowLevelASTNode): lowLevel.ILowLevelASTNode[] {
    var children: lowLevel.ILowLevelASTNode[] = node.children();

    var result = [];

    if(children && children.length > 0) {
        children.forEach(child => {
            if(child.includePath()) {
                result.push(child);

                return;
            }

            result = result.concat(findIncludesInside(child));
        });
    }

    return result;
}
