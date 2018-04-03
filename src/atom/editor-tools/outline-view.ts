/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import SC=require("../util/ScrollViewUI")
import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
var universes=rp.universes

import fs=require("fs")
import details2=require("./details2")
import contextActions = require("raml-actions")
import commonContextActions = require("../context-menu/commonContextActions")
import editorTools=require("./editor-tools")
import _=require("underscore")
import pair = require("../../util/pair");
import universeHelpers = rp.universeHelpers;
import ramlOutline = require("raml-outline")
import outlineCommon = require("./outline-common")

export class RamlOutline extends SC.Scrollable {
    private _rs: UI.TabFolder;

    private createTree(p: hl.IParseResult) {
        this._rs = createTree(p, sender => {
            if(editorTools.aquireManager()._details && sender.selection && sender.selection.elements && this.fire == true){
                if (sender.selection.elements.length>0&&sender.selection.elements[0]) {
                    editorTools.aquireManager().setSelectedNode(sender.selection.elements[0].getSource());
                }
            }
        });
        this._viewers = [0, 1, 2, 3].map(i=> <UI.TreeViewer<any, any>> this._rs.get(i).content);
    }

    private _viewers: UI.TreeViewer<any,any>[];
    private outlineDataRoot : ramlOutline.StructureNode;

    constructor() {
        super();

        this.createTree(null);
        (<any>this).addClass('raml-outline');
        this.addChild(this._rs);
    }

    getTitle() { return "Outline"; }

    disposables = new CompositeDisposable();

    _isAttached : boolean;

    private fire : boolean = true;

    private getNodePType(node: hl.IHighLevelNode) {
        while (node.parent() &&node.parent().parent()) {
            node = node.parent();
        }
        return getNodeType(node);
    }

    private _selectedNode: hl.IHighLevelNode;

    setSelection(node: hl.IHighLevelNode) {
        //if (this._selectedNode == node) return;
        this._selectedNode = node;

        this.fire = false;
        try {
            var index = this.getNodePType(node);
            var viewer = this._viewers[index];
            
            var treeModel = viewer && viewer.getTreeModel();
            
            var structureNodeElement = treeModel && treeModel.findElement((structureNode: ramlOutline.StructureNode) => {
                return node && (<any>node) == structureNode.getSource();
            });
            
            if (structureNodeElement && viewer != null) {
                viewer.setSelection(structureNodeElement);
                this._rs.setSelectedIndex(index);
            }
        }finally {
            this.fire = true;
        }
    }

    unit: hl.IHighLevelNode;
    setUnit(unit:hl.IHighLevelNode, force: boolean = false) {
        this._children=[];
        this.createTree(unit);
        (<any>this).addClass('raml-outline');
        this.addChild(this._rs);
        this.html(this.innerRenderUI());


    }

    attach() {
        if (!this._isAttached) {
            var $this = $(this);
            $this.html(this._rs.renderUI().outerHTML);
            this._isAttached = true;
        }
    }

    forEachViewer(command: (viewer: UI.TreeViewer<any, any>) => void) {
        this._viewers.forEach(command);
    }

    refresh() {
        var unit = this.unit;
        this.setUnit(null);
        this.setUnit(unit);
    }

    destroy (): void {
        editorTools.aquireManager()._view=null;
        this._selectedNode=null;
        this.unit=null;
        this._viewers=[];
        this._rs=null
        this._children=[];
        this.disposables.dispose()
    }
}

/*
 *
 */
// export function treeSection(input: hl.IParseResult,
//                             name: string,
//                             icon: UI.Icon,
//                             filterFunc: (x:hl.IHighLevelNode)=>boolean,
//                             l: UI.ISelectionListener<any>,
//                             opener: (x:hl.IParseResult)=>void=null) : UI.TreePanel<any,any> {
//
//     var v = UI.treeViewerSection(name,icon,input,x=>getChildren(x).filter(x=>filterFunc(<hl.IHighLevelNode> x)),new HLRenderer(opener));
//
//     v.viewer.setBasicLabelFunction(x=>x ? x.name() : '');
//     v.viewer.setKeyProvider({
//         key:(p:hl.IParseResult):string=>{
//             return ""+p.lowLevel().start();
//         }
//
//     });
//     v.viewer.addSelectionListener(l)
//     return v;
// }

