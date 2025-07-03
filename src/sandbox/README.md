### Web security model prototype

Prototype of a virtualized web app environment. The goal is to decouple apps from the concept of an origin (as in browser same-origin-policy). The benefit would be giving end users more control over their data and privacy. 

The main approach to virtualization is overriding the browser global objects syntactically or programmatically where necessary. This is used to modify or block any API that allows network or storage access so apps can be isolated while safely sharing data.

- [Detailed security model here](https://docs.bintoca.com/security/model)

The dev server in this repo is capable of loading and transforming JS, CSS and WASM in a way that blocks all storage and network IO (while still allowing DOM access). The deployment model assumes bundling dependencies and publishing as a single npm package.