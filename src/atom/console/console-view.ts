/// <reference path="../../../typings/main.d.ts" />

import fs = require('fs')
import Atom = require('atom')
import React = require('react')
import SpacePenViews = require('atom-space-pen-views')
import pathwatcher = require('../../util/pathwatcherProxy')
import extend = require('xtend')
import path = require('path')
import popsicle = require('popsicle')
import AtomUtil = require('../util/atom')
import rp=require("raml-1-parser")

import RamlWrapper1 =rp.api10;
import RamlWrapper08 =rp.api08;
import JSYaml = rp.ll;
import Render = require('./render')
import Disposable = Atom.Disposable
import CompositeDisposable = Atom.CompositeDisposable

/**
 * View initialization options.
 */
export interface ConsoleViewOptions {
  editorId?: string
  filename?: string
  raml?: RamlWrapper1.Api | RamlWrapper08.Api
  state?: ConsoleState
}

interface Map<T> {
  [key: string]: T
}

export interface ViewState {
  id?: string
  demo?: boolean
}

/**
 * State rendering information.
 */
export interface ConsoleState {
  view?: ViewState
  uriParameters?: Map<string>
  baseUriParameters?: Map<string>
  headers?: Map<string>
  queryParameters?: Map<string>
  body?: string
  bodies?: Map<string>
  securityScheme?: string
  pretty?: boolean
  resource?:string
  method?:string
}

export interface ConsolePageState {
  // Request data.
  requestProgress?: number
  requestError?: string
  requestResponse?: any
}

interface ParameterMap {
  [name: string]: string
}

function template (str: string, replace: ParameterMap, defaults?: ParameterMap): string {
  return str.replace(/\{([^{}]+)\}/g, function (match, key) {
    if (replace && replace[key] != null) {
      return replace[key]
    }

    if (defaults && defaults[key] != null) {
      return defaults[key]
    }

    return ''
  })
}

/**
 * Export the console view instance which provides rendering and live-updating.
 */
export class RAMLConsoleView extends SpacePenViews.ScrollView {
  filename: string
  editorId: string

  file: pathwatcher.File
  editor: AtomCore.IEditor
  state: ConsoleState
  raml: RamlWrapper1.Api | RamlWrapper08.Api
  errors: Error[]
  project: JSYaml.IProject
  request: popsicle.Request

  loaded = false
  isAttached = false
  isParsing = false
  disposables = new CompositeDisposable()
  pageState: ConsolePageState = {}

  // Track files and editor watchers.
  paths: { [filename: string]: pathwatcher.IPathWatcher } = {}
  editors: { [filename: string]: AtomCore.Disposable } = {}

  resolver = new ConsoleResolver((path) => this.readFileSync(path))

  constructor (options: ConsoleViewOptions) {
    super()

    this.state = extend({
      view: {},
      parameters: {},
      headers: {},
      uriParameters: {},
      baseUriParameters: {},
      queryParameters: {},
      bodies: {}
    }, options.state)

    this.filename = options.filename
    this.editorId = options.editorId

    // Handle manually passed in RAML wrapper.
    if (options.raml) {
      this.raml = rp.expander.expandTraitsAndResourceTypes(options.raml)
      this.project = (<JSYaml.IProject> options.raml.highLevel().lowLevel().unit().project()).cloneWithResolver(this.resolver)
      this.loaded = true
    }
  }

  /**
   * Atom uses the `content` as the wrapper element.
   */
  static content (): HTMLElement {
    return this.div({ class: 'raml-console pane-item', tabindex: -1 })
  }

  static getUriForFilename (path: string): string {
    return 'raml-console://file/' + path
  }

  static getUriForEditor (editor: AtomCore.IEditor) {
    return 'raml-console://editor/' + editor.id
  }

  attached (): void {
    if (this.isAttached) {
      return
    }

    this.render()
    this.isAttached = true

    if (this.editorId) {
      this.resolveEditor(this.editorId)
    } else if (this.filename) {
      this.resolveFilename(this.filename)
    }

    this.disposables.add(atom.workspace.observeTextEditors(editor => {
      var path = editor.getPath()

      // Upgrade from file watching to editor watching.
      if (this.paths[path]) {
        this.watchEditor(editor)
        this.stopWatchingPath(path)
      }
    }))
  }

