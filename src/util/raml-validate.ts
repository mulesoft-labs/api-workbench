/// <reference path="../../typings/main.d.ts" />

type ParameterValueMap = { [parameterName: string]: any }

/**
 * Exported API
 */
interface Validate {
    (parameters: Raml08Parser.NamedParameterMap): (check: ParameterValueMap ) => ValidationsResult

    rule: (parameter: Raml08Parser.NamedParameter) => ValidationFunction

    RULES: RulesObject
    TYPES: TypesObject
}

interface ValidationResult {
    valid: boolean
    key: string
    value: any
    rule: string
    attr: any
}

interface ValidationsResult {
    valid: boolean
    errors: ValidationResult[]
}

var _toString = Object.prototype.toString

function isDateType (check: any): boolean {
    return _toString.call(check) === '[object Date]' && !isNaN(check.getTime())
}

function isBooleanType (check: any): boolean {
    return typeof check === 'boolean'
}

function isStringType (check: any): boolean {
    return typeof check === 'string'
}

function isIntegerType (check: any): boolean {
    return typeof check === 'number' && check % 1 === 0
}

function isNumberType (check: any): boolean {
    return typeof check === 'number' && isFinite(check)
}

interface Validator<T> {
    ( v: T ): boolean
}

function isMinimum (min: number): Validator<number> {
    return function (check: number): boolean {
        return check >= min
    }
}

function isMaximum (max: number): Validator<number> {
    return function (check: number): boolean {
        return check <= max
    }
}

function isMinimumLength (min: number): Validator<string> {
    return function (check: string): boolean {
        return Buffer.byteLength(check) >= min
    }
}

function isMaximumLength (max: number): Validator<string> {
    return function (check: string) {
        return Buffer.byteLength(check) <= max
    }
}

function isEnum (values: any[]): Validator<any> {
    if (values && values.length != 0) {
        return function (check:any):boolean {
            return values.indexOf(check) > -1
        }
    }
    else {
        return function (check:any):boolean {
            return true;
        }
    }
}

function isPattern (pattern: string | RegExp): (check: string) => boolean {
    var regexp = (typeof pattern === 'string') ? new RegExp(pattern) : pattern

    return regexp.test.bind(regexp)
}

type CheckFunction = (check: any, key?: string, src?: ParameterValueMap) => boolean
type RuleFunction = (rule: any, key: string) => CheckFunction
type ValidationFunction = (check: any, key: string, src: ParameterValueMap) => ValidationResult

type RulesObject = { [rule: string]: RuleFunction }
type TypesObject = { [rule: string]: CheckFunction }

function toValidationResult (valid: boolean, key: string, value: any, rule?: string, attr?: any): ValidationResult {
    return {
        valid: valid,
        rule: rule,
        attr: attr,
        value: value,
        key: key
    }
}

function toValidationFunction (parameter: Raml08Parser.NamedParameter, rules: RulesObject) {
    var validations = []

    Object.keys(parameter).forEach(function (name) {
        var rule = rules[name]

        if (!rule) {
            return
        }

        var value = parameter[name]

        validations.push([name, rule(value, name), value])
    })

    return function (value: any, key: string, src: ParameterValueMap): ValidationResult {
        for (var i = 0; i < validations.length; i++) {
            var validation = validations[i]
            var name = validation[0]
            var fn = validation[1]
            var attr = validation[2]
            var valid = fn(value, key, src)

            if (!valid) {
                return toValidationResult(false, key, value, name, attr)
            }
        }

        return toValidationResult(true, key, value)
    }
}

function toValidation (parameter: Raml08Parser.NamedParameter, rules: RulesObject, types: TypesObject): ValidationFunction {
    var parameters = Array.isArray(parameter) ? <Array<Raml08Parser.BasicNamedParameter>>parameter : [parameter]
    var isOptional = !parameters.length
    var simpleValidations = []
    var repeatValidations = []

    parameters.forEach(function (parameter) {
        var validation = [parameter.type || 'string', toValidationFunction(parameter, rules)]

        if (!parameter.required) {
            isOptional = true
        }

        if (parameter.repeat) {
            repeatValidations.push(validation)
        } else {
            simpleValidations.push(validation)
        }
    })

    return function (value: any, key: string, src: ParameterValueMap): ValidationResult {
        if (value == null) {
            return toValidationResult(isOptional, key, value, 'required', !isOptional)
        }

        var isArray = Array.isArray(value)
        var values = isArray ? value : [value]
        var validations = isArray ? repeatValidations : simpleValidations

        if (!validations.length) {
            return toValidationResult(false, key, value, 'repeat', !isArray)
        }

        var response = null
        var originalValue = value

        validations.some(function (validation) {
            var isValidType = values.every(function (value) {
                var paramType = validation[0]
                var isValidType = types[paramType] && types[paramType](value, key, src)

                if (!isValidType) {
                    response = toValidationResult(false, key, originalValue, 'type', paramType)
                }

                return isValidType
            })

            if (!isValidType) {
                return false
            }

            values.every(function (value) {
                var fn = validation[1]

                response = fn(value, key)

                return response.valid
            })

            return true
        })

        return response
    }
}

function validate () {

    var TYPES: TypesObject = {
        date: isDateType,
        number: isNumberType,
        integer: isIntegerType,
        boolean: isBooleanType,
        string: isStringType
    }

    var RULES: RulesObject = {
        minimum: isMinimum,
        maximum: isMaximum,
        minLength: isMinimumLength,
        maxLength: isMaximumLength,
        'enum': isEnum,
        pattern: isPattern
    }

    function rule (parameter: Raml08Parser.NamedParameter): ValidationFunction {
        return toValidation(parameter, RULES, TYPES)
    }

    var v: Validate

    var validate: any = function (parameterMap: Raml08Parser.NamedParameterMap) {
        if (!parameterMap) {
            return function (check: ParameterValueMap) {
                return { valid: true, errors: []}
            }
        }

        var validations = {}

        Object.keys(parameterMap).forEach(function (key) {

            validations[key] = rule(<Raml08Parser.NamedParameter>parameterMap[key])
        })

        return function (src?: ParameterValueMap): ValidationsResult {
            src = src || {}

            var errors = Object.keys(validations)
                .map(function (param) {
                    var value = src[param]
                    var fn = validations[param]

                    return fn(value, param, src)
                })
                .filter(function (result) {
                    return !result.valid
                })

            return {
                valid: errors.length === 0,
                errors: errors
            }
        }
    }

    v = validate
    v.rule = rule
    v.TYPES = TYPES
    v.RULES = RULES

    return v
}

export = validate
