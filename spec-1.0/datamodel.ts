import  MetaModel = require("../definition-system/metamodel")
import  Sys = require("./systemTypes")
import  Bodies=require("./bodies")
import  Common=require("./common")
import  Declarations=require("./declarations")


export enum ModelLocation{
    QUERY,HEADERS,URI,FORM,BURI,ANNOTATION,MODEL,SECURITYSCHEMATYPE
}
export enum LocationKind{
    APISTRUCTURE,DECLARATIONS,MODELS
}

export class ExampleSpec extends Common.RAMLLanguageElement{
    content:string
    $content=[
        MetaModel.selfNode(),
        MetaModel.description("The example itself"),
        MetaModel.required(),
        MetaModel.valueDescription("* Valid value for this type<br>* String representing the serialized version of a valid value")
    ]

    strict:boolean
    $strict=[MetaModel.description("By default, examples are validated against any type declaration. Set this to false to allow examples that need not validate.")]

    name:string
    $name=[MetaModel.key(),MetaModel.hide()];

    $displayName = [MetaModel.description("An alternate, human-friendly name for the example")]

    $description = [
        MetaModel.description("A longer, human-friendly description of the example"),
        MetaModel.valueDescription("markdown string")
    ]

    $annotations = [
        MetaModel.markdownDescription("Annotations to be applied to this example. Annotations are any property whose key begins with \"(\" and ends with \")\" and whose name (the part between the beginning and ending parentheses) is a declared annotation name. See the [[raml-10-spec-annotations|section on annotations]].")
    ]
}

export class DataElementProperty{

    name:string
    $name=[
        MetaModel.key(),
        MetaModel.description("name of the parameter"),
        MetaModel.extraMetaKey("headers"),
        MetaModel.hide()
    ]

    location:ModelLocation
    $location=[
        MetaModel.system(),MetaModel.description("Location of the parameter (can not be edited by user)"),
        MetaModel.hide()
    ]

    locationKind:LocationKind;
    $locationKind=[
        MetaModel.system(),MetaModel.description("Kind of location"),
        MetaModel.hide()
    ]

    default:string
    $default=[
        MetaModel.description("Provides default value for a property"),
        MetaModel.valueDescription("any")
    ]

    //repeat:boolean
    //$repeat=[MetaModel.requireValue("fieldOrParam",true),MetaModel.description("The repeat attribute specifies that the parameter can be repeated. " +
    //    "If the parameter can be used multiple times, the repeat parameter value MUST be set to 'true'. Otherwise, the default value is 'false' and the parameter may not be repeated."),
    //    MetaModel.issue("semantic of repeat " +
    //        "is not clearly specified and actually multiple possible reasonable options exists at the same time "),MetaModel.issue("https://github.com/raml-org/raml-spec/issues/152"),
    //    MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE),
    //    MetaModel.hide()
    //]

    required: boolean
    $required=[
        MetaModel.requireValue("fieldOrParam",true),
        MetaModel.description("Sets if property is optional or not"),
        MetaModel.describesAnnotation("required"),
        MetaModel.valueDescription("boolean = true")
    ]
}

export class TypeDeclaration extends Common.RAMLLanguageElement{

    name:string
    $name=[
        MetaModel.key(),
        MetaModel.description("name of the parameter"),
        MetaModel.extraMetaKey("headers"),
        MetaModel.hide()
    ]

    //xml: XMLSerializationHints

    facets:TypeDeclaration[];
    $facets=[
        MetaModel.declaringFields(),
        MetaModel.description("When extending from a type you can define new facets (which can then be set to concrete values by subtypes)."),
        MetaModel.hide()
    ]

    schema: string
    $schema=[
        MetaModel.description("Alias for the equivalent \"type\" property, for compatibility with RAML 0.8. Deprecated - API definitions should use the \"type\" property, as the \"schema\" alias for that property name may be removed in a future RAML version. The \"type\" property allows for XML and JSON schemas."),
        MetaModel.valueDescription("Single string denoting the base type or type expression")
    ]

