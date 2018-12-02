(function(){"use strict";var t=new Set("annotation-xml color-profile font-face font-face-src font-face-uri font-face-format font-face-name missing-glyph".split(" "));function e(e){var n=t.has(e);return e=/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/.test(e),!n&&e}function n(t){var e=t.isConnected;if(void 0!==e)return e;for(;t&&!(t.__CE_isImportDocument||t instanceof Document);)t=t.parentNode||(window.ShadowRoot&&t instanceof ShadowRoot?t.host:void 0);return!(!t||!(t.__CE_isImportDocument||t instanceof Document))}function o(t,e){for(;e&&e!==t&&!e.nextSibling;)e=e.parentNode;return e&&e!==t?e.nextSibling:null}function i(t,e,n){n=void 0===n?new Set:n;for(var r=t;r;){if(r.nodeType===Node.ELEMENT_NODE){var a=r;e(a);var l=a.localName;if("link"===l&&"import"===a.getAttribute("rel")){if((r=a.import)instanceof Node&&!n.has(r))for(n.add(r),r=r.firstChild;r;r=r.nextSibling)i(r,e,n);r=o(t,a);continue}if("template"===l){r=o(t,a);continue}if(a=a.__CE_shadowRoot)for(a=a.firstChild;a;a=a.nextSibling)i(a,e,n)}r=r.firstChild?r.firstChild:o(t,r)}}function r(t,e,n){t[e]=n}function a(){this.a=new Map,this.f=new Map,this.c=[],this.b=!1}function l(t,e){t.b=!0,t.c.push(e)}function c(t,e){t.b&&i(e,function(e){return s(t,e)})}function s(t,e){if(t.b&&!e.__CE_patched){e.__CE_patched=!0;for(var n=0;n<t.c.length;n++)t.c[n](e)}}function h(t,e){var n=[];for(i(e,function(t){return n.push(t)}),e=0;e<n.length;e++){var o=n[e];1===o.__CE_state?t.connectedCallback(o):f(t,o)}}function u(t,e){var n=[];for(i(e,function(t){return n.push(t)}),e=0;e<n.length;e++){var o=n[e];1===o.__CE_state&&t.disconnectedCallback(o)}}function p(t,e,n){var o=(n=void 0===n?{}:n).u||new Set,r=n.h||function(e){return f(t,e)},a=[];if(i(e,function(e){if("link"===e.localName&&"import"===e.getAttribute("rel")){var n=e.import;n instanceof Node&&(n.__CE_isImportDocument=!0,n.__CE_hasRegistry=!0),n&&"complete"===n.readyState?n.__CE_documentLoadHandled=!0:e.addEventListener("load",function(){var n=e.import;if(!n.__CE_documentLoadHandled){n.__CE_documentLoadHandled=!0;var i=new Set(o);i.delete(n),p(t,n,{u:i,h:r})}})}else a.push(e)},o),t.b)for(e=0;e<a.length;e++)s(t,a[e]);for(e=0;e<a.length;e++)r(a[e])}function f(t,e){if(void 0===e.__CE_state){var o=e.ownerDocument;if((o.defaultView||o.__CE_isImportDocument&&o.__CE_hasRegistry)&&(o=t.a.get(e.localName))){o.constructionStack.push(e);var i=o.constructorFunction;try{try{if(new i!==e)throw Error("The custom element constructor did not produce the element being upgraded.")}finally{o.constructionStack.pop()}}catch(t){throw e.__CE_state=2,t}if(e.__CE_state=1,e.__CE_definition=o,o.attributeChangedCallback)for(o=o.observedAttributes,i=0;i<o.length;i++){var r=o[i],a=e.getAttribute(r);null!==a&&t.attributeChangedCallback(e,r,null,a,null)}n(e)&&t.connectedCallback(e)}}}function d(t){var e=document;this.c=t,this.a=e,this.b=void 0,p(this.c,this.a),"loading"===this.a.readyState&&(this.b=new MutationObserver(this.f.bind(this)),this.b.observe(this.a,{childList:!0,subtree:!0}))}function m(t){t.b&&t.b.disconnect()}function w(t){if(t.a)throw Error("Already resolved.");t.a=void 0,t.b&&t.b(void 0)}function b(t){this.c=!1,this.a=t,this.j=new Map,this.f=function(t){return t()},this.b=!1,this.i=[],this.o=new d(t)}a.prototype.connectedCallback=function(t){var e=t.__CE_definition;e.connectedCallback&&e.connectedCallback.call(t)},a.prototype.disconnectedCallback=function(t){var e=t.__CE_definition;e.disconnectedCallback&&e.disconnectedCallback.call(t)},a.prototype.attributeChangedCallback=function(t,e,n,o,i){var r=t.__CE_definition;r.attributeChangedCallback&&-1<r.observedAttributes.indexOf(e)&&r.attributeChangedCallback.call(t,e,n,o,i)},d.prototype.f=function(t){var e=this.a.readyState;for("interactive"!==e&&"complete"!==e||m(this),e=0;e<t.length;e++)for(var n=t[e].addedNodes,o=0;o<n.length;o++)p(this.c,n[o])},b.prototype.l=function(t,n){var o,i,r,a=this;if(!(n instanceof Function))throw new TypeError("Custom element constructors must be functions.");if(!e(t))throw new SyntaxError("The element name '"+t+"' is not valid.");if(this.a.a.get(t))throw Error("A custom element with name '"+t+"' has already been defined.");if(this.c)throw Error("A custom element is already being defined.");this.c=!0;try{var l=function(t){var e=c[t];if(void 0!==e&&!(e instanceof Function))throw Error("The '"+t+"' callback must be a function.");return e},c=n.prototype;if(!(c instanceof Object))throw new TypeError("The custom element constructor's prototype is not an object.");var s=l("connectedCallback"),h=l("disconnectedCallback"),u=l("adoptedCallback"),d=l("attributeChangedCallback"),m=n.observedAttributes||[]}catch(t){return}finally{this.c=!1}n={localName:t,constructorFunction:n,connectedCallback:s,disconnectedCallback:h,adoptedCallback:u,attributeChangedCallback:d,observedAttributes:m,constructionStack:[]},o=this.a,i=t,r=n,o.a.set(i,r),o.f.set(r.constructorFunction,r),this.i.push(n),this.b||(this.b=!0,this.f(function(){return function(t){if(!1!==t.b){t.b=!1;for(var e=t.i,n=[],o=new Map,i=0;i<e.length;i++)o.set(e[i].localName,[]);for(p(t.a,document,{h:function(e){if(void 0===e.__CE_state){var i=e.localName,r=o.get(i);r?r.push(e):t.a.a.get(i)&&n.push(e)}}}),i=0;i<n.length;i++)f(t.a,n[i]);for(;0<e.length;){var r=e.shift();i=r.localName,r=o.get(r.localName);for(var a=0;a<r.length;a++)f(t.a,r[a]);(i=t.j.get(i))&&w(i)}}}(a)}))},b.prototype.h=function(t){p(this.a,t)},b.prototype.get=function(t){if(t=this.a.a.get(t))return t.constructorFunction},b.prototype.m=function(t){if(!e(t))return Promise.reject(new SyntaxError("'"+t+"' is not a valid custom element name."));var n=this.j.get(t);return n?n.c:(n=new function(){var t=this;this.b=this.a=void 0,this.c=new Promise(function(e){t.b=e,t.a&&e(t.a)})},this.j.set(t,n),this.a.a.get(t)&&!this.i.some(function(e){return e.localName===t})&&w(n),n.c)},b.prototype.s=function(t){m(this.o);var e=this.f;this.f=function(n){return t(function(){return e(n)})}},window.CustomElementRegistry=b,b.prototype.define=b.prototype.l,b.prototype.upgrade=b.prototype.h,b.prototype.get=b.prototype.get,b.prototype.whenDefined=b.prototype.m,b.prototype.polyfillWrapFlushCallback=b.prototype.s;var y=window.Document.prototype.createElement,g=window.Document.prototype.createElementNS,v=window.Document.prototype.importNode,E=window.Document.prototype.prepend,_=window.Document.prototype.append,C=window.DocumentFragment.prototype.prepend,N=window.DocumentFragment.prototype.append,S=window.Node.prototype.cloneNode,k=window.Node.prototype.appendChild,D=window.Node.prototype.insertBefore,T=window.Node.prototype.removeChild,A=window.Node.prototype.replaceChild,L=Object.getOwnPropertyDescriptor(window.Node.prototype,"textContent"),j=window.Element.prototype.attachShadow,M=Object.getOwnPropertyDescriptor(window.Element.prototype,"innerHTML"),H=window.Element.prototype.getAttribute,x=window.Element.prototype.setAttribute,O=window.Element.prototype.removeAttribute,F=window.Element.prototype.getAttributeNS,R=window.Element.prototype.setAttributeNS,P=window.Element.prototype.removeAttributeNS,W=window.Element.prototype.insertAdjacentElement,I=window.Element.prototype.insertAdjacentHTML,z=window.Element.prototype.prepend,B=window.Element.prototype.append,U=window.Element.prototype.before,V=window.Element.prototype.after,X=window.Element.prototype.replaceWith,$=window.Element.prototype.remove,q=window.HTMLElement,G=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,"innerHTML"),J=window.HTMLElement.prototype.insertAdjacentElement,K=window.HTMLElement.prototype.insertAdjacentHTML,Q=new function(){};function Y(t,e,o){function i(e){return function(o){for(var i=[],r=0;r<arguments.length;++r)i[r]=arguments[r];r=[];for(var a=[],l=0;l<i.length;l++){var c=i[l];if(c instanceof Element&&n(c)&&a.push(c),c instanceof DocumentFragment)for(c=c.firstChild;c;c=c.nextSibling)r.push(c);else r.push(c)}for(e.apply(this,i),i=0;i<a.length;i++)u(t,a[i]);if(n(this))for(i=0;i<r.length;i++)(a=r[i])instanceof Element&&h(t,a)}}void 0!==o.g&&(e.prepend=i(o.g)),void 0!==o.append&&(e.append=i(o.append))}var Z,tt,et=window.customElements;if(!et||et.forcePolyfill||"function"!=typeof et.define||"function"!=typeof et.get){var nt=new a;tt=nt,window.HTMLElement=function(){function t(){var t=this.constructor,e=tt.f.get(t);if(!e)throw Error("The custom element being constructed was not registered with `customElements`.");var n=e.constructionStack;if(0===n.length)return n=y.call(document,e.localName),Object.setPrototypeOf(n,t.prototype),n.__CE_state=1,n.__CE_definition=e,s(tt,n),n;var o=n[e=n.length-1];if(o===Q)throw Error("The HTMLElement constructor was either called reentrantly for this constructor or called multiple times.");return n[e]=Q,Object.setPrototypeOf(o,t.prototype),s(tt,o),o}return t.prototype=q.prototype,Object.defineProperty(t.prototype,"constructor",{writable:!0,configurable:!0,enumerable:!1,value:t}),t}(),Z=nt,r(Document.prototype,"createElement",function(t){if(this.__CE_hasRegistry){var e=Z.a.get(t);if(e)return new e.constructorFunction}return t=y.call(this,t),s(Z,t),t}),r(Document.prototype,"importNode",function(t,e){return t=v.call(this,t,!!e),this.__CE_hasRegistry?p(Z,t):c(Z,t),t}),r(Document.prototype,"createElementNS",function(t,e){if(this.__CE_hasRegistry&&(null===t||"http://www.w3.org/1999/xhtml"===t)){var n=Z.a.get(e);if(n)return new n.constructorFunction}return t=g.call(this,t,e),s(Z,t),t}),Y(Z,Document.prototype,{g:E,append:_}),Y(nt,DocumentFragment.prototype,{g:C,append:N}),function(){function t(t,o){Object.defineProperty(t,"textContent",{enumerable:o.enumerable,configurable:!0,get:o.get,set:function(t){if(this.nodeType===Node.TEXT_NODE)o.set.call(this,t);else{var i=void 0;if(this.firstChild){var r=this.childNodes,a=r.length;if(0<a&&n(this)){i=Array(a);for(var l=0;l<a;l++)i[l]=r[l]}}if(o.set.call(this,t),i)for(t=0;t<i.length;t++)u(e,i[t])}}})}var e=nt;r(Node.prototype,"insertBefore",function(t,o){if(t instanceof DocumentFragment){var i=Array.prototype.slice.apply(t.childNodes);if(t=D.call(this,t,o),n(this))for(o=0;o<i.length;o++)h(e,i[o]);return t}return i=n(t),o=D.call(this,t,o),i&&u(e,t),n(this)&&h(e,t),o}),r(Node.prototype,"appendChild",function(t){if(t instanceof DocumentFragment){var o=Array.prototype.slice.apply(t.childNodes);if(t=k.call(this,t),n(this))for(var i=0;i<o.length;i++)h(e,o[i]);return t}return o=n(t),i=k.call(this,t),o&&u(e,t),n(this)&&h(e,t),i}),r(Node.prototype,"cloneNode",function(t){return t=S.call(this,!!t),this.ownerDocument.__CE_hasRegistry?p(e,t):c(e,t),t}),r(Node.prototype,"removeChild",function(t){var o=n(t),i=T.call(this,t);return o&&u(e,t),i}),r(Node.prototype,"replaceChild",function(t,o){if(t instanceof DocumentFragment){var i=Array.prototype.slice.apply(t.childNodes);if(t=A.call(this,t,o),n(this))for(u(e,o),o=0;o<i.length;o++)h(e,i[o]);return t}i=n(t);var r=A.call(this,t,o),a=n(this);return a&&u(e,o),i&&u(e,t),a&&h(e,t),r}),L&&L.get?t(Node.prototype,L):l(e,function(e){t(e,{enumerable:!0,configurable:!0,get:function(){for(var t=[],e=0;e<this.childNodes.length;e++)t.push(this.childNodes[e].textContent);return t.join("")},set:function(t){for(;this.firstChild;)T.call(this,this.firstChild);k.call(this,document.createTextNode(t))}})})}(),function(){function t(t,e){Object.defineProperty(t,"innerHTML",{enumerable:e.enumerable,configurable:!0,get:e.get,set:function(t){var o=this,r=void 0;if(n(this)&&(r=[],i(this,function(t){t!==o&&r.push(t)})),e.set.call(this,t),r)for(var l=0;l<r.length;l++){var s=r[l];1===s.__CE_state&&a.disconnectedCallback(s)}return this.ownerDocument.__CE_hasRegistry?p(a,this):c(a,this),t}})}function e(t,e){r(t,"insertAdjacentElement",function(t,o){var i=n(o);return t=e.call(this,t,o),i&&u(a,o),n(t)&&h(a,o),t})}function o(t,e){function n(t,e){for(var n=[];t!==e;t=t.nextSibling)n.push(t);for(e=0;e<n.length;e++)p(a,n[e])}r(t,"insertAdjacentHTML",function(t,o){if("beforebegin"===(t=t.toLowerCase())){var i=this.previousSibling;e.call(this,t,o),n(i||this.parentNode.firstChild,this)}else if("afterbegin"===t)i=this.firstChild,e.call(this,t,o),n(this.firstChild,i);else if("beforeend"===t)i=this.lastChild,e.call(this,t,o),n(i||this.firstChild,null);else{if("afterend"!==t)throw new SyntaxError("The value provided ("+String(t)+") is not one of 'beforebegin', 'afterbegin', 'beforeend', or 'afterend'.");i=this.nextSibling,e.call(this,t,o),n(this.nextSibling,i)}})}var a=nt;j&&r(Element.prototype,"attachShadow",function(t){return this.__CE_shadowRoot=j.call(this,t)}),M&&M.get?t(Element.prototype,M):G&&G.get?t(HTMLElement.prototype,G):l(a,function(e){t(e,{enumerable:!0,configurable:!0,get:function(){return S.call(this,!0).innerHTML},set:function(t){var e="template"===this.localName,n=e?this.content:this,o=g.call(document,this.namespaceURI,this.localName);for(o.innerHTML=t;0<n.childNodes.length;)T.call(n,n.childNodes[0]);for(t=e?o.content:o;0<t.childNodes.length;)k.call(n,t.childNodes[0])}})}),r(Element.prototype,"setAttribute",function(t,e){if(1!==this.__CE_state)return x.call(this,t,e);var n=H.call(this,t);x.call(this,t,e),e=H.call(this,t),a.attributeChangedCallback(this,t,n,e,null)}),r(Element.prototype,"setAttributeNS",function(t,e,n){if(1!==this.__CE_state)return R.call(this,t,e,n);var o=F.call(this,t,e);R.call(this,t,e,n),n=F.call(this,t,e),a.attributeChangedCallback(this,e,o,n,t)}),r(Element.prototype,"removeAttribute",function(t){if(1!==this.__CE_state)return O.call(this,t);var e=H.call(this,t);O.call(this,t),null!==e&&a.attributeChangedCallback(this,t,e,null,null)}),r(Element.prototype,"removeAttributeNS",function(t,e){if(1!==this.__CE_state)return P.call(this,t,e);var n=F.call(this,t,e);P.call(this,t,e);var o=F.call(this,t,e);n!==o&&a.attributeChangedCallback(this,e,n,o,t)}),J?e(HTMLElement.prototype,J):W?e(Element.prototype,W):console.warn("Custom Elements: `Element#insertAdjacentElement` was not patched."),K?o(HTMLElement.prototype,K):I?o(Element.prototype,I):console.warn("Custom Elements: `Element#insertAdjacentHTML` was not patched."),Y(a,Element.prototype,{g:z,append:B}),function(t){function e(e){return function(o){for(var i=[],r=0;r<arguments.length;++r)i[r]=arguments[r];r=[];for(var a=[],l=0;l<i.length;l++){var c=i[l];if(c instanceof Element&&n(c)&&a.push(c),c instanceof DocumentFragment)for(c=c.firstChild;c;c=c.nextSibling)r.push(c);else r.push(c)}for(e.apply(this,i),i=0;i<a.length;i++)u(t,a[i]);if(n(this))for(i=0;i<r.length;i++)(a=r[i])instanceof Element&&h(t,a)}}var o=Element.prototype;void 0!==U&&(o.before=e(U)),void 0!==U&&(o.after=e(V)),void 0!==X&&r(o,"replaceWith",function(e){for(var o=[],i=0;i<arguments.length;++i)o[i]=arguments[i];i=[];for(var r=[],a=0;a<o.length;a++){var l=o[a];if(l instanceof Element&&n(l)&&r.push(l),l instanceof DocumentFragment)for(l=l.firstChild;l;l=l.nextSibling)i.push(l);else i.push(l)}for(a=n(this),X.apply(this,o),o=0;o<r.length;o++)u(t,r[o]);if(a)for(u(t,this),o=0;o<i.length;o++)(r=i[o])instanceof Element&&h(t,r)}),void 0!==$&&r(o,"remove",function(){var e=n(this);$.call(this),e&&u(t,this)})}(a)}(),document.__CE_hasRegistry=!0;var ot=new b(nt);Object.defineProperty(window,"customElements",{configurable:!0,enumerable:!0,value:ot})}var it=window.document;function rt(){window.WebComponents.ready=!0,window.document.dispatchEvent(new CustomEvent("WebComponentsReady",{bubbles:!0}))}window.WebComponents=window.WebComponents||{},"loading"!==it.readyState?rt():it.addEventListener("readystatechange",function t(){rt(),it.removeEventListener("readystatechange",t)})}).call(this);