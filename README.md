## lib

monorepo for bintoca libraries and prototypes

## Web security model prototype

Work in progress toward a virtualized web app environment. The goal is to decouple apps from the concept of an origin (as in browser same-origin-policy). The benefit would be giving end users more control over their data and privacy. 

The main approach to virtualization is overriding the browser global objects syntactically or programmatically where necessary. This is used to modify or block any API that allows network or storage access so apps can be isolated while safely sharing data.

- [Detailed security model here](https://docs.bintoca.com/security/model)

The dev server in this repo is currently capable of loading and transforming JS, CSS and WASM in a way that blocks all storage and network IO (while still allowing DOM access). The deployment model assumes bundling dependencies and publishing as a single npm package.

### Possible future directions

- Multi-app configuration and permissions management
- Managed storage (IndexedDB that syncs)
- Network routing and aliasing
- Platform managed identity and authentication

### dev server test

1. `npm install`
1. `npm run build`
1. `cd src/dev/test1`
1. `npm run server` - this should start a server listening on port 3000

## CBOR encoder/decoder

- Spec compliant (RFC8949) CBOR codec
- Supports streaming for both Node streams and WHATWG streams
- Can incrementally encode and stream large objects with back pressure
- Can roundtrip all JS datatypes that IndexedDB can serialize (was conceived as part a sync framework for above web security prototype)
- Heavily modularized - all logic is broken out into small public functions that allow building custom CBOR codecs. The streaming portions are so flexible they can even be reused with a codec that isn't CBOR at all.

## License
Apache-2.0 WITH LLVM-exception
