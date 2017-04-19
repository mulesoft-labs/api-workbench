/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import rp=require("raml-1-parser")
import hl=rp.hl;
import utils=rp.utils;
import rr=rp.utils;
import unitUtils = require("../util/unit")

import _=require("underscore")
var TextBuffer=require("basarat-text-buffer")
import editorManager=require("./editorManager")
import editorTools=require("../editor-tools/editor-tools")
export var grammarScopes= ['source.raml']
export var scope= 'file'
export var lintOnFly= true;

export var relint = function (editor:AtomCore.IEditor)  {
    (<any>editor).getBuffer().emitter.emit("did-change", {
        oldText: (<any>editor).getBuffer().getText(),
        newText: (<any>editor).getBuffer().getText()
    });
}

function relintLater(editor: any) {
    Promise.resolve(editor).then(editor => {
        relint(editor);
    });
}

export function initEditorObservers(linter) {
    rr.addLoadCallback(x => {
        atom.workspace.getTextEditors().forEach(x=>relintLater(x));
    
        var manager = editorTools.aquireManager();
    
        if(manager) {
            manager.updateDetails();
        }
    });
    
    atom.workspace.observeTextEditors(relintLater);
    
    return {
        dispose: () => {

        }
    }
}

export function lint(textEditor:AtomCore.IEditor) {
    var result = actualLint(textEditor);

    if(rr.hasAsyncRequests()) {
        return [];
    }

    return result;
}

function isRAMLUnit(editor) {
    var contents = editor.getBuffer().getText();

    return unitUtils.isRAMLUnit(contents)
}

var combErrors = function (result:any[]) {
    var map = {};
    result.forEach(x=> {
        var original = JSON.parse(JSON.stringify(x));
        original.trace = null;
        var newKey = JSON.stringify(original);
        var tr = map[newKey];
        if (tr) {
            tr.push(x);
        }
        else {
            map[newKey] = [x];
        }
    });
    var rs:any[] = [];
    for (var i in map) {
        var mes = JSON.parse(i);
        mes.trace = [];
        var ms = map[i];
        ms.forEach(x=> {
            if (x.trace) {
                mes.trace = mes.trace.concat(x.trace);
            }
        })
        mes.trace = combErrors(mes.trace);
        rs.push(mes);
    }
    return rs;
};
function actualLint(textEditor:AtomCore.IEditor) {
    if(rr.hasAsyncRequests()) {
        return [];
    }

    if (!isRAMLUnit(textEditor)) return [];

    var l=new Date().getTime();
    var astNode=editorManager.ast(textEditor);
    if (astNode==null){
        return [];
    }
    var result:any[]=[];
    var acceptor=new Acceptor(textEditor, result, astNode.root());
    var c=astNode.lowLevel() ? astNode.lowLevel().unit().contents() : "";
    var tab=0;
    while (true) {
        var tab:number = c.indexOf('\t',tab)
        if (tab != -1) {
            var p1 = textEditor.getBuffer().positionForCharacterIndex(tab);
            var p2 = textEditor.getBuffer().positionForCharacterIndex(tab + 1);
            var t = "Using tabs  can lead to unpredictable results";
            var message = {
                type: ("Warning"),
                filePath: textEditor.getPath(),
                text: t,
                trace: [],
                range: [[p1.row, p1.column], [p2.row, p2.column]]
            }
            result.push(message);
            tab++;
        }
        else{
            break;
        }
    }
    if (!astNode.lowLevel()){
        return [];
    }

    gatherValidationErrors(astNode,result,textEditor);

    var l1=new Date().getTime();
    var rs = combErrors(result);
    if (editorTools.aquireManager()) {
        if (editorTools.aquireManager().performanceDebug) {
            console.log("Linting took:" + (l1 - l))
        }
    }
    
    var warnings = 0;
    
    return rs.filter(x => {
        return x;
    })
        .filter(x => {
        if(x.type === "Warning") {
            if(warnings >= 20) {
                return false;
            }
            
            warnings++;
        }
        
        return x;
    });
}
class Acceptor extends utils.PointOfViewValidationAcceptorImpl{

    constructor(private editor:AtomCore.IEditor, errors:any[],
                primaryUnit : hl.IParseResult){
        super(errors, primaryUnit)
    }
    buffers:{[path:string]:any}={}

    accept(issue:hl.ValidationIssue) {
        if (!issue){
            return;
        }

        this.transformIssue(issue);

        var issueType = issue.isWarning?"Warning":'Error';
        var issuesArray:hl.ValidationIssue[] = [];
        while(issue){
            issuesArray.push(issue);
            if(issue.extras && issue.extras.length>0){
                issue = issue.extras[0];
            }
            else{
                issue = null;
            }
        }        
        var issues = issuesArray.reverse().map(x=>{
            var result = this.convertParserIssue(x,issueType);
            issueType = "Trace";
            return result;
        });
        for(var i = 0 ; i < issues.length-1; i++){
            issues[0].trace.push(issues[i+1]);
        }
        var message = issues[0];
        this.errors.push(message);
    }

    private convertParserIssue(x:hl.ValidationIssue,iType:string):any {
        var t = x.message;
        var buf = this.editor.getBuffer();
        var ps = x.path;
        if (x.unit) {
            ps = x.unit.absolutePath();
        }
        if (ps) {
            if (this.buffers[ps]) {
                buf = this.buffers[ps];
            }
            else {
                buf = new TextBuffer(x.unit.contents());
                this.buffers[ps] = buf;

            }
        }
        var p1 = buf.positionForCharacterIndex(x.start);
        var p2 = buf.positionForCharacterIndex(x.end);

        var trace = {
            type: iType,
            filePath: x.path ? ps : this.editor.getPath(),
            text: t,
            range: [[p1.row, p1.column], [p2.row, p2.column]],
            trace: [],
        };
        return trace;
    }

    acceptUnique(issue:hl.ValidationIssue){
        this.accept(issue);
    }

    end() {
    }
}
function gatherValidationErrors(astNode:hl.IParseResult,errors:any[],editor:AtomCore.IEditor){
    if (astNode) {
        astNode.validate(new Acceptor(editor,errors, astNode.root()))
    }
}
