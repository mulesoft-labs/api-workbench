import fs = require ('fs')
import path = require ('path')
import rp=require("raml-1-parser")
import highlevel=rp.hl;
import def=rp.ds;
import search=rp.search;
import lowLevel=rp.ll;

import _ = require('underscore');

import suggestions = require('raml-suggestions');
import sharedAstInitializerInterfaces = require('../shared-ast-initializer-interfaces');

export var selector= '.source.raml'
export var disableForSelector= '.text.html .comment'
export var filterSuggestions= true
export var inclusionPriority= 1
export var excludeLowerPriority=true;

export interface AtomCompletionRequest {
    bufferPosition:TextBuffer.IPoint
    editor:AtomCore.IEditor
    prefix?: string
}

import editorTools=require("../editor-tools/editor-tools")

export function initialize(astProvider : sharedAstInitializerInterfaces.IASTProvider) {
    suggestions.setDefaultASTProvider(<any>astProvider);
}

export function onDidInsertSuggestion(event:{editor:AtomCore.IEditor; triggerPosition:any; suggestion: any}){
    var offset=event.editor.getBuffer().characterIndexForPosition(event.triggerPosition);
    if (event.suggestion.annotation){
        var txt=event.editor.getBuffer().getText();
        for (var i=offset;i<txt.length;i++){
            var c=txt.charAt(i);
            if (c==')'){
                offset=i+1;
                break;
            }
            if (c=='\r'||c=='\n'){
                return;
            }
        }
        var newPos=event.editor.getBuffer().positionForCharacterIndex(offset)

        event.editor.getBuffer().insert(newPos, ':');
        return;
    }
    if ((event.suggestion.replacementPrefix&&event.suggestion.extra)||event.suggestion.extra=="%") {
        var newPos=event.editor.getBuffer().positionForCharacterIndex(offset-event.suggestion.replacementPrefix.length)
        event.editor.getBuffer().insert(newPos, event.suggestion.extra);
    }
    else{
        //This actually looks exactly like a previous case but typing it as a separate case for now TODO
        if (event.suggestion.extra==" "){
            var newPos=event.editor.getBuffer().positionForCharacterIndex(offset)
            event.editor.getBuffer().insert(newPos, event.suggestion.extra);
        }
        //FIXME
        if (event.suggestion.extra==" { "){
            var newPos=event.editor.getBuffer().positionForCharacterIndex(offset)
            event.editor.getBuffer().insert(newPos, event.suggestion.extra);
        }
        if (event.suggestion.extra&&event.suggestion.extra.indexOf("!include")!=-1){
            var newPos=event.editor.getBuffer().positionForCharacterIndex(offset)
            event.editor.getBuffer().insert(newPos, event.suggestion.extra);
        }
    }
}


class FSProvider implements suggestions.IFSProvider {
    contentDirName(content: suggestions.IEditorStateProvider): string {
        var contentPath = content.getPath();

        return path.dirname(contentPath);
    }

    dirName(childPath: string): string {
        return path.dirname(childPath);
    }

    exists(checkPath: string): boolean {
        return fs.existsSync(checkPath);
    }

    resolve(contextPath: string, relativePath: string): string {
        return path.resolve(contextPath, relativePath);
    }

    isDirectory(dirPath: string): boolean {
        var stat = fs.statSync(dirPath);

        return stat && stat.isDirectory();
    }

    readDir(dirPath: string): string[] {
        return fs.readdirSync(dirPath);
    }

    existsAsync(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.exists(path, (result) => {resolve(result)})
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDirAsync(path: string): Promise<string[]> {
        return new Promise(resolve => {
            fs.readdir(path, (err, result) => {resolve(result)})
        });
    }

    /**
     * Check whether the path points to a directory.
     * @param fullPath
     */
    isDirectoryAsync(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.stat(path, (err, stats) => {resolve(stats.isDirectory())})
        });
    }
}

class AtomEditorState implements suggestions.IEditorStateProvider {
    textEditor: AtomCore.IEditor;

    constructor(textEditor: AtomCore.IEditor,private request: AtomCompletionRequest) {
        this.textEditor = textEditor;
    }

    getText(): string {
        return this.textEditor.getBuffer().getText();
    }

    getPath(): string {
        return this.textEditor.getPath();
    }

    getBaseName(): string {
        return path.basename(this.getPath());
    }

    getOffset(): number {
        return this.request.editor.getBuffer().characterIndexForPosition(this.request.bufferPosition);
    }
}

export function getSuggestions(request: AtomCompletionRequest): suggestions.Suggestion[] {
    var t0=new Date().getMilliseconds();
    try {
        var editorState = new AtomEditorState(request.editor, request);

        var result = suggestions.suggest(editorState, new FSProvider());

        result.forEach(suggestion => {
            if(suggestion.prefix !== undefined) {
                delete suggestion.prefix;
        
                (<any>suggestion).replacementPrefix = suggestion.prefix;
        
                delete suggestion.prefix;
            }
        });

        return result;

    }finally{
        if (editorTools.aquireManager()){
            var m=editorTools.aquireManager();
            if (m.performanceDebug){
                var t1=new Date().getMilliseconds();
                console.log("Completion calc:"+(t1-t0));
            }
        }
    }
}

export function getAstNode(request: AtomCompletionRequest,clearLastChar:boolean=true,allowNull:boolean=true):highlevel.IParseResult{
    var p=request.editor.getPath();
    var prj=rp.project.createProject(path.dirname(p));
    var offset=request.editor.getBuffer().characterIndexForPosition(request.bufferPosition);
    var text=request.editor.getBuffer().getText();
    var kind=search.determineCompletionKind(text,offset);
    if(kind==search.LocationKind.KEY_COMPLETION&&clearLastChar){
        var pos=offset>0?offset-1:offset;
        for (var i=pos;i>0;i--){
            var c=text[i];
            if (c=='\r'||c=='\n'){
                break;
            }
            else{
                if (c==' '||c=='\t'){
                    ilevel++;
                }
            }
        }
        var oldOfffset=offset;

        text=text.substring(0,oldOfffset)+"k:"+text.substring(oldOfffset);
        //offset--;
    }
    var ilevel=0;
    var unit=prj.setCachedUnitContent(path.basename(p),text);
    var ast=<highlevel.IHighLevelNode>unit.highLevel();
    var cm=offset;
    for (var pm=offset-1;pm>=0;pm--){
        var c=text[pm];
        //if (c==' '||c=='\t'||c=='\r'||c=='\n'){
        //    cm=pm-1;
        //    continue;
        //}
        if (c==' '||c=='\t'){
            cm=pm-1;
            continue;
        }
        break;
    }
    var astNode=ast.findElementAtOffset(cm);

    if (astNode&&astNode.parent()==null){
        if (ilevel>0&&kind==search.LocationKind.KEY_COMPLETION) {
            var attr=_.find(astNode.attrs(),attr=>{
                var at=<any>attr;
                return at.lowLevel().start()<offset&&at.lowLevel().end()>=offset&&!at.property().isKey()
            });
            if (!attr) {
                if (allowNull) {
                    return null;
                }
            }
        }
        //check if we are on correct indentation level
    }
    if (!allowNull&&!astNode){
        return ast;
    }
    return astNode;
}

export function saveUnit(unit : lowLevel.ICompilationUnit) : void {
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
