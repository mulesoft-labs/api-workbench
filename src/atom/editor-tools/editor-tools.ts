/// <reference path="../../../typings/main.d.ts" />
import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import atom = require('../core/atomWrapper');
// import rp=require("raml-1-parser")
// import hl=rp.hl;
// import ll=rp.ll;
// import project=rp.project;
import _=require("underscore")
import pair = require("../../util/pair");
import detailsView=require("./details-view")
import outlineView=require("./outline-view")
import UI=require("atom-ui-lib")
import ramlServer = require("raml-language-server");
import markOccurrences = require("../core/markOccurences")

var _bmc : number = 0;
function benchmark(func?: string): void {
    var t0 = new Date().getTime();
    if (_bmc != 0 && func)
        console.log(func + " took " + (t0-_bmc) + " miliseconds.");

    _bmc = t0;
}

interface Point {
    row: number;
    column: number;
}
interface Range {
    start: Point;
    end: Point;
}
interface IChangeCommand {
    newText: string;
    oldText: string;
    oldRange: Range;
    newRange: Range;
}



class EditorManager{

    private currentEditor:any;

    _view: outlineView.RamlOutline;
    _details: detailsView.RamlDetails;

    // ast: hl.IHighLevelNode;
    unitPath : string;
    // unit: ll.ICompilationUnit;

    changing: boolean;
    executingCommand: boolean;

    private _initialized: boolean = false;

    private markOccurrencesReconciler;

    getPath(): string {
        console.log("ETM::GetPath");
        return this.currentEditor ? this.currentEditor.getPath() : null;
    }

    getCurrentEditor() { return this.currentEditor; }

    constructor(display: boolean = true) {
        manager = window["manager"] = this;

        this.markOccurrencesReconciler = new ramlServer.Reconciler(ramlServer.getNodeClientConnection(), 200);

        atom.workspace.onDidChangeActivePaneItem(e => this.updateEverything(display));

        atom.workspace.observeTextEditors(editor=>{
            editor.onDidDestroy(()=>{

                let path = editor.getPath();

                ramlServer.getNodeClientConnection().documentClosed(path);
            })

            editor.onDidChangeCursorPosition(event=>this.cursorChanged(editor, event.newBufferPosition))
        })

        this.updateEverything(display);
        this.addAutoCloseListener();

        this.addListenersForStructure();
    }

    private updateCount: number=0;

    private cursorChanged(editor: atom.ITextEditor, newBufferPosition: Point) {

        markOccurrences.clearOccurences(editor);

        this.markOccurrencesReconciler.schedule(new markOccurrences.MarkOccurrenceRunnable(editor, newBufferPosition));

        let buffer = editor.getBuffer();
        let pos = buffer.characterIndexForPosition(editor.getCursorBufferPosition());

        ramlServer.getNodeClientConnection().positionChanged(manager.unitPath, pos);
    }

    internalScheduleUpdateViews(count:number){
        this.updateCount=count;
        setTimeout(()=>{
            if (this.updateCount==count){
                this.updateViews();
            }
        },500);
    }

    scheduleViewsUpdate(){
        if (this.fire){
            this.internalScheduleUpdateViews(this.updateCount+1);
        }
    }

    private outlineCount: number=0;
    internalScheduleOutlineUpdate(count:number){
        this.outlineCount=count;
        setTimeout(()=>{
            if (this.outlineCount==count){
                this.updateOutline();
            }
        },500);
    }

    scheduleOutlineUpdate(){
        this.internalScheduleOutlineUpdate(this.outlineCount+1);

    }

    private addAutoCloseListener() {
        atom.workspace.onDidDestroyPane(evt=> {
            try {
                var edcount = atom.workspace.getPaneItems().filter(function (e) {
                    return e['softTabs'] != undefined;
                }).length;
                if (edcount == 0) {
                    // this.ast=null;
                    // this.unit=null;
                    // this._currentNode=null;
                    this.currentEditor=null;

                    if(global.cleanCache) {
                        global.cleanCache();
                    }

                    if (atom.workspace.paneForItem(this._view)) atom.workspace.paneForItem(this._view).destroy();
                    if (atom.workspace.paneForItem(this._details)) atom.workspace.paneForItem(this._details).destroy();
                    this.opened = false;
                }
            } catch (e) {
                //TODO REMOVE IT LATER WE NEED TO BE PRETy DEFENSIVE AT THIS MOMENT
                console.log(e)
            }
        });
    }

