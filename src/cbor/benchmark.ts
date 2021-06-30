import { spawn } from 'child_process'
import fs from 'fs'

function bench(f, newCode) {
    let ff = fs.readFileSync(f, 'utf-8')
    const autoGenMark = ff.indexOf('//bintoca auto gen')
    if (autoGenMark > 0) {
        ff = ff.substring(0, autoGenMark)
    }
    ff += '//bintoca auto gen\n' + newCode
    fs.writeFileSync(f, ff)
    const p = spawn('node', [f])
    p.stdout.on('data', (data) => {
        console.log(data.toString().trim());
    });

    p.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    return new Promise((resolve, reject) => {
        p.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            resolve(code)
        });
    })
}
async function go() {
    await bench('./node_modules/cbor-x/tests/benchmark.cjs', `import('../../../packages/cbor/node.js').then(x=>{
    const enc = new x.Encoder({ useRecursion:true, newBufferSize:8192,minViewSize:2048 })
    buf = bench('buf = require("@bintoca/cbor").encode(obj);', enc.encode, data);
    //obj = bench('obj = require("@bintoca/cbor").decode(buf);', cbor.decode, buf);
    //test(obj);
    })`)

    await bench('./node_modules/cbor-x/tests/benchmark-stream.cjs', `import('../../../packages/cbor/node.js').then(x=>{
        function be(callback) {
            var stream = new x.Encoder()
            var cnt = counter(callback);
            stream.on("data", cnt.inc);
            stream.on('error', (e) => console.error(e))
            stream.on("end", cnt.end);
            for (var j = 0; j < opcount; j++) {
              stream.write(data);
            }
            stream.end();
          }
          list.push(['bintoca encode;', be])
    })`)

}
go()