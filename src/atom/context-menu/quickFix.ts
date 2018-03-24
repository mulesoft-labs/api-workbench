/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import contextActions = require("raml-actions")
import parser2 = require("raml-1-parser")
import rp = contextActions.parser
import lowLevel=rp.ll;
import hl=rp.hl;
import hl2=parser2.hl;
import search=rp.search;
import stubs=rp.stubs;
import universeHelpers = rp.universeHelpers;
import su=rp.schema;
import wrapper = rp.api10;
import apiModifier = rp.parser.modify;
import _=require("underscore")
import UI=require("atom-ui-lib")
import xmlutil=require("../../util/xmlutil")
import extract=require("../dialogs/extractElementsDialog")
import shemagen=require("../../util/schemaGenerator")
import SpacePenViews = require('atom-space-pen-views')
import def=rp.ds
import move=require("../dialogs/moveElementsDialog")
import tooltip=require("../core/tooltip-manager")
import commonContextActions = require("./commonContextActions")
import assistUtils = require("../dialogs/assist-utils")
import textutil = require("../../util/textutil")
import editorTools=require("../editor-tools/editor-tools")

/**
 * For unknown reason, compiler cant merge highlevel coming from raml-1-parser direct import
 * and the one coming from actions, so we need to convert manually.
 * @param node
 */
function hlConv(node:hl.IHighLevelNode) : hl2.IHighLevelNode {
    return <any> node;
}

export class AbstractDialogWithValidation {

    constructor(private parentNode:hl.IParseResult, private name:string) {
    }

    rootAtomPanel:any

    okButton:UI.Button

    errorLabel:UI.TextElement<any>

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {
        return null;
    }

    /**
     * Is called when "Ok" is pressed.
     */
    performOk() {

    }

    /**
     * Indended for subclassing
     * @param vc - parent section
     */
    createBody(section:UI.Section) {

    }

    /**
     * Call this to display the dialog.
     */
    show() {
        console.log("Original node tree:")
        if (this.getParentNode()) console.log(this.getParentNode().printDetails())

        if (!this.getParentNode()) {
            return
        }

        var mainSection = UI.section(this.name + ":", UI.Icon.GIST_NEW, false, false);

        this.createValidationIndicator(mainSection)

        this.createBody(mainSection)

        this.createButtonBar(mainSection)

        mainSection.setPercentWidth(100);

        var html = mainSection.renderUI();
        this.rootAtomPanel = (<any>atom).workspace.addModalPanel({item: html});
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

    createValidationIndicator(vc:UI.Section) {
        this.errorLabel = UI.label("", UI.Icon.BUG, UI.TextClasses.ERROR, UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(this.errorLabel));
    }

    saveUnit(unit:lowLevel.ICompilationUnit):void {
        var unitPath = unit.absolutePath()
        var unitText = unit.contents()

        //first trying to find an opened text editor
        var openedEditor = _.find(atom.workspace.getTextEditors(), editor => {
            var editorPath = editor.getPath()
            return editorPath == unitPath
        })

        if (openedEditor) {
            openedEditor.setText(unitText)
        } else {
            fs.writeFileSync(unitPath, unitText)
        }
    }

    createButtonBar(parentPanel:UI.Section) {
        var buttonBar = UI.hc().setPercentWidth(100).setStyle("display", "flex")

        buttonBar.addChild(UI.label("", null, null, null).setStyle("flex", "1"))

        buttonBar.addChild(UI.button("Cancel", UI.ButtonSizes.NORMAL,
            UI.ButtonHighlights.NO_HIGHLIGHT, UI.Icon.NONE,
            x=> {
                this.rootAtomPanel.destroy()
            }).margin(10, 10))

        this.okButton = UI.button("Extract", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x=> {
            this.performOk();
            this.rootAtomPanel.destroy();
        })

        this.okButton.setDisabled(true)
        buttonBar.addChild(this.okButton);

        parentPanel.addChild(buttonBar)
    }

    getParentNode():hl.IParseResult {
        return this.parentNode
    }

    getActiveEditor() {
        return assistUtils.getActiveEditor()
    }

    getNodeId(node:hl.IParseResult):string {

        if (node.parent()) {
            var parentId = this.getNodeId(node.parent());
            parentId += "." + node.name();
            var sameName = (<hl.IParseResult><any>node.parent()).directChildren().filter(x=>x.name() == node.name());
            if (sameName.length > 1) {
                var ind = sameName.indexOf(node);
                parentId += "[" + ind + "]"
            }
            return parentId;
        } else if (node.name()) {
            if ((<any>node).definition && (<any>node).definition() && (<any>node).definition().name() == "Api") {
                //no other way to get rid of a fake Api "key"
                return ""
            }
            return "." + node.name()
        }
        return "";
    }

    nodesEqualById(node1:hl.IParseResult, node2:hl.IParseResult) {
        return this.getNodeId(node1) == this.getNodeId(node2)
    }

    isParentOf(potentialParent:hl.IParseResult, potentialChild:hl.IParseResult):boolean {
        var current = potentialChild.parent()
        while (current != null) {

            if (current == potentialParent || this.nodesEqualById(current, potentialParent)) {
                return true
            }

            current = current.parent()
        }

        return false
    }
}


class MoveResourceStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        if (!universeHelpers.isResourceType(highLevelNode.definition()))
            return null