    private getOrCreateView() {
        if (!this._view) {
            this._view = new outlineView.RamlOutline();
            if (this.unitPath){
                 this._view.setUnit(this.unitPath);
            }
            // if (this.ast){
            //     this._view.setUnit(this.ast);
            // }
        }
        return this._view;
    }

    private getDetails() {
        if (!this._details) this._details = new detailsView.RamlDetails();
        return this._details;
    }

    updateDetails() {
        this.getDetails().update();
    }

    reparseAST() {
        if (this.currentEditor) {
            var _path = this.currentEditor.getPath();
            var bf=this.currentEditor.getBuffer();

            this.unitPath = _path;
            // var prj = project.createProject(path.dirname(_path));
            // var unit = prj.setCachedUnitContent(path.basename(_path), this.currentEditor.getBuffer().getText());
            //
            // unit.project().addTextChangeListener(delta=>{
            //     if (delta.unit!=unit){
            //         return;
            //     }
            //     var cm=delta.offset;
            //     var end=delta.replacementLength;
            //     var text=delta.text;
            //     var buffer=(<atom.IBuffer>this.currentEditor.getBuffer());
            //     var start=buffer.positionForCharacterIndex(cm);
            //     var endPosition=buffer.positionForCharacterIndex(cm+end);
            //     try {
            //         this.fire=false;
            //         (<any>buffer).setTextInRange({start: start, end: endPosition}, text);
            //         this.scheduleOutlineUpdate();
            //     } finally{
            //         this.fire=true;
            //     }
            // });
            // this.ast = unit.highLevel();
            // this.unit = unit;
        }
    }


    isETPane(pane) {
       if (!this._view){
           return;
       }
       var items = pane.getItems();
       return (items.indexOf(this.getDetails()) >= 0 || items.indexOf(this._view) >= 0);
    }

    display() {
        console.log("ETM::Display");
        var aw = atom.workspace;
        var fpane = atom.workspace.paneForItem(this.getCurrentEditor());
        if (!fpane) return;
        if (!aw.paneForItem(this.getOrCreateView()))
            doSplit(this.getOrCreateView());
        if (!aw.paneForItem(manager.getDetails()))
            doSplit(this.getDetails(), SplitDirections.BOTTOM);

        this.opened = true;
    }

    fire: boolean = true;

    // updateText(node?: ll.ILowLevelASTNode) {
    //     this.fire = false;
    //     var editor = this.currentEditor;
    //     var pos = node ? editor.getBuffer().positionForCharacterIndex(node.start()) : null;
    //     editor.setText(this.unit.contents());
    //     this.fire = true;
    //     if (pos) (<any>editor).setCursorBufferPosition(pos);
    // }

    // selectNode(hnode: hl.IHighLevelNode) {
    //     var node = hnode.lowLevel();
    //     if (!node) return;
    //     var editor = this.currentEditor;
    //     if (!editor) return;
    //     var pos = node ? editor.getBuffer().positionForCharacterIndex(node.start()) : null;
    //     if (pos) (<any>editor).setCursorBufferPosition(pos);
    // }
    
    private setViewsDisplayStyle(visible: boolean) {
        if(this._details && (<any>this)._details.element) {
            (<any>this)._details.element.style.display = visible ? null : "none";
        }

        if(this._view && (<any>this)._view.element) {
            (<any>this)._view.element.style.display = visible ? null : "none";
        }
    }
    
    private isRaml(editor): boolean {
        if(!editor) {
            return false;
        }

        var editorPath = editor.getPath();
        
        if(!editorPath) {
            return false;
        }
        
        var extName = path.extname(editorPath);
        
        if(extName !== '.raml') {
            return false;
        }
        
        return true;
    }
    