    usage: string
    $usage=[MetaModel.hide()]

    type:string;
    $type=[
        MetaModel.allowMultiple(),
        //MetaModel.needsClarification("I suggest to remove multiple type feature from RAML 1.0 in favour of parameter overloading"),
        MetaModel.canBeValue(),
        MetaModel.defaultValue("string"),
        MetaModel.descriminatingProperty(),
        MetaModel.description("A base type which the current type extends, or more generally a type expression."),
        MetaModel.valueDescription("string denoting the base type or type expression")
    ]

    location:ModelLocation
    $location=[
        MetaModel.system(),
        MetaModel.description("Location of the parameter (can not be edited by user)"),
        MetaModel.hide()
    ]

//    formParameters:TypeDeclaration[]
//    $formParameters=[ MetaModel.requireValue("form","true"), MetaModel.setsContextValue("fieldOrParam",true),MetaModel.setsContextValue("location","models.ModelLocation.FORM"),
//        MetaModel.setsContextValue("locationKind","models.LocationKind.APISTRUCTURE"),MetaModel.description(`Web forms REQUIRE special encoding and custom declaration.
//If the API's media type is either application/x-www-form-urlencoded or multipart/form-data, the formParameters property MUST specify the name-value pairs that the API is expecting.
//The formParameters property is a map in which the key is the name of the web form parameter, and the value is itself a map the specifies the web form parameter's attributes`)]

    //$=[]

    locationKind:LocationKind;
    $locationKind=[
        MetaModel.system(),MetaModel.description("Kind of location"),
        MetaModel.hide()
    ]

    default:string
    $default=[
        MetaModel.description("Provides default value for a property"),
        MetaModel.hide()
    ]

    //sendDefaultByClient:boolean;
    //$sendDefaultByClient=[MetaModel.requireValue("fieldOrParam",true),MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/86"),MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE)]

    example:string
    $example=[
        MetaModel.selfNode(),
        MetaModel.description("An example of an instance of this type. This can be used, e.g., by documentation generators to generate sample values for an object of this type. Cannot be present if the examples property is present."),
        MetaModel.valueDescription("* Valid value for this type<br>* String representing the serialized version of a valid value")
    ]
    examples: ExampleSpec[]
    $examples=[
        MetaModel.description("An object containing named examples of instances of this type. This can be used, e.g., by documentation generators to generate sample values for an object of this type. Cannot be present if the examples property is present."),
        MetaModel.valueDescription("An object whose properties map example names to Example objects (see [[raml-10-spec-examples|Examples]] section); or an array of Example objects.")
    ]


    repeat:boolean
    $repeat=[
        MetaModel.requireValue("fieldOrParam",true),
        MetaModel.description("The repeat attribute specifies that the parameter can be repeated. " +
        "If the parameter can be used multiple times, the repeat parameter value MUST be set to 'true'. Otherwise, the default value is 'false' and the parameter may not be repeated."),
        //MetaModel.issue("semantic of repeat " +
        //    "is not clearly specified and actually multiple possible reasonable options exists at the same time "),MetaModel.issue("https://github.com/raml-org/raml-spec/issues/152"),
        //MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE)
        MetaModel.hide()
    ]
    //collectionFormat:string
    //$collectionFormat=[MetaModel.oneOf(["csv","ssv","tsv","pipes","multi"])];

    required: boolean
    $required=[
        MetaModel.requireValue("fieldOrParam",true),
        MetaModel.description("Sets if property is optional or not"),
        MetaModel.describesAnnotation("required"),
        MetaModel.hide()
    ]

    //scope: string[];
    //$scope=[MetaModel.requireValue("fieldOrParam",true),MetaModel.requireValue("locationKind",LocationKind.MODELS)]

    //xml:XMLSerializationHints
    //$xml=[MetaModel.requireValue("locationKind",LocationKind.MODELS)]

