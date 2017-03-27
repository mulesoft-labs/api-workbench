/// <reference path="../../../typings/main.d.ts" />

import Atom = require('atom')
import marked = require('marked')
import React = require('react')
import extend = require('xtend')
import classnames = require('classnames')
import arrify = require('arrify')
import PureComponent = require('react-pure-render/component')
import pretty = require('pretty-data')
import rp=require("raml-1-parser")
import wrapperHelper=rp.wrapperHelper;
import lowLevelAst=rp.ll;
import highLevelAst=rp.hl;
import RamlWrapper1=rp.api10;
import RamlWrapper08=rp.api08;
import atomUtil = require('../util/atom')



var services = rp.ds;

import ConsoleView = require('./console-view')
import {BasicNode} from "raml-1-parser/dist/raml1/wrapped-ast/parserCoreApi";

//TODO consider moving this set of types into a parser, might be useful for other parser users.
//Another (better) option is to extract superinterfaces from both API hierarchies instead
type RamlApi = RamlWrapper1.Api | RamlWrapper08.Api;
type RamlMethod = RamlWrapper1.Method | RamlWrapper08.Method;
type RamlTrait = RamlWrapper1.Trait | RamlWrapper08.Trait;
type RamlResourceBase = RamlWrapper1.ResourceBase | RamlWrapper08.Resource | RamlWrapper08.ResourceType;
type RamlResourceType = RamlWrapper1.ResourceType | RamlWrapper08.ResourceType;
type RamlAbstractSecurityScheme = RamlWrapper1.AbstractSecurityScheme | RamlWrapper08.AbstractSecurityScheme;
type RamlResource = RamlWrapper1.Resource | RamlWrapper08.Resource;
type RamlDocumentationItem = RamlWrapper1.DocumentationItem | RamlWrapper08.DocumentationItem;
type RamlMethodBase = RamlWrapper1.MethodBase | RamlWrapper08.MethodBase;
type RamlMarkdownString = RamlWrapper1.MarkdownString | RamlWrapper08.MarkdownString;
type RamlTypeOrParameter = RamlWrapper1.TypeDeclaration | RamlWrapper08.Parameter;
type RamlFileTypeDeclaration = RamlWrapper1.FileTypeDeclaration | RamlWrapper08.FileTypeDeclaration;
type RamlIntegerTypeDeclaration = RamlWrapper1.IntegerTypeDeclaration | RamlWrapper08.IntegerTypeDeclaration;
type RamlBody = RamlWrapper1.TypeDeclaration | RamlWrapper08.BodyLike;
type RamlResponse = RamlWrapper1.Response | RamlWrapper08.Response;
type RamlSecuritySchemeRef = RamlWrapper1.SecuritySchemeRef | RamlWrapper08.SecuritySchemeRef;
type RamlTraitRef = RamlWrapper1.TraitRef | RamlWrapper08.TraitRef;

var BULLET_TEXT = '\u00b7'

var METHOD_CLASS_MAP = {
  'get': 'btn-primary',
  'get?': 'btn-primary',
  'post': 'btn-success',
  'post?': 'btn-success',
  'delete': 'btn-error',
  'delete?': 'btn-error',
  'put': 'btn-warning',
  'put?': 'btn-warning',
  'patch': 'btn-info',
  'patch?': 'btn-info'
}

type SetStateFn = (state: ConsoleView.ConsoleState) => void
type NavigateFn = (id: string | ConsoleView.ViewState) => void
type SetParameterFn = (group: string, name: string, value: string) => void

export interface ConsoleProps {
  raml: RamlApi
  loaded: boolean
  state: ConsoleView.ConsoleState
  pageState: ConsoleView.ConsolePageState
  setState: SetStateFn
  setParameter: SetParameterFn
  navigate: NavigateFn
  errors: Error[]
  execRequest: () => void
}

export interface NodeProps <T> extends ConsoleProps {
  node: T
}


//Methods moved to the parser as: 1) Custom type guards like isApi() for each node interface and 2) RAMLVersion() method for each node.
//
// /**
//  * Returns whether the node is instance of interface by interface name.
//  * DOES NOT CHECK SUPER INTERFACES!
//  * @param node
//  * @param interfaceShortName - interface name, does not include namespace.
//  * @param ramlVersion - optionally also checks if node belongs to "RAML10" or "RAML08" RAML.
//  * @returns {boolean}
//  */
// function nodeInstanceOf(node : core.BasicNode, interfaceShortName : string, ramlVersion? : string) : boolean {
//   var nodeKind = node.kind();
//
//   if (nodeKind != interfaceShortName) return false;
//
//   if (ramlVersion) {
//     if (ramlVersion != nodeRAMLVersion(node)) return false;
//   }
//
//   return true;
// }
//
// function nodeInstanceOf10(node : core.BasicNode, interfaceShortName : string) {
//   return nodeInstanceOf(node, interfaceShortName, "RAML10");
// }
//
// function nodeInstanceOf08(node : core.BasicNode, interfaceShortName : string) {
//   return nodeInstanceOf(node, interfaceShortName, "RAML08");
// }
//
// /**
//  * Returns node version.
//  * @param node
//  * @returns {string} : "RAML10" for RAML 1.0 and "RAML08" for RAML 0.8
//  */
// function nodeRAMLVersion(node : core.BasicNode) : string {
//   return node.highLevel().definition().universe().version();
// }
//
function isRAML10(node : highLevelAst.AbstractWrapperNode) : boolean {
  return node.RAMLVersion() == "RAML10";
}

function isRAML08(node : highLevelAst.AbstractWrapperNode) : boolean {
  return node.RAMLVersion() == "RAML08";
}

export class Console extends PureComponent<ConsoleProps, any> {

  isSupportedNode (node: any) {

    return !(
      RamlWrapper1.isObjectTypeDeclaration(node) ||
      RamlWrapper1.isResponse(node) ||
      RamlWrapper1.isTypeDeclaration(node) ||
      RamlWrapper1.isLibrary(node) ||
      RamlWrapper1.isSecuritySchemePart(node) ||
      RamlWrapper1.isOAuth1SecurityScheme(node) ||
      RamlWrapper1.isOAuth2SecurityScheme(node) ||
      RamlWrapper08.isResponse(node) ||
      RamlWrapper08.isSecuritySchemePart(node) ||
      RamlWrapper08.isOAuth1SecurityScheme(node) ||
      RamlWrapper08.isOAuth2SecurityScheme(node));
  }

