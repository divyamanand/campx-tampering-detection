import { readFileSync } from "node:fs";
import { prepareZXingModule } from "zxing-wasm/reader";

prepareZXingModule({
  overrides: {
    wasmBinary: readFileSync("../../assets/wasm/zxing_reader.wasm")
      .buffer as ArrayBuffer,
  },
});