        return highLevelNode
    }
}

class CreateGlobalSchemaStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.VALUE_COMPLETION
            && generalState.completionKind != search.LocationKind.KEY_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        var attr = _.find(highLevelNode.attrs(),
            x=>x.lowLevel().start() < generalState.offset && x.lowLevel().end() >= generalState.offset && !x.property().getAdapter(def.RAMLPropertyService).isKey());

        if (!attr) return null

        if (!attr.value()) return null

        var p:hl.IProperty = attr.property();

        //FIXME INFRASTRUCTURE NEEDED
        if (!universeHelpers.isSchemaProperty(p)) return null

        var v = attr.value();
        var targets = search.referenceTargets(p,highLevelNode);
        var t:hl.IHighLevelNode = _.find(targets, x=>x.name() == attr.value())

        if (t) return null

        return attr
    }
}


export class ExtractJSONSchemaToTypeDialog extends AbstractDialogWithValidation {

    typeNameTextField:UI.TextField

    /**
     * Indended for subclassing
     * @param vc - parent section
     */
    createBody(section:UI.Section) {
        section.addChild(UI.label("Type name:").pad(5, 0))

        this.typeNameTextField = UI.texfField("", "NewType", x=> {
            this.performValidation()
        });

        section.addChild(this.typeNameTextField)
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {
        if (!this.typeNameTextField || !this.typeNameTextField.getBinding()) {
            return null
        }

        var schemaName = this.typeNameTextField.getBinding().get()
        if (schemaName.trim().length == 0) {
            return "Enter type name"
        }

        return null;
    }

    /**
     * Is called when "Ok" is pressed.
     */
    performOk() {
        var node = <hl.IHighLevelNode>this.getParentNode();
        var api = node.root();
        var schema = node.attrValue('schema');
        node.attr('schema').setValue('');

        var schemaName = this.typeNameTextField.getBinding().get()

        var types = su.createSchemaModelGenerator().generateTo(api, schema, schemaName);
        if (types.length > 0) {
            node.attrOrCreate('type').setValue(types[0]);
        }

        this.saveUnit(api.lowLevel().unit())
    }
}

export class CreateGlobalSchemaDialog extends AbstractDialogWithValidation {

    schemaNameTextField:UI.TextField

    /**
     * Indended for subclassing
     * @param vc - parent section
     */
    createBody(section:UI.Section) {
        section.addChild(UI.label("Schema name:").pad(5, 0))

        this.schemaNameTextField = UI.texfField("", this.getDefaultSchemaName(), x=> {
            this.performValidation()
        });

        section.addChild(this.schemaNameTextField)
    }

    /**
     * Intended for overriding in subclass.
     * Checks if everything is valid.
     * @returns {null} if validation passed ok, error message otherwise
     */
    validate():string {
        if (!this.schemaNameTextField || !this.schemaNameTextField.getBinding()) {
            return null
        }

        var schemaName = this.schemaNameTextField.getBinding().get()
        if (schemaName.trim().length == 0) {
            return "Enter schema name"
        }

        var attr = <hl.IAttribute>this.getParentNode()

        var schemaContent = attr.value()

        var schemaFilePath = this.getSchemaFilePath(schemaName, schemaContent)
        if (fs.existsSync(schemaFilePath)) {
            return "Schema file " + schemaFilePath + " already exists"
        }

        return null;
    }

