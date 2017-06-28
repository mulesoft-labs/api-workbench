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

    (<any>editor).getBuffer().emitter.emit("did-change", {
        oldText: (<any>editor).getBuffer().getText(),
        newText: (<any>editor).getBuffer().getText()
    });
}

export function initEditorObservers(linter) {

    atom.workspace.observeTextEditors(editor => relint(editor));

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
        clientConnection.debugDetail("Converting an error with range: [" + error.range.start + " , " + error.range.end + "]",
            "Linter-ui","postPocessError");

        if (error.range.start != null && error.range.end != null) {

            clientConnection.debugDetail("Converting an error with range as array: [" + error.range[0] + " , " + error.range[1] + "]",
                "Linter-ui","postPocessError");

            var p1 = buffer.positionForCharacterIndex(error.range.start);
            var p2 = buffer.positionForCharacterIndex(error.range.end);

            clientConnection.debugDetail("Result error range: [" + p1.row + " , " + p1.column + "] ; ["+ p2.row + " , " + p2.column + "]",
                "Linter-ui","postPocessError");

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
    public expectedVersion : number
    public resolve : {(result:any):void}
    public reject : {(error:any):void}
}

let clientConnection = getNodeClientConnection();
var expectedValidationReports : ValidationReportExpected[] = [];

function findAndRemoveExpectedReports(uri : string,
                                      versionLimit: number) : ValidationReportExpected[] {
    let result : ValidationReportExpected[] = [];

    expectedValidationReports = expectedValidationReports.filter(reportExpected=>{

        if (reportExpected.uri == uri
            && (versionLimit == null || reportExpected.expectedVersion == null ||
                versionLimit >= reportExpected.expectedVersion)) {

            result.push(reportExpected);
            return false;
        }

        return true;
    });

    return result;
}

var latestRecievedReport = null;
clientConnection.onValidationReport((report: IValidationReport)=>{
    clientConnection.debugDetail("Got debug report for uri " + report.pointOfViewUri +
        " and version " + report.version,
        "linter-ui", "onValidationReport")

    let expectedReports = findAndRemoveExpectedReports(report.pointOfViewUri,
        report.version);

    clientConnection.debugDetail("Found expected reports: " + expectedReports.length,
        "linter-ui", "onValidationReport")

    for (let expectedReport of expectedReports) {
        expectedReport.resolve(report.issues);
    }

    latestRecievedReport = report;
});

function runValidationSheduleUpdater(textEditor: AtomCore.IEditor, resolve, reject) : void {
    let uri = textEditor.getPath();

    //in any way, lets report current state, it should not hurt.
    clientConnection.documentChanged({
        uri : uri,
        text: textEditor.getBuffer().getText()
    });

    clientConnection.getLatestVersion(uri).then(version=>{
        clientConnection.debugDetail("Scheduling validation for uri " + uri + " and version " +
            version,
            "linter-ui", "runValidationSheduleUpdater")

        if (latestRecievedReport && latestRecievedReport.version &&
            latestRecievedReport.version >= version) {

            //we already know validation report for this version

            clientConnection.debugDetail("Previous report found v " +
                latestRecievedReport.version + " resolving, issues " +
                (latestRecievedReport.issues?latestRecievedReport.issues.length:0),
                "linter-ui", "runValidationSheduleUpdater")

            resolve(latestRecievedReport.issues)
        } else {

            //lets wait until the server provides a report for this or later version
            expectedValidationReports.push({
                uri: uri,
                expectedVersion: version,
                resolve : resolve,
                reject: reject
            });

            clientConnection.debugDetail("Pushing the expected report to the list for version " +
                version,
                "linter-ui", "runValidationSheduleUpdater")
        }
    })
}

export function lint(textEditor: AtomCore.IEditor): Promise<any[]> {
    if(!isRAMLUnit(textEditor)) {
        return Promise.resolve([]);
    }
    
    Promise.resolve("").then(editorManager.toggleEditorTools);
    
    var promise = new Promise((resolve, reject) => {
        runValidationSheduleUpdater(textEditor, resolve, reject);
    }).then((errors: any[]) => {

        clientConnection.debugDetail("Update report handled in with issues " +
            (errors?errors.length:0),
            "linter-ui", "lint")

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

    clientConnection.debugDetail("Before returning from lint",
        "linter-ui", "lint")
    
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