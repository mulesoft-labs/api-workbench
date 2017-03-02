/// <reference path="../../../typings/main.d.ts" />
import fs = require('fs');
import path = require('path');

// import parser = require("raml-1-parser");

// import parserUtils = parser.utils;

import unitUtils = require("../util/unit");

var TextBuffer = require("basarat-text-buffer");

import editorManager = require("./editorManager");
import editorTools = require("../editor-tools/editor-tools");
import ramlServer = require("raml-language-server")

export var grammarScopes = ['source.raml'];

export var scope = 'file';

export var lintOnFly = true;

import {
    getNodeClientConnection,
    IValidationReport
} from 'raml-language-server'

export function relint(editor:AtomCore.IEditor) {
    Promise.resolve("").then(editorManager.toggleEditorTools);
}

function lintFirstTime(linterApi: any, editor: AtomCore.IEditor) {
    var editorPath = editor.getPath && editor.getPath();

    var extName = editorPath && path.extname(editorPath);

    var lowerCase = extName && extName.toLowerCase();

    if(lowerCase === '.raml' || lowerCase === '.yaml' ) {
        var linter = linterApi.getEditorLinter(editor);

        lint(editor).then(messages => {
            linterApi.setMessages(linter, messages);

            var linterDestroyer = editor.onDidChange(() => {
                destroyLinter(linterApi, linter);

                linterDestroyer.dispose();
            });
        });
    }
}

export function initEditorObservers(linterApi) {
    // parserUtils.addLoadCallback(x => {
    //     var manager = editorTools.aquireManager();
    //
    //     if(manager) {
    //         manager.updateDetails();
    //     }
    // });

    atom.workspace.observeTextEditors(editor => lintFirstTime(linterApi, editor));

    return {
        dispose: () => {
            
        }
    }
}

function destroyLinter(linterApi, linter) {
    linterApi.deleteMessages(linter);

    linterApi.deleteLinter(linter);
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

function tabWarnings(textEditor:AtomCore.IEditor): any[] {
    var result: any[] = [];

    var text = textEditor.getBuffer().getText();

    var tab = 0;

    while(true) {
        var tab: number = text.indexOf('\t',tab);

        if(tab != -1) {
            var p1 = textEditor.getBuffer().positionForCharacterIndex(tab);
            var p2 = textEditor.getBuffer().positionForCharacterIndex(tab + 1);

            var message = {
                type: ("Warning"),

                filePath: textEditor.getPath(),

                text: "Using tabs  can lead to unpredictable results",

                trace: [],

                range: [[p1.row, p1.column], [p2.row, p2.column]]
            };

            result.push(message);

            tab++;
        }
        else{
            break;
        }
    }

    return result;
}

function postPocessError(editor, error, buffers) {
    var editorPath = editor.getPath();

    if(!buffers[editorPath]) {
        buffers[editorPath] = editor.getBuffer();
    }

    return Promise.resolve(error).then(error => {
        if(!error.filePath) {
            error.filePath = editorPath;
        }

        var buffer = buffers[error.filePath];

        if(!buffer) {
            return new Promise((resolve, reject) => {
                fs.readFile(error.filePath, (err: any, data: any) => {
                    if(err) {
                        reject(err);
                    } else {
                        buffer = new TextBuffer(data.toString());

                        buffers[error.filePath] = buffer;

                        resolve(buffer);
                    }
                });
            });
        }

        return buffer;
    }).then(buffer => {
        console.log("Linter-ui:postPocessError Converting an error with range: [" + error.range.start + " , " + error.range.end + "]")

        if (error.range.start != null && error.range.end != null) {

            console.log("Linter-ui:postPocessError Converting an error with range as array: [" + error.range[0] + " , " + error.range[1] + "]")

            var p1 = buffer.positionForCharacterIndex(error.range.start);
            var p2 = buffer.positionForCharacterIndex(error.range.end);

            console.log("Linter-ui:postPocessError Result error range: [" + p1.row + " , " + p1.column + "] ; ["+ p2.row + " , " + p2.column + "]")

            error.range = [[p1.row, p1.column], [p2.row, p2.column]];
        }
        
        var traceErrors = error.trace || [];
        
        var tracePromises = traceErrors.map(traceError => postPocessError(editor, traceError, buffers));

        return Promise.all(tracePromises).then(trace => {
            error.trace = trace;
            
            return error;
        });
    });
}

function getEditorId(textEditor): string {
    return textEditor.id;
}

class ValidationReportExpected {
    public uri : string
    public resolve : {(result:any):void}
    public reject : {(error:any):void}
}

var expectedValidationReports : ValidationReportExpected[] = [];

function findAndRemoveExpectedReports(uri : string) : ValidationReportExpected[] {
    let result : ValidationReportExpected[] = [];

    expectedValidationReports = expectedValidationReports.filter(reportExpected=>{
        if (reportExpected.uri == uri) {
            result.push(reportExpected);
            return false;
        }
        return true;
    });

    return result;
}

let clientConnection = getNodeClientConnection();
clientConnection.onValidationReport((report: IValidationReport)=>{
    console.log("Linter-ui:onValidationReport Recieved validation report")
    let expectedReports = findAndRemoveExpectedReports(report.pointOfViewUri);
    console.log("Linter-ui:onValidationReport Found expected reports: " + expectedReports.length)

    for (let expectedReport of expectedReports) {
        expectedReport.resolve(report.issues);
    }
});

function runValidationSheduleUpdater(textEditor: AtomCore.IEditor, resolve, reject) : void {
    let uri = textEditor.getPath();
    expectedValidationReports.push({
       uri: uri,
       resolve : resolve,
       reject: reject
    });

    clientConnection.documentChanged({
        uri : uri,
        text: textEditor.getBuffer().getText()
    });
}

export function lint(textEditor: AtomCore.IEditor): Promise<any[]> {
    if(!isRAMLUnit(textEditor)) {
        return Promise.resolve([]);
    }
    
    Promise.resolve("").then(editorManager.toggleEditorTools);
    
    var promise = new Promise((resolve, reject) => {
        runValidationSheduleUpdater(textEditor, resolve, reject);
    }).then((errors: any[]) => {
        var buffers = {};
        
        var promises = errors.map(error => postPocessError(textEditor, error, buffers));

        var tabs: any[] = tabWarnings(textEditor);

        promises = promises.concat(tabs);
        
        return Promise.all(promises).then((errors: any[]) => {
            var result = combErrors(errors);

            var warnings = 0;
            
            return result.filter(error => error ? true : false).filter(error => {
                return error.type === 'Warning' && warnings++ >= 20 ? false : true;
            });
        });
    });
    
    return promise;
}

function addListenersToEditor(editor) {
    let currentBuffer = editor.getBuffer();
    currentBuffer.onDidChange(x => {
        try {
            ramlServer.getNodeClientConnection().debug("Change detected", "linter-ui", "addListenersToEditor")
            ramlServer.getNodeClientConnection().documentChanged({
                    uri: currentBuffer.getPath(),
                    text: currentBuffer.getText()
            });

        } catch (e){
            console.log(e);
        }
    });
}

function addListenersToWorkspace() {
    atom.workspace.onDidChangeActivePaneItem(e => {
        let editor = atom.workspace.getActiveTextEditor();
        if (editor) {
            addListenersToEditor(editor)
        }
    });
}