    /**
     * Is called when "Ok" is pressed.
     */
    performOk() {
        var schemaName = this.schemaNameTextField.getBinding().get()

        var attr = <hl.IAttribute>this.getParentNode()

        var schemaContent = attr.value()

        var schemaFilePath = this.getSchemaFilePath(schemaName, schemaContent)

        var root = attr.parent().root();

        var globalSchemaType:def.NodeClass = <def.NodeClass>attr.property().range().universe().type("GlobalSchema");
        var schemaNode:hl.IHighLevelNode =<hl.IHighLevelNode> stubs.createStubNode(globalSchemaType,(<any>globalSchemaType.universe().type("Api")).property("schemas"), schemaName);

        schemaNode.attrOrCreate("value").setValue("!include " + this.getSchemaRelativePath(schemaName, schemaContent));

        root.add(schemaNode);

        attr.setValue(schemaName);

        this.saveUnit(attr.lowLevel().unit())


        var schemaDir = path.dirname(schemaFilePath)
        if (!fs.existsSync(schemaDir)) {
            fs.mkdirSync(schemaDir);
        }

        fs.writeFileSync(schemaFilePath, schemaContent)
    }

    getSchemaFilePath(schemaName:string, schemaContent:string):string {
        var parentDirectory = path.resolve(path.dirname(this.getActiveEditor().getPath()), "schemas");

        var schemaExtension = this.determineSchemaExtension(schemaContent)

        var fileName = schemaName + "." + schemaExtension

        return path.resolve(parentDirectory, fileName)
    }

    getSchemaRelativePath(schemaName:string, schemaContent:string):string {
        var schemaExtension = this.determineSchemaExtension(schemaContent)

        var fileName = schemaName + "." + schemaExtension

        return "schemas/" + fileName
    }

    determineSchemaExtension(schemaContent:string):string {
        var trim = schemaContent.trim();
        if (trim.indexOf("{") == 0 || trim.indexOf("[") == 0) {
            return "json"
        }

        return "xsd"
    }

    getDefaultSchemaName():string {
        return "NewSchema"
    }
}

export function createGlobalSchema(attr:hl.IAttribute) {
    new CreateGlobalSchemaDialog(attr, "Create Global Schema").show()
}

class ExpandSignatureStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.VALUE_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        var attr = _.find(highLevelNode.attrs(),
            x=>x.lowLevel().start() < generalState.offset && x.lowLevel().end() >= generalState.offset && !x.property().getAdapter(def.RAMLPropertyService).isKey());

        if (!attr) return null

        if (!attr.value()) return null

        var p:hl.IProperty = attr.property();


        return attr
    }
}



function updateEditor(node) {
    var ed = assistUtils.getActiveEditor();
    ed.setText(assistUtils.cleanEmptyLines(node.root().lowLevel().unit().contents()));
}






class ExtractResourceTypeStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        if (!universeHelpers.isResourceType(highLevelNode.definition()))
            return null

        return highLevelNode
    }
}

class ExtractTraitStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        if (!universeHelpers.isMethodType(highLevelNode.definition()))
            return null

        return highLevelNode
    }
}

class MoveContentStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION)
            return null;


        var highLevelNode = <hl.IHighLevelNode>generalState.node;

        if (highLevelNode.children().length == 0)
            return null

        return highLevelNode
    }
}

class ConvertJsonSchemaToTypeStateCalculator extends contextActions.CommonASTStateCalculator {
    calculate():any {
        var generalState = this.getGeneralState();
        if (!generalState) return null

        
        var highLevelNode = <hl.IHighLevelNode>generalState.node;
        //console.log('definition: ' + highLevelNode.definition().name() + '; ' + generalState.completionKind);
        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION
            && generalState.completionKind != search.LocationKind.VALUE_COMPLETION)
            return null;

        if (generalState.node.isElement()) {
            if (universeHelpers.isRAML08Node(generalState.node.asElement())) return null;
        }

        if (generalState.node.isAttr()) {
            if (universeHelpers.isRAML08Attribute(generalState.node.asAttr())) return null;
        }

        var attr = _.find(highLevelNode.attrs(),
            x=>x.lowLevel().start() < generalState.offset && x.lowLevel().end() >= generalState.offset && !x.property().getAdapter(def.RAMLPropertyService).isKey());

