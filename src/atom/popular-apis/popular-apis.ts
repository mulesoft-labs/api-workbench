/// <reference path="../../../typings/main.d.ts" />

import path = require('path');
import fs = require('fs');
import UI = require("atom-ui-lib");
import SC = require("../util/ScrollViewUI");
import editorTools = require("../editor-tools/editor-tools");
import childProcess = require('child_process');
import ramlParser = require("raml-1-parser");
import atom = require('../core/atomWrapper');
import fileDialogUtils = UI.fdUtils;

var XMLHttpRequestConstructor = require("xmlhttprequest").XMLHttpRequest;

var mkdirp = require('mkdirp');

var defaultBranch="production";

function buildXHR( ){
    var x: XMLHttpRequest = new XMLHttpRequestConstructor;

    return x;
}

interface BranchInfo {
    name: string
}

class ExecConfig {
    callPath:string = null;
    wrkDir:string = null;
    logEnabled:boolean = false;
    errLogEnabled:boolean = true;
    messageBefore:string = '';
    messageAfter:string = '';
    messageError:string = '';
    maxLogLength:number = -1;
    onError:(err) => void = null;
}

function execProcess(config: ExecConfig) {
    try {
        if(config.logEnabled) {
            console.log(config.messageBefore);
        }

        var logObj = childProcess.execSync(config.callPath, {
            cwd: config.wrkDir,
            encoding: 'utf8',
            stdio: [0,1,2]
        });

        if(config.logEnabled) {
            console.log(config.messageAfter);

            if(logObj) {
                var log = logObj.toString();if(log.trim().length>0) {
                    if(config.maxLogLength < 0) {
                        console.log(log);
                    } else if(config.maxLogLength > 0) {
                        console.log(log.substring(0, Math.min(config.maxLogLength, log.length)));
                    }
                }
            }
        }
    } catch(err) {
        if(config.onError) {
            config.onError(err);
        }

        if(config.errLogEnabled) {
            console.log(config.messageError);

            console.log(err.message);
        }
    }
}

function branches(repoName: string, cb: (br: any) => void) {
    var xhr = buildXHR();

    var reposLink = 'https://api.github.com/repos/raml-apis/' + repoName + '/branches';

    xhr.open("GET",reposLink);

    xhr.onload = () => {
        var data:any[] = JSON.parse(xhr.responseText);

        cb(data);
    };

    xhr.send();
}

export function gitInstalled() : boolean {
    var errorOccured = false;

    var config = new ExecConfig();

    config.callPath = 'git version';
    config.wrkDir = fileDialogUtils.getHome();
    config.logEnabled = true;
    config.messageError = 'Git launch failed';
    config.onError = () => {
        errorOccured = true;
    };

    execProcess(config);

    return !errorOccured;
}

class RamlOutline extends SC.Scrollable {
    disposables = new UI.CompositeDisposable();

    _isAttached:boolean;

    getTitle() {
        return "RAML Apis"
    }

    load() {
        var reposLink = 'https://api.github.com/orgs/raml-apis/repos?per_page=200';

        var sec = UI.section("RAML Apis");

        var xhr = buildXHR();

        sec.addChild(UI.label("loading..."));

        this.html(sec.renderUI());

        xhr.open("GET",reposLink);

        var outer =this;
        var home = fileDialogUtils.getHome();
        var dir = path.resolve(home,"apis");
        var apiListData = require('../../util/config/apiList.json');

        var secHC = UI.hc();

        var sett = UI.a("Cloning to: " + dir + "(click to change)", x => {
            fileDialogUtils.openFolderDialog("Please enter new path to clone", newVal => {
                dir=newVal;
                sett.setText("Cloning to: "+dir+"(click to change)");
            }, true, dir);
        }, UI.Icon.SETTINGS,UI.TextClasses.NORMAL,UI.HighLightClasses.HIGHLIGHT);

        secHC.addChild(sett);

        var branchLink:UI.TextElement<any>=UI.a("" + defaultBranch,x => {
            UI.prompt("Please enter name of the branch", y => {
                defaultBranch=y;

                branchLink.setText(y);
            },defaultBranch);
        }, UI.Icon.GIT_BRANCH, UI.TextClasses.NORMAL, UI.HighLightClasses.HIGHLIGHT);

        branchLink.margin(10,0);

        var l = UI.list(apiListData, (x: any) => {
            var uiLabel = UI.label(x.name, UI.Icon.REPO, UI.TextClasses.HIGHLIGHT, UI.HighLightClasses.NONE).pad(10,10);

            var buttonCallback = () => {
                if(!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }

                var ok=cloneRepo(x.git_url,dir);

                if(ok) {
                    var output = path.resolve(dir, x.name);

                    if(!fs.existsSync(dir)) {
                        fs.mkdirSync(dir);
                    }

                    var a = path.resolve(output, "api.raml");

                    if(!fs.existsSync(a)) {
                        a = path.resolve(output, x.name + ".raml");
                    }

                    if(fs.existsSync(a)) {
                        (<any>atom).open({pathsToOpen: [output, a]});

                    } else {
                        (<any>atom).open({pathsToOpen: [output]});
                    }
                }
            };

            var uiButton = UI.button("clone", UI.ButtonSizes.EXTRA_SMALL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE, buttonCallback);

            return UI.hc(uiLabel, uiButton);
        });

        secHC.addChild(l);
        outer.html(secHC.renderUI());
    }

    attached() {
        if(this._isAttached) {
            return;
        }

        this.load();

        this._isAttached = true;
    }

    destroy(): void {
        this.disposables.dispose();
    }
}

export function info(name:string, callBack : (newValue:string) => void): void {
    var pane = null;
    var section=UI.section(name,UI.Icon.BOOK,false,false);

    var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex");

    buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"));

    var okButton = UI.button("Ok", UI.ButtonSizes.NORMAL, UI.ButtonHighlights.SUCCESS, UI.Icon.NONE, x => {
        pane.destroy();
    });

    buttonBar.addChild(okButton);
    section.addChild(buttonBar);

    pane = (<any>atom).workspace.addModalPanel({
        item: section.renderUI()
    });
}

function cloneRepo(repo:string, dir: string, branch: string = null) {
    if(!branch) {
        branch = defaultBranch;
    }

    var repoName:string = extractRepoName(repo);

    mkdirp.sync(dir);

    var ok=true;

    var config = new ExecConfig();

    config.callPath = 'git clone --branch ' + branch + ' "' + repo + '"';
    config.wrkDir = dir;
    config.logEnabled = true;
    config.messageBefore = 'Cloning GIT repository: ' + repo;
    config.messageAfter = 'Cloning complete: ' + repo;
    config.messageError = 'Cloning failed: ' + repo;
    config.onError = (error) => {
        ok=false;

        info(error.message, () => null);
    }

    execProcess(config);

    return ok;
}

function extractRepoName(repoPath:string) {
   return repoPath.substring(repoPath.lastIndexOf('/') + 1, repoPath.lastIndexOf('.'))
}

export function showPopularApis() {
    if(!gitInstalled()) {
        info("GIT is required to clone APIs. Please install GIT.",x=>{});

        return;
    }

    var center = atom.workspace.getCenter();

    var centerPane = center.getPanes()[0];
    
    var pane = centerPane.splitRight({});
    
    var view = new RamlOutline();

    pane.addItem(view);

    atom.workspace.onDidAddPaneItem(event => {
        setTimeout(()=> {
            if(event.pane === pane && event.item !== view) {
                pane.moveItemToPane(event.item, centerPane, null);
            }
        }, 20);
    });
}