    //validWhen:Sys.ramlexpression;//another alternative conflicts
    //$validWhen=[MetaModel.requireValue("fieldOrParam",true),MetaModel.version(MetaModel.RAMLVersion.RAML10),MetaModel.description("allows to specify expression to compute parameter validity"),MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/53"),MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/46")]
    //
    //requiredWhen:Sys.ramlexpression;//another alternative requires
    //$requiredWhen=[MetaModel.requireValue("fieldOrParam",true),MetaModel.version(MetaModel.RAMLVersion.RAML10),MetaModel.description("allows to specify expression to compute parameter requirement"),MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/53"),MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/46")]


    $=[MetaModel.convertsToGlobalOfType("SchemaString"),MetaModel.canInherit("mediaType")]

    $displayName=[MetaModel.description("An alternate, human-friendly name for the type")]

    $description=[
        MetaModel.description("A longer, human-friendly description of the type"),
        MetaModel.valueDescription("markdown string")
    ]

    $annotations=[
        MetaModel.markdownDescription("Annotations to be applied to this type. Annotations are any property whose key begins with \"(\" and ends with \")\" and whose name (the part between the beginning and ending parentheses) is a declared annotation name. See the [[raml-10-spec-annotations|section on annotations]].")
    ]


}

export class ScalarElement{

    facets:TypeDeclaration[];
    $facets=[
        MetaModel.declaringFields(),
        MetaModel.description("When extending from a scalar type you can define new facets (which can then be set to concrete values by subtypes)."),
        MetaModel.valueDescription("An object whose properties map facets names to their types.")
    ]

    enum:string[]
    $enum=[
        //MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/82"),
        MetaModel.describesAnnotation("oneOf"),
        MetaModel.description("Enumeration of possible values for this primitive type. Cannot be used with the file type."),
        MetaModel.valueDescription("Array containing string representations of possible values, or a single string if there is only one possible value.")
    ]

}

//class XMLSerializationHints{
//    name:string
//    namespace:string
//    prefix: string
//    attribute: boolean;
//    wrapped: boolean
//}

export class ArrayTypeDeclaration extends TypeDeclaration{
    //items:DataElementRef[];
    type="array"
    uniqueItems:boolean
    $uniqueItems=[
        MetaModel.facetId("uniqueItems"),
        MetaModel.description("Should items in array be unique")
    ]

    items: TypeDeclaration
    $items=[
        MetaModel.description("Array component type."),
        MetaModel.valueDescription("Inline type declaration or type name.")
    ]

    minItems: number
    $minItems=[
        MetaModel.facetId("minItems"),
        MetaModel.description("Minimum amount of items in array"),
        MetaModel.valueDescription("integer ( >= 0 ). Defaults to 0")
    ]

    maxItems: number
    $maxItems=[
        MetaModel.facetId("maxItems"),
        MetaModel.description("Maximum amount of items in array"),
        MetaModel.valueDescription("integer ( >= 0 ). Defaults to undefined.")
    ]

    $=[
        MetaModel.convertsToGlobalOfType("SchemaString"),
        //MetaModel.requireValue("locationKind",LocationKind.MODELS),
        MetaModel.alias("array"),
        MetaModel.declaresSubTypeOf("TypeDeclaration")]
}
export class UnionTypeDeclaration extends TypeDeclaration{
    discriminator:string;//FIXME should be pointer at some moment
    $discriminator=[
        MetaModel.selector("*.DataElement"),
        MetaModel.description("Type property name to be used as a discriminator or boolean")
    ];

    //oneOf:pointer[]
    //$oneOf=[MetaModel.selector("$$.**.TypeDeclaration"),MetaModel.required()]
    type="union";
    $=[MetaModel.convertsToGlobalOfType("SchemaString"),MetaModel.requireValue("locationKind",LocationKind.MODELS),MetaModel.declaresSubTypeOf("TypeDeclaration")]
}
export class DataElementRef extends Sys.Reference<TypeDeclaration>{

}
export class ObjectTypeDeclaration extends TypeDeclaration{

