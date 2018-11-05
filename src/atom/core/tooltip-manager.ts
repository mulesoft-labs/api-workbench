/// <reference path="../../../typings/main.d.ts" />
import path = require('path');
import fs = require('fs');
// import docHelper=require("./documentation-utils")
import _=require("underscore")
var emissary = require('emissary');
var Subscriber = emissary.Subscriber;

var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
var sp = require("atom-space-pen-views");
var $ = sp.$;
var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
var View = (function (_super) {
    __extends(View, _super);
    function View(options) {
        _super.call(this);
        this.options = options;
        this.init();
    }
    Object.defineProperty(View.prototype, "$", {
        get: function () {
            return this;
        },
        enumerable: true,
        configurable: true
    });
    (<any>View).content = function () {
        throw new Error('Must override the base View static content member');
    };
    View.prototype.init = function () { };
    return View;
})(sp.View);
var ScrollView = (function (_super) {
    __extends(ScrollView, _super);
    function ScrollView(options) {
        _super.call(this);
        this.options = options;
        this.init();
    }
    Object.defineProperty(ScrollView.prototype, "$", {
        get: function () {
            return this;
        },
        enumerable: true,
        configurable: true
    });
    (<any>ScrollView).content = function () {
        throw new Error('Must override the base View static content member');
    };
    ScrollView.prototype.init = function () { };
    return ScrollView;
})(sp.ScrollView);

var TooltipView = (function (_super) {
    __extends(TooltipView, _super);
    function TooltipView(rect) {
        _super.call(this, rect);
        this.rect = rect;
        $(document.body).append(this.$);
        this.updatePosition();
    }
    (<any>TooltipView).content = function () {
        var _this = this;
        return this.div({ class: 'atom-typescript-tooltip tooltip' }, function () {
            _this.div({ class: 'tooltip-inner', outlet: 'inner' });
        });
    };
    TooltipView.prototype.updateText = function (text) {
        this.inner.html(text);
        this.updatePosition();
        this.$.fadeTo(300, 1);
    };
    TooltipView.prototype.updatePosition = function () {
        var offset = 10;
        var left = this.rect.right;
        var top = this.rect.bottom;
        var right = undefined;
        if (left + this.$[0].offsetWidth >= $(document.body).width())
            left = $(document.body).width() - this.$[0].offsetWidth - offset;
        //this.$.css({ 'max-width': '500px'})
        if (left < 0) {
            this.$.css({ 'white-space': 'pre-wrap' });
            left = offset;
            right = offset;
        }
        if (top + this.$[0].offsetHeight >= $(document.body).height()) {
            top = this.rect.top - this.$[0].offsetHeight;
        }
        this.$.css({ left: left, top: top });
    };
    return TooltipView;
})(View);

function getFromShadowDom(element, selector) {
    var el = element[0];
    var found = el.rootElement.querySelectorAll(selector);
    return sp.$(found[0]);
}
exports.getFromShadowDom = getFromShadowDom;
function getEditorPositionForBufferPosition(editor, bufferPos) {
    var buffer = editor.getBuffer();
    return buffer.characterIndexForPosition(bufferPos);
}
export function isAllowedExtension(ext) {
    return (ext == '.raml' || ext == '.yaml' || ext == '.yml');
}