  resolveEditor (editorId: string) {
    var resolve = () => {
      this.editor = AtomUtil.getEditorById(editorId)

      if (this.editor) {
        this.trigger('title-changed')
        this.loadRAML()
        return
      }

      var view = this.parents('.pane').view()

      return view && view.destroyItem(this)
    }

    if (atom.workspace) {
      resolve()
    } else {
      this.disposables.add(atom.packages.onDidActivateInitialPackages(resolve))
    }
  }

  resolveFilename (filename: string): void {
    var resolve = () => {
      this.file = new pathwatcher.File(filename)
      this.trigger('title-changed')
      this.loadRAML()
    }

    if (atom.workspace) {
      resolve()
    } else {
      this.disposables.add(atom.packages.onDidActivateInitialPackages(resolve))
    }
  }

  readFileSync (path: string): string {
    var editor = AtomUtil.getEditorByPath(path)
    var contents: string

    if (editor) {
      contents = editor.getText()

      this.watchEditor(editor)
    } else {
      try {
        contents = fs.readFileSync(path, 'utf8')
      } catch (err) {
        if (err.code === 'ENOENT') {
          this.watchForFile(path)
          return
        }

        throw err
      }

      this.watchFile(path)
    }

    return contents
  }

  watchEditor (editor: AtomCore.IEditor): void {
    var path = editor.getPath()

    if (this.editors[path]) {
      return
    }

    var disposables = new CompositeDisposable()

    this.editors[path] = disposables

    // Changes can be as simple as updating the cache.
    disposables.add(editor.onDidStopChanging(() => {
      this.updateUnit(path, editor.getText())
    }))

    // Callback to dispose of listeners and force an update. This happens
    // because the updated path or file may not be used by the RAML parser.
    var cb = () => {
      this.stopWatchingEditor(path)
      this.updateUnit(path, this.readFileSync(path))
    }

    disposables.add(editor.onDidDestroy(cb))
    disposables.add(editor.onDidChangePath(cb))
  }

  getActiveEditor () {
    return atom.workspace.getActiveTextEditor()
  }

  stopWatchingPath (path: string) {
    var watcher = this.paths[path]

    if (watcher) {
      watcher.close()
      delete this.paths[path]
    }
  }

  stopWatchingEditor (path: string) {
    var disposables = this.editors[path]

    if (disposables) {
      disposables.dispose()
      delete this.editors[path]
    }
  }

  watchFile (path: string): void {
    if (this.paths[path]) {
      return
    }

    var watcher = pathwatcher.watch(path, (event) => {
      if (event === 'change') {
        this.updateUnit(path, this.readFileSync(path))
      } else {
        this.stopWatchingPath(path)
        this.deleteUnit(path)
      }
    })

    this.paths[path] = watcher
  }

  watchForFile (filename: string): void {
    this.watchForPath(filename, () => {
      this.updateUnit(filename, this.readFileSync(filename))
    })
  }

  watchForPath (filename: string, cb: () => any): void {
    var parent = path.dirname(filename)

    var watch = () => {
      var watcher = pathwatcher.watch(parent, (event, newFilename) => {
        if (event === 'change') {
          if (newFilename === filename) {
            this.stopWatchingPath(parent)
            cb()
          }
        } else {
          this.watchForPath(parent, watch)
          this.stopWatchingPath(parent)
        }
      })

      this.paths[parent] = watcher
    }

    try {
      watch()
    } catch (e) {
      this.watchForPath(parent, watch)
    }
  }

  stopWatching (): void {
    Object.keys(this.paths).forEach((path) => {
      this.stopWatchingPath(path)
    })

    Object.keys(this.editors).forEach((path) => {
      this.stopWatchingEditor(path)
    })
  }

