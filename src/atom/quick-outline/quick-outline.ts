/// <reference path="../../../typings/main.d.ts" />

import path = require('path');
import fs = require('fs');
import atom_space_pen_views_1 = require("atom-space-pen-views");
import provider=require('../suggestion/provider')
import tooltipManager=require("../core/tooltip-manager")
import UI=require ("atom-ui-lib")
import outline=require("../editor-tools/outline-view")
import editorTools=require("../editor-tools/editor-tools")
import hl=require("raml-1-parser")

class QuickOutlineDialog{

    constructor(private _editor:AtomCore.IEditor){
    }

    extraContent(s:UI.Section){

    }

    show(){
        var zz:any=null;
        var nodeToSelect=null;
        var node=<hl.IHighLevelNode>provider.getAstNode({bufferPosition:this._editor.getCursorBufferPosition(),editor:this._editor},false,false);
        var vc=UI.section("Quick outline:");
        var section=outline.createTree(node.root(),x=>{
            if (x.selection){
                if (x.selection.elements.length>0){
                    nodeToSelect=x.selection.elements[0];
                    ok.setDisabled(false)
                    return;
                }

            }
            ok.setDisabled(true);
        }, model=>{
            var editor = this._editor;
            var buffer = editor.getBuffer();
            var posStart = buffer.positionForCharacterIndex(model.getSource().lowLevel().start());

            editor.setCursorScreenPosition(posStart);
            zz.destroy();
        });
        section.setStyle("max-height","800px");
        section.addClass("tree-view-scroller");
        vc.addChild(section);
        var cancel=UI.buttonSimple("Cancel",x=>{zz.destroy()},UI.Icon.NONE);
        cancel.setStyle("float", "right")
            .margin(4,10)
        var ok=UI.button("Ok",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.PRIMARY,UI.Icon.NONE,x=>{
            if (nodeToSelect) {
                editorTools.aquireManager().setSelectedNode(nodeToSelect.getSource ? nodeToSelect.getSource() : nodeToSelect);
            }
            zz.destroy();
        });
        ok.setStyle("float", "right")
            .margin(4,10)
        ok.setDisabled(true)
        vc.addChild(ok);
        vc.addChild(cancel);

        var html=vc.renderUI();
        html.tabIndex=0;
        html.onkeypress=x=>{
            if (x.keyCode==27) {
                zz.destroy();
            }
        }

        zz=(<any>atom).workspace.addModalPanel( { item: html});
        html.focus();

    }
}


function showQuickOutline(editor:AtomCore.IEditor){
    new QuickOutlineDialog(editor).show();
}
function pixelPositionFromMouseEvent(editorView) {
    var clientX = 0, clientY = 0;
    var linesClientRect = getFromShadowDom([editorView], '.lines')[0].getBoundingClientRect();
    var top = clientY - linesClientRect.top;
    var left = clientX - linesClientRect.left;
    return { top: top, left: left };
}
function getFromShadowDom(element, selector) {
    var el = element[0];
    var found = el.rootElement.querySelectorAll(selector);
    return atom_space_pen_views_1.$(found[0]);
}

export function show() {
    var ed = atom.workspace.getActiveTextEditor();
    if (!ed) {
        return;
    }
    var filePath = ed.getPath();
    var filename = path.basename(filePath);
    var ext = path.extname(filename);
    if (!tooltipManager.isAllowedExtension(ext))
        return;
    if (!fs.existsSync(filePath)) {
        return;
    }
    showQuickOutline(ed);
}
