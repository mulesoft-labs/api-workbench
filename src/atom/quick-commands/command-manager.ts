/// <reference path="../../../typings/main.d.ts" />

import _ = require("underscore")


export var DYNAMIC_COMMAND_TAG = "DYNAMIC_COMMAND_TAG"

var commandIdToCommandInfo : {[id:string] : ICommandInfo} = {}

var tagToCommands : {[tag:string] : ICommandInfo[]} = {}

export interface ICommand {
    selector : string
    id : string
    callBack : ()=>void
}

/**
 * Adds new managed command
 * @param selector - command CSS selector
 * @param id - command id. Must be unique across the managed commands.
 * @param callBack - called on command invocation
 * @param tag - optional action tag allowing to perform batch operations
 */
export function addCommand(selector : string, id : string,
                           callBack : ()=>void, tag? : string) {

    if (_.find(listCommands(), commandId => {
            if( commandId == id){
                return true
            }
            return false
        })) {
        return
    }

    var disposable = atom.commands.add(selector, id , callBack)

    var commandInfo : ICommandInfo = {
        commandId : id,
        tag : tag,
        disposable : disposable
    }

    commandIdToCommandInfo[id] = commandInfo

    if (tag) {
        var tagCommands = tagToCommands[tag]
        if (!tagCommands) {
            tagCommands = []
            tagToCommands[tag] = tagCommands
        }

        tagCommands.push(commandInfo)
    }
}

/**
 * Deletes unmanaged command.
 * Generally, should not be called for managed actions, use the managed
 * version instead.
 * @param id - command id
 */
export function deleteUnmanagedCommand(id : string) {
    atom.commands.registeredCommands[id] = null;
    atom.commands.selectorBasedListenersByCommandName[id] = null;
}

/**
 * Deletes managed action by id
 * @param id
 */
export function deleteManagedCommand(id : string) {
    var commandInfo = commandIdToCommandInfo[id]
    if (!commandInfo) return

    commandInfo.disposable.dispose()

    delete commandIdToCommandInfo[id]

    if (commandInfo.tag) {
        var tagCommands = tagToCommands[commandInfo.tag]
        if (!tagCommands) return

        var infoIndex: number = -1;
        _.find(tagCommands, (currentInfo, index) => {
            if (currentInfo.commandId == id) {
                infoIndex = index;
                return true;
            }
            return false
        })

        if (infoIndex != -1)
            tagCommands.splice(infoIndex, 1)
    }
}

/**
 * Deletes all managed commands tagged the the specific tag
 * @param tag
 */
export function deleteCommandsByTag(tag : string) {
    var tagCommands = tagToCommands[tag]
    if (!tagCommands) return

    for (var index in tagCommands) {
        var currentInfo = tagCommands[index]

        currentInfo.disposable.dispose()
        delete commandIdToCommandInfo[currentInfo.commandId]
    }

    delete tagToCommands[tag]
}

/**
 * Lists all commands, both managed and unmanaged.
 * @returns {string[]}
 */
export function listCommands() {
    var result : string[] = []

    for (var commandName in atom.commands.selectorBasedListenersByCommandName){
        result.push(commandName)
    }

    return result
}

interface ICommandInfo {
    commandId : string
    tag : string
    disposable : AtomCore.Disposable
}

/**
 * Contributes commands.
 * Is called before each command panel display.
 */
export interface ICommandContributor {

    /**
     * Unique contributor id.
     */
    id : string

    /**
     * Calculates items to display in the context menu.
     * This is runtime method, called each time for each contributor before
     * the menu is displayed.
     */
    calculateItems () : ICommand[]

    /**
     * Optionally notifies contributor that the panel is about to be displayed and
     * item calculations are started
     */
    calculationStarted? : ()=>void

    /**
     * Optionally notifies contributor that the panel is about to be displayed and
     * item calculations are done
     */
    calculationFinished? : ()=>void
}

var initialized = false

export function initialize() {
    if (initialized) return

    initialized = true

    try {
        //forcing command palette to register itself
        atom.packages.activatePackage('command-palette')

        //registering our own listener to command palette's command
        var listener:any = function () {
            prePanelDisplay()
        }
        listener.commandManager = true;
        atom.commands.add('atom-workspace', 'command-palette:toggle', listener);

        ////and now swapping those listeners, so our one is called first
        //var listenersArray = (<any>atom.commands.selectorBasedListenersByCommandName)
        //    ["command-palette:toggle"]
        //listenersArray.splice(0,0,listenersArray[1])
        //listenersArray.splice(1, 1)

        var listenersArray = (<any>atom.commands.selectorBasedListenersByCommandName)
            ["command-palette:toggle"]
        listenersArray.forEach(listener => {
            if (listener.callback && listener.callback.commandManager) {
                listener.sequenceNumber = 100500000
            }
        })
    } catch (Error) {
        console.error(Error.message)
    }
}
var contributors : {[id:string] : ICommandContributor} = {}

export function registerContributor(contributor : ICommandContributor) {
    contributors[contributor.id] = contributor;
}

function prePanelDisplay() {
    deleteCommandsByTag(DYNAMIC_COMMAND_TAG)

    for (var contributorId in contributors) {

        var contributor = contributors[contributorId];
        if (contributor.calculationStarted) {
            contributor.calculationStarted();
        }
    }

    for (var contributorId in contributors) {

        var contributor : ICommandContributor = contributors[contributorId];
        contributor.calculateItems().forEach(item => {
            addCommand(item.selector, "api-workbench:"+item.id, item.callBack, DYNAMIC_COMMAND_TAG)
        });
    }

    for (var contributorId in contributors) {

        var contributor = contributors[contributorId];
        if (contributor.calculationFinished) {
            contributor.calculationFinished();
        }
    }
}