        if (!attr) return null

        if (!attr.value()) return null

        var p:hl.IProperty = attr.property();

        if (!universeHelpers.isSchemaProperty(p)) return null

        if (typeof attr.value() != 'string' || (<string>attr.value()).indexOf("{") == -1) {
            return null;
        }

        return highLevelNode
        //var txt=generalState.editor.getText();
        //var res = getKeyValue(generalState.offset, txt);
        //if(res != 'schema') return null;
        //var schema = highLevelNode.attrValue('schema');
        //if(!schema) return null;
        //return (schema.length > 0 && schema[0] == '{')? highLevelNode : null;
        //return true; //res == 'schema'? highLevelNode : null;
    }
}


// function indent(line:string) {
//     var rs = "";
//     for (var i = 0; i < line.length; i++) {
//         var c = line[i];
//         if (c == '\r' || c == '\n') {
//             continue;
//         }
//         if (c == ' ' || c == '\t') {
//             rs += c;
//             continue;
//         }
//         break;
//     }
//     return rs;
// }

//FIXME remove it from here duplication with jsyaml2lowLevel.ts
// function stripIndent(text:string, indent:string) {
//     var lines = assistUtils.splitOnLines(text);
//     var rs = [];
//     for (var i = 0; i < lines.length; i++) {
//         if (i == 0) {
//             rs.push(lines[0]);
//         }
//         else {
//             rs.push(lines[i].substring(indent.length));
//         }
//     }
//     return rs.join("");
// }



class ExtractLibraryStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState();
        if (!generalState) return null;

        if (generalState.node.isElement()) {
            if (universeHelpers.isRAML08Node(generalState.node.asElement())) return null;
        }

        if (generalState.node.isAttr()) {
            if (universeHelpers.isRAML08Attribute(generalState.node.asAttr())) return null;
        }

        var current: any = generalState.node;
        

        while (current.parent() != null) {
            current = current.parent()
        }
        
        var currentType = current && current.definition && current.definition();

        if(currentType && universeHelpers.isOverlayType(currentType)) {
            return null;
        }

        if(currentType && universeHelpers.isExtensionType(currentType)) {
            return null;
        }

        return current
    }
}

class ExtractOverlayStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        var current = generalState.node
        while (current.parent() != null) {
            current = current.parent()
        }
        return current
    }
}

class ModifyOverlayStateCalculator extends contextActions.CommonASTStateCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        var current = generalState.node
        while (current.parent() != null) {
            current = current.parent()
        }

        if ((<hl.IHighLevelNode>current).definition
            && universeHelpers.isOverlayType((<hl.IHighLevelNode>current).definition())) {
            return current
        }

        return null
    }
}

class AbstractMoveTypePropertiesCalculator extends contextActions.CommonASTStateCalculator {
    isTypeNode(node) {
        return (<hl.IHighLevelNode>node).property
            && (<hl.IHighLevelNode>node).property().range
            && universeHelpers.isTypeDeclarationType((<hl.IHighLevelNode>node).property().range())
            && universeHelpers.isTypesProperty((<hl.IHighLevelNode>node).property())
    }
}

class PullUpStateCalculator extends AbstractMoveTypePropertiesCalculator {

    calculate():any {

        var generalState = this.getGeneralState()
        if (!generalState) return null

        var current = generalState.node
        if (!current)
            return null

        while (current.parent() != null) {
            if (this.isTypeNode(current)) {
                //so, we're inside the type

                //but we also want to double check that there are superclasses
                var superTypes = extract.findUserDefinedSupertypes(hlConv(<hl.IHighLevelNode>current))
                if (superTypes && superTypes.length > 0)
                    return current
                else
                    return null
            }
            current = current.parent()
        }

        return null
    }
}

class ExtractSupertypeCalculator extends AbstractMoveTypePropertiesCalculator {

    calculate():any {
        var generalState = this.getGeneralState()
        if (!generalState) return null

        var current = generalState.node
        if (!current)
            return null

        while (current.parent() != null) {
            if (this.isTypeNode(current)) {
                //so, we're inside the type

                //but we also want to double check that there are no superclasses
                var superTypes = extract.findUserDefinedSupertypes(hlConv(<hl.IHighLevelNode>current))
                if (!superTypes || superTypes.length == 0)
                    return current
                else
                    return null
            }
            current = current.parent()
        }

        return null
    }
}