    properties:TypeDeclaration[]
    $properties=[
        MetaModel.setsContextValue("fieldOrParam",true),
        MetaModel.description("The properties that instances of this type may or must have."),
        MetaModel.valueDescription("An object whose keys are the properties' names and whose values are property declarations.")
    ]


    minProperties:number
    $minProperties=[
        MetaModel.facetId("minProperties"),
        MetaModel.description("The minimum number of properties allowed for instances of this type.")
    ]

    maxProperties:number
    $maxProperties=[
        MetaModel.facetId("maxProperties"),
        MetaModel.description("The maximum number of properties allowed for instances of this type.")
    ]

    additionalProperties:TypeDeclaration;
    $additionalProperties=[
        MetaModel.description("JSON schema style syntax for declaring maps"),
        MetaModel.markdownDescription("JSON schema style syntax for declaring maps. See [[raml-10-spec-map-types|Map Types]]."),
        MetaModel.valueDescription("Inline type declaration or typename")
    ]


    patternProperties:TypeDeclaration[];
    $patternProperties=[
        MetaModel.description("JSON schema style syntax for declaring key restricted maps"),
        MetaModel.markdownDescription("JSON schema style syntax for declaring key restricted maps. See [[raml-10-spec-map-types|Map Types]]."),
        MetaModel.valueDescription("An object whose properties map regular expressions (which are regarded as defining ranges for property names) to types of properties expressed as Inline type declaration or typename.")
    ]

    discriminator:pointer
    $discriminator=[
        MetaModel.selector("*.DataElement"),
        MetaModel.description("Type property name to be used as discriminator, or boolean")
    ];

    discriminatorValue:string
    $discriminatorValue=[
        MetaModel.description("The value of discriminator for the type.")
    ];

    type="object";
    $type=[MetaModel.hide()]

    $=[
        MetaModel.definingPropertyIsEnough("properties"),
        MetaModel.setsContextValue("field","true"),
        MetaModel.convertsToGlobalOfType("SchemaString")
        ,MetaModel.declaresSubTypeOf("TypeDeclaration")
    ]

}
//additionalProperties
//required should be handled with raml pointer in swagger for us required is placed inside at this moment (is this ok?)
//consider renaming fields to properties
//allOf (I prefer using extends)
//discriminator (it is pretty primitive in swagger,we can do it better)
//format (it is nice place to plug scripting in as well as scripting in general)


export class StringTypeDeclaration extends TypeDeclaration{
    pattern:string;
    $pattern=[
        MetaModel.facetId("pattern"),
        MetaModel.description("Regular expression that this string should path"),
        MetaModel.valueDescription("regexp")
    ]
    minLength:number
    $minLength=[
        MetaModel.facetId("minLength"),
        //MetaModel.thisFeatureCovers("https://github.com/raml-org/raml-spec/issues/141"),
        MetaModel.description("Minimum length of the string")]
    maxLength:number
    $maxLength=[
        MetaModel.facetId("maxLength"),
        MetaModel.description("Maximum length of the string")]
    type="string"
    $=[MetaModel.description("Value must be a string"),MetaModel.declaresSubTypeOf("TypeDeclaration")]
    enum:string[]
    $enum=[
        MetaModel.describesAnnotation("oneOf"),
        MetaModel.description("(Optional, applicable only for parameters of type string) The enum attribute provides an enumeration of the parameter's valid values. This MUST be an array. If the enum attribute is defined, API clients and servers MUST verify that a parameter's value matches a value in the enum array. If there is no matching value, the clients and servers MUST treat this as an error."),
        MetaModel.hide()
    ]



}
//export class WrappedJSON extends TypeDeclaration{
//    $=[MetaModel.declaresSubTypeOf("TypeDeclaration")]
//    type="jsonstring"
//    schema:Sys.SchemaString;
//    $schema=[MetaModel.description("Allows to provide schema of the content in case if it is json or xml"),MetaModel.version(MetaModel.RAMLVersion.RAML10)]
//
//}
//export class WrappedXML extends TypeDeclaration{
//    $=[MetaModel.declaresSubTypeOf("TypeDeclaration")]
//
//    type="xmlstring"
//    schema:Sys.SchemaString;
//    $schema=[MetaModel.description("Allows to provide schema of the content in case if it is json or xml"),MetaModel.version(MetaModel.RAMLVersion.RAML10)]
//
//}
export class BooleanTypeDeclaration extends TypeDeclaration{
    type="boolean"
    $=[MetaModel.description("Value must be a boolean"),MetaModel.declaresSubTypeOf("TypeDeclaration")]



}
export class ValueTypeDeclaration extends TypeDeclaration{
    type="value"
    $=[MetaModel.description("Value must be a boolean"),MetaModel.declaresSubTypeOf("TypeDeclaration")]



}
export class NumberTypeDeclaration extends TypeDeclaration{
    type="number"
    minimum:number
    $minimum=[MetaModel.facetId("minimum"),MetaModel.description("(Optional, applicable only for parameters of type number or integer) The minimum attribute specifies the parameter's minimum value.")]
    maximum:number
    $maximum=[MetaModel.facetId("maximum"),MetaModel.description("(Optional, applicable only for parameters of type number or integer) The maximum attribute specifies the parameter's maximum value.")]

