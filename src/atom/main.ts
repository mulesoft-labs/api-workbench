/// <reference path="../../typings/main.d.ts" />

// import Console = require('./console/index');
import apiList = require('./popular-apis/popular-apis');
import jQuery = require('jquery');
import editorTools=require('./editor-tools/editor-tools')
import quickCommands = require('./quick-commands/quick-commands')
import provider=require("./suggestion/provider")
import quickOutline=require("./quick-outline/quick-outline")
import decl=require("./dialogs/assist-utils")
import linterUI=require("./core/linter-ui")
var CompositeDisposable = require('atom').CompositeDisposable;
// import sharedASTInitializer = require("./shared-ast-initializer")
import commandManager = require("./quick-commands/command-manager")
import contextMenu = require("./context-menu/contextMenu")
// import quickFixActions = require("./context-menu/quickFix")
// import actions = require("./context-menu/actions")


module package_entry_point {

    var subscriptions = new CompositeDisposable()

    export function activate (state) {
        require('atom-package-deps').install('api-workbench', true)
            .then(() => {
                subscriptions.add(atom.commands.add('atom-workspace', {
                    'api-workbench:popular-apis': apiList.showPopularApis,
                    'api-workbench:editor-tools':editorTools.initEditorTools,
                    /*'api-workbench:console': Console.toggle,*/
                    'api-workbench:go-to-definition':decl.gotoDeclaration,
                    /*'api-workbench:find-usages':decl.findUsages,*/
                    'api-workbench:quick-outline':quickOutline.show,
                    'api-workbench:quick-commands': quickCommands.showCommands,
                    /*'api-workbench:rename':decl.renameRAMLElement,*/
                    'api-workbench:new-project':decl.newProject,
                    /*'api-workbench:select-node':decl.select,*/
                    'api-workbench:revalidate':decl.revalidate
                }))

                //subscriptions.add(atom.workspace.addOpener(Console.opener))
                ////subscriptions.add(atom.workspace.addOpener(RamlScriptReport.opener))

                commandManager.initialize()
                contextMenu.initialize()
                // sharedASTInitializer.initialize()

                quickCommands.registerCommands()
                // quickFixActions.initialize()
                // actions.register();

                editorTools.initEditorTools()
            })
    }


    export function getProvider(){
        return provider;
    }

    export function provideLinter(){
        return linterUI;
    }

    export function consumeLinter(linterApi) {
        subscriptions.add(linterUI.initEditorObservers(linterApi));
    }

    export function deactivate(){
        subscriptions.dispose()
    }

    export var config = {
        grammars: {
            type: 'array',
            default: [
                'source.raml'
            ]
        },
        openConsoleInSplitPane: {
            type: 'boolean',
            default: true
        }
    }
}
export =package_entry_point
