### CBOR encoder/decoder

- Spec compliant (RFC8949) CBOR codec
- Supports streaming for both Node streams and WHATWG streams
- Can incrementally encode and stream large objects with back pressure
- Can roundtrip all JS datatypes that IndexedDB can serialize (was conceived as part a sync framework for above web security prototype)
- Heavily modularized - all logic is broken out into small public functions that allow building custom CBOR codecs. The streaming portions are so flexible they can even be reused with a codec that isn't CBOR at all.