  renderNode (node: highLevelAst.BasicNode) {
    var props = <NodeProps<any>> extend(this.props, { node })

    if (RamlWrapper1.isTrait(node) ||
        RamlWrapper08.isTrait(node)) {

      return React.createElement(Trait, props)
    }

    if (RamlWrapper1.isResourceType(node) ||
        RamlWrapper08.isResourceType(node)) {

      return React.createElement(ResourceType, props)
    }

    if (RamlWrapper1.isAbstractSecurityScheme(node) ||
        RamlWrapper08.isAbstractSecurityScheme(node) ||
        RamlWrapper1.isOAuth1SecurityScheme(node) ||
        RamlWrapper08.isOAuth1SecurityScheme(node) ||
        RamlWrapper1.isOAuth2SecurityScheme(node) ||
        RamlWrapper08.isOAuth2SecurityScheme(node)) {

      return React.createElement(SecurityScheme, props)
    }

    if (RamlWrapper1.isResource(node) ||
        RamlWrapper08.isResource(node)) {

      return React.createElement(Resource, props)
    }

    if (RamlWrapper1.isDocumentationItem(node) ||
        RamlWrapper08.isDocumentationItem(node)) {

      return React.createElement(Documentation, props)
    }

    if (RamlWrapper1.isMethod(node) || RamlWrapper08.isMethod(node)) {

      return React.createElement(Method, props)
    }

    if (RamlWrapper1.isApi(node) || RamlWrapper08.isApi(node) ||
        RamlWrapper1.isExtension(node) || RamlWrapper1.isOverlay(node)) {

      return React.createElement(Root, props)
    }

    // Psuedo "404" in case a view isn't implemented.
    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { title: '404' }),
      React.createElement(
        Block,
        null,
        'How did you get here? You shouldn\'t be here! Please ',
        React.createElement('a', {
          href: 'https://github.com/mulesoft/api-workbench/issues'
        }, 'report me'),
        '.'
      ),
      React.createElement(
        Block,
        null,
        React.createElement('strong', null, `Reference: ${node.wrapperClassName()}`)
      )
    )
  }

  renderBreadcrumb (node: highLevelAst.IHighLevelNode | highLevelAst.IAttribute, renderedNode?: highLevelAst.BasicNode) {
    var parts = []
    var nodes: Array<highLevelAst.IHighLevelNode | highLevelAst.IAttribute> = []
    var currentNode = node

    // Render "Errors" as a breadcrumb.
    if (this.props.errors.length) {
      parts.push(React.createElement('span', { key: 'errors' }, 'Errors'))
    } else {
      do {
        nodes.unshift(currentNode)
      } while (currentNode = currentNode.parent())

      nodes.forEach((node, index) => {
        var lastNode = index === nodes.length - 1

        if (
          node.getKind() === highLevelAst.NodeKind.NODE &&
          this.isSupportedNode((<highLevelAst.IHighLevelNode> node).wrapperNode()) &&
          (<highLevelAst.IHighLevelNode> node).wrapperNode() !== renderedNode
        ) {
          parts.push(React.createElement(
            'a',
            {
              key: node.id(),
              onClick: () => this.props.navigate(node.id())
            },
            getNodeLabel(node)
          ))
        } else {
          parts.push(React.createElement(
            'span',
            { key: `value${index}` },
            getNodeLabel(node)
          ))
        }

        if (!lastNode) {
          parts.push(React.createElement('span', { key: `sep${index}` }, ` ${BULLET_TEXT} `))
        }
      })
    }

    return React.createElement(
      Block,
      { className: 'padded', style: { margin: 0, flex: '0 0 auto' } },
      parts
    )
  }

  getCurrentNode (): highLevelAst.IAttribute | highLevelAst.IHighLevelNode {
    var raml = this.props.raml
    var state = this.props.state

    if (!raml) {
      return null
    }

    if (state.view.id) {
      var idNode = raml.highLevel().findById(state.view.id)

      if (idNode) {
        return idNode
      }
    }

    return raml.highLevel()
  }

  wrapBody (element: any) {
    return React.createElement(
      Block,
      {
        id: 'raml-console-view',
        className: 'padded',
        style: {
          overflow: 'auto',
          height: '100%'
        }
      },
      element
    )
  }

  wrapContent (breadcrumb: any, element: any) {
    return React.createElement(
      Block,
      { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
      breadcrumb,
      this.wrapBody(element)
    )
  }

  render () {
    if (!this.props.loaded) {
      return React.createElement(Loading)
    }

    var highLevelNode = this.getCurrentNode()
    if (!highLevelNode) {
      return React.createElement(
          Block,
          null,
          React.createElement(TitleText, { title: 'Unsupported fragment' }),
          React.createElement(
              Block,
              null,
              'This type of fragment is not supported. Only APIs, Overlays and Extensions can be displayed.'
          )
      )
    }


    var node: highLevelAst.BasicNode

    if (this.props.errors.length) {
      return this.wrapBody(React.createElement(Errors, { errors: this.props.errors }))
    }

    if (!highLevelNode.isElement()) {
      var referencedNode = (<highLevelAst.IAttribute> highLevelNode).findReferencedValue()

      if (!referencedNode) {
        return this.wrapContent(
          this.renderBreadcrumb(highLevelNode),
          React.createElement(MissingReference, extend(this.props, { highLevelNode }))
        )
      }

      node = referencedNode.wrapperNode()
    } else {
      node = (<highLevelAst.IHighLevelNode> highLevelNode).wrapperNode()
    }

    // Traverse upwards to rendered nodes.
    while (!this.isSupportedNode(node)) {
      node = node.parent()
    }

    return this.wrapContent(
      this.renderBreadcrumb(highLevelNode, node),
      this.renderNode(node)
    )
  }

}

class Errors extends PureComponent<{ errors: Error[] }, {}> {

  render () {
    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { title: 'Errors' }),
      React.createElement(
        'ul',
        null,
        this.props.errors.map((error, index) => {
          // TODO(blakeembrey): Use `error.mark` to open text editor to issue.
          return React.createElement(
            'li',
            { key: index },
            error.message
          )
        })
      )
    )
  }

}

class Root extends PureComponent<NodeProps<RamlApi>, {}> {

