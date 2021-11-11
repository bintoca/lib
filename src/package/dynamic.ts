import primordials from "@bintoca/package/primordial"
const { ObjectCreate } = primordials
function imp() { }
imp.meta = ObjectCreate(null)
export default imp