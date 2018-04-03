/// <reference path="../../typings/main.d.ts" />

export function isMultiLine(s: string): boolean {
    return s && s.indexOf('\n') >= 0;
}

export function isMultiLineValue(s: string): boolean {
    return isMultiLine(s) && s.length>2 && s[0] == '|' && (s[1] == '\n' || s[1] == '\r' || s[2] == '\n');
}

export function makeMutiLine(s: string, lev: number): string {
    var xbuf = '';
    if (isMultiLine(s)) {
        xbuf += '|\n';
        var lines = splitOnLines(s);
        for(var i=0; i<lines.length; i++) {
            xbuf += indent(lev, lines[i]);
        }
        //xbuf += '\n';
    } else {
        xbuf += s;
    }
    return xbuf;
}

export function fromMutiLine(s: string): string {
    if(!isMultiLineValue(s)) return s;
    var res = null;
    var lines = splitOnLines(s);
    for(var i=1; i<lines.length; i++) {
        var line = lines[i];
        var str = line.substring(2);
        if(!res)
            res = str;
        else
            res += str;
    }
    return res;
}

export function trimStart(s: string): string {
    if(!s) return s;
    var pos = 0;
    while(pos < s.length) {
        var ch = s[pos];
        if(ch!='\r' && ch!='\n' && ch!=' ' && ch!='\t') break;
        pos++;
    }
    return s.substring(pos, s.length);
}

export function indent(lev: number, str: string='') {
    var leading = '';
    //leading += '[' + lev + ']';
    for(var i=0; i<lev; i++) leading += '  ';
    return leading + str;
}

export function print(lev: number, str: string='') {
    console.log(indent(lev,str));
}

export function replaceNewlines(s: string, rep: string=null): string {
    var res: string = '';
    for(var i=0; i<s.length; i++) {
        var ch = s[i];
        if(ch == '\r') ch = rep == null? '\\r' : rep;
        if(ch == '\n') ch = rep == null? '\\n' : rep;
        res += ch;
    }
    return res;
}


export function trimEnd(s: string): string {
    var pos = s.length;
        while(pos > 0) {
                var ch = s[pos-1];
                if(ch != ' ' && ch != '\t' && ch != '\r' && ch != '\n') break;
                pos--;
            }
        return s.substring(0,pos);
}

export function trim(s: string): string {
    return trimStart(trimEnd(s));
}

export function splitOnLines(text:string):string[]{
    var lines = text.match(/^.*((\r\n|\n|\r)|$)/gm);
    return lines;
}

export function startsWith(s: string, suffix: string): boolean {
    if(!s || !suffix || s.length < suffix.length) return false;
    for(var i=0; i<suffix.length; i++) {
        if(s[i] != suffix[i]) return false;
    }
    return true;
}

export function endsWith(s: string, suffix: string): boolean {
    if(!s || !suffix || s.length < suffix.length) return false;
    for(var i=0; i<suffix.length; i++) {
        if(s[s.length-1-i] != suffix[suffix.length-1-i]) return false;
    }
    return true;
}

export function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export class TextRange {

    constructor(private contents: string, private start: number, private end: number) {
    }

    text(): string {
        return this.contents.substring(this.start,this.end);
    }

    startpos(): number { return this.start }

    endpos(): number { return this.end }

    len(): number { return this.end - this.start }

    unitText(): string { return this.contents}

    withStart(start: number): TextRange {
        return new TextRange(this.contents, start, this.end);
    }

    withEnd(end: number): TextRange {
        return new TextRange(this.contents, this.start, end);
    }

    sub(start: number, end: number) {
        return this.contents.substring(start, end);
    }

    trimStart(): TextRange {
        var pos = this.start;
        while(pos < this.contents.length-1) {
            var ch = this.contents[pos];
            if(ch != ' ' && ch != '\t') break;
            pos++;
        }
        return new TextRange(this.contents, pos, this.end);
    }

    trimEnd(): TextRange {
        var pos = this.end;
        while(pos > 0) {
            var ch = this.contents[pos-1];
            if(ch != ' ' && ch != '\t') break;
            pos--;
        }
        return new TextRange(this.contents, this.start, pos);
    }
    extendToStartOfLine(): TextRange {
        var pos = this.start;
        while(pos > 0) {
            var prevchar = this.contents[pos-1];
            if(prevchar == '\r' || prevchar == '\n') break;
            pos--;
        }
        return new TextRange(this.contents, pos, this.end);
    }

    extendAnyUntilNewLines(): TextRange {
        var pos = this.end;
        if(pos>0) {
            var last = this.contents[pos-1];
            if(last == '\n') return this;
        }
        while(pos < this.contents.length-1) {
            var nextchar = this.contents[pos];
            if(nextchar == '\r' || nextchar == '\n') break;
            pos++;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    extendSpacesUntilNewLines(): TextRange {
        var pos = this.end;
        if(pos>0) {
            var last = this.contents[pos-1];
            if(last == '\n') return this;
        }
        while(pos < this.contents.length-1) {
            var nextchar = this.contents[pos];
            if(nextchar != ' ' || nextchar == <string>'\r' || nextchar == <string>'\n') break;
            pos++;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    extendSpaces(): TextRange {
        var pos = this.end;
        while(pos < this.contents.length-1) {
            var nextchar = this.contents[pos];
            if(nextchar != ' ') break;
            pos++;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    extendSpacesBack(): TextRange {
        var pos = this.start;
        while(pos > 0) {
            var nextchar = this.contents[pos-1];
            if(nextchar != ' ') break;
            pos--;
        }
        return new TextRange(this.contents, pos, this.end);
    }

    extendCharIfAny(ch: string): TextRange {
        var pos = this.end;
        if(pos < this.contents.length-1 && this.contents[pos] == ch) {
            pos++;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    extendCharIfAnyBack(ch: string): TextRange {
        var pos = this.start;
        if(pos > 0 && this.contents[pos-1] == ch) {
            pos--;
        }
        return new TextRange(this.contents, pos, this.end);
    }

    extendToNewlines() {
        var pos = this.end;
        if(pos>0) {
            var last = this.contents[pos-1];
            if(last == '\n') return this;
        }
        while(pos < this.contents.length-1) {
            var nextchar = this.contents[pos];
            if(nextchar != '\r' && nextchar != '\n') break;
            pos++;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    extendUntilNewlinesBack() {
        var pos = this.start;
        while(pos >0) {
            var nextchar = this.contents[pos-1];
            if(nextchar == '\r' || nextchar == '\n') break;
            pos--;
        }
        return new TextRange(this.contents, pos,this.end);
    }

    reduceNewlinesEnd() {
        var pos = this.end;
        while(pos>this.start) {
            var last = this.contents[pos-1];
            if(last != '\r' && last != '\n') break;
            pos--;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    reduceSpaces() {
        var pos = this.end;
        while(pos>this.start) {
            var last = this.contents[pos-1];
            if(last != ' ') break;
            pos--;
        }
        return new TextRange(this.contents, this.start, pos);
    }

    replace(text: string) {
        return this.sub(0, this.start) + text + this.sub(this.end, this.unitText().length);
    }



    remove() {
        return this.sub(0, this.start) + /*this.text() +*/ this.sub(this.end, this.unitText().length);
    }
}