export function attach(editorView, editor:AtomCore.IEditor) {
    //console.log("Attach")
    //console.log(editorView)
    //var rawView = editorView;
    //var filePath = editor.getPath();
    //var filename = path.basename(filePath);
    //var ext = path.extname(filename);
    //if (!isAllowedExtension(ext))
    //    return;
    //if (!fs.existsSync(filePath)) {
    //    return;
    //}
    //var scroll = getFromShadowDom([editorView], '.scroll-view');
    //var subscriber = new Subscriber();
    //var exprTypeTimeout = null;
    //var exprTypeTooltip = null;
    //var lastExprTypeBufferPt;
    //subscriber.subscribe(scroll, 'mousemove', function (e) {
    //    var pixelPt = pixelPositionFromMouseEvent(editorView, e);
    //    var screenPt = editor.screenPositionForPixelPosition(pixelPt);
    //    var bufferPt = editor.bufferPositionForScreenPosition(screenPt);
    //    if (lastExprTypeBufferPt && lastExprTypeBufferPt.isEqual(bufferPt) && exprTypeTooltip)
    //        return;
    //    lastExprTypeBufferPt = bufferPt;
    //    clearExprTypeTimeout();
    //    exprTypeTimeout = setTimeout(function () { return showExpressionType(e); }, 1000);
    //});
    //subscriber.subscribe(scroll, 'mouseout', function (e) { return clearExprTypeTimeout(); });
    //subscriber.subscribe(scroll, 'keydown', function (e) { return clearExprTypeTimeout(); });
    //editor.onDidDestroy(function () { return deactivate(); });
    //function showExpressionType(e) {
    //    if (exprTypeTooltip)
    //        return;
    //    var pixelPt = pixelPositionFromMouseEvent(editorView, e);
    //    pixelPt.top += editor.displayBuffer.getScrollTop();
    //    pixelPt.left += editor.displayBuffer.getScrollLeft();
    //    var screenPt = editor.screenPositionForPixelPosition(pixelPt);
    //    var bufferPt = editor.bufferPositionForScreenPosition(screenPt);
    //    var curCharPixelPt = rawView.pixelPositionForBufferPosition([bufferPt.row, bufferPt.column]);
    //    var nextCharPixelPt = rawView.pixelPositionForBufferPosition([bufferPt.row, bufferPt.column + 1]);
    //    if (curCharPixelPt.left >= nextCharPixelPt.left)
    //        return;
    //    var offset = editor.getLineHeightInPixels() * 0.7;
    //    var tooltipRect = {
    //        left: e.clientX,
    //        right: e.clientX,
    //        top: e.clientY - offset,
    //        bottom: e.clientY + offset
    //    };
    //    exprTypeTooltip = new TooltipView(tooltipRect);
    //    // var position = getEditorPositionForBufferPosition(editor, bufferPt);
    //    var node=provider.getAstNode({
    //        editor:editor,
    //        bufferPosition:bufferPt
    //    },false);
    //    if (node) {
    //        var hl=<hl.IHighLevelNode>node;
    //        var pos=getEditorPositionForBufferPosition(editor,bufferPt);
    //        var doc=docHelper.getDocumentation(hl,pos);
    //        if (doc){
    //            exprTypeTooltip.updateText(doc);
    //        }
    //    }
    //
    //}
    //function deactivate() {
    //    subscriber.unsubscribe();
    //    clearExprTypeTimeout();
    //}
    //function clearExprTypeTimeout() {
    //    if (exprTypeTimeout) {
    //        clearTimeout(exprTypeTimeout);
    //        exprTypeTimeout = null;
    //    }
    //    hideExpressionType();
    //}
    //function hideExpressionType() {
    //    if (!exprTypeTooltip)
    //        return;
    //    exprTypeTooltip.$.remove();
    //    exprTypeTooltip = null;
    //}
}
function pixelPositionFromMouseEvent(editorView, event) {
    var clientX = event.clientX, clientY = event.clientY;
    var linesClientRect = getFromShadowDom([editorView], '.lines')[0].getBoundingClientRect();
    var top = clientY - linesClientRect.top;
    var left = clientX - linesClientRect.left;
    return { top: top, left: left };
}
export function screenPositionFromMouseEvent(editorView, event) {
    return editorView.getModel().screenPositionForPixelPosition(pixelPositionFromMouseEvent(editorView, event));
}
export function screenPositionFromMouse(editor,event:{clientX:number;clientY:number}){
    var editorView = (<any>sp.$((<any>atom).views))[0].getView(editor);
    var pos= pixelPositionFromMouseEvent(editorView,event);
    pos.top -= editor.displayBuffer.getScrollTop();
    pos.left -= editor.displayBuffer.getScrollLeft();
    var clientRect=editorView.getBoundingClientRect();
    pos.top+=clientRect.top;
    pos.left+=clientRect.left;
    return pos;
}
//export function turnOn()
//{
//    (<any>atom.workspace).observeTextEditors(editor=> {
//        var editorView = (<any>sp.$((<any>atom).views))[0].getView(editor);
//        attach(editorView, editor);
//    });
//}
