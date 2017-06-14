/// <reference path="../../../typings/main.d.ts" />

export function markOccurences(editor: AtomCore.IEditor, occurences: TextBuffer.IRange[]) {
    var layer: any = getOccurencesLayer(editor);

    layer.clear();

    occurences.forEach(occurence => {
        layer.markBufferRange(occurence);
    });

    (<any>editor).decorateMarkerLayer(layer, {
        type: 'highlight',
        class: 'raml-occurence'
    });
}

export function clearOccurences(editor: AtomCore.IEditor) {
    var layer: any = getOccurencesLayer(editor);

    layer.clear();
}

function getOccurencesLayer(editor: AtomCore.IEditor): any {
    var layerId = (<any>editor).occurencesLayerId;

    var layer = layerId && (<any>editor).getMarkerLayer(layerId);

    if(!layer) {
        layer = (<any>editor).addMarkerLayer();
    }

    (<any>editor).occurencesLayerId = layer.id;

    return layer;
}