class GenerateExampleCalculator extends contextActions.CommonASTStateCalculator {
    calculate():any {
        var generalState = this.getGeneralState()
        if (!generalState) return null
        var highLevelNode = <hl.IHighLevelNode>generalState.node;
        //console.log('definition: ' + highLevelNode.definition().name() + '; ' + generalState.completionKind);
        if (generalState.completionKind != search.LocationKind.KEY_COMPLETION
            && generalState.completionKind != search.LocationKind.VALUE_COMPLETION)
            return null;
        var txt = generalState.editor.getText();
        //var res = getKeyValue(generalState.offset, txt);
        //return (res == 'type')? highLevelNode: null;

        var attr = _.find(highLevelNode.attrs(),
            x=>x.lowLevel().start() < generalState.offset && x.lowLevel().end() >= generalState.offset && !x.property().getAdapter(def.RAMLPropertyService).isKey());

        if (!attr) return null;
        var p:hl.IProperty = attr.property();
        if (!universeHelpers.isExampleProperty(p)) return null;

        var typeAttr = highLevelNode.attr('type');
        if(!typeAttr) return null;
        var type = typeAttr.value();
        if(!type) return null;

        return highLevelNode
    }
}

export function initialize() {

    contextActions.addAction({

        name: "Create global schema",

        id: "Create global schema",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Code"],

        onClick: (contextState, uiState)=>createGlobalSchema(<hl.IAttribute> contextState),

        stateCalculator: new CreateGlobalSchemaStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Move resource",

        id: "Move resource",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new move.MoveElementsDialog(
                hlConv(<hl.IHighLevelNode>state),
                "Resource Type", true).show()
        },

        stateCalculator: new MoveResourceStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Extract Resource Type",

        id: "Extract Resource Type",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new extract.ExtractTypesAndTraitsDialog(hlConv(<hl.IHighLevelNode>state), "Resource Type", true).show()
        },

        stateCalculator: new ExtractResourceTypeStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Extract Trait",

        id: "Extract Trait",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new extract.ExtractTypesAndTraitsDialog(hlConv(<hl.IHighLevelNode>state), "Trait", false).show()
        },

        stateCalculator: new ExtractTraitStateCalculator(),

        shouldDisplay: state=>state != null
    });

    contextActions.addAction({
        name: "Convert JSON schema to type",
        id: "Convert JSON schema to type",
        target: contextActions.TARGET_RAML_EDITOR_NODE,
        category: ["Refactoring"],
        onClick: (state)=> {
            new ExtractJSONSchemaToTypeDialog(<hl.IHighLevelNode>state, "Convert JSON schema to type").show()
        },
        stateCalculator: new ConvertJsonSchemaToTypeStateCalculator(),
        shouldDisplay: state=>state != null
    });
    
    contextActions.addAction({

        name: "Extract Library",

        id: "Extract Library",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new extract.ExtractLibraryDialog(hlConv(<hl.IHighLevelNode>state), "Extract Library").show()
        },

        stateCalculator: new ExtractLibraryStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Extract Overlay",

        id: "Extract Overlay",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Code"],

        onClick: (state)=> {
            new extract.ExtractOverlayDialog(hlConv(<hl.IHighLevelNode>state), "Extract Overlay").show()
        },

        stateCalculator: new ExtractOverlayStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Modify Overlay",

        id: "Modify Overlay",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Code"],

        onClick: (state)=> {
            new extract.ModifyOverlayDialog(hlConv(<hl.IHighLevelNode>state), "Modify Overlay").show()
        },

        stateCalculator: new ModifyOverlayStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Pull Up",

        id: "Pull Up",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new extract.PullUpDialog(hlConv(<hl.IHighLevelNode>state), "Pull Up").show()
        },

        stateCalculator: new PullUpStateCalculator(),

        shouldDisplay: state=>state != null
    })

    contextActions.addAction({

        name: "Extract Supertype",

        id: "Extract Supertype",

        target: contextActions.TARGET_RAML_EDITOR_NODE,

        category: ["Refactoring"],

        onClick: (state)=> {
            new extract.ExtractSupertypeDialog(hlConv(<hl.IHighLevelNode>state), "Extract Supertype").show()
        },

        stateCalculator: new ExtractSupertypeCalculator(),

        shouldDisplay: state=>state != null
    })

}
