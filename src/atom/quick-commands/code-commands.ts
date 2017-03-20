import editorTools=require("../editor-tools/editor-tools")
import contextActions = require("raml-actions")
import commonContextActions = require("../context-menu/commonContextActions")
import qc = require('./quick-commands');
import dialogs=require("../dialogs/dialogs")
import path=require('path')
import rp=require("raml-1-parser")

import hl=rp.hl;
import universe = rp.universes;
import services =rp.ds;

import universeHelpers =rp.universeHelpers;

class AddNewResourceStateCalculator extends contextActions.CommonASTStateCalculator {
    calculate () : any {

        //usually we dont need to check the editor, CommonASTStateCalculator does this for us
        //but in this case we accept null generalState, so double-checking for opened file
        var editor=this.getEditor()
        if (!editor) return null

        if (path.extname(editor.getPath() || '') != '.raml') return null

        var generalState = this.getGeneralState()
        if (!generalState) return null;

        var highLevelNode = <hl.IHighLevelNode><any>generalState.node;

        if (!universeHelpers.isResourceType(highLevelNode.definition()) &&
            !universeHelpers.isApiType(highLevelNode.definition()))
            return null

        if(!highLevelNode.lowLevel()) {
            return null;
        }

        return highLevelNode
    }
}

class CreateNewAPIStateCalculator extends contextActions.CommonASTStateCalculator {
    calculate () : any {

        var generalState = this.getGeneralState()
        if (generalState) return null

        var editor=this.getEditor()
        if (!editor) return null

        if (path.extname(editor.getPath() || '') != '.raml') return null

        var text = editor.getText().trim()
        if (text != "") return null

        return {}
    }
}


export function getResourceParent(node: hl.IHighLevelNode) {
    if (!node || !node.property()) return null;
    if ((universeHelpers.isResourcesProperty(node.property()) || universeHelpers.isResourceTypesProperty(node.property()))
        && (universeHelpers.isResourceType(node.definition()) || universeHelpers.isResourceTypeType(node.definition()))) return node;
    return getResourceParent(node.parent());
}
function getMethodParent(node: hl.IHighLevelNode) {
    if (!node || !node.property()) return null;
    if ((universeHelpers.isMethodType(node.definition())||universeHelpers.isTraitType(node.definition()))&&!node.definition().getAdapter(services.RAMLService).isUserDefined()){
        return node;
    }
    return null;
}
function getParent(node: hl.IHighLevelNode,name:string) {
    if (!node || !node.property()) return null;
    if ((node.definition().isAssignableFrom(name))){
        return node;
    }
    return null;
}

function getResourceParentOrRoot(node: hl.IHighLevelNode) {
    var rp = getResourceParent(node);
    return rp ? rp : editorTools.aquireManager().ast;
}

export function toResource(node: hl.IHighLevelNode) {
    if (!node || !node.property()) return null;

    if ((universeHelpers.isResourcesProperty(node.property()) || universeHelpers.isResourceTypesProperty(node.property()))
        && (universeHelpers.isResourceType(node.definition()) || universeHelpers.isResourceTypeType(node.definition()))) return node;

    return null;
}

export function registerQuickCommands(cm: qc.CommandManager) {
    if (!editorTools.aquireManager()) editorTools.initEditorTools(false);

    var commands = [
        //cm.add( 'raml-labs:re-parse',
        //    "Parse current file again",
        //    () => {
        //        editorTools.aquireManager().doParse(editorTools.aquireManager().getCurrentEditor().getPath());
        //        editorTools.aquireManager().getView().forEachViewer(viewer=>viewer.clear());
        //        editorTools.aquireManager().getView().setUnit(editorTools.aquireManager().ast, true); },
        //    () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && editorTools.aquireManager().ast != null,
        //    -100)

    ];

    commands.forEach(x=>x['__module__'] = 'editorTools');

    contextActions.addAction({
        name : "Add new resource",
        target : contextActions.TARGET_RAML_EDITOR_NODE,
        category : ["Add new..."],
        onClick : state=>dialogs.newResource(editorTools.aquireManager().getSelectedNode()),
        stateCalculator : new AddNewResourceStateCalculator(),
        shouldDisplay : state=>state != null
    })

    contextActions.addAction({
        name : "Create new API",
        target : contextActions.TARGET_RAML_EDITOR_NODE,
        category : ["Add new..."],
        onClick : state=>dialogs.newApi(),
        stateCalculator : new CreateNewAPIStateCalculator(),
        shouldDisplay : state=>state != null
    })

    contextActions.addSimpleAction("Add new method", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newMethod(toResource(editorTools.aquireManager().getSelectedNode())),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && toResource(editorTools.aquireManager().getSelectedNode()) != null);

    contextActions.addSimpleAction("Create new URI Parameter", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(toResource(editorTools.aquireManager().getSelectedNode()),"Create new URI Parameter","uriParameters"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (toResource(editorTools.aquireManager().getSelectedNode()) != null));

    contextActions.addSimpleAction("Create new Query Parameter", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getMethodParent(editorTools.aquireManager().getSelectedNode()),"Create new Query Parameter","queryParameters"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getMethodParent(editorTools.aquireManager().getSelectedNode()) != null));

    contextActions.addSimpleAction("Create new Header", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getMethodParent(editorTools.aquireManager().getSelectedNode()),"Create new Header","headers"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getMethodParent(editorTools.aquireManager().getSelectedNode()) != null));

    contextActions.addSimpleAction("Create new Response Header", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getParent(editorTools.aquireManager().getSelectedNode(),"Response"),"Create new Header","headers"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getParent(editorTools.aquireManager().getSelectedNode(),"Response" )!= null));
    contextActions.addSimpleAction("Create new Response Body", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getParent(editorTools.aquireManager().getSelectedNode(),"Response"),"Create new Response Body","body"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getParent(editorTools.aquireManager().getSelectedNode(),"Response" )!= null));
    contextActions.addSimpleAction("Create new Property", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getParent(editorTools.aquireManager().getSelectedNode(),"ObjectTypeDeclaration"),"Create new Property","properties"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getParent(editorTools.aquireManager().getSelectedNode(),"ObjectTypeDeclaration" )!= null));

    contextActions.addSimpleAction("Create new Body", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getMethodParent(editorTools.aquireManager().getSelectedNode()),"Create new Body","body"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getMethodParent(editorTools.aquireManager().getSelectedNode()) != null));
    contextActions.addSimpleAction("Create new Response", ["Add new..."], contextActions.TARGET_RAML_EDITOR_NODE,
        () => dialogs.newNode(getMethodParent(editorTools.aquireManager().getSelectedNode()),"Create new Response","responses","200"),
        () => editorTools.aquireManager() && editorTools.aquireManager().getCurrentEditor() && (getMethodParent(editorTools.aquireManager().getSelectedNode()) != null));
}