  render () {
    var raml = this.props.node

    return React.createElement(
      'div',
      null,
      React.createElement(TitleText, { title: raml.title() }),
      React.createElement(ResourceTypesAndTraits, this.props),
      raml.documentation().length ? React.createElement(
        InsetPanel,
        null,
        React.createElement(
          'h3',
          { style: { marginTop: 0 } },
          'Documentation'
        ),
        React.createElement(
          'ul',
          null,
          raml.documentation().map(documentation => {
            var id = documentation.highLevel().id()

            return React.createElement(
              'li',
              { key: id },
              React.createElement(
                'a',
                { onClick: () => this.props.navigate(id) },
                documentation.title()
              )
            )
          })
        )
      ) : null,
      React.createElement(ResourceChildren, this.props)
    )
  }

}

class MethodButton extends PureComponent<{ key: string; method: RamlMethod; navigate: NavigateFn }, {}> {

  render () {
    var verb = this.props.method.method()

    return React.createElement(
      'div',
      {
        onClick: () => this.props.navigate(this.props.method.highLevel().id()),
        className: classnames('btn inline-block', METHOD_CLASS_MAP[verb])
      },
      verb.toUpperCase()
    )
  }

}

class MissingReference extends PureComponent<{ highLevelNode: highLevelAst.IHighLevelNode }, {}> {

  render () {
    var node = this.props.highLevelNode

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { title: 'Missing Reference' }),
      'Unable to resolve reference: ',
      React.createElement('strong', null, node.id())
    )
  }

}

// class GlobalSchema extends PureComponent<NodeProps<RamlWrapper1.GlobalSchema>, {}> {
//
//   render () {
//     var node = this.props.node
//
//     return React.createElement(
//       Block,
//       null,
//       React.createElement(TitleText, { node, title: node.key(), type: 'Schema' }),
//       React.createElement(Markup, { content: node.value().value(), setState: this.props.setState, state: this.props.state })
//     )
//   }
//
// }

class Loading extends PureComponent<{}, {}> {

  render () {
    return React.createElement(
      Block,
      null,
      React.createElement(
        'div',
        {
          className: 'loading-spinner-medium inline-block'
        }
      ),
      React.createElement(
        'span',
        {
          className: 'inline-block'
        },
        'Loading RAML\u2026'
      )
    )
  }

}

class Trait extends PureComponent<NodeProps<RamlTrait>, {}> {

  render () {
    var node = this.props.node
    var references = node.highLevel().findReferences()

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.name(), type: 'Trait' }),
      React.createElement(SimpleText, { text: node.usage(), title: 'Usage' }),
      React.createElement(AbstractMethod, this.props),
      React.createElement(References, { references, navigate: this.props.navigate })
    )
  }

}

class TitleText extends PureComponent<{ title: string; type?: string; node: highLevelAst.BasicNode }, {}> {

  render () {
    var title = this.props.title

    return React.createElement(
      'h1',
      { style: { marginTop: 0 } },
      this.props.node ? React.createElement(OpenInEditor, { node: this.props.node }, title) : title,
      this.props.type ? React.createElement('small', null, ` (${this.props.type})`) : null
    )
  }

}

class SimpleText extends PureComponent<{ text: string; title: string }, {}> {

  render () {
    var text = this.props.text

    if (!text) {
      return null
    }

    return React.createElement(
      Block,
      null,
      React.createElement('strong', null, `${this.props.title}: `),
      text
    )
  }

}

class References extends PureComponent<{ references: highLevelAst.IHighLevelNode[]; navigate: NavigateFn }, {}> {

  formatNode (node: highLevelAst.IHighLevelNode): string {
    var parts = []

    do {
      parts.unshift(getNodeLabel(node))
    } while (node = node.parent())

    return parts.join(` ${BULLET_TEXT} `)
  }

  render () {
    var references = this.props.references

    if (!references.length) {
      return null
    }

    return React.createElement(
      InsetPanel,
      null,
      React.createElement(
        'h3',
        null,
        `References (${references.length} Found)`
      ),
      React.createElement(
        'ul',
        null,
        references.map(reference => {
          var id = reference.id()
          var parent = reference.parent()

          return React.createElement(
            'li',
            { key: id },
            React.createElement(
              'a',
              { onClick: () => this.props.navigate(parent.id()) },
              this.formatNode(parent)
            )
          )
        })
      )
    )
  }

}

class AbstractResource extends PureComponent<NodeProps<RamlResourceBase>, {}> {

  render () {
    var node = this.props.node
    var navigate = this.props.navigate
    var methods : RamlMethod[] = node.methods()
    var uriParameters = node.uriParameters()

    return React.createElement(
      Block,
      null,
      React.createElement(ResourceTypesAndTraits, this.props),
      React.createElement(MarkdownBlock, { content: (node.description()?node.description().value():null) }),
      methods.length ? React.createElement(
        Block,
        null,
        methods.map(method => React.createElement(MethodButton, { key: method.method(), method, navigate: this.props.navigate }))
      ) : null,
      React.createElement(ParametersBlock, { parameters: uriParameters, title: 'URI Parameters', navigate })
    )
  }

}

class ResourceType extends PureComponent<NodeProps<RamlResourceType>, {}> {

  render () {
    var node = this.props.node
    var references = node.highLevel().findReferences()

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.name(), type: 'Resource Type' }),
      React.createElement(SimpleText, { text: node.usage(), title: 'Usage' }),
      React.createElement(AbstractResource, this.props),
      React.createElement(References, { references, navigate: this.props.navigate })
    )
  }

}

class SecurityScheme extends PureComponent<NodeProps<RamlAbstractSecurityScheme>, {}> {

  render () {
    var node = this.props.node
    var references = node.highLevel().findReferences()

    // TODO(blakeembrey): Render `settings`.

    var displayName = "";
    if (isRAML08(node)) {
      displayName = node.name();
    } else {
      displayName = (<RamlWrapper1.AbstractSecurityScheme> node).displayName();
    }

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.name(), type: 'Security Scheme' }),
      React.createElement(SimpleText, { title: 'Type', text: node.type() }),
      React.createElement(SimpleText, { title: 'Display Name', text: displayName }),
      React.createElement(MarkdownBlock, { content: (node.description()?node.description().value():null)}),
      React.createElement(AbstractMethod, extend(this.props, { node: node.describedBy() })),
      React.createElement(References, { references, navigate: this.props.navigate })
    )
  }

}

class Resource extends PureComponent<NodeProps<RamlResource>, {}> {

  render () {
    var node = this.props.node

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.relativeUri().value(), type: 'Resource' }),
      React.createElement(AbstractResource, this.props),
      React.createElement(ResourceChildren, this.props)
    )
  }

}

