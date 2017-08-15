/// <reference path="../../typings/main.d.ts" />

import editorTools = require("./editor-tools/editor-tools")
import sharedAstInitializerInterfaces = require("./shared-ast-initializer-interfaces")
import commonContextActions = require("./context-menu/commonContextActions")
import provider=require("./suggestion/provider")
import outlineInitializer = require("./editor-tools/outline-initializer")
import path = require ('path')
import unitUtils = require("./util/unit")

import parser=require("raml-1-parser");
import hl=parser.hl;
import ll=parser.ll;
import dialects=require("./dialects");
dialects.initDialects();
import ds=parser.ds;
// var u=ds.registerRAMLDialect("Async","0.1");
//
// //import fs=require("fs");
//
// //parser.loadSync();
// var as=new ds.NodeClass("Async",u,"");
// as.addSuperType(<any>u.type("LibraryBase"));
// u.register(as);
// var p=ds.prop("hello","",as,<any>u.type("NumberType"));
// p.unmerge();
export function initialize() {
    var editorProvider = {
        getCurrentEditor() {
            var gotEditorFromOutline = false;

            var editor = null;

            if (atom.workspace.getActiveTextEditor()) {
                editor = atom.workspace.getActiveTextEditor()
            } else if (editorTools.aquireManager()) {
                editor = <AtomCore.IEditor>editorTools.aquireManager().getCurrentEditor()
                gotEditorFromOutline = true
            }

            return editor;
        }
    }

    var astProvider = {
        getASTRoot() : hl.IHighLevelNode {
            var selectedNode = this.getSelectedNode();
            if (selectedNode) return selectedNode.root();

            var editor = null;
            if (editorTools.aquireManager()) {
                editor = <AtomCore.IEditor>editorTools.aquireManager().getCurrentEditor()
            }

            if (!editor && atom.workspace.getActiveTextEditor()) {
                editor = atom.workspace.getActiveTextEditor()
            }

            if (!editor) return null
            if (!unitUtils.isRAMLUnit(editor.getBuffer().getText())) return null;

            var filePath = editor.getPath();

            var prj=parser.project.createProject(path.dirname(filePath));
            var offset=editor.getBuffer().characterIndexForPosition(
                editor.getCursorBufferPosition());
            var text=editor.getBuffer().getText();

            var unit=prj.setCachedUnitContent(path.basename(filePath),text);

            return <hl.IHighLevelNode>unit.highLevel();
        },

        getSelectedNode() : hl.IParseResult {

            var editor = null;
            var gotEditorFromOutline = false;

            if (editorTools.aquireManager()) {
                editor = <AtomCore.IEditor>editorTools.aquireManager().getCurrentEditor()
                gotEditorFromOutline = true
            }

            if (!editor && atom.workspace.getActiveTextEditor()) {
                editor = atom.workspace.getActiveTextEditor()
            }

            if (!editor) return null

            if (path.extname(editor.getPath()) != '.raml') return null
            if (!unitUtils.isRAMLUnit(editor.getBuffer().getText())) return null;

            var request = {
                editor: editor,
                bufferPosition: editor.getCursorBufferPosition()
            };

            var node = null;

            if (gotEditorFromOutline) {
                node = editorTools.aquireManager().getSelectedNode()
            } else {
                if (editor.getBuffer()) {
                    var lastPosition = editor.getBuffer().getEndPosition();
                    if (lastPosition.column == request.bufferPosition.column
                        && lastPosition.row == request.bufferPosition.row) {
                        return null;
                    }
                    if (request.bufferPosition.row == 0 && request.bufferPosition.column == 0) {
                        return null;
                    }
                }

                node = provider.getAstNode(request, false);
            }

            return node;
        }
    }
    
    var astModifier = {
        deleteNode(node: hl.IParseResult) {
            var editorManager = editorTools.aquireManager();
            if (editorManager && editorManager._view) {
                editorManager._view.forEachViewer(x=> x.remove(node));
            }

            var parent = node.parent();
            if (parent) {
                parent.remove(<any>node);
                parent.resetChildren();
            }
        },
        updateText(node: ll.ILowLevelASTNode) {
            var editorManager = editorTools.aquireManager();
            if (editorManager) {
                editorManager.updateText(node);
            }
        }
    }

    commonContextActions.initialize(editorProvider, astProvider, astModifier);
    outlineInitializer.initialize(editorProvider, astProvider);
    provider.initialize(astProvider);
}