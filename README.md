## lib

monorepo for bintoca libraries

## Summary

Work in progess toward a virtualized web app environement. The goal is to decouple apps from the concept of an origin (as in browser same-origin-policy). The benefit would be giving end users more control over their data and privacy. 

The main approach to virtualization is overriding the browser global objects syntactically or programmatically where nessesary. This is used to modify or block any API that allows network or storage access so apps can be isolated while safely sharing data.

- [Detailed security model here](https://docs.bintoca.com/security/model)

The dev server in this repo is currently capable of loading and transforming JS, CSS and WASM in a way that blocks all storage and network IO (while still allowing DOM access). The deployment model assumes bundling dependencies and publishing as a single npm package.

### Future

- Multi-app configuration and permissions management
- Managed storage (IndexedDB that syncs)
- Network routing and aliasing
- Platform managed identity and authentication

## dev server test

1. `npm install`
1. `npm run build`
1. `cd src/dev/test1`
1. `npm run server` - this should start a server listening on port 3000

## License
Apache-2.0 WITH LLVM-exception