class ParameterInfo extends PureComponent<{ node: RamlWrapper08.Parameter }, {}> {
  render () {
    var node = this.props.node

    if (node == null) {
      return null
    }

    var nodeType = node.type();
    if (!nodeType) nodeType = "string";

    return React.createElement(
        Block,
        null,
        React.createElement(
            Block,
            null,
            React.createElement('span', {
                key: nodeType,
                className: 'highlight',
                style: { marginRight: 5 }
            }, nodeType)
        )
    )
  }
}

class TypeInfo extends PureComponent<{ node: RamlWrapper1.TypeDeclaration }, {}> {

  hasNamedSuperTypes(type : highLevelAst.ITypeDefinition) : boolean {
    var superTypes = type.superTypes();
    if (!superTypes) return false;

    var namedTypeFound = false;
    superTypes.forEach(superType=>{
      if (superType.nameId() && superType.nameId().indexOf("application/") != 0) namedTypeFound = true;
    })

    return namedTypeFound;
  }

  renderDefinition (definition: highLevelAst.ITypeDefinition, renderNameId: boolean) {
    return React.createElement(
      Block,
      null,
      // TODO(blakeembrey): Fix `renderNameId` check, currently hacky because
      // the media type is being printed out sometimes.
      renderNameId ? React.createElement(
        Block,
        null,
        React.createElement('span', {
          className: 'highlight'
        }, definition.nameId())
      ) : null,
      this.hasNamedSuperTypes(definition) ? React.createElement(
        Block,
        null,
        React.createElement(
          Block,
          null,
          React.createElement('strong', null, 'Super Types:')
        ),
        definition.superTypes().map(x => {
          return React.createElement(
            'span',
            {
              className: 'highlight',
              style: { marginRight: 5 }
            },
            x.nameId()
          )
        })
      ) : null,
      definition.allProperties().length ? React.createElement(
        Block,
        null,
        React.createElement('h5', null, 'Properties'),
        definition.allProperties().map(property => {
          return React.createElement(
            Block,
            { key: property.nameId() },
            React.createElement(
              Block,
              null,
              React.createElement('strong', null, property.nameId()),
              property.isRequired() ? ' (required)' : ''
            ),
            React.createElement(
              Block,
              null,
              property.description()
            )
          )
        })
      ) : null,
      definition.hasUnionInHierarchy() ? React.createElement(
        Block,
        null,
        React.createElement(
          Block,
          null,
          React.createElement('strong', null, 'Left: ')
        ),
        this.renderDefinition(definition.unionInHierarchy().leftType(), true),
        React.createElement(
          Block,
          null,
          React.createElement('strong', null, 'Right: ')
        ),
        this.renderDefinition(definition.unionInHierarchy().rightType(), true)
      ) : null,
      definition.hasArrayInHierarchy() ? React.createElement(
        Block,
        null,
        React.createElement(
          Block,
          null,
          React.createElement('strong', null, 'Item: ')
        ),
        this.renderDefinition(definition.arrayInHierarchy().componentType(), true)
      ) : null
    )
  }

  render () {
    var node = this.props.node

    // Array items can be `null`.
    if (node == null) {
      return null
    }

    var definition = node.runtimeDefinition();
    if (definition && definition.hasGenuineUserDefinedTypeInHierarchy()
      && !definition.isGenuineUserDefinedType()) {
      
      definition = definition.genuineUserDefinedTypeInHierarchy();
    }

    return React.createElement(
      Block,
      null,
      typeof node.type === 'function' ? React.createElement(
        Block,
        null,
          (node.type() || []).map(type => {
          return React.createElement('span', {
            key: type,
            className: 'highlight',
            style: { marginRight: 5 }
          }, type)
        })
      ) : null,
      this.renderDefinition(definition, false)
    )
  }

}

class ParametersBlock extends PureComponent<{
  parameters: RamlTypeOrParameter[] ;
  title: string; navigate: NavigateFn }, {}> {

  summary (param: RamlTypeOrParameter) {
    var parts = []

    if (RamlWrapper1.isFileTypeDeclaration(param)/*param.wrapperClassName() === 'FileTypeDeclarationImpl'*/) {

      if (param.fileTypes()) {
        parts.push(`fileTypes: ${param.fileTypes()}`)
      }

      if (param.minLength()) {
        parts.push(`minLength: ${param.minLength()}`)
      }

      if (param.maxLength()) {
        parts.push(`maxLength: ${param.maxLength()}`)
      }
    }

    if (RamlWrapper1.isIntegerTypeDeclaration(param)/*param.wrapperClassName() === 'IntegerTypeDeclarationImpl'*/) {

      if (param.minimum() != null) {
        parts.push(`minimum: ${param.minimum()}`)
      }

      if (param.maximum() != null) {
        parts.push(`maximum: ${param.maximum()}`)
      }
    }

    if (param.required()) {
      parts.push('required')
    }

    return parts.join(', ')
  }

  render () {
    if (!this.props.parameters.length) {
      return null
    }

    var navigate = this.props.navigate

    return React.createElement(
      Block,
      null,
      React.createElement('h3', null, this.props.title),
        this.props.parameters.map(parameter => {
        return React.createElement(
          Block,
          { key: parameter.name() },
          React.createElement(
            'h4',
            null,
            React.createElement(OpenInEditor, { node: parameter }, parameter.name())
          ),
          React.createElement(
              isRAML10(parameter)?TypeInfo:ParameterInfo, { node: parameter }
          ),
          React.createElement(
            Block,
            null,
            React.createElement('strong', null, this.summary(parameter))
          ),
          React.createElement(MarkdownBlock, { content: (parameter.description()?parameter.description().value():null) })
        )
      })
    )
  }

}

class ResourceChildren extends PureComponent<NodeProps<{ resources: () => RamlResource[] }>, {}> {

  render () {
    var node = this.props.node

    return React.createElement(
      Block,
      null,
      node.resources().map(resource => {
        var id = resource.highLevel().id()
        var children = resource.resources().length

        return React.createElement(
          InsetPanel,
          { key: id },
          React.createElement(
            'h4',
            null,
            React.createElement(OpenInEditor, { node: resource }, resource.completeRelativeUri()),
            ' ',
            children ? React.createElement(
              'small',
              null,
              React.createElement(
                'a',
                { onClick: () => this.props.navigate(id) },
                `View ${children} more ${plural(children, 'resource', 'resources')}`
              )
            ) : null
          ),
          React.createElement(MarkdownBlock, {
            content: (resource.description()?resource.description().value():null)
          }),
          React.createElement(
            Block,
            null,
              (<RamlMethod[]>resource.methods()).map(
                  method => React.createElement(MethodButton, { key: method.method(), method, navigate: this.props.navigate }))
          )
        )
      })
    )
  }

}

