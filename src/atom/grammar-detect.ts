var grammarHandlers: {[id: string]: (editor: AtomCore.IEditor) => boolean} = {};

export function handle(editor: AtomCore.IEditor): any {
    console.log("Editor Opened: " + (<any>editor).getURI());
    
    var uri = (<any>editor).getURI() || "";

    updateGrammar(editor);

    editor.onDidChange(() => {
        updateGrammar(editor);
    });
}

function updateGrammar(editor: AtomCore.IEditor): void {
    Object.keys(grammarHandlers).forEach(extension => tryUpdateGrammarForLanguage(editor, extension));
}

function tryUpdateGrammarForLanguage(editor: AtomCore.IEditor, extension: string): void {
    if(!isUriEndsWith(editor, extension)) {
        return;
    }
    
    try {
        if(grammarHandlers[extension](editor)) {
            setGrammar(editor, "source.s" + extension);
            
            return;
        }
    } catch(e) {
        return;
    }
    
    setGrammar(editor, "source." + extension);
}

export function isSwaggerJson(editor: AtomCore.IEditor): boolean {

    try {
        if(JSON.parse(editor.getText()).swagger) {
            return true;
        }
    } catch (Err) {
        return false
    }
    
    return false;
}

export function isSwaggerYaml(editor: AtomCore.IEditor): boolean {
    if(editor.getText().trim().indexOf("swagger:") == 0) {
        return true;
    }
    
    return false;
}

function isUriEndsWith(editor: AtomCore.IEditor, extension: string): boolean {
    return ((<any>editor).getURI() || "").toLowerCase().endsWith("." + extension);
}

function setGrammar(editor: AtomCore.IEditor, grammarId: string) {
    if(editor.getGrammar() && editor.getGrammar().scopeName === grammarId) {
        return;
    }
    
    editor.setGrammar((<any>atom).workspace.grammarRegistry.grammarForId(grammarId));
}

grammarHandlers["json"] = isSwaggerJson;
grammarHandlers["yaml"] = isSwaggerYaml;
