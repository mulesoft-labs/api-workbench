/// <reference path="../../../typings/main.d.ts" />

import url = require('url')
import path = require('path')
import ConsoleView = require('./console-view')

atom.deserializers.add({
  name: 'RAMLConsoleView',
  deserialize (state) {
    if (state) {
      return createConsoleView(state)
    }
  }
})

export interface WorkspaceOpenOptions {
  searchAllPanes?: boolean
  activatePane?: boolean
  split?: string
}

export function createConsoleView (opts: ConsoleView.ConsoleViewOptions) {
  return new ConsoleView.RAMLConsoleView(opts)
}

export function isConsoleView (obj: any): boolean {
  return obj instanceof ConsoleView.RAMLConsoleView
}

export function toggle (): void {
  if (isConsoleView(atom.workspace.getActivePaneItem())) {
    atom.workspace.destroyActivePaneItem()
    return
  }

  var editor = atom.workspace.getActiveTextEditor()

  if (!editor) {
    atom.notifications.addInfo('The API Console can only be opened when focused on a RAML file editor.')
    return
  }

  var grammars: string[] = atom.config.get('api-workbench.grammars') || []

  if (grammars.indexOf(editor.getGrammar().scopeName) === -1) {
    atom.notifications.addInfo('The API Console can only be opened with focus on a RAML file.')
    return
  }

  if (!removeConsoleForEditor(editor)) {
    addConsoleForEditor(editor)
    return
  }
}

export function removeConsoleForEditor (editor: AtomCore.IEditor): boolean {
  var uri = ConsoleView.RAMLConsoleView.getUriForEditor(editor)
  var previewPane = atom.workspace.paneForURI(uri)

  if (previewPane) {
    previewPane.destroyItem(previewPane.itemForURI(uri))
    return true
  }

  return false
}

export function addConsoleForEditor (editor: AtomCore.IEditor, state?: ConsoleView.ConsoleState) {
  return open(ConsoleView.RAMLConsoleView.getUriForEditor(editor), state)
}

export function addConsoleForFile (filename: string, state?: ConsoleView.ConsoleState) {
  return open(ConsoleView.RAMLConsoleView.getUriForFilename(filename), state)
}

export function opener (uri: string): ConsoleView.RAMLConsoleView | void {
  try {
    var result = url.parse(uri)
    var protocol = result.protocol
    var host = result.host
    var pathname = result.pathname
  } catch (err) {
    return
  }

  if (protocol !== 'raml-console:') {
    return
  }

  try {
    pathname = decodeURI(pathname || '').substr(1)
  } catch (err) {
    return
  }

  if (host === 'editor') {
    return createConsoleView({ editorId: pathname })
  }

  return createConsoleView({ filename: pathname })
}

function shouldSplit (): boolean {
  return atom.config.get('api-workbench.openConsoleInSplitPane')
}

function getWorkspaceOptions (): WorkspaceOpenOptions {
  return {
    activatePane: false,
    searchAllPanes: true,
    split: shouldSplit() ? 'right' : undefined
  }
}

export function openView (raml: any, state?: ConsoleView.ConsoleState): Promise<ConsoleView.RAMLConsoleView> {
  var pane = atom.workspace.getActivePane()
  var item = createConsoleView({ raml, state })

  // TODO(blakeembrey): Fix RAML instance passed in, RAML 0.8 interface is dead.

  if (shouldSplit()) {
    pane = pane.findOrCreateRightmostSibling()
  }

  atom.workspace.itemOpened(item)
  pane.activateItem(item)

  return Promise.resolve(item)
}

function open (uri: string, state?: ConsoleView.ConsoleState): Promise<ConsoleView.RAMLConsoleView> {
  var workspaceOptions = getWorkspaceOptions()
  var previousActivePane = atom.workspace.getActivePane()

  var opened: Promise<ConsoleView.RAMLConsoleView> = <any>atom.workspace.open(uri, workspaceOptions);

  return opened.then((view) => {
      (<ConsoleView.RAMLConsoleView> view).setState(state)

      return view
    })
}