class Documentation extends PureComponent<NodeProps<RamlDocumentationItem>, {}> {

  render () {
    var node = this.props.node

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.title(), type: 'Documentation' }),
      React.createElement(MarkdownBlock, { content: (this.props.node.content()?this.props.node.content().value():null) })
    )
  }

}

class AbstractMethod extends PureComponent<NodeProps<RamlMethodBase>, {}> {

  renderBody (body: RamlBody) {
    // TODO(blakeembrey): Render more properties from `ObjectField`.

    var parts = [];

    //link to open body in the editor
    parts.push(React.createElement(
        'h4',
        null,
        React.createElement(OpenInEditor, {node: body}, body.name())
    ));

    //type block for 1.0 raml
    if (isRAML10(body)) {
      parts.push(
          React.createElement(TypeInfo, {node: body})
      );
    }

    //if there is schema, we render it
    //TODO for 1.0 case this should be replaced with external type rendering in TypeInfo
    var schemaPart = this.createSchemaPart(body);
    if (schemaPart) parts.push(schemaPart);

    //adding examples if available
    parts.push(this.createExampleParts(body));

    return React.createElement(
      Block, { key: body.name() }, parts
    )
  }

  exampleToString(example : RamlWrapper1.ExampleSpec) : string {
    var exampleValue = example.value();
    if (exampleValue == null) return null;

    if (typeof(exampleValue) == "string") {
      return <string> exampleValue;
    }

    return JSON.stringify(exampleValue, null, 2)
  }

  createExampleParts(body: RamlBody) : any[]{
    if (isRAML10(body)) {
      var bodyType = <RamlWrapper1.TypeDeclaration>body;

      var runtimeType = bodyType.runtimeType();

      if (runtimeType) {
        var examples = runtimeType.examples(true);
        if (examples && examples.length > 0) {
          return examples.map((example : highLevelAst.IExpandableExample) => {

            var exampleName = example.name()?example.name():"Example";
            var displayName = example.displayName()?example.displayName():exampleName;

            return React.createElement(<any>MarkupBlock, {
              key: displayName,
              content: example.asString(),
              title: "Example",
              name: exampleName,
              mime: (<RamlWrapper1.TypeDeclaration>body).name(),
              setState: this.props.setState,
              state: this.props.state
            })
          })
        }
      }

      // var singleExampleNode = bodyType.example();
      // var singleExampleContent = singleExampleNode?this.exampleToString(singleExampleNode):null;
      // if (singleExampleContent && singleExampleContent != "null" && typeof(singleExampleContent) == "string") {
      //   return [React.createElement(<any>MarkupBlock, {
      //     content: singleExampleContent,
      //     title: 'Example',
      //     mime: (<RamlWrapper1.TypeDeclaration>body).name(),
      //     setState: this.props.setState,
      //     state: this.props.state
      //   })]
      // }

    } else if (RamlWrapper08.isBodyLike(body)){

      var exampleNode : RamlWrapper08.ExampleString = body.example();
      if (!exampleNode) return [];

      var exampleContent = exampleNode.value();
      if (!exampleContent) return [];

      return [React.createElement(<any>MarkupBlock, {
            content: exampleContent,
            title: 'Example',
            mime: body.name(),
            setState: this.props.setState,
            state: this.props.state
          })]
    }

    return [];
  }

  createSchemaPart(body: RamlBody) {
    var schemaName = null;
    var schemaContent = null;

    if (RamlWrapper08.isBodyLike(body)) {
      schemaName = body.schema() ? body.schema().value() : "";

      //this is probably not an external scheme reference, but inplace schema.
      if (!schemaName || schemaName.indexOf("{") != -1 && schemaName.indexOf("}") != -1) schemaName = "";

      schemaContent = body.schemaContent();
    } else if (isRAML10(body)) {
      var bodyAsType = <RamlWrapper1.TypeDeclaration>body;
      if (body.runtimeType() && bodyAsType.runtimeType().hasExternalInHierarchy()) {
        var externalType = bodyAsType.runtimeType().externalInHierarchy();
        if (externalType) {
          schemaName = body.runtimeType().superTypes() != null && body.runtimeType().superTypes().length == 1 &&
              body.runtimeType().superTypes()[0].nameId();
          schemaContent = externalType.schema();
        }
      }
    }

    if (schemaContent) {

      return React.createElement(<any>MarkupBlock, {
            key: undefined,
            content: schemaContent,
            title: 'Schema',
            mime: body.name(),
            name: schemaName,
            setState: this.props.setState,
            state: this.props.state
          });
    }

    return null;
  }

  render () {
    var node = this.props.node
    var navigate = this.props.navigate

    if (!node) {
      return null
    }

    var methodBodies : RamlBody[] = node.body();

    return React.createElement(
      Block,
      null,
      React.createElement(MarkdownBlock, { content: (node.description()?node.description().value():null) }),
      node.queryParameters().length ? React.createElement(
        InsetPanel,
        null,
        React.createElement(ParametersBlock, {
          parameters: node.queryParameters(),
          title: 'Query Parameters',
          navigate
        })
      ) : null,
      React.createElement(ParametersBlock, {
        parameters: node.headers(),
        title: 'Headers',
        navigate
      }),
        methodBodies.length ? React.createElement(
        InsetPanel,
        null,
        React.createElement(
          'h3',
          null,
          'Body'
        ),
            methodBodies.map(body => this.renderBody(body))
      ) : null,
      node.responses().length ? React.createElement(
        InsetPanel,
        null,
        React.createElement(
          'h3',
          null,
          'Responses'
        ),
        (<RamlResponse[]>node.responses()).map(response => {
          return React.createElement(
            Block,
            { key: response.code().value() },
            React.createElement(
              'h4',
              null,
              React.createElement(OpenInEditor, { node: response.code() }, response.code().value())
            ),
            React.createElement(MarkdownBlock, { content: (response.description()?response.description().value():null) }),
            React.createElement(ParametersBlock, {
              parameters: response.headers(),
              title: 'Headers',
              navigate
            }),
            (<RamlBody[]>response.body()).map(body => this.renderBody(body))
          )
        })
      ) : null
    )
  }

}