    private updateEverything(display: boolean = true) {
        var editor = atom.workspace.getActiveTextEditor();
        
        if(editor) {
            this.setViewsDisplayStyle(this.isRaml(editor));
        }
        
        if(!editor || editor == this.currentEditor || !this.isRaml(editor)) {
            return;
        }

        this.currentEditor = editor;

        if (this.opened == false && display) this.display();

        //we are not listening to the editor changes any more,
        //instead we are listening to the reports of the server that something is avilable, like the structure
        if (!(<any>editor).patched) {
           this.addListenersToEditor( editor);
        }

        this.reparseAST();

        var pos = (<any>editor.getBuffer()).characterIndexForPosition(editor.getCursorBufferPosition());

        this.positionUpdated(pos);

        this.scheduleViewsUpdate();
    }

    private addListenersToEditor(cedit) {
        var buffer = cedit.getBuffer();
        buffer.onDidChange(x => {
            try {
                //this.reparseAST();
                var pos = buffer.characterIndexForPosition(cedit.getCursorBufferPosition());
                this.positionUpdated(pos);
                //this.scheduleViewsUpdate();

            } catch (e){
                console.log(e);
            }
        });
        //updating ast node on position change
        // cedit.getLastCursor().onDidChangePosition(x=> {
        //     if (!this.fire) return;
        //     this.positionUpdated(buffer.characterIndexForPosition(cedit.getCursorBufferPosition()));
        //     this.scheduleViewsUpdate();
        // });
        // this.addListenersOnMove(cedit);
        (<any>this.currentEditor).patched = true;
    }

    private addListenersForStructure() {
        ramlServer.getNodeClientConnection().onStructureReport(report=>{

            let categoryNames = []
            for(let categoryName in report.structure) categoryNames.push(categoryName);

            let categoryNamesString = categoryNames.join();
            ramlServer.getNodeClientConnection().debug("Got new structure report with categories "
                + categoryNamesString, "EditorManager", "addListenersForStructure");

            var editor = atom.workspace.getActiveTextEditor();

            if(!editor || !this.isRaml(editor)) {
                return;
            }

            this.updateOutline();
        })
    }

    private addListenersOnMove(cedit) {
        var movingPane=false;
        atom.workspace.onDidAddPaneItem(event=> {
            if (movingPane || this.isETPane(event.pane) == false || event.item == this.getOrCreateView() || event.item == this.getDetails()) return event;
            setTimeout(()=> {
                try {
                    var fpane = atom.workspace.paneForItem(cedit);
                    if (fpane) {
                        movingPane = true;
                        event.pane.moveItemToPane(event.item, fpane, null);
                        movingPane = false;
                        fpane.setActiveItem(event.item);
                        fpane.activate();
                    }
                } catch (e) {
                    //TODO REMOVE IT LATER WE NEED TO BE PRETy DEFENSIVE AT THIS MOMENT
                    console.log(e);
                }
            }, 18);
        });

    }

    opened: boolean = false;

    currentPosition: number;
    // _currentNode: hl.IHighLevelNode;
    // //_selectedNode: hl.IHighLevelNode;

    // patchCurrentNode(n:hl.IHighLevelNode){
    //     this._currentNode=n;
    // }
    //
    // getCurrentNode() {
    //     if (this._currentNode == null) return this._currentNode = this.ast;
    //     else return this._currentNode;
    // }


    // setSelectedNode(node: hl.IHighLevelNode) {
    //     //this._selectedNode = node;
    //
    //     if (this.unit){
    //         var unitPath=this.unit.absolutePath();
    //         while (node.lowLevel().unit().absolutePath()!=unitPath){
    //             if (!node.parent()){
    //                 break;
    //             }
    //             else{
    //                 node=node.parent();
    //             }
    //         }
    //     }
    //     var id=node.id();
    //     var anode=this.ast.findById(id);
    //     if (anode){
    //         node=anode;
    //     }
    //     if (this._details){
    //         this._details.show(node);
    //     }
    //     var editor = this.getCurrentEditor();
    //     if (editor) {
    //         this.fire=false;
    //         try {
    //             var buffer = editor.getBuffer();
    //             var posStart = buffer.positionForCharacterIndex(node.lowLevel().start());
    //             var posEnd = buffer.positionForCharacterIndex(node.lowLevel().end());
    //             editor.setCursorBufferPosition(posStart);
    //             this.positionUpdated(buffer.characterIndexForPosition(editor.getCursorBufferPosition()));
    //         }finally{
    //             this.fire=true;
    //         }
    //     }
    // }