    $=[MetaModel.description("Value MUST be a number. Indicate floating point numbers as defined by YAML."),MetaModel.declaresSubTypeOf("TypeDeclaration")]
    enum:string[]
    $enum=[
        MetaModel.describesAnnotation("oneOf"),
        MetaModel.description("(Optional, applicable only for parameters of type string) The enum attribute provides an enumeration of the parameter's valid values. This MUST be an array. If the enum attribute is defined, API clients and servers MUST verify that a parameter's value matches a value in the enum array. If there is no matching value, the clients and servers MUST treat this as an error."),
        MetaModel.hide()
    ]

    format:string
    $format=[
        MetaModel.oneOf(["int32","int64","int","long","float","double","int16","int8"]),
        MetaModel.description("Value format")
    ];

    multipleOf:number
    $multipleOf=[MetaModel.description('A numeric instance is valid against "multipleOf" if the result of the division of the instance by this keyword\'s value is an integer.')]

}
export class IntegerTypeDeclaration extends NumberTypeDeclaration{
    type="integer"
    $=[MetaModel.description("Value MUST be a integer."),MetaModel.declaresSubTypeOf("TypeDeclaration")]
    format:string
    $format=[MetaModel.oneOf(["int32","int64","int","long","int16","int8"])];


}
export class RAMLPointerElement extends TypeDeclaration{
    type="pointer"
    target:Sys.RAMLSelector
    $=[MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE)]
}
export class pointer extends Sys.ValueType{}

export class RAMLExpression extends TypeDeclaration{
    type="ramlexpression"
    $=[MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE),MetaModel.requireValue("location",ModelLocation.ANNOTATION)]
}


export class ScriptHookElement extends TypeDeclaration{
    $=[MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE),MetaModel.requireValue("location",ModelLocation.ANNOTATION)]

    type="script"
    declaredIn: string
    $declaredIn=[MetaModel.description("Typescript file defining interface which this scrip should comply to")]
    interfaceName: string
    $interfaceName=[MetaModel.description("Name of the interface which scripts should comply to")]
}

export class SchemaElement extends TypeDeclaration{
    $=[MetaModel.requireValue("locationKind",LocationKind.APISTRUCTURE),MetaModel.nameAtRuntime("SchemaString")]
    type="schema"

}

export class DateTypeDeclaration extends TypeDeclaration{
    type="date"
    $=[MetaModel.description("Value MUST be a string representation of a date as defined in RFC3339 or according to specified date format"),MetaModel.declaresSubTypeOf("TypeDeclaration")]
    dateFormat:Sys.DateFormatSpec;
}