class Method extends PureComponent<NodeProps<RamlMethod>, {}> {

  render () {
    var props = this.props
    var node = props.node
    var demo = props.state.view.demo
    var canDemo = node.parent().wrapperClassName() === 'ResourceImpl'

    return React.createElement(
      Block,
      null,
      React.createElement(TitleText, { node, title: node.method().toUpperCase(), type: 'Method' }),
      React.createElement(ResourceTypesAndTraits, props),
      canDemo ? React.createElement(
        Block,
        null,
        React.createElement(
          'div',
          {
            className: 'btn btn-primary',
            onClick: () => props.navigate({ demo: !demo })
          },
          demo ? 'Read Documentation' : 'Make an API Request'
        )
      ) : null,
      canDemo && demo ? React.createElement(MethodDemo, props) : React.createElement(AbstractMethod, props)
    )
  }

}

class MethodDemo extends PureComponent<NodeProps<RamlMethod>, {}> {

  render () {
    var node = this.props.node
    var method = node.method()
    var contentType = this.props.state.body
    var securityScheme = this.props.state.securityScheme
    var progress = this.props.pageState.requestProgress
    var bodies = (<RamlBody[]>node.body()).map(x => x.name())
    var securitySchemes = (<RamlSecuritySchemeRef[]>node.allSecuredBy()).map(x => x.securityScheme())
    var currentSecurityScheme = securitySchemes.filter(x => x != null && x.name() === securityScheme)[0]
        
    if(!this.props.state.bodies || Object.keys(this.props.state.bodies).length === 0) {
      this.props.state.bodies = {};

      (<RamlBody[]>node.body()).forEach((body: any) => {
        var name = body.name();
        
        var example = (body.example && body.example()) || (body.examples && body.examples() && body.examples()[0]);

        example && (this.props.state.bodies[name] = example.value());
      });
    }
    
    return React.createElement(
      Block,
      null,
      securitySchemes.length ? React.createElement(
        Block,
        null,
        React.createElement(
          'h3',
          null,
          'Security Scheme'
        ),
        React.createElement(
          Block,
          null,
          React.createElement(
            'select',
            {
              onChange: (e) => this.props.setState({ securityScheme: e.target.value }),
              className: 'form-control',
              value: securityScheme
            },
            securitySchemes.map(x => {
              var name = x != null ? x.name() : 'null'

              return React.createElement('option', { key: name, value: x == null ? '' : x.name() }, name)
            })
          )
        ),
        currentSecurityScheme ? React.createElement(
          Block,
          null,
          React.createElement(
            EditParameters,
            {
              title: undefined,
              prefix: `Security Scheme Query Parameter`,
              parameters: (currentSecurityScheme.describedBy() && currentSecurityScheme.describedBy().queryParameters()) || [],
              values: this.props.state.queryParameters,
              change: (name: string, value: string) => this.props.setParameter('queryParameters', name, value)
            }
          ),
          React.createElement(
            EditParameters,
            {
              title: undefined,
              prefix: `Security Scheme Header`,
              parameters: (currentSecurityScheme.describedBy() &&  currentSecurityScheme.describedBy().headers()) || [],
              values: this.props.state.headers,
              change: (name: string, value: string) => this.props.setParameter('headers', name, value)
            }
          )
        ) : null
      ) : null,
      React.createElement(
        EditParameters,
        {
          title: 'Base URI Parameters',
          prefix: undefined,
          parameters: node.ownerApi().allBaseUriParameters(),
          values: this.props.state.baseUriParameters,
          change: (name: string, value: string) => this.props.setParameter('baseUriParameters', name, value)
        }
      ),
      null,
      React.createElement(
        EditParameters,
        {
          title: 'URI Parameters',
          prefix: undefined,
          parameters: localParameters(<RamlResource>node.parent()),
          values: this.props.state.uriParameters,
          change: (name: string, value: string) => this.props.setParameter('uriParameters', name, value)
        }
      ),
      React.createElement(
        EditParameters,
        {
          title: 'Query Parameters',
          prefix: undefined,
          parameters: node.queryParameters(),
          values: this.props.state.queryParameters,
          change: (name: string, value: string) => this.props.setParameter('queryParameters', name, value)
        }
      ),
      React.createElement(
        EditParameters,
        {
          title: 'Headers',
          prefix: undefined,
          parameters: node.headers(),
          values: this.props.state.headers,
          change: (name: string, value: string) => this.props.setParameter('headers', name, value)
        }
      ),
      bodies.length ? React.createElement(
        Block,
        null,
        React.createElement(
          'h3',
          null,
          'Body'
        ),
        React.createElement(
          Block,
          null,
          React.createElement(
            'select',
            {
              onChange: (e) => this.props.setState({ body: e.target.value }),
              className: 'form-control',
              value: contentType || bodies[0]
            },
            bodies.map(x => React.createElement('option', { key: x }, x))
          )
        ),
        React.createElement(<any> TextEditor, {
          mini: false,
          value: this.props.state.bodies[contentType || bodies[0]],
          onChange: (body: string) => {
            return this.props.setParameter('bodies', contentType || bodies[0], body);
          }
        })
      ) : null,
      React.createElement(
        Block,
        null,
        React.createElement(
          'div',
          {
            className: classnames('btn inline-block', METHOD_CLASS_MAP[method]),
            onClick: () => {
              if(!this.props.state.body) {
                this.props.state.body = contentType || bodies[0];
              }
              
              return this.props.execRequest();
            }
          },
          method.toUpperCase()
        ),
        progress == null ? null : React.createElement('progress', {
          style: { marginLeft: 5 },
          className: 'inline-block',
          max: isNaN(progress) ? null : '1',
          value: isNaN(progress) ? null : String(progress)
        })
      ),
      React.createElement(Response, this.props)
    )
  }

}

class Response extends PureComponent<NodeProps<RamlMethod>, {}> {