enum HLNodeType {
    Resource,
    Schema,
    Type,
    Trait,
    Unknown
}

function getNodeType(node: hl.IHighLevelNode): HLNodeType {
    if (outlineCommon.isResource(node)) return HLNodeType.Resource;
    else if (outlineCommon.isOther(node)) return HLNodeType.Trait;
    else if (outlineCommon.isResourceTypeOrTrait(node)) return HLNodeType.Type;
    else if (outlineCommon.isSchemaOrType(node)) return HLNodeType.Schema;
    else return HLNodeType.Unknown;
}

function isApi(p: hl.IHighLevelNode) {
    var pc=p.definition().key();
    return pc===universes.Universe08.Api||pc===universes.Universe10.Api;
}
function isDocumentation(p: hl.IHighLevelNode) {
    var pc=p.definition().key();
    return ( pc=== universes.Universe08.DocumentationItem||pc===universes.Universe10.DocumentationItem);
}

function fullStructurePath(model: ramlOutline.StructureNode) {
    if (!model) return "";

    var node = model.getSource();
    return fullPath(<any>node);
}

function fullPath(node: hl.IParseResult) {
    if (node == null) return "";
    else return fullPath(node.parent()) + "/" + node.name();
}

function simpleTree(input: ramlOutline.StructureNode, selectionListener: UI.ISelectionListener<any>, categoryName:string,
                           opener: (x:ramlOutline.StructureNode)=>void=null) {
    var viewer = UI.treeViewer<ramlOutline.StructureNode>((x:ramlOutline.StructureNode)=>{
        return <ramlOutline.StructureNode[]>x.children;
    }, new HLRenderer(opener), fullStructurePath);

    viewer.setBasicLabelFunction(x=>x.text);
    viewer.setKeyProvider({ key: (x:ramlOutline.StructureNode)=>{return x.key} });
    viewer.addSelectionListener(selectionListener);

    viewer.getBinding().set(input);

    return viewer;
}

export function createTree(p: hl.IParseResult, selectionListener: (e : UI.SelectionChangedEvent<any>) => void, opener: (x: ramlOutline.StructureNode) => void = null) {

    var subTrees = ramlOutline.getStructureForAllCategories();

    var resourcesModel = (p!=null&&subTrees!=null)?subTrees[outlineCommon.ResourcesCategory]:null;
    var typesModel = (p!=null&&subTrees!=null)?subTrees[outlineCommon.SchemasAndTypesCategory]:null;
    var traitsModel = (p!=null&&subTrees!=null)?subTrees[outlineCommon.ResourceTypesAndTraitsCategory]:null;
    var otherModel = (p!=null&&subTrees!=null)?subTrees[outlineCommon.OtherCategory]:null;

    // var resourcesModel = p!=null?ramlOutline.getStructure(outlineCommon.ResourcesCategory):null;
    // var typesModel = p!=null?ramlOutline.getStructure(outlineCommon.SchemasAndTypesCategory):null;
    // var traitsModel = p!=null?ramlOutline.getStructure(outlineCommon.ResourceTypesAndTraitsCategory):null;
    // var otherModel = p!=null?ramlOutline.getStructure(outlineCommon.OtherCategory):null;

    var outline = resourcesModel!=null? simpleTree(resourcesModel, { selectionChanged: selectionListener }, outlineCommon.ResourcesCategory, opener):null;
    var schemas = typesModel!=null? simpleTree(typesModel, { selectionChanged: selectionListener }, outlineCommon.SchemasAndTypesCategory, opener):null;
    var types   = traitsModel!=null? simpleTree(traitsModel, { selectionChanged: selectionListener }, outlineCommon.ResourceTypesAndTraitsCategory, opener):null;
    var other  = otherModel!=null? simpleTree(otherModel, { selectionChanged: selectionListener }, outlineCommon.OtherCategory, opener):null;

    var folder = new UI.TabFolder();

    folder.add(outlineCommon.ResourcesCategory, UI.Icon.SEARCH, outline, 'raml-icon-custom');
    folder.add(outlineCommon.SchemasAndTypesCategory, UI.Icon.SEARCH, schemas, 'raml-icon-custom');
    folder.add(outlineCommon.ResourceTypesAndTraitsCategory, UI.Icon.SEARCH, types, 'raml-icon-custom');
    folder.add(outlineCommon.OtherCategory, UI.Icon.SEARCH, other, 'raml-icon-custom');

    folder.setSelectedIndex(0)

    folder.setOnSelected(()=>{
        var selectedTab = <UI.TreeViewer<hl.IParseResult, hl.IParseResult>> folder.selectedComponent();
        if (selectedTab) {
            var selection = selectedTab.getSelection();
            if (selection && selection.elements && selection.elements.length > 0) {
                selectionListener(new UI.SelectionChangedEvent(selectedTab, null, selection));
            }

            selectedTab.customizePanel(true);
        }
    })
    return folder;
}


