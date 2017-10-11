/// <reference path="../../typings/main.d.ts" />

import ramlSanitize = require('./raml-sanitize')
import ramlValidate = require('./raml-validate')

interface MatchResult {
    path: string
    params: { [key: string]: any }
}

type PathMatchResult = MatchResult | boolean

type ParameterValueMap = { [parameterName: string]: any }

interface KeyMatchObject {
    name: string
    prefix: string
}

interface OptionsObject {
    end?: boolean
    strict?: boolean
    sensitive?: boolean
}

var REGEXP_MATCH = {
    number: '[-+]?\\d+(?:\\.\\d+)?',
    integer: '[-+]?\\d+',
    date: '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \\d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{4} (?:[0-1]\\d|2[0-3]):[0-5]\\d:[0-5]\\d GMT',
    boolean: '(?:true|false)'
}

var ESCAPE_CHARACTERS = /([.*+?=^!:${}()|[\]\/\\])/g

var REGEXP_REPLACE = new RegExp([
    // Match RAML parameters with an optional prefix.
    '([.\\/])?\\{([^}]+)\\}',
    // Match any escape characters.
    ESCAPE_CHARACTERS.source
].join('|'), 'g');

function toRegExp (path: string, parameters: Raml08Parser.NamedParameterMap, keys: KeyMatchObject[], options: OptionsObject): RegExp {
    var end = options.end !== false
    var strict = options.strict
    var flags  = ''

    if (!options.sensitive) {
        flags += 'i'
    }

    var route = path.replace(
        REGEXP_REPLACE,
        function (match: string, prefix?: string, key?: string, escape?: string): string {
            if (escape) {
                return '\\' + escape
            }

            // Push the current key into the keys array.
            keys.push({
                name: key,
                prefix: prefix || '/'
            })

            prefix = prefix ? '\\' + prefix : ''

            // TODO: Support an array of parameters.
            var param: Raml08Parser.BasicNamedParameter = <any>parameters[key]
            var capture = param && REGEXP_MATCH[param.type] || '[^' + (prefix || '\\/') + ']+'
            var optional = param && param.required === false

            if (Array.isArray(param.enum) && param.enum.length) {
                capture = '(?:' + param.enum.map(function (value) {
                    return String(value).replace(ESCAPE_CHARACTERS, '\\$1')
                }).join('|') + ')'
            }

            return prefix + '(' + capture + ')' + (optional ? '?' : '')
        }
    )

    var endsWithSlash = path.charAt(path.length - 1) === '/'

    // In non-strict mode we allow a slash at the end of match. If the path to
    // match already ends with a slash, we remove it for consistency. The slash
    // is valid at the end of a path match, not in the middle. This is important
    // in non-ending mode, where "/test/" shouldn't match "/test//route".
    if (!strict) {
        route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
    }

    if (end) {
        route += '$'
    } else {
        // In non-ending mode, we need the capturing groups to match as much as
        // possible by using a positive lookahead to the end or next path segment.
        route += strict && endsWithSlash ? '' : '(?=\\/|$)'
    }

    return new RegExp('^' + route + (end ? '$' : ''), flags)
}

function decodeParam (param: string): string {
    try {
        return decodeURIComponent(param)
    } catch (_) {
        var err: any = new Error('Failed to decode param "' + param + '"')
        err.status = 400
        throw err
    }
}

type PathMatchFunction = (path: string) => PathMatchResult

function ramlPathMatch (path: string, parameters: Raml08Parser.NamedParameterMap, options: OptionsObject): PathMatchFunction {
    options = options || {}

    if (path === '/' && options.end === false) {
        return truth
    }

    parameters = parameters || {}

    var keys = [];
    var re = toRegExp(path, parameters, keys, options)
    var sanitize = ramlSanitize()(parameters)
    var validate = ramlValidate()(parameters)

    return function (pathname: string): PathMatchResult {
        var m = re.exec(pathname)

        if (!m) {
            return false
        }

        if(parameters['mediaTypeExtension']){
            if(m.length>1&&!m[m.length-1]){
                var beforeLast = m[m.length-2];
                var ind = beforeLast.lastIndexOf('.');
                if(ind>=0){
                    m[m.length-2] = beforeLast.substring(0,ind);
                    m[m.length-1] = beforeLast.substring(ind);
                }
            }
        }

        var path = m[0]
        var params: ParameterValueMap = {}

        for (var i = 1; i < m.length; i++) {
            var key   = keys[i - 1]
            var param = m[i]

            params[key.name] = param == null ? param : decodeParam(param)
        }

        params = sanitize(params)

        if (!validate(params).valid) {
            return false
        }

        return {
            path: path,
            params: params
        }
    };
}

function truth (path: string): MatchResult {
    return { path: '', params: {} }
}

export = ramlPathMatch