  render () {
    var error = this.props.pageState.requestError
    var response = this.props.pageState.requestResponse

    if (error) {
      return React.createElement(
        Block,
        { className: 'text-error' },
        error
      )
    }

    if (response) {
      var mime = getCaseless(response.headers, 'content-type')

      // readonly: boolean
      // grammar: any
      // gutter: boolean
      // mini: boolean
      // value: string
      // placeholder: string
      // onChange: (value: string) => any

      return React.createElement(
        Block,
        null,
        React.createElement('h3', null, 'Response'),
        React.createElement(
          Block,
          null,
          React.createElement(
            'div',
            null,
            React.createElement('strong', null, 'Status Code: '),
            response.status
          ),
          React.createElement(
            'div',
            null,
            React.createElement('strong', null, 'Status Text: '),
            response.statusText
          ),
          React.createElement(
            'div',
            null,
            React.createElement('strong', null, 'URL: '),
            response.url
          )
        ),
        React.createElement(
          Block,
          null,
          React.createElement('h4', null, 'Headers'),
          React.createElement(
            Block,
            null,
            response.rawHeaders.map((value, index) => {
              if (index % 2 === 0) {
                return React.createElement('strong', { key: index }, `${value}: `)
              }

              return React.createElement(
                'span',
                { key: index },
                value,
                React.createElement('br')
              )
            })
          )
        ),
        response.body ? React.createElement(
          Block,
          null,
          React.createElement('h4', null, 'Body'),
          React.createElement(Markup, {
            content: <string> response.body,
            mime: <string> mime,
            setState: this.props.setState,
            state: this.props.state
          })
        ) : null
      )
    }

    return null
  }

}

interface EditParametersProps {
  title?: string
  prefix?: string
  parameters: RamlTypeOrParameter[]
  values: { [name: string]: string }
  change: (name: string, value: string) => any
}

class EditParameters extends PureComponent<EditParametersProps, {}> {

  render () {
    var values = this.props.values || {}
    var params = this.props.parameters

    if (!params.length) {
      return null
    }

    return React.createElement(
      Block,
      null,
      this.props.title ? React.createElement('h3', {
        className: 'sub-title'
      }, this.props.title) : null,
      params.map((parameter) => {
        var name = parameter.name()
        var input: React.ReactElement<any>
        var value = values[name]

        if(!value && value !== '') {
          var param = <any>parameter;
          
          if(param && param._node && param._node._prop && param._node._prop._groupName === rp.universes.Universe10.Api.properties.baseUriParameters.name) {
            if(name === rp.universes.Universe10.Api.properties.version.name) {
              values[name] = param._node.root().wrapperNode().version();
            }
          }

          var value = values[name];
        }

        var label = this.props.prefix == null ? name : `${this.props.prefix}: ${name}`

        input = React.createElement(<any> TextEditor, {
          mini: true,
          value: value,
          placeholder: parameter.default(),
          onChange: (value: string) => this.props.change(name, value)
        })
        
        return React.createElement(
          Block,
          { key: name },
          React.createElement('label', null, label, parameter.required() ? ' *' : ''),
          input
        )
      })
    )
  }

}

interface TextEditorProps {
  readonly?: boolean
  grammar?: any
  gutter?: boolean
  mini?: boolean
  value?: string
  placeholder?: string
  onChange?: (value: string) => any
}

class TextEditor extends PureComponent<TextEditorProps, {}> {

  disposable: AtomCore.Disposable
  editor: any

  componentDidMount () {
    var editor = this.editor = <any> document.createElement('atom-text-editor')

    this.updateModel(this.props)

    ;(<any> this.refs).container.getDOMNode().appendChild(editor)
  }

  updateModel (props: TextEditorProps) {
    var editor = this.editor
    var model = editor.getModel()
    
    this.cleanup()

    model.setMini(props.mini)
    model.setPlaceholderText(props.placeholder)
    model.setGrammar(props.grammar)
    model.setText(props.value || '')

    if (props.readonly) {
      editor.removeAttribute('tabindex')
    } else {
      editor.setAttribute('tabindex', '0')
    }

    if (props.gutter === false) {
      editor.setAttribute('gutter-hidden', '')
    } else {
      editor.removeAttribute('gutter-hidden')
    }

    if (props.onChange) {
      this.disposable = model.onDidChange(() => {
        var position = model.cursors[0].getBufferPosition();        
        
        props.onChange(model.getText())

        model.cursors[0].setBufferPosition(position);
      })
    }
  }

  cleanup () {
    if (this.disposable) {
      this.disposable.dispose()
      this.disposable = null
    }
  }

  componentWillUnmount () {
    this.cleanup()
  }

  componentDidUpdate () {
    this.updateModel(this.props)
  }

  render () {
    return React.createElement('div', { ref: 'container' })
  }

}

class MarkupBlock extends PureComponent<{ content: string; mime: string; title: string; name?: string; key?: string; setState: SetStateFn; state: ConsoleView.ConsoleState }, {}> {

  state = { visible: false }

  render () {
    if (!this.props.content) {
      return null
    }

    var visible = this.state.visible

    return React.createElement(
      Block,
      { key: this.props.key },
      React.createElement(
        'a',
        { onClick: () => this.setState({ visible: !visible }) },
        `${visible ? 'Hide' : 'Show'} ${this.props.title}`
      ),
      this.props.name ? ` (${this.props.name})` : null,
      visible ? React.createElement(
        'div',
        { style: { marginTop: 5 } },
        React.createElement(Markup, this.props)
      ) : null
    )
  }

}

class Markup extends PureComponent<{ content: string; mime?: string; setState: SetStateFn; state: ConsoleView.ConsoleState }, {}> {

  render () {
    var grammar = atomUtil.getGrammerFromMime(this.props.mime)
    var content = this.props.content
    var isXml = grammar.fileTypes.indexOf('xml') > -1 || isXML(content);
    var isJson = grammar.fileTypes.indexOf('json') > -1 || isJSON(content);
    var isCss = grammar.fileTypes.indexOf('css') > -1
    var canPrettify = isXml || isJson || isCss

    if (this.props.state.pretty) {
      try {
        if (isXml) {
          content = pretty.pd.xml(content)
        } else if (isJson) {
          content = pretty.pd.json(content)
        } else if (isCss) {
          content = pretty.pd.css(content)
        }
      } catch (e) {
        // Ignore errors when beautifying.
      }
    }

    return React.createElement(
      Block,
      null,
      React.createElement(<any> TextEditor, {
        value: content,
        grammar: grammar,
        readonly: true
      }),
      canPrettify ? React.createElement(
        Block,
        null,
        React.createElement(
          'label',
          null,
          React.createElement(
            'input',
            {
              type: 'checkbox',
              onChange: (e) => this.props.setState({ pretty: e.target.checked }),
              checked: this.props.state.pretty,
              style: { marginRight: 5 }
            }
          ),
          React.createElement(
            'span',
            null,
            'Pretty data'
          )
        )
      ) : null
    )
  }

}

class NavigateLabel extends PureComponent<{ title: string; node: any; navigate: NavigateFn }, {}> {