  navigate (state: string | ViewState) {
    var view = typeof state === 'string' ? { id: state } : extend(this.state.view, state)

    // Reset `pageState` before re-render.
    this.pageState = {}

    this.setState({ view }, () => {
      // Scroll the view to the top, as if we'd just navigated.
      document.getElementById('raml-console-view').scrollTop = 0
    })

    this.abortRequest()
  }

  /**
   * Render the UI with React.
   */
  render (cb?: () => any): void {
    var props: Render.ConsoleProps = {
      state: this.state,
      raml: this.raml,
      loaded: this.loaded,
      errors: this.errors,
      pageState: this.pageState,
      setParameter: (group: string, name: string, value: string) => this.setParameter(group, name, value),
      setState: (state) => this.setState(state),
      navigate: (view) => this.navigate(view),
      execRequest: () => this.execRequest()
    }

    React.render(React.createElement(Render.Console, props), this.element, cb)
  }

  execRequest () {
    this.abortRequest()

    var baseUri = this.raml.baseUri()
    var node: RamlWrapper1.Method | RamlWrapper08.Method = this.raml.highLevel().findById(this.state.view.id).wrapperNode()

    // Remove old request errors.
    this.setPageState({ requestError: undefined })

    if (baseUri == null) {
      this.setPageState({ requestError: 'Unable to execute request, `baseUri` is missing' })
      return
    }

    var securityScheme : RamlWrapper1.AbstractSecurityScheme | RamlWrapper08.AbstractSecurityScheme = this.state.securityScheme ?
        (<(RamlWrapper1.AbstractSecurityScheme | RamlWrapper08.AbstractSecurityScheme)[]>
            this.raml.securitySchemes()).filter(x => x.name() === this.state.securityScheme)[0] : undefined
    var defaultBaseUriParameters = this.toDefaultParameters(this.raml.allBaseUriParameters())
    var defaultUriParameters = this.toDefaultParameters((<RamlWrapper1.Resource> node.parent()).allUriParameters())
    var methodHeaders  : (RamlWrapper1.TypeDeclaration | RamlWrapper08.Parameter)[] =
        node.headers();
    var methodQuery : (RamlWrapper1.TypeDeclaration | RamlWrapper08.Parameter)[] =
        node.queryParameters();

    var url = template(baseUri.value() || '', this.state.baseUriParameters, defaultBaseUriParameters).replace(/\/$/, '')
    var path = template((<RamlWrapper1.Resource> node.parent()).completeRelativeUri(), this.state.uriParameters, defaultUriParameters)

    if (securityScheme) {
      methodQuery = methodQuery.concat(securityScheme.describedBy().queryParameters())
      methodHeaders = methodHeaders.concat(securityScheme.describedBy().headers())
    }

    var requestOptions: any = {
      url: url + path,
      method: node.method(),
      headers: extend<any>({ 'User-Agent': 'API Workbench: Console' }, this.usedParameters(this.state.headers, methodHeaders)),
      query: this.usedParameters(this.state.queryParameters, methodQuery),
      body: this.state.bodies[this.state.body],
      use: [
        popsicle.plugins.headers(),
        popsicle.plugins.unzip(),
        popsicle.plugins.concatStream('string')
      ]
    }

    if(this.state.body && requestOptions.headers && !requestOptions.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = this.state.body;
    }

    this.request = popsicle.request(requestOptions);

    this.request.progress(() => {
      this.setPageState({ requestProgress: this.request.completed })
    })

    // Handle request completion.
    this.request.then(
      (response) => {
        this.setPageState({ requestResponse: response.toJSON(), requestProgress: undefined })
        this.request = undefined
      },
      (error) => {
        this.setPageState({ requestError: error.message, requestProgress: undefined })
        this.request = undefined
      }
    )
  }

  toDefaultParameters (parameters: (RamlWrapper1.TypeDeclaration | RamlWrapper08.Parameter)[]) {
    var params: { [key: string]: string } = {}

    parameters.forEach(parameter => {
      if (parameter.default()) {
        params[parameter.name()] = parameter.default()
      }
    })

    return params
  }

