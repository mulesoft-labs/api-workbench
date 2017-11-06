export function doPatch(): void {

    var oldRegister = (<any>document).registerElement;

    (<any>document).registerElement = function (name, options) {

        if(name === "atom-pane-resize-handle") {
            var proto = options.prototype;

            if(proto) {
                var oldAttachedCallback = proto.attachedCallback;

                proto.attachedCallback = function () {
                    if (this.parentElement) {
                        return oldAttachedCallback.apply(this, [])
                    }
                }
            }

            (<any>document).registerElement = oldRegister;
        }

        return oldRegister.apply(document, [name, options])
    }
}