  getName (node: any) {
    var value = node.value()

    return typeof value === 'string' ? value : (<any> value).valueName()
  }

  render () {
    var node = this.props.node

    // Ignore empty node values.
    if (node.value() == null) {
      return null
    }

    var navigate = this.props.navigate
    var title = this.props.title
    var id = node.highLevel().id()

    return React.createElement(
      'span',
      {
        className: 'highlight',
        style: {
          margin: '0 5px 5px 0',
          cursor: 'pointer',
          display: 'inline-block'
        },
        onClick: () => navigate(id)
      },
      React.createElement('strong', null, `${title}: `),
      this.getName(node)
    )
  }

}

class ResourceTypesAndTraits extends PureComponent<NodeProps<RamlApi | RamlResourceBase | RamlMethodBase>, {}> {

  render () {
    var types:any = []
    var node = this.props.node
    var navigate = this.props.navigate

    if ((RamlWrapper1.isResource(node) || RamlWrapper08.isResource(node))
        && (<RamlResourceBase> node).type()) {

      types.push(React.createElement("NavigateLabel", { title: 'Type', key: 'type', node: (<RamlResourceBase> node).type(), navigate }))
    }

    if (RamlWrapper1.isResource(node) || RamlWrapper08.isResource(node)
        || RamlWrapper1.isMethod(node) || RamlWrapper08.isMethod(node)) {

      (<RamlTraitRef[]>(<RamlResource | RamlMethod> node).is()).forEach((is, index) => {
        types.push(React.createElement("NavigateLabel", { title: 'Trait', key: `is:${index}`, node: is, navigate }))
      })
    }

    (<RamlSecuritySchemeRef[]>node.securedBy()).forEach((securedBy, index) => {
      types.push(React.createElement("NavigateLabel", { title: 'Secured By', key: `securedBy:${index}`, node: securedBy, navigate }))
    })

    return React.createElement(Block, null, types)
  }

}

class Block extends PureComponent<any, {}> {

  render () {
    return React.createElement('div', extend(this.props, {
      className: classnames(this.props.className, 'block')
    }), this.props.children)
  }

}

class InsetPanel extends PureComponent<{ children: any; key: string }, {}> {

  render () {
    return React.createElement(
      Block,
      null,
      React.createElement(
        'atom-panel',
        null,
        React.createElement(
          'div',
          { className: 'padded' },
          this.props.children
        )
      )
    )
  }

}

class Icon extends PureComponent<{ name: string; className: any }, {}> {

  render () {
    return React.createElement('i', {
      className: classnames('icon icon-' + this.props.name,  this.props.className)
    })
  }

}

class OpenInEditor extends PureComponent<{ node: { highLevel: () => highLevelAst.IParseResult } }, {}> {

  openInEditor (node: lowLevelAst.ILowLevelASTNode) {
    var editors = atom.workspace.getTextEditors()
    var path = node.unit().absolutePath()
    var start = node.start()

    // TODO(blakeembrey): Review logic if atom/atom#9258 lands.

    function resolve (editor) {
      var position = editor.getBuffer().positionForCharacterIndex(start)

      editor.setCursorBufferPosition(position)
    }

    var split: string

    // Split is disabled for the console, just open it without any bells.
    if (atom.config.get('api-workbench.openConsoleInSplitPane')) {
      // Attempt to render onto the preferred side of the console.
      var panes = atom.workspace.getPanes()
      var activePane = atom.workspace.getActivePane()

      if (panes.length === 1) {
        split = 'left'
        activePane.splitLeft({})
      } else {
        split = activePane === panes[0] ? 'right' : 'left'
      }
    }

    atom.workspace.open(path, { searchAllPanes: true, split }).then(resolve)
  }

  render () {
    var lowLevel = this.props.node.highLevel().lowLevel()
    var hasUnit = lowLevel.unit() != null

    if (!hasUnit) {
      return React.createElement('span', null, (<any> this.props).children)
    }

    return React.createElement(
      'a',
      {
        onClick: () => this.openInEditor(lowLevel)
      },
      (<any> this.props).children
    )
  }

}

class MarkdownBlock extends PureComponent<{ content: string; key: string }, {}> {

  render () {
    var content = this.props.content

    if (content == null) {
      return null
    }

    return React.createElement(
      Block,
      { dangerouslySetInnerHTML: { __html: marked(content) } }
    )
  }

}

function plural (count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural
}

function getCaseless (obj: Object, key: string) {
  var keys = Object.keys(obj)
  var match = key.toLowerCase()

  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === match) {
      return obj[keys[i]]
    }
  }
}

function getNodeLabel (node: highLevelAst.IAttribute | highLevelAst.IHighLevelNode): string {
  var name = node.getKind() === highLevelAst.NodeKind.ATTRIBUTE ? node.value() : node.name()

  if (typeof name !== 'string') {
    name = (<any> name).valueName()
  }

  if (!name && node.getKind() === highLevelAst.NodeKind.NODE) {
    var wrapper = (<highLevelAst.IHighLevelNode> node).wrapperNode()

    if (RamlWrapper1.isDocumentationItem(wrapper) ||
        RamlWrapper08.isDocumentationItem(wrapper)) {
      return (<RamlDocumentationItem> wrapper).title()
    }

    if (RamlWrapper1.isApi(wrapper) || RamlWrapper08.isApi(wrapper) ||
        RamlWrapper1.isExtension(wrapper) || RamlWrapper1.isOverlay(wrapper)) {

      return 'Home'
    }
  }

  return name
}

function isXML(content: any): boolean {
  if(typeof content !== 'string') {
    return false;
  }

  var trimmed: string = content.trim();

  if(trimmed.length < 1) {
    return false;
  }

  if(trimmed.charAt(0) === "<" && trimmed.charAt(trimmed.length -1) === ">") {
    return true;
  }

  return false;
}

function isJSON(content: any): boolean {
  try {
    JSON.parse(content);

    return true;
  } catch(exception) {
    return false;
  }
}

function localParameters(node: RamlResource): RamlTypeOrParameter[] {
  var baseUriParams: string[] = (<any>node).ownerApi().baseUriParameters().map(param => param.name());
  
  return filter(node.absoluteUriParameters(), param => baseUriParams.indexOf(param.name()) < 0);
}

function filter(array: any[], condition: (element: any) => boolean): any[] {
  var result: any[] = [];

  array.forEach(element => condition(element) && result.push(element));

  return result;
}