  usedParameters (state: { [key: string]: string },
                  parameters: (RamlWrapper1.TypeDeclaration | RamlWrapper08.Parameter)[]) {
    var params: { [key: string]: string } = {}

    parameters.forEach(param => {
      if (state[param.name()]) {
        params[param.name()] = state[param.name()]
      }
    })

    return params
  }

  abortRequest () {
    if (this.request) {
      this.request.abort()
      this.request = undefined
    }
  }

  updateRAML (): void {
    this.isParsing = true

    try {
      var baseUnit = this.getUnit(this.getFilename())
      var errors = baseUnit.ast().errors()

      this.errors = errors

      if (!errors.length) {
        (<any>baseUnit)._hl = null;

        var originalRoot = baseUnit.highLevel().asElement().wrapperNode();
        this.raml = <RamlWrapper1.Api | RamlWrapper08.Api>
            rp.expander.expandTraitsAndResourceTypes(originalRoot);
      }
    } catch (error) {
      this.raml = undefined
      this.errors = [error]
    } finally {
      this.loaded = true
      this.isParsing = false

      this.render()
      this.trigger('title-changed')
    }
  }

  loadRAML (): void {
    // Reset all watchers, consider it a fresh parse.
    this.stopWatching()

    this.project = rp.project.createProject(path.dirname(this.getFilename()),
        <any>this.resolver)

    this.updateRAML()
  }

  serialize () {
    return {
      deserializer: 'RAMLConsoleView',
      filename: this.getFilename(),
      state: this.state
    }
  }

  getFilename (): string {
    if (this.file) {
      return this.file.getPath()
    }

    if (this.editor) {
      return this.editor.getPath()
    }
  }

  getTitle (): string {
    var name = 'RAML'

    if (this.raml && this.raml.title() != null) {
      name = this.raml.title()
    } else if (this.file) {
      name = path.basename(this.getFilename())
    } else if (this.editor) {
      name = this.editor.getTitle()
    }

    return name + ' Console'
  }

  destroy (): void {
    this.stopWatching()
    this.disposables.dispose()
    React.unmountComponentAtNode(this.element)
  }

  setState (state: ConsoleState, cb?: () => any) {
    this.state = extend(this.state, state)
    this.render(cb)
  }

  setPageState (pageState: ConsolePageState, cb?: () => any) {
    this.pageState = extend(this.pageState, pageState)
    this.render(cb)
  }

  setParameter (group: string, name: string, value: string) {
    // TODO(blakeembrey): Use computed properties on TypeScript 1.5+.
    var state = {}
    var groupState = extend(this.state[group])

    // Remove falsy values from view.
    if (value) {
      groupState[name] = value
    } else {
      delete groupState[name]
    }

    state[group] = groupState

    this.setState(state)
  }

  getURI () {
    return RAMLConsoleView.getUriForFilename(this.getFilename())
  }

  getUnit (path: string) {
    return this.project.unit(path, true)
  }

  deleteUnit (path: string) {
    this.project.deleteUnit(path)
    this.updateRAML()
  }

  updateUnit(path: string, contents: string) {
    this.getUnit(path).updateContent(contents);
    
    this.updateRAML();
  }
}
export class FSResolverImpl {


  content(path:string):string{
    if (!fs.existsSync(path)){
      return null;
    }
    try {
      return fs.readFileSync(path).toString();
    } catch (e){
      return null;
    }
  }

  list(path:string):string[]{
    return fs.readdirSync(path);
  }

  contentAsync(path:string):Promise<string>{

    return new Promise(function(resolve, reject) {

      fs.readFile(path,(err,data)=>{
        if(err!=null){
          return reject(err);
        }
        var content = data.toString();
        resolve(content);
      });
    });
  }

  listAsync(path:string):Promise<string[]>{
    return new Promise(function(reject,resolve){
      fs.readdir(path,(err,files)=>{
        if(err!=null){
          var message: string[] = <any>err;

          return reject(message);
        }
        resolve(files);
      });
    });
  }
}

/**
 * Create a console resolver class.
 */
class ConsoleResolver extends FSResolverImpl {

  constructor (public readFileSync: (path: string) => string) {
    super()
  }

  content (path: string): string {
    return this.readFileSync(path)
  }

}
