declare module AtomCore {
  interface IWorkspace {
    addOpener(cb: (uri: string) => void): void
    getActivePaneItem(): IPaneView
    observeActivePaneItem(item?: IPaneView): void
    paneForItem(item: any): IPane
    paneForURI(uri: string): IPaneView
    getActiveTextEditor(): IEditor
    getTextEditors(): any[]
    observeTextEditors(cb: (editor: IEditor) => any): Disposable
    onDidChangeActivePaneItem(cb: (editor: IEditor) => any): Disposable
    addModalPanel(options: { item: HTMLElement }): IPane
    getPaneItems(): IPane[]
    onDidAddPaneItem(callback: (event: { item: any; pane: IPane; index: number }) => void)
    onDidDestroyPane(callback: (event: { pane: IPane }) => void)
  }

  interface IContextMenuManager {
    itemSets : IContextMenuItemSet[]
    add(argument:any)
  }

  interface IContextMenuItemSet {
    items : IContextMenuItem[]
    selector : string
    specificity : number
  }

  interface IContextMenuItem {
    label : string
    submenu? : IContextMenuItem[]
    command? : string
  }

  interface IGrammar {
    fileTypes: string[]
  }

  interface INotificationManager {
    addError(message: string, options?: { detail?: string }): any
    addInfo(message: string, options?: { detail?: string }): any
  }

  interface IGrammarRegistry {
    grammars: IGrammar[];
    grammarsByScopeName: { [scopeName: string]: IGrammar }
    getGrammars(): IGrammar[];
  }

  interface TooltipElementOptions {
    container?: string
    placement?: string
    html?: boolean
    viewportPadding?: number
    delay?: number | {
      hide?: number
      show?: number
    }
  }

  interface TooltipOptions extends TooltipElementOptions {
    title?: string
    keyBindingCommand?: string
    keyBindingTarget?: Element
  }



  interface IAtom {
    commands: {
      add: {
        (selector: string, type: string | Element, callback: () => void): Disposable
        (type: string | Element, events: { [selector: string]: () => void }): void
      }
      registeredCommands : any
      selectorBasedListenersByCommandName : any
    }

    contextMenu: IContextMenuManager
    grammars: IGrammarRegistry
    notifications: INotificationManager

    tooltips: {
      add(target: Element, options: TooltipOptions): Disposable
      defaults: TooltipElementOptions
    }
  }

  interface IPaneView {
    destroyItem(item: IEditor): void
    itemForURI(uri: string): IEditor
  }

  interface Point{
    row:number;
    column:number;
  }

  interface IEditor {
    getLastCursor (): ICursor
    onDidChange (cb: () => any): Disposable
    onDidStopChanging (cb: () => any): Disposable
    onDidChangePath (cb: () => any): Disposable
    onDidDestroy (cb: () => any): Disposable
    onDidChangeCursorPosition(callback: (event:{
                                           oldBufferPosition:Point,
                                           oldScreenPosition:Point,
                                           newBufferPosition:Point,
                                           newScreenPosition:Point,
                                           textChanged:boolean,
                                           cursor: ICursor
                                         })=>void);
  }

  interface IPackageManager {
    onDidActivateInitialPackages(callback: Function): Disposable
  }

  class Disposable {
    constructor (disposalAction: Function)
    dispose(): void
    disposed: boolean
  }

  class CompositeDisposable {
    constructor (...disposable: Disposable[])
    add(disposable: Disposable): void
    clear(): void
    dispose(): void
    disposed: boolean
    remove(disposable: Disposable): void
  }

  class Emitter {
    handlersByEventName: Object
    dispose(): boolean
    emit(eventName: string, value?: any): void
    isDisposed: boolean
    off(eventName: string, handlerToRemove: Function): Array<Function>
    on(evenName: string, hander: Function, unshift?: boolean): Disposable
    preempt(eventName: string, handler: Function): Disposable
  }
}

declare module 'atom' {
  export import Emitter = AtomCore.Emitter
  export import Disposable = AtomCore.Disposable
  export import CompositeDisposable = AtomCore.CompositeDisposable
}