    // getSelectedNode() {
    //     return this.getCurrentNode()
    //     //else return this._selectedNode;
    // }

    setText(text: string) {
        console.log("ETM::SetText");
        var editor = this.currentEditor;
        if (editor == null) return;
        editor.setText(text);
    }

    private isFromEdgeRow(): boolean {
        var editor = this.getCurrentEditor()

        if(!editor) {
            return false;
        }

        var currentPosition = editor.getCursorBufferPosition();

        if(!currentPosition) {
            return false;
        }

        var currentRow = currentPosition.row;

        var previousRow = editor.previousRow;

        editor.previousRow = currentRow;

        if(previousRow === undefined) {
            return false;
        }

        if(previousRow === currentRow) {
            return false;
        }

        if(previousRow === editor.getBuffer().getLastRow() || previousRow === 0) {
            return true;
        }
    }

    updateViews() {
        //var cNode = this.getCurrentNode();
        var ds=new Date().getMilliseconds();
        if (this._details) {
            this.getDetails().show(manager.unitPath, manager.currentPosition, this.isFromEdgeRow());
        }
        if (this._view) {
            this.getOrCreateView().setUnit(manager.unitPath);
            // this.getOrCreateView().setUnit(manager.ast);
            //this.getOrCreateView().setSelection(cNode);
        }
        var d1=new Date().getMilliseconds();
        if (this.performanceDebug) {
            console.log("Views update:" + (d1 - ds));
        }
    }

    _cleanOutline=false;

    updateOutline() {

        ramlServer.getNodeClientConnection().debug("Updating outline", "EditorManager", "updateOutline");

        if (this._view) {
            this.getOrCreateView().setUnit(manager.unitPath);
        }
    }

    positionUpdated(newPosition) {
        this.currentPosition = newPosition;
        if (this._details) {
            ramlServer.getNodeClientConnection().positionChanged(manager.unitPath, this.currentPosition);
            // this.getDetails().show(manager.unitPath, this.currentPosition, this.isFromEdgeRow());
        }
        // if (this.ast){
        //     this._currentNode=this.ast.findElementAtOffset(this.currentPosition);
        // }
    }
    performanceDebug=true;

    placeholder: boolean = false;

}
var manager : EditorManager = null;

export function initEditorTools(display: boolean = true) {
    if (manager == null) manager = new EditorManager(display);
    else if (display) manager.display();
}

export function editorToolsStatus() {
    return manager != null && manager.opened;
}

export function aquireManager(){
    if (!manager){
        manager=new EditorManager(true);
    }
    return manager;
}
// export function updateAndSelect(node:hl.IHighLevelNode){
//     if (aquireManager()._view) {
//         aquireManager()._view.refresh();
//     }
//     aquireManager().updateText();
//     aquireManager().selectNode(node);
// }
export enum SplitDirections{
    RIGHT,
    LEFT,
    TOP,
    BOTTOM
}

export function doSplit(value:any,dir:SplitDirections=SplitDirections.RIGHT){
    var newPane=null;
    switch( dir) {
        case SplitDirections.BOTTOM:
            newPane=atom.workspace.getActivePane().splitDown({});
            break;
        case SplitDirections.TOP:
            newPane=atom.workspace.getActivePane().splitUp({});
            break;
        case SplitDirections.LEFT:
            newPane=atom.workspace.getActivePane().splitLeft({});
            break;
        case SplitDirections.RIGHT:
            newPane=atom.workspace.getActivePane().splitRight({});
            break;
    }
    newPane.addItem(value,0)
    return newPane;
}
