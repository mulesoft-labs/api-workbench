/// <reference path="../../../typings/main.d.ts" />

import _ = require("underscore")
import commandManager = require("../quick-commands/command-manager")
import contextMenuInterfaces = require("./contextMenuInterfaces")
import contextMenuImpl = require("./contextMenuImpl")

var originalShowForEvent : (object : any, args : any)=>void

/**
 * Must be called first, at startup, before the module is used.
 */
export function initialize() {
    if (initialized) {
        return;
    }

    initialized = true;


    originalShowForEvent = atom.contextMenu.constructor.prototype.showForEvent


    atom.contextMenu.constructor.prototype.showForEvent = (event : any) => {
        preMenuDisplay().then(()=>{
            originalShowForEvent.apply(atom.contextMenu, [event]);

            postMenuDisplay()
        })
    }
}

var initialized = false;

function preMenuDisplay() : Promise<void> {
    try {
        return contextMenuImpl.calculateMenuItemsTree().then(
            (treeRoots:contextMenuInterfaces.IContextMenuItem[])=>{

            var nodeSets:{[s:string] : AtomCore.IContextMenuItemSet} = {}

            cleanExistingSets();
            commandManager.deleteCommandsByTag(commandManager.DYNAMIC_COMMAND_TAG)

            treeRoots.forEach(node => {
                var itemSet = nodeSets[node.selector]

                if (!itemSet) {
                    itemSet = findOrCreateItemSet(node.selector);
                    nodeSets[node.selector] = itemSet;
                }

                var menuItem = constructAtomMenuItem(node)

                itemSet.items.push(menuItem)
            })
        })


    } catch (Error) {
        console.log(Error.message)
    }
}

function constructAtomMenuItem(node : contextMenuInterfaces.IContextMenuItem) : AtomCore.IContextMenuItem {
    var result : AtomCore.IContextMenuItem = {
        label : node.name,
    }

    if (node.children.length > 0) {
        result.submenu = []
    } else {
        var commandName = "api-workbench:"+node.name
        var existingCommands = commandManager.listCommands()
        commandManager.addCommand(node.selector, commandName, node.onClick,
            commandManager.DYNAMIC_COMMAND_TAG)
        result.command = commandName
    }

    node.children.forEach(child => {
        var childMenuItem = constructAtomMenuItem(child)
        result.submenu.push(childMenuItem)
    })

    return result;
}

interface ITaggedItemSet extends AtomCore.IContextMenuItemSet {
    tag? : string
}

var DYNAMIC_SET_TAG = "DYNAMIC_SET_TAG"

/**
 * Selector that were used at least once in the context menu
 * @type {Array}
 */
var usedSelectors : string[] = []

function findOrCreateItemSet(selector : string) : AtomCore.IContextMenuItemSet{
    var existingSet =  _.find(atom.contextMenu.itemSets, currentSet=>{

      return (<ITaggedItemSet>currentSet).tag && (<ITaggedItemSet>currentSet).tag == DYNAMIC_SET_TAG;
    })

    if (!existingSet) {
        existingSet = <any>{
            items : [],
            selector : selector,
            specificity : 11,
            tag: DYNAMIC_SET_TAG
        }

        atom.contextMenu.itemSets.push(existingSet)

        //saving used selector name
        if(!_.find(usedSelectors, name=>{return name == selector})){
            usedSelectors.push(selector)
        }
    }

    return existingSet
}

function cleanExistingSets() {
    var existingSets =  _.filter(atom.contextMenu.itemSets, currentSet=>{

        return (<ITaggedItemSet>currentSet).tag && (<ITaggedItemSet>currentSet).tag == DYNAMIC_SET_TAG;
    })

    existingSets.forEach(existingSet=>{
        existingSet.items = []
    })
}

function postMenuDisplay() {
    //commandManager.deleteCommandsByTag(commandManager.DYNAMIC_COMMAND_TAG)
}