export class HLRenderer implements UI.ICellRenderer<ramlOutline.StructureNode>{

    constructor(private opener: (x: ramlOutline.StructureNode) => void) {

    }

    private iconNameToIconEnum(iconName : string) : UI.Icon {
        if (!iconName) return null;

        return UI.Icon[iconName];
    }

    private textHighlightNameToTextClass(highlightName : string) : UI.TextClasses {
        if (!highlightName) return null;

        return UI.TextClasses[highlightName];
    }

    render(model: ramlOutline.StructureNode): UI.BasicComponent<any> {
        try {

            if (ramlOutline.isTypedStructureNode(model)
                && (<ramlOutline.TypedStructureNode>model).type
                && (<ramlOutline.TypedStructureNode>model).type == ramlOutline.NodeType.ATTRIBUTE) {

                var attr = <hl.IAttribute>(<any>model.getSource());

                //TODO check if we really need custom selection here, otherwise the whole "is attribute" condition is redundant
                return UI.hc(UI.label(model.text), UI.a("", x=> {
                    var p1 = editorTools.aquireManager().getCurrentEditor().
                        getBuffer().positionForCharacterIndex(attr.lowLevel().start());
                    var p2 = editorTools.aquireManager().getCurrentEditor().
                        getBuffer().positionForCharacterIndex(attr.lowLevel().end());
                    editorTools.aquireManager().getCurrentEditor().setSelectedBufferRange({ start: p1, end: p1 }, {});

                }, UI.Icon.ARROW_SMALL_LEFT, null, null));

            }

            var icon = UI.Icon.DASH;
            var highLight = UI.TextClasses.NORMAL;

            if (this.iconNameToIconEnum(model.icon)) {
                icon = this.iconNameToIconEnum(model.icon);
            }

            if (this.textHighlightNameToTextClass(model.textStyle)) {
                highLight = this.textHighlightNameToTextClass(model.textStyle);
            }

            var extraText="";
            var extraClass=UI.TextClasses.NORMAL;

            var hc=UI.hc(UI.label(model.text, icon, highLight))

            if (model.typeText){
                hc.addChild(UI.label(model.typeText, UI.Icon.NONE, UI.TextClasses.WARNING).margin(2,0,0,0));
            }

            if (model.getSource().lowLevel().unit()!=model.getSource().root().lowLevel().unit()){
                highLight=UI.TextClasses.SUBTLE;
                hc.addChild(UI.label("("+model.getSource().lowLevel().unit().path()+")",UI.Icon.NONE,highLight).margin(5,0,0,0));
            }

            hc.addClass("outline");
            return hc;
        } catch (e) {
            console.log(e);
            return UI.hc(UI.label("Illegal node", UI.Icon.ARROW_SMALL_LEFT, null, null));
        }
    }
}
