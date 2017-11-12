import path = require("path")
import fs = require("fs")
import mkdirp = require("mkdirp");

export function update() : void {

    const rootPath = path.join(__dirname, "../..");

    const targetActionsPath = path.join(rootPath, "/src/atom/context-menu/actions")
    if (!fs.existsSync(targetActionsPath)) {
        return;
    }

    const sourceActionsPath = path.join(rootPath, "/node_modules/raml-actions/src/actions/remoteUI")
    if (!fs.existsSync(sourceActionsPath)) {
        return;
    }
    fs.readdirSync(sourceActionsPath).forEach((actionDir) => {

        const fullSourceActionDir = path.join(sourceActionsPath, actionDir);
        const sourceActionFile = path.join(fullSourceActionDir, "ui.ts");
        if (!fs.existsSync(sourceActionFile)) {
            return;
        }

        const targetActionDir = path.join(targetActionsPath, actionDir);
        mkdirp.sync(targetActionDir);

        const targetActionFile = path.join(targetActionDir, "ui.ts");

        copyFileSync(sourceActionFile, targetActionFile);
    })
}

export function copyFileSync(sourcePath: string, targetPath : string) {

    var bufferLength = 16384;
    var buffer = new Buffer(bufferLength);
    var sourceDescriptor = fs.openSync(sourcePath, 'r');
    mkdirp.sync(path.dirname(targetPath));
    var targetDescriptor = fs.openSync(targetPath, 'w');

    var numBytes = fs.readSync(sourceDescriptor, buffer, 0, bufferLength, 0);
    var currentPosition = 0;

    while(numBytes > 0) {
        (<any>fs).writeSync(targetDescriptor,buffer,0,numBytes);

        currentPosition += numBytes;
        numBytes = fs.readSync(sourceDescriptor, buffer, 0, bufferLength, currentPosition);
    }

    fs.closeSync(sourceDescriptor)
    fs.closeSync(targetDescriptor)
}

update();